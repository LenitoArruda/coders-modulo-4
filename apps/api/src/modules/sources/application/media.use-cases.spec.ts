import { beforeEach, describe, expect, it } from "vitest";

import { FakeMediaTextExtractor } from "../../../test/fakes/fake-media-text-extractor";
import { FakeWebPageFetcher } from "../../../test/fakes/fake-web-page-fetcher";
import { InMemorySourcesRepository } from "../../../test/fakes/in-memory-sources.repository";
import { FakeDocumentTextExtractor } from "../../../test/fakes/fake-document-text-extractor";
import { FakeEmbeddingGenerator } from "../../../test/fakes/fake-embedding-generator";
import { InMemoryVectorStore } from "../../../test/fakes/in-memory-vector-store";
import { validateSourceFiles } from "../domain/source-file-policy";
import { ConnectSourcesUseCase } from "./connect-sources.use-case";
import { DeleteSourceUseCase } from "./delete-source.use-case";
import { ListSourcesUseCase } from "./list-sources.use-case";
import { ProcessSourceVersionUseCase } from "./process-source-version.use-case";
import { RetrySourceVersionUseCase } from "./retry-source-version.use-case";

const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";

const MEDIA_OPTIONS = { allowMedia: true };

function png(name = "manual.png"): Buffer {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01,
  ]);
}

function mp3(name = "meeting.mp3"): Buffer {
  return Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x01, 0x02]);
}

function mp4(name = "demo.mp4"): Buffer {
  return Buffer.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
  ]);
}

function mediaFile(
  name: string,
  mimeType: string,
  buffer: Buffer,
  durationSeconds?: number,
) {
  return { originalName: name, mimeType, buffer, durationSeconds };
}

async function settle(): Promise<void> {
  for (let index = 0; index < 30; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

describe("knowledge media use cases", () => {
  let sources: InMemorySourcesRepository;
  let extractor: FakeMediaTextExtractor;
  let vectors: InMemoryVectorStore;
  let connect: ConnectSourcesUseCase;
  let processVersion: ProcessSourceVersionUseCase;
  let list: ListSourcesUseCase;
  let remove: DeleteSourceUseCase;
  let retry: RetrySourceVersionUseCase;
  let pages: FakeWebPageFetcher;

  beforeEach(() => {
    sources = new InMemorySourcesRepository();
    extractor = new FakeMediaTextExtractor();
    extractor.silentNames.add("silent.mp3");
    vectors = new InMemoryVectorStore();
    processVersion = new ProcessSourceVersionUseCase(
      sources,
      new FakeDocumentTextExtractor(),
      new FakeEmbeddingGenerator(),
      vectors,
      extractor,
    );
    connect = new ConnectSourcesUseCase(sources, processVersion);
    list = new ListSourcesUseCase(sources);
    remove = new DeleteSourceUseCase(sources, vectors);
    pages = new FakeWebPageFetcher();
    retry = new RetrySourceVersionUseCase(
      sources,
      vectors,
      processVersion,
      pages,
    );
  });

  async function connectFile(
    userId: string,
    file: ReturnType<typeof mediaFile>,
  ) {
    const result = await connect.execute({
      userId,
      files: validateSourceFiles([file], undefined, undefined, MEDIA_OPTIONS),
    });
    await settle();

    return result;
  }

  it("indexa imagem via OCR com proveniência e vetores da própria fonte", async () => {
    const result = await connectFile(
      USER_A,
      mediaFile("manual.png", "image/png", png()),
    );

    expect(result.results[0]).toMatchObject({
      type: "image",
      status: "processing",
      alreadyConnected: false,
    });
    expect(sources.versions[0]).toMatchObject({
      status: "ready",
      mediaType: "image",
      extractionMethod: "ocr",
      extractionModelVersion: "fake-local-v1",
      processingPhase: null,
      chunkCount: 1,
    });
    expect(vectors.records).toHaveLength(1);
    expect(vectors.records[0]?.chunk.sourceId).toBe(
      result.results[0]?.sourceId,
    );
    expect(extractor.calls[0]).toMatchObject({ type: "image" });
  });

  it("transcreve áudio e vídeo com duração informada", async () => {
    await connectFile(
      USER_A,
      mediaFile("meeting.mp3", "audio/mpeg", mp3(), 300),
    );
    await connectFile(USER_A, mediaFile("demo.mp4", "video/mp4", mp4(), 600));

    expect(vectors.records).toHaveLength(2);
    expect(sources.versions.map((version) => version.type)).toEqual([
      "audio",
      "video",
    ]);
    expect(sources.versions[0]?.durationSeconds).toBe(300);
    expect(sources.versions[1]?.durationSeconds).toBe(600);
    expect(
      sources.versions.every(
        (version) => version.extractionMethod === "transcription",
      ),
    ).toBe(true);
    expect(extractor.calls.map((call) => call.type)).toEqual([
      "audio",
      "video",
    ]);
  });

  it("reaproveita o mesmo hash sem duplicar versão, chunk ou vetor", async () => {
    await connectFile(USER_A, mediaFile("meeting.mp3", "audio/mpeg", mp3()));
    const before = {
      versions: sources.versions.length,
      chunks: sources.chunks.length,
      vectors: vectors.records.length,
    };

    const repeated = await connectFile(
      USER_A,
      mediaFile("copy.mp3", "audio/mpeg", mp3()),
    );

    expect(repeated.results[0]?.alreadyConnected).toBe(true);
    expect(sources.versions).toHaveLength(before.versions);
    expect(sources.chunks).toHaveLength(before.chunks);
    expect(vectors.records).toHaveLength(before.vectors);
  });

  it("marca áudio sem fala como failed com No speech detected e sem vetores", async () => {
    await connectFile(USER_A, mediaFile("silent.mp3", "audio/mpeg", mp3(), 12));

    expect(sources.versions[0]).toMatchObject({
      status: "failed",
      errorMessage: "No speech detected",
      processingPhase: null,
    });
    expect(vectors.records).toHaveLength(0);
    expect((await list.execute(USER_A)).sources[0]?.errorMessage).toBe(
      "No speech detected",
    );
  });

  it("faz retry no mesmo sourceId e exclui mídia sem apagar outro usuário", async () => {
    await connectFile(USER_A, mediaFile("silent.mp3", "audio/mpeg", mp3()));
    const failed = sources.versions[0];

    expect(failed?.status).toBe("failed");

    extractor.calls.length = 0;
    extractor.silentNames.clear();
    const retried = await retry.execute(USER_A, failed?.id ?? "");
    await settle();

    expect(retried.sourceId).toBe(failed?.sourceId);
    expect(sources.versions).toHaveLength(1);
    expect(failed?.status).toBe("ready");
    expect(vectors.records).toHaveLength(1);

    await connectFile(USER_B, mediaFile("other.mp4", "video/mp4", mp4()));
    const sourceId = failed?.sourceId ?? "";

    await remove.execute(USER_A, sourceId);

    expect(sources.sources.some((source) => source.id === sourceId)).toBe(
      false,
    );
    expect(vectors.deletedSources).toContain(sourceId);
    expect((await list.execute(USER_A)).sources).toEqual([]);
    expect((await list.execute(USER_B)).sources).toHaveLength(1);
  });

  it("mantém fontes idênticas isoladas por usuário", async () => {
    await connectFile(USER_A, mediaFile("manual.png", "image/png", png()));
    await connectFile(USER_B, mediaFile("manual.png", "image/png", png()));

    expect(sources.sources).toHaveLength(2);
    expect((await list.execute(USER_A)).sources).toHaveLength(1);
    expect((await list.execute(USER_B)).sources).toHaveLength(1);
    expect(vectors.records).toHaveLength(2);
  });

  it("falha com mensagem acionável quando o extrator local não está configurado", async () => {
    processVersion = new ProcessSourceVersionUseCase(
      sources,
      new FakeDocumentTextExtractor(),
      new FakeEmbeddingGenerator(),
      vectors,
    );
    connect = new ConnectSourcesUseCase(sources, processVersion);

    await connectFile(USER_A, mediaFile("manual.png", "image/png", png()));

    expect(sources.versions[0]?.status).toBe("failed");
    expect(sources.versions[0]?.errorMessage).toContain("not configured");
    expect(vectors.records).toHaveLength(0);
  });
});
