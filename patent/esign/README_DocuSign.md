# DocuSign Envelope Instructions

Files included:

- `../ready_for_esign/COVER_SHEET_for_esign.pdf`
- `../ready_for_esign/INVENTOR_ASSIGNMENT_for_esign.pdf`
- `Docusign_ENVELOPE_RECIPIENTS.csv` (this file)

Step-by-step to create an envelope in DocuSign (Web UI):

1. Log in to your DocuSign account (https://www.docusign.com).
2. From the dashboard, click **New** → **Send an Envelope**.
3. Upload the two PDFs above.
4. Click **Add Recipients** and either:
   - Manually enter the recipient names and emails from `Docusign_ENVELOPE_RECIPIENTS.csv`, or
   - Use the **Import** option to upload the CSV (if your DocuSign plan supports CSV import for bulk recipients).
5. Set signing order to 1 for Jashaad and 2 for Christine.
6. For each document page, drag and drop the **Signature** field to match the signature boxes we placed. The fields are labeled `Sign_Jashaad` and `Sign_Christine` as text fields — replace them with signature fields if DocuSign doesn't auto-detect.
7. Optionally add **Date Signed** fields next to each signature.
8. Add an email subject and message (example below) and click **Send**.

Suggested email subject and message:

Subject: Funeral-Book Provisional Filing — Signature Request

Message:
Please review and sign the attached provisional filing documents (Cover Sheet and Inventor Assignment). Signer 1: Jashaad Gulifield (order 1). Signer 2: Christine Grant (order 2). Thank you.

Notes & tips:
- If DocuSign does not automatically map the text fields we added, manually place signature fields where appropriate.
- If you prefer Adobe Sign or HelloSign, the same steps apply: upload PDFs, add recipients, drag signature fields, and send.

If you want, I can also generate a DocuSign CSV with Role and routing metadata specific to the DocuSign bulk import schema — tell me and I'll produce that.
DocuSign envelope instructions

Files to upload:
- `patent/signed/ready_for_esign/docusign_fields/COVER_SHEET_docusign.pdf`
- `patent/signed/ready_for_esign/docusign_fields/INVENTOR_ASSIGNMENT_docusign.pdf`
- `patent/esign/Docusign_ENVELOPE_RECIPIENTS.csv` (CSV template for recipients)

Steps:
1. Log in to your DocuSign account.
2. Select "New" → "Send an Envelope".
3. Upload both PDFs listed above.
4. Choose "Use a CSV list to add recipients" and upload `Docusign_ENVELOPE_RECIPIENTS.csv` (or enter recipients manually).
5. For each document, drag signature fields to the visible text-field placeholders labeled `Sign_Jashaad` and `Sign_Christine`.
   - Assign the `Sign_Jashaad` fields to role `Signer` for the recipient Jashaad (routing order 1).
   - Assign the `Sign_Christine` fields to role `Signer` for the recipient Christine (routing order 2).
6. Set signing order to 1 → 2 so Jashaad signs first, then Christine.
7. Review the envelope, set authentication options if desired, and send.

Notes:
- Replace the placeholder emails in the CSV with the real signer email addresses before uploading.
- If you prefer simultaneous signing, set both recipients to routing order 1.
- If you use Adobe Sign or HelloSign, the same PDFs should work; those services will detect the text fields as form fields that can be mapped to signature tabs.
