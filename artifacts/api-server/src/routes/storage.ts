import { Readable } from 'stream';
import { getParam } from "../lib/params";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from '@workspace/api-zod';
import { Router, type IRouter, type Request, type Response } from 'express';

import { ObjectPermission } from '../lib/objectAcl';
import {
  ObjectNotFoundError,
  ObjectStorageService,
} from '../lib/objectStorage';
import {
  buildObjectName,
  canReadObject,
  createSignedUploadUrl,
  downloadObject,
  isGcsConfigured,
  normalizeObjectName,
  validateUploadInput,
  type ObjectVisibility,
} from '../lib/gcsStorage';
import { isAdmin } from '../lib/policy';
import { getAuth } from '@clerk/express';
import { strictWriteLimit } from '../lib/rateLimit';

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType[, visibility]) —
 * NOT the file. Then uploads the file directly to the returned presigned URL.
 * Requires auth so public callers cannot mint write-capable URLs.
 *
 * Backend selection: GCS service-account flow whenever GCS_* env is
 * configured (all non-Replit deploys); otherwise the legacy Replit sidecar
 * flow; otherwise 503 with a configuration error.
 */
router.post(
  '/storage/uploads/request-url',
  strictWriteLimit(),
  async (req: Request, res: Response) => {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });

      return;
    }

    const parsed = RequestUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Missing or invalid required fields' });
      return;
    }

    try {
      const { name, size, contentType } = parsed.data;
      const visibility = (parsed.data as { visibility?: ObjectVisibility }).visibility ?? 'public';
      if (visibility !== 'public' && visibility !== 'private') {
        res.status(400).json({ error: 'visibility must be "public" or "private"' });
        return;
      }
      try {
        validateUploadInput({ name, size, contentType });
      } catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid upload metadata' });
        return;
      }

      if (isGcsConfigured()) {
        const objectName = buildObjectName({ visibility, uploaderId: userId, fileName: name });
        const uploadURL = await createSignedUploadUrl({ objectName, contentType });
        res.json(
          RequestUploadUrlResponse.parse({
            uploadURL,
            objectPath: `/gcs/${objectName}`,
            metadata: { name, size, contentType },
          }),
        );
        return;
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath =
        objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json(
        RequestUploadUrlResponse.parse({
          uploadURL,
          objectPath,
          metadata: { name, size, contentType },
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, 'Error generating upload URL');
      const message = error instanceof Error ? error.message : '';
      if (message.startsWith('GCS_UPLOAD_NOT_CONFIGURED') || message.includes('not set')) {
        res.status(503).json({ error: 'File uploads are not configured on this server.' });
        return;
      }
      res.status(500).json({ error: 'Failed to generate upload URL' });
    }
  },
);

/**
 * GET /storage/gcs/*
 *
 * Serve objects stored via the GCS flow. `public/*` objects are openly
 * readable; `private/*` objects require a Clerk session belonging to the
 * uploader (path segment 2) or a platform admin. Traversal is rejected.
 */
router.get(
  '/storage/gcs/*path',
  async (req: Request, res: Response) => {
    try {
      const wildcardPath = getParam(req, "path");
      let objectName: string;
      try {
        objectName = normalizeObjectName(wildcardPath);
      } catch {
        res.status(400).json({ error: 'Invalid object path' });
        return;
      }
      const isPublic = objectName.startsWith('public/');
      let callerId: string | null = null;
      let admin = false;
      if (!isPublic) {
        const { userId } = getAuth(req);
        if (!userId) {
          res.status(401).json({ error: 'Unauthorized' });
          return;
        }
        callerId = userId;
        admin = await isAdmin(userId);
        if (!canReadObject(objectName, callerId, admin)) {
          res.status(403).json({ error: 'Forbidden' });
          return;
        }
      }
      const { buffer, contentType } = await downloadObject(objectName);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', String(buffer.length));
      res.setHeader('Cache-Control', `${isPublic ? 'public' : 'private'}, max-age=3600`);
      res.status(200).end(buffer);
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404) {
        res.status(404).json({ error: 'Object not found' });
        return;
      }
      req.log.error({ err: error }, 'Error serving GCS object');
      res.status(500).json({ error: 'Failed to serve object' });
    }
  },
);

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get(
  '/storage/public-objects/*filePath',
  async (req: Request, res: Response) => {
    try {
      const filePath = getParam(req, "filePath");
      if (!filePath || filePath.includes("..")) {
        res.status(400).json({ error: "Invalid file path" });
        return;
      }
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      const response = await objectStorageService.downloadObject(file);

      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));

      if (response.body) {
        const nodeStream = Readable.fromWeb(
          response.body as ReadableStream<Uint8Array>,
        );
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      req.log.error({ err: error }, 'Error serving public object');
      res.status(500).json({ error: 'Failed to serve public object' });
    }
  },
);

/**
 * GET /storage/objects/*
 *
 * LEGACY Replit-sidecar path. Requires authentication: callers must present
 * a valid Clerk session. Path traversal is rejected; object ACL metadata is
 * honored when present. On servers without the Replit sidecar env
 * (all non-Replit deploys), returns 404 — use /storage/gcs/* instead.
 */
router.get('/storage/objects/*path', async (req: Request, res: Response) => {
    try {
      const { userId } = getAuth(req);
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const wildcardPath = getParam(req, "path");
      if (!wildcardPath || wildcardPath.includes("..")) {
        res.status(400).json({ error: "Invalid object path" });
        return;
      }
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile =
      await objectStorageService.getObjectEntityFile(objectPath);

    const canAccess = await objectStorageService.canAccessObjectEntity({
      userId,
      objectFile,
      requestedPermission: ObjectPermission.READ,
    });
    if (!canAccess) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(
        response.body as ReadableStream<Uint8Array>,
      );
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, 'Object not found');
      res.status(404).json({ error: 'Object not found' });
      return;
    }
    const message = error instanceof Error ? error.message : '';
    if (message.includes('PRIVATE_OBJECT_DIR not set') || message.includes('PUBLIC_OBJECT_SEARCH_PATHS not set')) {
      res.status(404).json({ error: 'Legacy object storage is not configured on this server. Use GCS-backed uploads.' });
      return;
    }
    req.log.error({ err: error }, 'Error serving object');
    res.status(500).json({ error: 'Failed to serve object' });
  }
});

export default router;
