// Small wrapper around the Drive archiver that records state + emits the `archived` event.
import { config } from "./config.js";
import { setArchiveStatus } from "./db.js";
import { archiveRecording, isConnected } from "./archive/drive.js";
import { emit } from "./webhooks.js";

export async function runArchive(id: string) {
  try {
    const { folderId, files } = await archiveRecording(id);
    setArchiveStatus.run("archived", folderId, id);
    await emit("archived", { id, driveFolderId: folderId, files });
    return { ok: true, folderId, files };
  } catch (e) {
    setArchiveStatus.run("error", null, id);
    throw e;
  }
}

/** Called after a recording is mirrored; archives immediately if auto-archive is on. */
export async function maybeAutoArchive(id: string) {
  if (!config.drive.autoArchive || !isConnected()) return;
  await runArchive(id).catch((e) => console.error("auto-archive", id, (e as Error).message));
}
