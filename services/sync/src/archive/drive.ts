// Google Drive archiver (OAuth user account).
//
// Archives a recording's full footprint — audio, transcripts, summaries, and a self-describing
// index.json — into a per-recording folder under GDRIVE_ARCHIVE_FOLDER in the user's My Drive.
import fs from "node:fs";
import path from "node:path";
import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { config } from "../config.js";
import { getRecording, type Recording } from "../db.js";

const SCOPES = ["https://www.googleapis.com/auth/drive.file"];
const REDIRECT = "urn:ietf:wg:oauth:2.0:oob"; // desktop flow; UI can also use a loopback redirect

function oauthClient(): OAuth2Client {
  return new google.auth.OAuth2(config.drive.clientId, config.drive.clientSecret, REDIRECT);
}

/** Step 1 of connecting Drive: URL the user visits to grant access. */
export function getConsentUrl(): string {
  return oauthClient().generateAuthUrl({ access_type: "offline", scope: SCOPES, prompt: "consent" });
}

/** Step 2: exchange the pasted code for tokens and persist the refresh token. */
export async function saveTokenFromCode(code: string): Promise<void> {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  fs.mkdirSync(path.dirname(config.drive.tokenPath), { recursive: true });
  fs.writeFileSync(config.drive.tokenPath, JSON.stringify(tokens, null, 2));
}

export function isConnected(): boolean {
  return Boolean(config.drive.clientId) && fs.existsSync(config.drive.tokenPath);
}

function authed(): OAuth2Client {
  const client = oauthClient();
  client.setCredentials(JSON.parse(fs.readFileSync(config.drive.tokenPath, "utf8")));
  return client;
}

async function ensureFolder(drive: ReturnType<typeof google.drive>, name: string, parent?: string) {
  // Escape backslashes before single quotes so folder names can't break the Drive query syntax.
  const escapedName = name.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const q = [
    `name = '${escapedName}'`,
    "mimeType = 'application/vnd.google-apps.folder'",
    "trashed = false",
    parent ? `'${parent}' in parents` : "'root' in parents",
  ].join(" and ");
  const found = await drive.files.list({ q, fields: "files(id)" });
  if (found.data.files?.[0]?.id) return found.data.files[0].id!;
  const created = await drive.files.create({
    requestBody: { name, mimeType: "application/vnd.google-apps.folder", parents: parent ? [parent] : ["root"] },
    fields: "id",
  });
  return created.data.id!;
}

/** Build the self-describing manifest for a recording's local folder. */
export function buildIndex(rec: Recording, dir: string) {
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f !== "index.json") : [];
  return {
    schema: "applaud-assistant/recording-index@1",
    id: rec.id,
    title: rec.title,
    source: rec.source,
    createdAt: rec.created_at,
    archivedAt: Date.now(),
    files: files.map((name) => ({
      name,
      role: roleFor(name),
      bytes: fs.statSync(path.join(dir, name)).size,
    })),
  };
}

function roleFor(name: string): string {
  if (/^audio\./.test(name)) return "audio";
  if (name.startsWith("plaud.transcript")) return "transcript:plaud";
  if (name.startsWith("local.transcript")) return "transcript:local";
  if (name.startsWith("plaud.summary")) return "summary:plaud";
  if (name.startsWith("local.summary")) return "summary:local";
  return "other";
}

/** Upload everything for a recording. Returns the Drive folder id. */
export async function archiveRecording(id: string): Promise<{ folderId: string; files: string[] }> {
  if (!isConnected()) throw new Error("DRIVE_NOT_CONNECTED");
  const rec = getRecording.get(id) as Recording | undefined;
  if (!rec) throw new Error("recording not found");

  const dir = path.join(config.recordingsDir, id);
  // Write a fresh manifest before uploading so the archive is self-describing.
  fs.writeFileSync(path.join(dir, "index.json"), JSON.stringify(buildIndex(rec, dir), null, 2));

  const drive = google.drive({ version: "v3", auth: authed() });
  const root = await ensureFolder(drive, config.drive.folderName);
  const folderId = await ensureFolder(drive, `${rec.title ?? "Untitled"} [${id}]`, root);

  // Map existing files in the folder so retries update in place instead of creating duplicates.
  const existing = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id, name)",
  });
  const existingByName = new Map(existing.data.files?.map((f) => [f.name, f.id!]) ?? []);

  const uploaded: string[] = [];
  for (const name of fs.readdirSync(dir)) {
    const media = { body: fs.createReadStream(path.join(dir, name)) };
    const existingId = existingByName.get(name);
    if (existingId) {
      await drive.files.update({ fileId: existingId, media, fields: "id" });
    } else {
      await drive.files.create({ requestBody: { name, parents: [folderId] }, media, fields: "id" });
    }
    uploaded.push(name);
  }
  return { folderId, files: uploaded };
}
