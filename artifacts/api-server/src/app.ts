import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import { randomUUID } from "crypto";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import { logger } from "./lib/logger";
import { getConfig } from "./lib/config";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

const app: Express = express();
const config = getConfig();

// Security headers. CSP is disabled by default: /api/__clerk proxies Clerk
// frontend assets and a restrictive CSP here could break sign-in flows.
// Revisit only with an explicit allowlist (see docs/SECURITY.md).
app.use(helmet({ contentSecurityPolicy: false }));

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// Expose the request id (assigned by pino-http) so clients and logs correlate.
app.use((req: Request, res: Response, next: NextFunction) => {
  const id =
    (req as unknown as { id?: string }).id ?? randomUUID();
  (req as unknown as { id?: string }).id = id;
  res.setHeader("X-Request-ID", id);
  next();
});

// CORS: explicit allowlist when CORS_ORIGINS is set; otherwise reflect the
// request origin (dev default, production fallback with startup warning).
// Wildcard "*" is never used — credentialed auth requires explicit origins.
app.use(cors({ credentials: true, origin: config.corsOrigins ?? true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      config.clerkPublishableKey,
    ),
  })),
);

app.use("/api", router);

export default app;
