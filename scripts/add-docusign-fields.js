const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts } = require('pdf-lib');

async function addSignatureFields(inputPdf, outputPdf, fields) {
  const existingPdfBytes = fs.readFileSync(inputPdf);
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const pages = pdfDoc.getPages();
  const form = pdfDoc.getForm();

  const helvFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const f of fields) {
    const pageIndex = Math.min(f.page || 0, pages.length - 1);
    const page = pages[pageIndex];
    const { x, y, width, height, name } = f;
    // create a signature field (we'll use a text field labeled for the e-sign provider)
    const field = form.createTextField(name);
    field.setText(' ');
    field.addToPage(page, { x, y, width, height });
    field.updateAppearances(helvFont);
  }

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPdf, pdfBytes);
}

(async () => {
  try {
    const baseDir = path.join(__dirname, '..', 'patent', 'signed', 'ready_for_esign');
    const outDir = path.join(baseDir, 'docusign_fields');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const coverIn = path.join(baseDir, 'COVER_SHEET_for_esign.pdf');
    const assignIn = path.join(baseDir, 'INVENTOR_ASSIGNMENT_for_esign.pdf');

    const coverOut = path.join(outDir, 'COVER_SHEET_docusign.pdf');
    const assignOut = path.join(outDir, 'INVENTOR_ASSIGNMENT_docusign.pdf');

    const fields = [
      // signer 1 (Jashaad) signature box
      { page: 0, x: 100, y: 120, width: 220, height: 40, name: 'Sign_Jashaad' },
      // signer 2 (Christine) signature box
      { page: 0, x: 360, y: 120, width: 220, height: 40, name: 'Sign_Christine' },
    ];

    if (fs.existsSync(coverIn)) {
      await addSignatureFields(coverIn, coverOut, fields);
      console.log('Wrote', coverOut);
    }
    if (fs.existsSync(assignIn)) {
      await addSignatureFields(assignIn, assignOut, fields);
      console.log('Wrote', assignOut);
    }
    console.log('DocuSign-ready PDFs generated in', outDir);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
