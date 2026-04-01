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

Réponds UNIQUEMENT avec le JSON, sans markdown, sans commentaire.

{
  "supplierName": "Le nom complet du fournisseur tel qu'il apparaît sur le document",
  "invoiceNumber": "Le numéro de facture",
  "date": "La date du document au format YYYY-MM-DD",
  "totalHT": "Le montant HT",
  "totalTTC": "Le montant TTC",
  "tvaAmount": "Le montant de TVA"
}

Si un champ n'est pas visible ou lisible, mets null.`

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

    return {
      date: parsed.date || undefined,
      fixedPart: parsed.supplierName || undefined,
      adjustablePart: parsed.invoiceNumber || undefined,
      rawText: textBlock.text
    }
  } catch (err) {
    console.error('AI extraction error:', err)
    return null
  }
}
