export interface CompteComptable {
  numero: string
  libelle: string
}

const csvData = `101,Capital social
106,Réserves
108,Compte de l'exploitant
164,Emprunts auprès des établissements de crédit
201,Frais d'établissement
205,Concessions brevets licences marques
211,Terrains
213,Constructions
215,Installations techniques matériel et outillage
218,Autres immobilisations corporelles
261,Titres de participation
271,Titres immobilisés
301,Matières premières
311,Stocks de marchandises
355,Produits finis
371,Marchandises
401,Fournisseurs
403,Fournisseurs - Effets à payer
404,Fournisseurs d'immobilisations
408,Fournisseurs - Factures non parvenues
411,Clients
413,Clients - Effets à recevoir
416,Clients douteux ou litigieux
418,Clients - Produits non encore facturés
421,Personnel - Rémunérations dues
431,Sécurité sociale
437,Autres organismes sociaux
441,État - Subventions à recevoir
443,Opérations particulières avec l'État
445,État - TVA
4456,TVA déductible
4457,TVA collectée
447,Autres impôts taxes et versements assimilés
455,Associés - Comptes courants
467,Autres comptes débiteurs ou créditeurs
471,Comptes d'attente
486,Charges constatées d'avance
487,Produits constatés d'avance
491,Provisions pour dépréciation des comptes clients
512,Banques
514,Chèques postaux
530,Caisse
580,Virements internes
601,Achats de matières premières
602,Achats d'autres approvisionnements
604,Achats d'études et prestations de services
606,Achats non stockés de matières et fournitures
6061,Fournitures non stockables (eau énergie)
6063,Fournitures d'entretien et petit équipement
6064,Fournitures administratives
607,Achats de marchandises
609,Rabais remises ristournes obtenus sur achats
611,Sous-traitance générale
613,Locations
614,Charges locatives et de copropriété
615,Entretien et réparations
616,Primes d'assurances
618,Divers (documentation séminaires colloques)
621,Personnel extérieur à l'entreprise
622,Rémunérations d'intermédiaires et honoraires
623,Publicité publications relations publiques
624,Transports de biens et transports collectifs du personnel
625,Déplacements missions et réceptions
626,Frais postaux et de télécommunications
627,Services bancaires et assimilés
628,Divers (cotisations syndicales professionnelles)
631,Impôts taxes et versements assimilés sur rémunérations
633,Impôts taxes et versements assimilés sur rémunérations (autres organismes)
635,Autres impôts taxes et versements assimilés
637,Autres impôts taxes et versements assimilés
641,Rémunérations du personnel
645,Charges de sécurité sociale et de prévoyance
646,Cotisations sociales personnelles de l'exploitant
651,Redevances pour concessions brevets licences
654,Pertes sur créances irrécouvrables
658,Charges diverses de gestion courante
661,Charges d'intérêts
665,Escomptes accordés
671,Charges exceptionnelles sur opérations de gestion
675,Valeurs comptables des éléments d'actif cédés
681,Dotations aux amortissements et provisions - Charges d'exploitation
686,Dotations aux amortissements et provisions - Charges financières
687,Dotations aux amortissements et provisions - Charges exceptionnelles
691,Participation des salariés aux résultats
695,Impôts sur les bénéfices
701,Ventes de produits finis
706,Prestations de services
707,Ventes de marchandises
708,Produits des activités annexes
709,Rabais remises ristournes accordés
713,Variation des stocks
721,Production immobilisée - Immobilisations incorporelles
722,Production immobilisée - Immobilisations corporelles
741,Subventions d'exploitation
751,Redevances pour concessions brevets licences
758,Produits divers de gestion courante
761,Produits de participations
762,Produits des autres immobilisations financières
764,Revenus des valeurs mobilières de placement
765,Escomptes obtenus
771,Produits exceptionnels sur opérations de gestion
775,Produits des cessions d'éléments d'actif
781,Reprises sur amortissements et provisions - Produits d'exploitation
786,Reprises sur provisions - Produits financiers
787,Reprises sur provisions - Produits exceptionnels`

const defaultPlan: CompteComptable[] = csvData.split('\n').map((line) => {
  const [numero, ...rest] = line.split(',')
  return { numero: numero.trim(), libelle: rest.join(',').trim() }
})

let planComptable: CompteComptable[] = defaultPlan

export { planComptable }

export async function loadPlanComptable(): Promise<void> {
  const custom = await window.api.getPlanComptable()
  if (custom && custom.length > 0) {
    planComptable = custom
  } else {
    planComptable = defaultPlan
  }
}

export function setPlanComptable(entries: CompteComptable[]): void {
  planComptable = entries
}

export function resetToDefaultPlan(): void {
  planComptable = defaultPlan
}

export function searchComptes(query: string): CompteComptable[] {
  if (!query) return planComptable.slice(0, 20)
  const q = query.toLowerCase()
  return planComptable.filter(
    (c) => c.numero.startsWith(q) || c.libelle.toLowerCase().includes(q)
  )
}
