import type { INestApplication } from "@nestjs/common";

import {
  CORS_ALLOWED_HEADERS,
  CORS_METHODS,
  isAllowedCorsOrigin,
} from "./modules/shared/config/cors";
import { loadEnv, type Env } from "./modules/shared/config/env";
import { notFoundOutsidePrefixMiddleware } from "./modules/shared/interface/not-found.middleware";
import { requestLoggingMiddleware } from "./modules/shared/logging/request-logging.middleware";

export const API_PREFIX = "api/v1";

export function configureApp(app: INestApplication, env: Env = loadEnv()): Env {
  app.use(requestLoggingMiddleware);
  app.setGlobalPrefix(API_PREFIX);
  app.use(notFoundOutsidePrefixMiddleware(API_PREFIX));
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      callback(null, isAllowedCorsOrigin(origin, env.webOrigin));
    },
    methods: [...CORS_METHODS],
    allowedHeaders: [...CORS_ALLOWED_HEADERS],
  });

  return env;
}
