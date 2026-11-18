import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MediaProviderError } from "../domain/media.errors";
import { MediaGeneratorRouter } from "./media-generator.router";
import { GeminiVideoGenerator } from "./gemini-video.generator";
import { OpenAIImageGenerator } from "./openai-image.generator";

const REQUEST = {
  userId: "user-1",
  kind: "image" as const,
  prompt: "Create an image about the product",
  parameters: { kind: "image" as const, size: "1024x1024" as const },
  modelId: "gpt-image-2",
};

type Handler = (
  url: URL,
  body: unknown,
  headers: Record<string, string | string[] | undefined>,
) => { status: number; body: unknown };

describe("media provider adapters", () => {
  let server: Server;
  let baseUrl: string;
  let handler: Handler;

  beforeEach(async () => {
    handler = () => ({ status: 500, body: {} });
    server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        const result = handler(
          new URL(request.url ?? "/", "http://127.0.0.1"),
          raw === "" ? {} : (JSON.parse(raw) as unknown),
          request.headers,
        );
        response.writeHead(result.status, {
          "Content-Type": "application/json",
        });
        response.end(JSON.stringify(result.body));
      });
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) =>
        error === undefined ? resolve() : reject(error),
      ),
    );
  });

  it("sends an authenticated OpenAI image request and decodes b64 bytes", async () => {
    let authorization: string | undefined;
    handler = (_url, body, headers) => {
      authorization = headers.authorization as string;
      expect(body).toMatchObject({ model: "gpt-image-2", size: "1024x1024" });

      return {
        status: 200,
        body: {
          data: [{ b64_json: Buffer.from("fake-image").toString("base64") }],
        },
      };
    };

    const generator = new OpenAIImageGenerator("test-key", baseUrl);
    const result = await generator.generate(REQUEST);

    expect(authorization).toBe("Bearer test-key");
    expect(result.bytes.toString()).toBe("fake-image");
    expect(result.mimeType).toBe("image/png");
    expect(result.width).toBe(1024);
    expect(result.height).toBe(1024);
  });

  it("maps an OpenAI refusal to a safe public error", async () => {
    handler = () => ({
      status: 403,
      body: { error: { message: "secret detail" } },
    });
    const generator = new OpenAIImageGenerator("test-key", baseUrl);

    await expect(generator.generate(REQUEST)).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
      publicMessage:
        "The provider declined this briefing. Try rephrasing it without restricted content.",
    });
    expect(MediaProviderError).toBeDefined();
  });

  it("polls a Gemini long-running operation and decodes video bytes", async () => {
    let polls = 0;
    handler = (url) => {
      if (url.pathname.endsWith(":predictLongRunning")) {
        return { status: 200, body: { name: "operations/1" } };
      }
      polls += 1;

      return {
        status: 200,
        body: {
          name: "operations/1",
          done: true,
          response: {
            generatedVideos: [
              {
                video: {
                  base64: Buffer.from("fake-video").toString("base64"),
                  mimeType: "video/mp4",
                },
              },
            ],
          },
        },
      };
    };

    const generator = new GeminiVideoGenerator("test-key", baseUrl);
    const result = await generator.generate({
      ...REQUEST,
      kind: "video",
      parameters: {
        kind: "video",
        durationSeconds: 6,
        resolution: "720p",
      },
      modelId: "gemini-omni-1.2-flash",
    });

    expect(polls).toBe(1);
    expect(result.bytes.toString()).toBe("fake-video");
    expect(result.height).toBe(720);
  });

  it("routes images and videos to distinct providers", async () => {
    handler = (url) =>
      url.pathname.includes("images")
        ? {
            status: 200,
            body: {
              data: [{ b64_json: Buffer.from("image").toString("base64") }],
            },
          }
        : {
            status: 200,
            body: {
              name: "operations/1",
              done: true,
              response: {
                video: { base64: Buffer.from("video").toString("base64") },
              },
            },
          };

    const router = new MediaGeneratorRouter(
      new OpenAIImageGenerator("test-key", baseUrl),
      new GeminiVideoGenerator("test-key", baseUrl),
    );

    expect((await router.generate(REQUEST)).bytes.toString()).toBe("image");
    expect(
      (
        await router.generate({
          ...REQUEST,
          kind: "video",
          modelId: "gemini-omni-1.2-flash",
        })
      ).bytes.toString(),
    ).toBe("video");
  });
});
