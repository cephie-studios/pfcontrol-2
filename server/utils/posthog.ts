import { PostHog } from "posthog-node";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { logs, type AnyValueMap } from "@opentelemetry/api-logs";
import type { Request } from "express";

const noop = {
  capture: () => {},
  identify: () => {},
  captureException: () => {},
  captureExceptionImmediate: async () => {},
  addPendingPromise: () => {},
  shutdown: async () => {},
} as unknown as PostHog;

const client: PostHog = process.env.POSTHOG_API_KEY
  ? new PostHog(process.env.POSTHOG_API_KEY, {
      host: process.env.POSTHOG_HOST || "https://us.i.posthog.com",
      enableExceptionAutocapture: true,
    })
  : noop;

export const posthogServerEnabled = Boolean(process.env.POSTHOG_API_KEY);

if (process.env.POSTHOG_API_KEY) {
  process.on("SIGINT", async () => {
    await client.shutdown();
  });
  process.on("SIGTERM", async () => {
    await client.shutdown();
  });
}

interface CaptureParams {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}

export function capture(req: Request, params: CaptureParams): void {
  const sessionId = req.headers["x-posthog-session-id"];
  const currentUrl = req.headers.referer || req.headers.origin;
  client.capture({
    ...params,
    properties: {
      ...params.properties,
      ...(sessionId ? { $session_id: String(sessionId) } : {}),
      ...(currentUrl ? { $current_url: String(currentUrl) } : {}),
    },
  });
}

/**
 * Report a caught exception with request/session context for Error Tracking.
 */
export function captureRequestException(
  req: Request,
  error: unknown,
  additional?: Record<string, unknown>,
): void {
  if (!posthogServerEnabled) return;
  const distinctId =
    req.user?.userId ??
    (typeof req.headers["x-posthog-distinct-id"] === "string"
      ? req.headers["x-posthog-distinct-id"]
      : undefined) ??
    "server-anonymous";
  const sessionId = req.headers["x-posthog-session-id"];
  const currentUrl = req.headers.referer || req.headers.origin || req.originalUrl;
  client.captureException(error, distinctId, {
    ...additional,
    ...(sessionId ? { $session_id: String(sessionId) } : {}),
    ...(currentUrl ? { $current_url: String(currentUrl) } : {}),
    $request_method: req.method,
    $request_path: req.path,
  });
}

// --- OpenTelemetry logging to PostHog ---

type LogLevel = "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";

let _otelLogger: ReturnType<typeof logs.getLogger> | null = null;

export function initTelemetry() {
  if (!process.env.POSTHOG_API_KEY) return;

  const host = process.env.POSTHOG_HOST || "https://us.i.posthog.com";

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      "service.name": process.env.SERVICE_NAME || "pfcontrol",
    }),
    logRecordProcessor: new BatchLogRecordProcessor(
      new OTLPLogExporter({
        url: `${host}/i/v1/logs`,
        headers: { Authorization: `Bearer ${process.env.POSTHOG_API_KEY}` },
      })
    ),
  });

  sdk.start();
  process.on("SIGTERM", () => { sdk.shutdown(); });
  process.on("SIGINT",  () => { sdk.shutdown(); });

  _otelLogger = logs.getLogger("pfcontrol");
}

function emitLog(level: LogLevel, message: string, attributes?: AnyValueMap) {
  _otelLogger?.emit({ severityText: level, body: message, attributes });
}

export const logger = {
  trace: (msg: string, attrs?: AnyValueMap) => emitLog("TRACE", msg, attrs),
  debug: (msg: string, attrs?: AnyValueMap) => emitLog("DEBUG", msg, attrs),
  info:  (msg: string, attrs?: AnyValueMap) => emitLog("INFO",  msg, attrs),
  warn:  (msg: string, attrs?: AnyValueMap) => emitLog("WARN",  msg, attrs),
  error: (msg: string, attrs?: AnyValueMap) => emitLog("ERROR", msg, attrs),
  fatal: (msg: string, attrs?: AnyValueMap) => emitLog("FATAL", msg, attrs),
};

export default client;