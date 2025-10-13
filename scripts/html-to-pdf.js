const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

(async () => {
  try {
    const inPath = path.join(__dirname, '..', 'patent', 'printable', 'INVENTOR_ASSIGNMENT_print.html');
    const outDir = path.join(__dirname, '..', 'patent', 'signed');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, 'INVENTOR_ASSIGNMENT_print.pdf');

    const browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox']});
    const page = await browser.newPage();
    await page.goto('file://' + inPath);
    await page.pdf({path: outPath, format: 'A4', printBackground: true, margin: {top: '20mm', bottom: '20mm', left: '15mm', right: '15mm'}});
    await browser.close();
    console.log('Wrote PDF to', outPath);
  } catch (err) {
    console.error('Failed to render PDF:', err);
    process.exit(1);
  }
})();
