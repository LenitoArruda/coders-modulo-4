import { beforeEach, describe, expect, it, vi } from "vitest";

const context = vi.hoisted(() => ({
  enabled: false,
  fetchApi: vi.fn(),
}));

vi.mock("../../lib/knowledge/flags", () => ({
  isKnowledgeMediaEnabled: async () => context.enabled,
}));

vi.mock("../../lib/auth/api-client", () => ({
  fetchApiWithSession: context.fetchApi,
}));

import {
  CONNECT_SOURCES_PATH,
  NO_SPEECH_DETECTED_MESSAGE,
} from "../../lib/knowledge/types";
import { connectSourcesAction } from "./source-actions";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function upload(
  name = "manual.png",
  mimeType = "image/png",
  duration?: string,
): FormData {
  const formData = new FormData();

  formData.append("files", new File(["media"], name, { type: mimeType }));
  if (duration !== undefined) {
    formData.append("durationSeconds", duration);
  }

  return formData;
}

beforeEach(() => {
  context.enabled = true;
  context.fetchApi.mockReset();
});

describe("connectSourcesAction with the media flag enabled", () => {
  it("forwards media with the server-resolved flag and duration", async () => {
    context.fetchApi.mockResolvedValue(
      jsonResponse(202, {
        results: [
          {
            name: "meeting.mp3",
            type: "audio",
            byteSize: 5,
            sourceId: "src-1",
            versionId: "ver-1",
            status: "processing",
            alreadyConnected: false,
          },
        ],
      }),
    );
    const formData = upload("meeting.mp3", "audio/mpeg", "120");

    const result = await connectSourcesAction(formData);

    expect(result.ok).toBe(true);
    const [path, init] = context.fetchApi.mock.calls[0] as [
      string,
      RequestInit,
    ];

    expect(path).toBe(CONNECT_SOURCES_PATH);
    expect(init.body).toBe(formData);
    expect(formData.get("allowMedia")).toBe("true");
    expect(formData.get("durationSeconds")).toBe("120");
  });

  it("rejects a client-supplied flag when the rollout is off", async () => {
    context.enabled = false;
    const formData = upload("manual.png", "image/png");

    formData.set("allowMedia", "true");

    await expect(connectSourcesAction(formData)).resolves.toEqual({
      ok: false,
      message: "Only PDF, TXT or Markdown files are supported.",
    });
    expect(formData.has("allowMedia")).toBe(false);
    expect(context.fetchApi).not.toHaveBeenCalled();
  });

  it("lists media formats for an unsupported file", async () => {
    const result = await connectSourcesAction(
      upload("malware.exe", "application/octet-stream"),
    );

    expect(result).toEqual({
      ok: false,
      message:
        "Only PDF, TXT, Markdown, JPEG, PNG, MP3 or MP4 files are supported.",
    });
    expect(context.fetchApi).not.toHaveBeenCalled();
  });

  it("validates duration before calling the API", async () => {
    await expect(
      connectSourcesAction(upload("meeting.mp3", "audio/mpeg", "0")),
    ).resolves.toEqual({
      ok: false,
      message: "Enter a valid duration in seconds, up to 60 minutes.",
    });
    await expect(
      connectSourcesAction(upload("meeting.mp3", "audio/mpeg", "3601")),
    ).resolves.toEqual({
      ok: false,
      message:
        "Media longer than 60 minutes is not supported. Try a shorter file.",
    });
    expect(context.fetchApi).not.toHaveBeenCalled();
  });

  it("forwards public extraction failures without internals", async () => {
    context.fetchApi.mockResolvedValue(
      jsonResponse(503, {
        code: "NO_SPEECH_DETECTED",
        message: NO_SPEECH_DETECTED_MESSAGE,
      }),
    );

    await expect(
      connectSourcesAction(upload("silent.mp3", "audio/mpeg")),
    ).resolves.toEqual({
      ok: false,
      message: NO_SPEECH_DETECTED_MESSAGE,
    });
  });
});
