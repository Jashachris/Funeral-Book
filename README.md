# Funeral Book

Minimal zero-dependency Node.js app to store simple funeral records.

## 📖 Product Development Plan

For comprehensive product planning documentation, see:
- **[PRODUCT_PLAN.md](PRODUCT_PLAN.md)** - Complete product development plan (mission, personas, features, tech stack, go-to-market strategy)
- **[Quick Start Guide](docs/QUICK_START_GUIDE.md)** - Quick reference for navigating the product plan

The product plan includes:
- Mission statement and user personas
- Privacy & permanence policy
- MVP and post-MVP feature roadmap
- Design & UX guidelines with accessibility requirements
- Tech stack options (fast startup vs. scalable)
- 8-sprint build plan with detailed tasks
- Legal, safety, and moderation requirements
- Go-to-market and monetization strategy
- 90-day detailed timeline

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

Moderation & privacy

- Registration supports public or private accounts. When creating a user you can include the optional `private` boolean in the register payload. Example:

```bash
# create a private account
curl -X POST -H "Content-Type: application/json" \
	-d '{"username":"alice","password":"secret","private":true}' \
	http://localhost:3000/api/users
```

- Blocking users

	- POST /api/users/block — authenticated. JSON body: { "targetId": 123 }
		- Returns: { "blocked": true }
	- POST /api/users/unblock — authenticated. JSON body: { "targetId": 123 }
		- Returns: { "blocked": false }

	Example (block user id 2):

```bash
curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
	-d '{"targetId":2}' http://localhost:3000/api/users/block
```

- Reporting abusive users

	- POST /api/report — authenticated. JSON body: { "targetUserId": 123, "categories": ["harassment","sexism"], "detail": "optional text" }
		- Allowed categories: harassment, bullying, sexism, racism, derogatory, hate
		- Returns: { "reported": true, "id": <reportId> }

Share the app globally

If you want to let people worldwide access a local development instance quickly, there's a simple command added:

```bash
# start and expose the app (uses ngrok if NGROK_AUTH_TOKEN set, otherwise localtunnel via npx)
npm run share
```

Notes:
- `npm run share` will start the server (if not already running) and attempt to expose it using `npx ngrok` (preferred) or `npx localtunnel` as a fallback.
- To use ngrok without interactive login, set `NGROK_AUTH_TOKEN` in your environment:

```bash
export NGROK_AUTH_TOKEN=your_token_here
npm run share
```

If you prefer another tunnel provider I can add direct integrations (e.g., Cloudflare Tunnel, Serveo) or produce a Docker deployment for cloud hosting.
	Example:

```bash
curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
	-d '{"targetUserId":2,"categories":["harassment"],"detail":"Repeated insults"}' \
	http://localhost:3000/api/report
```

- How privacy and moderation are handled

	- Private accounts: posts created by users with `private: true` are only visible to the account owner (requests authenticated as that user). `GET /api/posts` will filter private users' posts unless you are the owner.
	- Blocking: a blocker record is stored in `data.json` under `blocks`. Currently blocking is recorded but only post visibility is impacted via the privacy model; enforcement in chat and other surfaces can be added later.
	- Reporting: reports are stored in `data.json` under `reports`. In production you'd forward reports to a moderation workflow, rate-limit submissions, and add admin endpoints for review.

Notes

- The moderation features are intentionally lightweight and stored in `data.json`. For production use consider moving reports and blocks to a proper database, adding rate limits, notification hooks for moderators, and stronger enforcement of blocks across chat and profile endpoints.

Docker

Build and run with Docker:

```bash
docker build -t funeral-book .
docker run -p 3000:3000 funeral-book
```


Examples

Register / Login (placeholder endpoints — not implemented in scaffold yet):

```bash
# register (example)
curl -X POST -H "Content-Type: application/json" -d '{"username":"bob","password":"secret"}' http://localhost:3000/api/users/register

# login -> returns a token
curl -X POST -H "Content-Type: application/json" -d '{"username":"bob","password":"secret"}' http://localhost:3000/api/users/login
```

Create a post (attach a video URL):

```bash
curl -X POST -H "Content-Type: application/json" -d '{"title":"In loving memory","body":"A short message","videoUrl":"https://..."}' http://localhost:3000/api/posts
```

Instant messaging (SSE client):

```bash
# Open a live SSE stream in terminal
curl http://localhost:3000/api/chat/stream

# Send a chat message
curl -X POST -H "Content-Type: application/json" -d '{"user":"bob","message":"hello"}' http://localhost:3000/api/chat/send
```

Go live (get a stream key placeholder):

```bash
curl -X POST -H "Content-Type: application/json" -d '{"user":"bob"}' http://localhost:3000/api/live/start
```

Advanced features (implemented in scaffold)

- Tagging: posts accept a `tags` array and `mentions` array (usernames) in the POST body.
- Group chats: SSE chat supports a `room` query parameter. Examples:

	- Open room stream:
		curl "http://localhost:3000/api/chat/stream?room=grief-group-1"
	- Send to room:
		curl -X POST -H "Content-Type: application/json" -d '{"user":"bob","message":"hi group"}' "http://localhost:3000/api/chat/send?room=grief-group-1"

PWA & background music

- A simple `manifest.json` is included. You can add `music.mp3` at `/public/music.mp3` and users can toggle background music from the UI.

Mobile packaging to Play Store / App Store

- Packaging a web app for mobile stores typically requires a wrapper (e.g., Capacitor, Cordova, or a native shell). This scaffold is the web backend + frontend foundation. If you want, I can:
	- Create a Capacitor project and configure Android/iOS builds, or
	- Generate a Progressive Web App (PWA) build and provide guidance to publish to Play Store as a Trusted Web Activity (TWA).


