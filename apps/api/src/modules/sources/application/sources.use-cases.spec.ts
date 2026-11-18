import { beforeEach, describe, expect, it } from "vitest";

import { InMemorySourcesRepository } from "../../../test/fakes/in-memory-sources.repository";
import { FakeDocumentTextExtractor } from "../../../test/fakes/fake-document-text-extractor";
import { FakeEmbeddingGenerator } from "../../../test/fakes/fake-embedding-generator";
import {
  InMemoryVectorStore,
  vectorStoreFailure,
} from "../../../test/fakes/in-memory-vector-store";
import { validateSourceFiles } from "../domain/source-file-policy";
import { ConnectSourcesUseCase } from "./connect-sources.use-case";
import { DeleteSourceUseCase } from "./delete-source.use-case";
import { ListSourcesUseCase } from "./list-sources.use-case";
import { ProcessSourceVersionUseCase } from "./process-source-version.use-case";
import { RetrySourceVersionUseCase } from "./retry-source-version.use-case";

const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";

async function settle(): Promise<void> {
  for (let index = 0; index < 20; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function file(name: string, content: string, type = "text/plain") {
  return {
    originalName: name,
    mimeType: type,
    buffer: Buffer.from(content, "utf8"),
  };
}

describe("knowledge source use cases", () => {
  let sources: InMemorySourcesRepository;
  let extractor: FakeDocumentTextExtractor;
  let embeddings: FakeEmbeddingGenerator;
  let vectors: InMemoryVectorStore;
  let connect: ConnectSourcesUseCase;
  let processVersion: ProcessSourceVersionUseCase;
  let list: ListSourcesUseCase;
  let remove: DeleteSourceUseCase;
  let retry: RetrySourceVersionUseCase;

  beforeEach(() => {
    sources = new InMemorySourcesRepository();
    extractor = new FakeDocumentTextExtractor();
    embeddings = new FakeEmbeddingGenerator();
    vectors = new InMemoryVectorStore();
    processVersion = new ProcessSourceVersionUseCase(
      sources,
      extractor,
      embeddings,
      vectors,
    );
    connect = new ConnectSourcesUseCase(sources, processVersion);
    list = new ListSourcesUseCase(sources);
    remove = new DeleteSourceUseCase(sources, vectors);
    retry = new RetrySourceVersionUseCase(sources, vectors, processVersion);
  });

  it("indexa um arquivo novo com chunks e vetores", async () => {
    const result = await connect.execute({
      userId: USER_A,
      files: validateSourceFiles([file("notas.txt", "contexto explícito")]),
    });

    expect(result.results[0]).toMatchObject({
      status: "processing",
      alreadyConnected: false,
    });

    await settle();

    expect(sources.versions[0]?.status).toBe("ready");
    expect(sources.versions[0]?.chunkCount).toBe(1);
    expect(sources.chunks).toHaveLength(1);
    expect(vectors.records).toHaveLength(1);
    expect(vectors.records[0]?.vector).toHaveLength(1536);
    expect((await list.execute(USER_A)).sources[0]).toMatchObject({
      status: "ready",
      chunkCount: 1,
      versionNumber: 1,
      isStale: false,
    });
  });

  it("reaproveita conteúdo idêntico sem criar versão, chunk ou vetor", async () => {
    await connect.execute({
      userId: USER_A,
      files: validateSourceFiles([file("notas.txt", "conteúdo único")]),
    });
    await settle();

    const existingVersionId = sources.versions[0]?.id;
    const result = await connect.execute({
      userId: USER_A,
      files: validateSourceFiles([file("copia.txt", "conteúdo único")]),
    });
    await settle();

    expect(result.results[0]?.alreadyConnected).toBe(true);
    expect(result.results[0]?.versionId).toBe(existingVersionId);
    expect(sources.versions).toHaveLength(1);
    expect(sources.chunks).toHaveLength(1);
    expect(vectors.records).toHaveLength(1);
  });

  it("isolaa usuários com o mesmo conteúdo", async () => {
    await connect.execute({
      userId: USER_A,
      files: validateSourceFiles([file("notas.txt", "mesmo conteúdo")]),
    });
    await connect.execute({
      userId: USER_B,
      files: validateSourceFiles([file("notas.txt", "mesmo conteúdo")]),
    });
    await settle();

    expect((await list.execute(USER_A)).sources).toHaveLength(1);
    expect((await list.execute(USER_B)).sources).toHaveLength(1);
    expect(sources.sources[0]?.id).not.toBe(sources.sources[1]?.id);
  });

  it("cria nova versão para o mesmo nome com conteúdo diferente", async () => {
    await connect.execute({
      userId: USER_A,
      files: validateSourceFiles([
        file("Plano.md", "versão um", "text/markdown"),
      ]),
    });
    await settle();

    await connect.execute({
      userId: USER_A,
      files: validateSourceFiles([
        file("Plano.md", "versão dois", "text/markdown"),
      ]),
    });
    await settle();

    expect(sources.sources).toHaveLength(1);
    expect(sources.versions).toHaveLength(2);
    expect(sources.sources[0]?.currentVersionId).toBe(sources.versions[1]?.id);
    expect((await list.execute(USER_A)).sources[0]?.versionNumber).toBe(2);
  });

  it("marca falha de vetor como failed e permite retry", async () => {
    vectors.failure = vectorStoreFailure();

    const result = await connect.execute({
      userId: USER_A,
      files: validateSourceFiles([file("notas.txt", "conteúdo para indexar")]),
    });
    await settle();

    expect(result.results[0]?.status).toBe("processing");
    expect(sources.versions[0]?.status).toBe("failed");
    expect(sources.versions[0]?.errorMessage).toContain("index");
    expect(sources.chunks).toHaveLength(0);

    vectors.failure = null;
    const retried = await retry.execute(USER_A, sources.versions[0]?.id ?? "");

    expect(retried.status).toBe("processing");
    expect(sources.versions[0]?.status).toBe("ready");
    expect(vectors.records).toHaveLength(1);
  });

  it("remove fonte, versões, arquivo, chunks e vetores sem afetar outro usuário", async () => {
    await connect.execute({
      userId: USER_A,
      files: validateSourceFiles([file("notas.txt", "documento privado A")]),
    });
    await connect.execute({
      userId: USER_B,
      files: validateSourceFiles([file("notas.txt", "documento privado B")]),
    });
    await settle();

    const sourceId =
      sources.sources.find((source) => source.userId === USER_A)?.id ?? "";

    await remove.execute(USER_A, sourceId);

    expect(sources.sources.some((source) => source.id === sourceId)).toBe(
      false,
    );
    expect(
      sources.versions.some((version) => version.sourceId === sourceId),
    ).toBe(false);
    expect(sources.files).toHaveLength(1);
    expect(sources.chunks).toHaveLength(1);
    expect(vectors.records).toHaveLength(1);
    expect(vectors.deletedSources).toContain(sourceId);
    expect((await list.execute(USER_A)).sources).toEqual([]);
  });
});
