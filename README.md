# Funeral Book

Minimal zero-dependency Node.js app to store simple funeral records.

Quick start

1. Install Node.js (>=12). Then start the server:

	npm start

2. Open http://localhost:3000 in your browser.

Run tests

	npm test

Files added in this scaffold:

- `server.js` — simple HTTP server with API and static file serving
- `public/` — frontend files (index.html, app.js, style.css)
- `data.json` — simple file-backed JSON database (ignored by git)
- `test/test.js` — basic API tests

Notes

This scaffold intentionally avoids external dependencies for simplicity. It's suitable for local demos and as a starting point.

API

- GET /api/records — list all records
- GET /api/records/:id — get a single record by id
- POST /api/records — create a record (JSON body, { name, note? })
- PUT /api/records/:id — update fields (JSON body, { name?, note? })
- DELETE /api/records/:id — delete a record

Docker

Build and run with Docker:

```bash
docker build -t funeral-book .
docker run -p 3000:3000 funeral-book
```

