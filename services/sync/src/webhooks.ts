// Fire-and-forget webhook emitter for the documented event contract.
import { config } from "./config.js";

export type EventName = "audio_ready" | "transcript_ready" | "archived";

export async function emit(event: EventName, payload: Record<string, unknown>) {
  if (config.webhookUrls.length === 0) return;
  const body = JSON.stringify({ event, ts: Date.now(), ...payload });
  await Promise.allSettled(
    config.webhookUrls.map((url) =>
      fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      })
    )
  );
}
