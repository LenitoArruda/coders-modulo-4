import { describe, expect, it } from "vitest";

import { createPgPoolMock, pgError } from "../../../test/fakes/pg-pool.mock";
import type { Chunk } from "../domain/source";

import { PostgresSourcesRepository } from "./postgres-sources.repository";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const SOURCE_ID = "22222222-2222-2222-2222-222222222222";
const VERSION_ID = "33333333-3333-3333-3333-333333333333";
const CREATED_AT = new Date("2026-11-18T12:00:00.000Z");
const HASH = "a".repeat(64);

const sourceRow = {
  id: SOURCE_ID,
  user_id: USER_ID,
  name: "Notes.txt",
  normalized_name: "notes.txt",
  type: "txt",
  current_version_id: VERSION_ID,
  created_at: CREATED_AT,
  updated_at: CREATED_AT,
};

const versionRow = {
  id: VERSION_ID,
  source_id: SOURCE_ID,
  user_id: USER_ID,
  content_hash: HASH,
  original_name: "Notes.txt",
  mime_type: "text/plain",
  byte_size: "42",
  type: "txt",
  status: "ready",
  chunk_count: 1,
  error_message: null,
  created_at: CREATED_AT,
  updated_at: CREATED_AT,
};

describe("PostgresSourcesRepository", () => {
  it("busca versão por hash apenas dentro do usuário", async () => {
    const mock = createPgPoolMock({ rows: [versionRow] });
    const repository = new PostgresSourcesRepository(mock.pool);

    const version = await repository.findVersionByHash(USER_ID, HASH);

    expect(mock.calls[0]?.text).toContain(
      "where user_id = $1 and content_hash = $2 and status <> 'failed'",
    );
    expect(mock.calls[0]?.params).toEqual([USER_ID, HASH]);
    expect(version).toMatchObject({
      id: VERSION_ID,
      userId: USER_ID,
      contentHash: HASH,
      byteSize: 42,
      status: "ready",
    });
  });

  it("trata conflito de hash simultâneo como versão inexistente", async () => {
    const mock = createPgPoolMock(pgError("23505"));
    const repository = new PostgresSourcesRepository(mock.pool);

    await expect(
      repository.createVersion({
        userId: USER_ID,
        sourceId: SOURCE_ID,
        contentHash: HASH,
        originalName: "Notes.txt",
        mimeType: "text/plain",
        byteSize: 42,
        type: "txt",
        status: "processing",
      }),
    ).resolves.toBeNull();
  });

  it("filtra criação e consulta de fonte pelo usuário", async () => {
    const mock = createPgPoolMock({ rows: [] }, { rows: [sourceRow] });
    const repository = new PostgresSourcesRepository(mock.pool);

    const source = await repository.createSource(
      USER_ID,
      "Notes.txt",
      "notes.txt",
      "txt",
    );

    expect(mock.calls[0]?.text).toContain(
      "insert into public.sources (user_id, name, normalized_name, type)",
    );
    expect(mock.calls[0]?.params).toEqual([
      USER_ID,
      "Notes.txt",
      "notes.txt",
      "txt",
    ]);
    expect(mock.calls[1]?.text).toContain(
      "where user_id = $1 and normalized_name = $2",
    );
    expect(source.id).toBe(SOURCE_ID);
  });

  it("grava arquivo original e chunks com o usuário autenticado", async () => {
    const mock = createPgPoolMock({ rows: [] }, { rows: [] });
    const repository = new PostgresSourcesRepository(mock.pool);
    const buffer = Buffer.from("conteúdo");

    await repository.saveFile(USER_ID, VERSION_ID, buffer);

    const chunk: Chunk = {
      id: "44444444-4444-4444-4444-444444444444",
      sourceId: SOURCE_ID,
      sourceVersionId: VERSION_ID,
      userId: USER_ID,
      index: 0,
      content: "conteúdo",
    };
    await repository.saveChunks([chunk]);

    expect(mock.calls[0]?.params).toEqual([
      VERSION_ID,
      USER_ID,
      buffer,
      buffer.byteLength,
    ]);
    expect(mock.calls[1]?.params).toEqual([
      chunk.id,
      SOURCE_ID,
      VERSION_ID,
      USER_ID,
      0,
      "conteúdo",
    ]);
  });

  it("atualiza status sem apagar chunkCount quando não informado", async () => {
    const mock = createPgPoolMock({ rows: [] });
    const repository = new PostgresSourcesRepository(mock.pool);

    await repository.updateVersionStatus(USER_ID, VERSION_ID, "failed");

    expect(mock.calls[0]?.text).toContain(
      "chunk_count = coalesce($4, chunk_count)",
    );
    expect(mock.calls[0]?.text).toContain("where user_id = $1 and id = $2");
    expect(mock.calls[0]?.params).toEqual([
      USER_ID,
      VERSION_ID,
      "failed",
      null,
      null,
    ]);
  });

  it("lista apenas fontes do usuário e exclui com filtro de proprietário", async () => {
    const summaryRow = {
      id: SOURCE_ID,
      name: "Notes.txt",
      type: "txt",
      byte_size: "42",
      status: "ready",
      version_id: VERSION_ID,
      version_number: "1",
      chunk_count: 1,
      created_at: CREATED_AT,
    };
    const mock = createPgPoolMock(
      { rows: [summaryRow] },
      { rows: [] },
      { rows: [] },
    );
    const repository = new PostgresSourcesRepository(mock.pool);

    const listed = await repository.listSources(USER_ID);
    await repository.findForDeletion(USER_ID, SOURCE_ID);
    const deleted = await repository.deleteSource(USER_ID, SOURCE_ID);

    expect(mock.calls[0]?.text).toContain("where s.user_id = $1");
    expect(mock.calls[0]?.params).toEqual([USER_ID]);
    expect(listed[0]).toMatchObject({
      id: SOURCE_ID,
      byteSize: 42,
      versionNumber: 1,
      isStale: false,
    });
    expect(mock.calls[1]?.text).toContain("where s.user_id = $1 and s.id = $2");
    expect(mock.calls[2]?.text).toContain("delete from public.sources");
    expect(mock.calls[2]?.params).toEqual([USER_ID, SOURCE_ID]);
    expect(deleted).toBe(false);
  });

  it("devolve erro estável quando o banco falha", async () => {
    const mock = createPgPoolMock(pgError("08006"));
    const repository = new PostgresSourcesRepository(mock.pool);

    await expect(repository.listSources(USER_ID)).rejects.toThrow(
      "Could not list sources",
    );
  });
});
