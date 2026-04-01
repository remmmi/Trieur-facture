const { PDFDocument, rgb, StandardFonts } = require('pdf-lib')
const { writeFileSync, mkdirSync } = require('fs')
const { join } = require('path')

async function createTestPdf() {
  const dir = join(__dirname, '..', 'test-data')
  mkdirSync(dir, { recursive: true })

  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const page = pdfDoc.addPage([595, 842]) // A4
  const { height } = page.getSize()

  // Header
  page.drawText('FACTURE N° FAC-2026-0042', {
    x: 50, y: height - 60, size: 22, font: boldFont, color: rgb(0.1, 0.1, 0.4)
  })

  page.drawText('Date: 15/03/2026', {
    x: 50, y: height - 90, size: 12, font, color: rgb(0.3, 0.3, 0.3)
  })

  // Separator
  page.drawRectangle({
    x: 50, y: height - 110, width: 495, height: 1, color: rgb(0.7, 0.7, 0.7)
  })

  // Supplier info
  page.drawText('FOURNISSEUR:', {
    x: 50, y: height - 140, size: 11, font: boldFont, color: rgb(0.2, 0.2, 0.2)
  })
  page.drawText('EDF Entreprises', {
    x: 50, y: height - 158, size: 11, font, color: rgb(0.3, 0.3, 0.3)
  })
  page.drawText('22-30 Avenue de Wagram', {
    x: 50, y: height - 174, size: 10, font, color: rgb(0.4, 0.4, 0.4)
  })
  page.drawText('75008 Paris', {
    x: 50, y: height - 190, size: 10, font, color: rgb(0.4, 0.4, 0.4)
  })

  // Client info
  page.drawText('CLIENT:', {
    x: 350, y: height - 140, size: 11, font: boldFont, color: rgb(0.2, 0.2, 0.2)
  })
  page.drawText('Mon Entreprise SARL', {
    x: 350, y: height - 158, size: 11, font, color: rgb(0.3, 0.3, 0.3)
  })
  page.drawText('15 Rue de la Paix', {
    x: 350, y: height - 174, size: 10, font, color: rgb(0.4, 0.4, 0.4)
  })
  page.drawText('69001 Lyon', {
    x: 350, y: height - 190, size: 10, font, color: rgb(0.4, 0.4, 0.4)
  })

  // Table header
  const tableTop = height - 240
  page.drawRectangle({
    x: 50, y: tableTop - 5, width: 495, height: 25, color: rgb(0.15, 0.15, 0.35)
  })
  page.drawText('Description', {
    x: 60, y: tableTop, size: 10, font: boldFont, color: rgb(1, 1, 1)
  })
  page.drawText('Qté', {
    x: 320, y: tableTop, size: 10, font: boldFont, color: rgb(1, 1, 1)
  })
  page.drawText('Prix HT', {
    x: 380, y: tableTop, size: 10, font: boldFont, color: rgb(1, 1, 1)
  })
  page.drawText('Total HT', {
    x: 470, y: tableTop, size: 10, font: boldFont, color: rgb(1, 1, 1)
  })

  // Table rows
  const rows = [
    ['Abonnement électricité - Mars 2026', '1', '45,00 €', '45,00 €'],
    ['Consommation kWh (1 240 kWh)', '1', '198,40 €', '198,40 €'],
    ['Contribution au service public (CSPE)', '1', '27,90 €', '27,90 €'],
    ['Taxe sur la consommation finale', '1', '12,50 €', '12,50 €'],
  ]

  rows.forEach((row, i) => {
    const y = tableTop - 30 - i * 22
    if (i % 2 === 0) {
      page.drawRectangle({
        x: 50, y: y - 5, width: 495, height: 22, color: rgb(0.95, 0.95, 0.97)
      })
    }
    page.drawText(row[0], { x: 60, y, size: 9, font, color: rgb(0.2, 0.2, 0.2) })
    page.drawText(row[1], { x: 328, y, size: 9, font, color: rgb(0.2, 0.2, 0.2) })
    page.drawText(row[2], { x: 380, y, size: 9, font, color: rgb(0.2, 0.2, 0.2) })
    page.drawText(row[3], { x: 470, y, size: 9, font, color: rgb(0.2, 0.2, 0.2) })
  })

  // Totals
  const totalsY = tableTop - 140
  page.drawRectangle({
    x: 350, y: totalsY - 60, width: 195, height: 80, color: rgb(0.96, 0.96, 0.98)
  })
  page.drawText('Total HT:', { x: 360, y: totalsY, size: 11, font, color: rgb(0.3, 0.3, 0.3) })
  page.drawText('283,80 €', { x: 470, y: totalsY, size: 11, font: boldFont, color: rgb(0.2, 0.2, 0.2) })
  page.drawText('TVA (20%):', { x: 360, y: totalsY - 22, size: 11, font, color: rgb(0.3, 0.3, 0.3) })
  page.drawText('56,76 €', { x: 475, y: totalsY - 22, size: 11, font, color: rgb(0.2, 0.2, 0.2) })
  page.drawRectangle({
    x: 350, y: totalsY - 55, width: 195, height: 1, color: rgb(0.5, 0.5, 0.5)
  })
  page.drawText('Total TTC:', { x: 360, y: totalsY - 48, size: 13, font: boldFont, color: rgb(0.1, 0.1, 0.4) })
  page.drawText('340,56 €', { x: 465, y: totalsY - 48, size: 13, font: boldFont, color: rgb(0.1, 0.1, 0.4) })

  // Footer
  page.drawText('Conditions de paiement: 30 jours net', {
    x: 50, y: 80, size: 9, font, color: rgb(0.5, 0.5, 0.5)
  })
  page.drawText('IBAN: FR76 1234 5678 9012 3456 7890 123', {
    x: 50, y: 60, size: 9, font, color: rgb(0.5, 0.5, 0.5)
  })

  const pdfBytes = await pdfDoc.save()
  const outputPath = join(dir, 'facture-EDF-2026-03.pdf')
  writeFileSync(outputPath, pdfBytes)
  console.log(`Test PDF created: ${outputPath}`)
  return outputPath
}

createTestPdf().catch(console.error)
