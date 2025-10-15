# External Media URLs for Memorials

This feature allows you to attach external media URLs (photos, videos, documents, etc.) to memorial pages without uploading the files directly to the server.

## API Endpoint

### POST `/api/memorials/:id/media`

Add an external media URL to a memorial.

**Request Body:**
```json
{
  "url": "https://example.com/photo.jpg",
  "type": "photo"
}
```

**Parameters:**
- `url` (required): The external URL of the media (must use http or https protocol)
- `type` (optional): The type of media (e.g., "photo", "video", "document", "link"). Defaults to "link"

**Response:**
```json
{
  "id": 1,
  "memorialId": 1,
  "url": "https://example.com/photo.jpg",
  "type": "photo",
  "external": true,
  "createdAt": "2025-10-15T02:00:00.000Z"
}
```

**Validation:**
- URL format is validated (must be a valid HTTP/HTTPS URL)
- A HEAD request is attempted to verify the URL is reachable
- Network errors are handled gracefully - URLs are accepted even if validation fails due to network issues
- Only HTTP 4xx/5xx responses from the target server will reject the URL

**Error Responses:**
- `400 Bad Request`: Invalid URL format, missing URL, or invalid protocol
- `404 Not Found`: Memorial does not exist

## GET Endpoint

### GET `/api/memorials/:id`

Retrieve a memorial with all its associated media.

**Response:**
```json
{
  "id": 1,
  "name": "John Doe",
  "note": "Beloved father and grandfather. 1945-2023.",
  "createdAt": "2025-10-15T01:54:47.835Z",
  "media": [
    {
      "id": 1,
      "memorialId": 1,
      "url": "https://example.com/photo.jpg",
      "type": "photo",
      "external": true,
      "createdAt": "2025-10-15T02:00:00.000Z"
    }
  ]
}
```

## Examples

### Adding a photo
```bash
curl -X POST http://localhost:3000/api/memorials/1/media \
  -H "Content-Type: application/json" \
  -d '{"url": "https://photos.example.com/memorial.jpg", "type": "photo"}'
```

### Adding a video
```bash
curl -X POST http://localhost:3000/api/memorials/1/media \
  -H "Content-Type: application/json" \
  -d '{"url": "https://videos.example.com/tribute.mp4", "type": "video"}'
```

### Adding a document
```bash
curl -X POST http://localhost:3000/api/memorials/1/media \
  -H "Content-Type: application/json" \
  -d '{"url": "https://docs.example.com/obituary.pdf", "type": "document"}'
```

### Retrieving memorial with media
```bash
curl http://localhost:3000/api/memorials/1
```

## Use Cases

1. **Link to external photo services**: Users can reference photos hosted on services like Google Photos, Flickr, or personal websites
2. **Video tributes**: Link to memorial videos hosted on YouTube, Vimeo, or other video platforms
3. **Documents**: Link to obituaries, eulogies, or other documents hosted elsewhere
4. **Social media content**: Reference memorial content shared on social platforms
5. **Cloud storage**: Link to files stored in cloud services like Dropbox, Google Drive, etc.

## Notes

- All media added via this endpoint is marked as `external: true`
- The server does not download or store the actual media files
- URLs are validated but the actual content is not verified
- The media remains available as long as the external URL is accessible
