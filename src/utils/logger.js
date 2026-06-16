import * as Sentry from "@sentry/react";

export const initLogger = () => {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN || "https://examplePublicKey@o0.ingest.sentry.io/0", // Replace with real DSN
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    // Tracing
    tracesSampleRate: 1.0, 
    // Session Replay
    replaysSessionSampleRate: 0.1, 
    replaysOnErrorSampleRate: 1.0, 
  });
};

export const logError = (error, context = {}) => {
  console.error("Logger Error:", error, context);
  Sentry.captureException(error, { extra: context });
};

export const logInfo = (message, context = {}) => {
  console.info("Logger Info:", message, context);
  Sentry.captureMessage(message, "info");
};
