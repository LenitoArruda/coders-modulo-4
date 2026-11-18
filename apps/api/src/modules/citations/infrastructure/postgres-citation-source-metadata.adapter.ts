import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";

import { DATABASE_POOL } from "../../shared/database/database.tokens";
import { withDbSpan } from "../../shared/observability/db-span";
import { databaseFailure } from "../../auth/infrastructure/database-error";
import {
  CitationSourceMetadataPort,
  type CitationSourceMetadata,
  type CitationSourceRef,
} from "../application/ports/citation-source-metadata.port";

type SourceRow = {
  name: string;
  type: string;
  current_version_id: string | null;
};

/** Reads only current source state; source content and file paths are not read. */
@Injectable()
export class PostgresCitationSourceMetadataAdapter extends CitationSourceMetadataPort {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {
    super();
  }

  async load(
    userId: string,
    refs: CitationSourceRef[],
  ): Promise<Map<string, CitationSourceMetadata>> {
    const result = new Map<string, CitationSourceMetadata>();

    if (refs.length === 0) return result;

    try {
      for (const ref of refs) {
        const found = await withDbSpan(
          { table: "sources", operation: "SELECT" },
          () =>
            this.pool.query<SourceRow>(
              `select s.name, s.type, s.current_version_id
               from public.sources s
               where s.user_id = $1 and s.id = $2`,
              [userId, ref.sourceId],
            ),
        );
        const row = found.rows[0];

        if (row === undefined) {
          result.set(ref.sourceVersionId, {
            sourceName: "Removed source",
            sourceType: "unknown",
            isStale: true,
            sourceRemoved: true,
          });
          continue;
        }

        result.set(ref.sourceVersionId, {
          sourceName: row.name,
          sourceType: row.type,
          isStale: row.current_version_id !== ref.sourceVersionId,
          sourceRemoved: false,
        });
      }

      return result;
    } catch (error) {
      throw databaseFailure("load citation source metadata", error);
    }
  }
}
