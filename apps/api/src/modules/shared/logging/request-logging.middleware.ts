import { context, metrics, trace } from "@opentelemetry/api";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

import { log, type LogLevel } from "../observability/app-logger";

const meter = metrics.getMeter("coders-modulo-4-api");
const requestDuration = meter.createHistogram("http.server.request.duration", {
  description: "Duração das requisições HTTP em milissegundos",
  unit: "ms",
});
const requestCount = meter.createCounter("http.server.requests", {
  description: "Total de requisições HTTP",
});

export type RequestWithId = Request & { requestId?: string };

function levelFor(statusCode: number): LogLevel {
  if (statusCode >= 500) return "error";
  if (statusCode >= 400) return "warn";

  return "info";
}

export function requestLoggingMiddleware(
  request: RequestWithId,
  response: Response,
  next: NextFunction,
): void {
  const requestId = request.header("x-request-id")?.trim() || randomUUID();
  const traceId = trace.getSpan(context.active())?.spanContext().traceId;
  const startedAt = performance.now();

  request.requestId = requestId;
  response.setHeader("x-request-id", requestId);

  response.on("finish", () => {
    const durationMs = Math.round(performance.now() - startedAt);
    const path = request.originalUrl || request.url;
    const attributes = {
      requestId,
      method: request.method,
      path,
      statusCode: response.statusCode,
      durationMs,
      ...(traceId ? { traceId } : {}),
    };
    const metricAttributes = {
      "http.request.method": request.method,
      "http.response.status_code": response.statusCode,
      "url.path": path,
    };

    log(levelFor(response.statusCode), "HTTP request completed", attributes);
    requestDuration.record(durationMs, metricAttributes);
    requestCount.add(1, metricAttributes);
  });

  next();
}
