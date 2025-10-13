Package Instructions — Prepare PDFs and ZIP for Filing

1) Fill in missing information
- Provide correspondence address and sign the cover sheet and assignment.
- Optionally create simple drawings (PNG/PDF) showing architecture and sequence flows.

2) Convert Markdown files to PDF
- If you have `pandoc` installed, you can convert the markdown files to PDF:

```bash
pandoc patent/PROVISIONAL_DRAFT.md -o patent/PROVISIONAL_DRAFT.pdf
pandoc patent/INVENTOR_ASSIGNMENT.md -o patent/INVENTOR_ASSIGNMENT.pdf
pandoc patent/COVER_SHEET.md -o patent/COVER_SHEET.pdf
pandoc patent/CLAIMS.md -o patent/CLAIMS.pdf
pandoc patent/SEARCH_QUERIES.md -o patent/SEARCH_QUERIES.pdf
```

- Alternatively, print-to-PDF from a Markdown editor or use LibreOffice.

3) Create a ZIP package for counsel or for your records

```bash
zip -r provisional_package.zip patent/*.pdf patent/drawings/*
```

4) Sign where required
- Print the PDFs that need handwritten signatures (assignment, cover sheet), sign, then re-scan or photograph and replace the unsigned PDF with the signed image-based PDF.

5) Filing
- Upload the PDFs with Patent Center (https://patentcenter.uspto.gov/) or provide them to your attorney to file.

Notes
- A provisional application can be filed without claims, but more detailed disclosures are stronger. Include example flows and pseudo-code if helpful.
- Keep a copy of the filing receipt; it establishes the priority date.

If you want, I can produce the PDF files for you here (placeholders) and prepare the ZIP, but I will need the completed cover sheet and signed assignment (images or PDFs) to include final signed versions.
