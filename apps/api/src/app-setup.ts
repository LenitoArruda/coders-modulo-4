import type { INestApplication } from "@nestjs/common";

import { loadEnv, type Env } from "./modules/shared/config/env";
import { requestLoggingMiddleware } from "./modules/shared/logging/request-logging.middleware";

export function configureApp(app: INestApplication, env: Env = loadEnv()): Env {
  app.use(requestLoggingMiddleware);
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      const isAllowed = !origin || origin === env.webOrigin;

      callback(null, isAllowed);
    },
    methods: ["GET", "HEAD", "OPTIONS"],
  });

  return env;
}
