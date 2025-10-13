const fs = require('fs');
const path = require('path');
const marked = require('marked');

const srcDir = path.join(__dirname, '..', 'patent');
const outDir = path.join(srcDir, 'html');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.md'));
const css = `body{font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; max-width:900px;margin:36px auto;padding:20px;color:#111} h1,h2,h3{color:#111} pre{background:#f5f5f5;padding:12px;border-radius:6px;overflow:auto}`;

files.forEach(f => {
  const inPath = path.join(srcDir, f);
  const outPath = path.join(outDir, f.replace(/\.md$/, '.html'));
  const md = fs.readFileSync(inPath, 'utf8');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${f}</title><style>${css}</style></head><body>${marked.parse(md)}</body></html>`;
  fs.writeFileSync(outPath, html);
  console.log('wrote', outPath);
});

console.log('Done. HTML files generated at', outDir);