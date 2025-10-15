# Uploads Directory

This directory is used for local file storage during development.

## Purpose

- Stores user-uploaded files (images, videos, documents)
- Keeps uploaded content separate from the codebase
- Git-ignored to prevent committing large binary files

## Development

In development mode, files are stored directly in this directory. The directory structure is:

```
uploads/
  └── [uploaded files will appear here]
```

## Production

For production deployments, consider using:
- Cloud storage services (AWS S3, Google Cloud Storage, Azure Blob Storage)
- CDN for serving uploaded media
- Proper file validation and virus scanning

## Notes

- This directory and its contents are ignored by git (see `.gitignore`)
- The directory is created automatically if it doesn't exist
- Make sure proper permissions are set for the web server to write to this directory
