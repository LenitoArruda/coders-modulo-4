import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-grpc";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-grpc";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";

const serviceName =
  process.env.OTEL_SERVICE_NAME?.trim() || "coders-modulo-4-api";
const endpoint =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim() || "http://localhost:4317";

let sdk: NodeSDK | undefined;

export function startTelemetry(): void {
  if (process.env.OTEL_SDK_DISABLED === "true" || sdk) {
    return;
  }

  try {
    sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: serviceName,
        [ATTR_SERVICE_VERSION]: "0.1.0",
      }),
      traceExporter: new OTLPTraceExporter({ url: endpoint }),
      metricReaders: [
        new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter({ url: endpoint }),
          exportIntervalMillis: 10_000,
        }),
      ],
      logRecordProcessors: [
        new BatchLogRecordProcessor({
          exporter: new OTLPLogExporter({ url: endpoint }),
        }),
      ],
      instrumentations: [new HttpInstrumentation()],
    });

    sdk.start();
  } catch (error) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        service: serviceName,
        message: "Falha ao iniciar OpenTelemetry",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

export async function stopTelemetry(): Promise<void> {
  if (!sdk) {
    return;
  }

  await sdk.shutdown();
  sdk = undefined;
}

startTelemetry();
