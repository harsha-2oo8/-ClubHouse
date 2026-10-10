# Storage (Supabase preferred, GCS supported, Replit retired)

## Backend selection (in order)

1. **Supabase Storage** when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
   are set (preferred on Supabase deployments).
2. **GCS service account** when `GCS_*` is set.
3. Legacy Replit sidecar (Replit only).
4. Otherwise uploads return `503 File uploads are not configured`.

## Architecture

- `supabaseStorage.ts` / `gcsStorage.ts` — signed PUT URLs (15 min),
  proxied downloads, delete/exists, strict filename sanitization,
  `..` rejection, 10 MB cap, PNG/JPEG/WebP/GIF/PDF allowlist.
- Object names: `<visibility>/<uploaderClerkId>/<uuid>-<safeName>`.
  Ownership is derivable from the path — never trusted from the client
  (the server builds the name; the filename is decoration only).
  Stored paths: `/sb/<name>` (Supabase) or `/gcs/<name>` (GCS).
- `public/*` is publicly readable (avatars, logos, brochures, banners — all render
  on public pages). `private/*` requires a session of the uploader or admin.
- Upload flow: `POST /storage/uploads/request-url` (auth + rate limit +
  validation) → client PUTs bytes to the signed URL → stores `objectPath`.
  Upload requests carry the Clerk Bearer token (both the generated client
  and `useUpload` attach it).
- Serve: `GET /storage/sb/*` and `GET /storage/gcs/*` (auth/ACL as above).
  Legacy `/storage/objects/*` (Replit sidecar) returns 404 when its env is
  absent.
- Deletion: club delete removes logo/brochure; club-event delete removes
  its banner — best-effort across both backends, never fails the delete.

## Configure Supabase (Render env, SERVER ONLY)

```
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role — never frontend, never committed>
SUPABASE_STORAGE_BUCKET=clubhouse-uploads   # optional, this is the default
```

Create the bucket first (Supabase Dashboard → Storage → New bucket
`clubhouse-uploads`, public). The service_role key mints upload URLs
server-side only.

## Configure GCS instead (Render env, SERVER ONLY)

```
GCS_PROJECT_ID=
GCS_BUCKET_NAME=clubhouse-uploads
GCS_CLIENT_EMAIL=<svc>@<project>.iam.gserviceaccount.com
GCS_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
```

Create ONE bucket + ONE service account with **Storage Object Admin** on
that bucket only. Literal `\n` sequences are converted automatically.

## Migration notes

- Values stored as `/objects/…` (Replit era) are not resolvable off-Replit;
  re-upload affected assets after configuring GCS.
- Never expose bucket/key material to the frontend (`VITE_*` ban).
- Never trust client-supplied paths: all serving goes through
  `normalizeObjectName`; enumeration is impossible (UUID names).
