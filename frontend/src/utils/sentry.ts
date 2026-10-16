// Sentry error monitoring and performance tracking for IntellMeet Frontend
// Captures unhandled client errors, network exceptions and WebRTC call crashes

import * as Sentry from "@sentry/react";

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || "";
const ENVIRONMENT = import.meta.env.MODE || "development";

let isSentryEnabled = false;

export const initSentry = () => {
  if (SENTRY_DSN) {
    try {
      Sentry.init({
        dsn: SENTRY_DSN,
        environment: ENVIRONMENT,
        tracesSampleRate: ENVIRONMENT === "production" ? 0.2 : 1.0,
      });
      isSentryEnabled = true;
      console.log("[Sentry] Frontend error tracking active.");
    } catch (err) {
      console.warn("[Sentry] Frontend init error:", err);
    }
  } else {
    console.log("[Sentry] VITE_SENTRY_DSN not set. Running in local error logging mode.");
  }
};

// Safe helper to report custom exceptions
export const reportError = (error: unknown, context?: Record<string, unknown>) => {
  if (isSentryEnabled) {
    Sentry.captureException(error, { extra: context });
  } else {
    console.error("[Client Error Captured]:", error, context);
  }
};

export { Sentry };
