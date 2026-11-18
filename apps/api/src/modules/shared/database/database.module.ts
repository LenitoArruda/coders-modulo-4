import {
  Global,
  Inject,
  Injectable,
  Module,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { Pool } from "pg";

import { loadEnv } from "../config/env";
import { log } from "../observability/app-logger";

import { DATABASE_POOL } from "./database.tokens";

/** Maximum number of pooled connections shared by every repository. */
export const DATABASE_POOL_MAX = 10;

/** Closes the pool once Nest finishes shutting down the application. */
@Injectable()
export class DatabaseLifecycle implements OnApplicationShutdown {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}

/**
 * Provides a single `pg` pool built from `DATABASE_URL`. Global so feature
 * modules can inject the pool without re-exporting it through every layer.
 */
@Global()
@Module({
  providers: [
    {
      provide: DATABASE_POOL,
      useFactory: (): Pool => {
        const pool = new Pool({
          connectionString: loadEnv().databaseUrl,
          max: DATABASE_POOL_MAX,
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 10_000,
        });

        // Idle clients can emit `error` (e.g. the server restarted); logging it
        // keeps the process alive instead of crashing on an unhandled event.
        pool.on("error", (error: Error & { code?: string }) => {
          log("error", "Erro em conexão ociosa do PostgreSQL", {
            code: error.code ?? "unknown",
          });
        });

        return pool;
      },
    },
    DatabaseLifecycle,
  ],
  exports: [DATABASE_POOL],
})
export class DatabaseModule {}
