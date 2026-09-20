import app from "./app";
import { logger } from "./lib/logger";
import { getConfig, isTestClerkKey } from "./lib/config";

const config = getConfig();

if (config.isProduction && isTestClerkKey(config.clerkSecretKey)) {
  // Never log the key itself — shape only.
  logger.warn(
    "CLERK_SECRET_KEY looks like a development (sk_test_) key while NODE_ENV=production. " +
      "Clerk will show 'development mode' and production auth may misbehave. Use sk_live_… from a production instance.",
  );
}

app.listen(config.port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port: config.port }, "Server listening");
});
