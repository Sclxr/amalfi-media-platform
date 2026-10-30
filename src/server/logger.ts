import "server-only";
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: ["req.headers.authorization", "password", "AUTH_SECRET", "ENCRYPTION_KEY"],
});
