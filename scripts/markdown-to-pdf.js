const fs = require('fs');
const path = require('path');
const marked = require('marked');
const puppeteer = require('puppeteer');

async function renderHtmlToPdf(htmlPath, outPath) {
  const browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox']});
  const page = await browser.newPage();
  await page.goto('file://' + htmlPath);
  await page.pdf({path: outPath, format: 'A4', printBackground: true, margin: {top: '20mm', bottom: '20mm', left: '15mm', right: '15mm'}});
  await browser.close();
}

async function mdToPdf(mdFile, outPdf) {
  const md = fs.readFileSync(mdFile, 'utf8');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${path.basename(mdFile)}</title><style>body{font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; max-width:900px;margin:36px auto;padding:20px;color:#111} h1,h2,h3{color:#111} pre{background:#f5f5f5;padding:12px;border-radius:6px;overflow:auto}</style></head><body>${marked.parse(md)}</body></html>`;
  const tmpDir = path.join(__dirname, '..', 'patent', 'printable');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const htmlPath = path.join(tmpDir, path.basename(mdFile).replace(/\.md$/i, '.html'));
  fs.writeFileSync(htmlPath, html);
  await renderHtmlToPdf(htmlPath, outPdf);
}

(async () => {
  try {
    const outDir = path.join(__dirname, '..', 'patent', 'signed', 'ready_for_esign');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    // Cover sheet from markdown
    const coverMd = path.join(__dirname, '..', 'patent', 'COVER_SHEET.md');
    const coverPdf = path.join(outDir, 'COVER_SHEET_for_esign.pdf');
    await mdToPdf(coverMd, coverPdf);
    console.log('Wrote', coverPdf);

    // Inventor assignment: use the printable HTML we already made, or convert markdown
    const assignHtml = path.join(__dirname, '..', 'patent', 'printable', 'INVENTOR_ASSIGNMENT_print.html');
    const assignPdf = path.join(outDir, 'INVENTOR_ASSIGNMENT_for_esign.pdf');
    if (fs.existsSync(assignHtml)) {
      await renderHtmlToPdf(assignHtml, assignPdf);
    } else {
      const mdAssign = path.join(__dirname, '..', 'patent', 'INVENTOR_ASSIGNMENT.md');
      await mdToPdf(mdAssign, assignPdf);
    }
    console.log('Wrote', assignPdf);

    console.log('All PDFs generated in', outDir);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
