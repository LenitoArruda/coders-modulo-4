import { describe, expect, it, vi } from "vitest";

import { HttpTraceSink } from "./http-trace.sink";
import { NoopTraceSink } from "./noop-trace.sink";
import { createTraceSink } from "./create-trace-sink";

const options = {
  enabled: true,
  endpoint: "http://127.0.0.1:1980",
  apiKey: "test-local-key",
  batchSize: 32,
  flushIntervalMs: 1_000,
};

describe("createTraceSink", () => {
  it("usa o sink no-op quando a flag está desligada", () => {
    expect(createTraceSink({ ...options, enabled: false })).toBeInstanceOf(
      NoopTraceSink,
    );
  });

  it("usa o sink HTTP para endpoint local quando ligado", () => {
    expect(createTraceSink(options)).toBeInstanceOf(HttpTraceSink);
  });

  it("usa no-op e avisa quando o endpoint não é local", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const sink = createTraceSink({
      ...options,
      endpoint: "https://cloud.langsmith.com",
    });

    expect(sink).toBeInstanceOf(NoopTraceSink);
    const lines = warn.mock.calls.map((call) => String(call[0]));

    expect(lines.some((line) => line.includes("obs.trace.disabled"))).toBe(
      true,
    );
    expect(lines.some((line) => line.includes("cloud.langsmith.com"))).toBe(
      false,
    );
    warn.mockRestore();
  });

  it("o sink no-op não lança", async () => {
    await expect(
      new NoopTraceSink().send({} as never),
    ).resolves.toBeUndefined();
  });
});
