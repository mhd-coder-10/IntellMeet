// Sentry initialization and error tracking configuration for IntellMeet backend
// Handles unhandled exceptions, rejection tracking, and Express error monitoring

const Sentry = require("@sentry/node");

const SENTRY_DSN = process.env.SENTRY_DSN || "";
const ENVIRONMENT = process.env.NODE_ENV || "development";

let isSentryInitialized = false;

if (SENTRY_DSN) {
  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: ENVIRONMENT,
      tracesSampleRate: ENVIRONMENT === "production" ? 0.2 : 1.0,
      integrations: [],
    });
    isSentryInitialized = true;
    console.log("[Sentry] Backend error monitoring initialized successfully.");
  } catch (err) {
    console.warn("[Sentry] Initialization error:", err.message);
  }
} else {
  console.log("[Sentry] SENTRY_DSN not provided. Error tracking will log to console.");
}

// Sentry Error Handler Middleware for Express
const sentryErrorHandler = (err, req, res, next) => {
  if (isSentryInitialized) {
    Sentry.captureException(err);
  }
  next(err);
};

// Safe helper to capture custom exceptions
const captureException = (error, context = {}) => {
  if (isSentryInitialized) {
    Sentry.captureException(error, { extra: context });
  } else {
    console.error("[Exception Captured]:", error?.message || error, context);
  }
};

// Safe helper to capture messages
const captureMessage = (message, level = "info") => {
  if (isSentryInitialized) {
    Sentry.captureMessage(message, level);
  } else {
    console.log(`[Sentry Message - ${level}]:`, message);
  }
};

module.exports = {
  isSentryInitialized,
  sentryErrorHandler,
  captureException,
  captureMessage,
  Sentry,
};
