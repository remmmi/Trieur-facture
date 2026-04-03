import Anthropic from '@anthropic-ai/sdk'
import { readFile } from 'fs/promises'
import type { AiSuggestion } from './stampService'

let client: Anthropic | null = null

export function initializeAiService(apiKey: string): void {
  client = new Anthropic({ apiKey })
}

export function isAiConfigured(): boolean {
  return client !== null
}

const EXTRACTION_PROMPT = `Tu es un assistant comptable expert. Analyse cette facture/document et extrais les informations suivantes au format JSON strict.

Reponds UNIQUEMENT avec le JSON, sans markdown, sans commentaire.

{
  "supplierName": "Le nom de l'enseigne ou du fournisseur (ex: LEROY MERLIN, CARREFOUR, etc.)",
  "invoiceNumber": "Le numero de facture ou de ticket. Voir regles ci-dessous.",
  "date": "La date du document au format YYYY-MM-DD. Chercher dans l'en-tete, le pied de page, ou pres du code-barres.",
  "totalHT": "Le montant HT (souvent apres la mention HT ou dans le recapitulatif TVA)",
  "totalTTC": "Le montant TTC final paye (le TOTAL en gras, ou le montant CB/paiement)",
  "tvaAmount": "Le montant de TVA",
  "amountIsTTC": true
}

REGLE pour amountIsTTC :
- Si tu as identifie un montant TTC fiable (total paye, montant CB, etc.), mets true.
- Si tu n'as trouve qu'un montant HT (pas de TVA visible, ou mention explicite HT sans TTC), mets false.
- En cas de doute, mets true (la plupart des factures affichent un TTC).

REGLES pour invoiceNumber :
- Si c'est un ticket de caisse (reconnaissable a : format etroit/vertical, liste d'articles avec prix unitaires, codes EAN/barres, sous-totaux, mention "carte bancaire"/"CB", ticket commercant, etc.) alors mets "ticket-caisse" dans invoiceNumber.
- Si c'est une facture classique avec un numero (FAC-xxx, N° xxx, etc.) mets ce numero.
- S'il y a un numero de BVI, BVA ou numero de transaction, c'est un ticket de caisse.

Si un champ n'est pas visible ou lisible, mets null.`

export async function validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const testClient = new Anthropic({ apiKey })
    await testClient.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ok' }]
    })
    return { valid: true }
  } catch (err: unknown) {
    const error = err as { status?: number; message?: string; error?: { type?: string } }
    if (error.status === 401) return { valid: false, error: 'Cle API invalide' }
    if (
      error.status === 400 &&
      error.error?.type === 'invalid_request_error' &&
      error.message?.includes('credit')
    )
      return { valid: false, error: 'Credit epuise' }
    if (error.status === 429) return { valid: false, error: 'Rate limit atteint, reessayez' }
    if (
      error.message?.includes('fetch') ||
      error.message?.includes('ENOTFOUND') ||
      error.message?.includes('ECONNREFUSED')
    )
      return { valid: false, error: 'Erreur reseau' }
    return { valid: false, error: 'Erreur API inconnue' }
  }
}

export async function extractInvoiceData(pdfPath: string): Promise<AiSuggestion | null> {
  if (!client) return null

  try {
    const pdfBuffer = await readFile(pdfPath)
    const base64 = pdfBuffer.toString('base64')

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64
              }
            },
            {
              type: 'text',
              text: EXTRACTION_PROMPT
            }
          ]
        }
      ]
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') return null

    const parsed = JSON.parse(textBlock.text)
    console.log('[AI] Parsed result:', JSON.stringify(parsed))

    return {
      date: parsed.date || undefined,
      fixedPart: parsed.supplierName || undefined,
      adjustablePart: parsed.invoiceNumber || undefined,
      amount: parsed.totalTTC || parsed.totalHT || undefined,
      amountType: parsed.amountIsTTC === false ? 'ht' : 'ttc',
      rawText: textBlock.text
    }
  } catch (err: unknown) {
    console.error('AI extraction error:', err)

    const error = err as { status?: number; message?: string; error?: { type?: string } }

    // Credit exhausted
    if (
      error.status === 400 &&
      error.error?.type === 'invalid_request_error' &&
      error.message?.includes('credit')
    ) {
      throw new Error('AI_NO_CREDIT')
    }
    if (error.status === 429) {
      throw new Error('AI_RATE_LIMIT')
    }
    // Auth errors
    if (error.status === 401) {
      throw new Error('AI_AUTH_ERROR')
    }
    // Network / unreachable
    if (
      error.message?.includes('fetch') ||
      error.message?.includes('ENOTFOUND') ||
      error.message?.includes('ECONNREFUSED') ||
      error.message?.includes('network')
    ) {
      throw new Error('AI_NETWORK_ERROR')
    }
    // Other API errors
    if (error.status && error.status >= 400) {
      throw new Error('AI_API_ERROR')
    }

    // JSON parse or other non-API errors: return null silently
    return null
  }
}
