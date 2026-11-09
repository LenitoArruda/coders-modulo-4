import "./modules/shared/observability/telemetry";

import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import { configureApp } from "./app-setup";
import { ConfigurationError, loadEnv } from "./modules/shared/config/env";
import { JsonLogger } from "./modules/shared/logging/json-logger";
import { log } from "./modules/shared/observability/app-logger";
import { stopTelemetry } from "./modules/shared/observability/telemetry";

async function bootstrap(): Promise<void> {
  let env;

  try {
    env = loadEnv();
  } catch (error) {
    if (error instanceof ConfigurationError) {
      log("error", "Configuração de ambiente inválida", {
        missing: error.missing.join(", "),
        invalid: error.invalid.join(", "),
      });
      await stopTelemetry();
      process.exit(1);
    }

    throw error;
  }

  const app = await NestFactory.create(AppModule, {
    logger: new JsonLogger(),
  });

  configureApp(app, env);
  await app.listen(env.port);

  log("info", "API iniciada", {
    port: env.port,
    webOrigin: env.webOrigin,
  });

  const shutdown = async (): Promise<void> => {
    await app.close();
    await stopTelemetry();
    process.exit(0);
  };

  process.once("SIGINT", () => {
    void shutdown();
  });
  process.once("SIGTERM", () => {
    void shutdown();
  });
}

void bootstrap();
