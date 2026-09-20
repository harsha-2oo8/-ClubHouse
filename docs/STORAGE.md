# Storage (GCS on Render, legacy Replit path retired)

## Architecture

- `artifacts/api-server/src/lib/gcsStorage.ts` — service-account GCS:
  signed PUT URLs (15 min), proxied downloads, delete/exists, strict
  filename sanitization, `..` rejection, 10 MB cap, PNG/JPEG/WebP/GIF/PDF
  allowlist.
- Object names: `<visibility>/<uploaderClerkId>/<uuid>-<safeName>`.
  Ownership is derivable from the path — never trusted from the client
  (the server builds the name; the filename is decoration only).
- `public/*` serves openly (avatars, logos, brochures, banners — all render
  on public pages). `private/*` requires a session of the uploader or admin.
- Upload flow: `POST /storage/uploads/request-url` (auth + rate limit +
  validation) → client PUTs bytes to the signed URL → stores `objectPath`
  `/gcs/<name>`. Upload requests carry the Clerk Bearer token (both the
  generated client and `useUpload` attach it).
- Serve: `GET /storage/gcs/*` (auth/ACL as above). Legacy
  `/storage/objects/*` (Replit sidecar) returns 404 when its env is absent.
- Deletion: club delete removes logo/brochure; club-event delete removes
  its banner — best-effort, never fails the resource delete.

## Configure (Render env, SERVER ONLY)

```
GCS_PROJECT_ID=<gcp-project>
GCS_BUCKET_NAME=clubhouse-uploads
GCS_CLIENT_EMAIL=<svc>@<project>.iam.gserviceaccount.com
GCS_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
```

Create ONE bucket + ONE service account with **Storage Object Admin** on
that bucket only. Literal `\n` sequences are converted automatically.
Without these vars, uploads return `503 File uploads are not configured` —
everything else keeps working.

## Migration notes

- Values stored as `/objects/…` (Replit era) are not resolvable off-Replit;
  re-upload affected assets after configuring GCS.
- Never expose bucket/key material to the frontend (`VITE_*` ban).
- Never trust client-supplied paths: all serving goes through
  `normalizeObjectName`; enumeration is impossible (UUID names).
