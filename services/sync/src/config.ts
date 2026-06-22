// Central configuration, read once from the environment.
import path from "node:path";

const num = (v: string | undefined, d: number) => (v ? Number(v) : d);
const bool = (v: string | undefined, d: boolean) =>
  v === undefined ? d : ["1", "true", "yes", "on"].includes(v.toLowerCase());

const DATA_DIR = process.env.DATA_DIR ?? "./data";

export const config = {
  port: num(process.env.SYNC_PORT, 8080),
  dataDir: DATA_DIR,
  dbPath: path.join(DATA_DIR, "applaud.sqlite"),
  recordingsDir: path.join(DATA_DIR, "recordings"),

  auth: {
    username: process.env.APP_USERNAME ?? "admin",
    password: process.env.APP_PASSWORD ?? "change-me",
    secret: process.env.AUTH_SECRET ?? "insecure-dev-secret",
  },

  plaud: {
    bearerToken: process.env.PLAUD_BEARER_TOKEN ?? "",
    pollInterval: num(process.env.PLAUD_POLL_INTERVAL, 600), // seconds
  },

  processingUrl: process.env.PROCESSING_URL ?? "http://processing:8000",

  webhookUrls: (process.env.WEBHOOK_URLS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  drive: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    folderName: process.env.GDRIVE_ARCHIVE_FOLDER ?? "Applaud-Assistant Archive",
    autoArchive: bool(process.env.GDRIVE_AUTO_ARCHIVE, true),
    tokenPath: process.env.GDRIVE_TOKEN_PATH ?? "/secrets/google-oauth-token.json",
  },
};

export type Config = typeof config;
