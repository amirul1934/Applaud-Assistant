// Mutable Plaud connection state (bearer token + resolved regional API base), persisted to disk so
// a token pasted at runtime survives restarts. Seeded from PLAUD_BEARER_TOKEN on first run.
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";

export interface PlaudState {
  bearerToken: string;
  apiBase: string;
  tokenValid: boolean; // flipped false when Plaud rejects the token (401)
}

const STORE_PATH = path.join(config.dataDir, "plaud-config.json");
const DEFAULT_BASE = "https://api.plaud.ai";

let state: PlaudState = load();

function load(): PlaudState {
  try {
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
    return {
      bearerToken: raw.bearerToken || config.plaud.bearerToken || "",
      apiBase: raw.apiBase || DEFAULT_BASE,
      tokenValid: raw.tokenValid ?? true,
    };
  } catch {
    return { bearerToken: config.plaud.bearerToken || "", apiBase: DEFAULT_BASE, tokenValid: true };
  }
}

function persist() {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(state, null, 2));
}

export const getState = (): PlaudState => state;
export const isConfigured = (): boolean => Boolean(state.bearerToken);

export function setBearerToken(token: string) {
  state = { ...state, bearerToken: token, tokenValid: true };
  persist();
}

export function setApiBase(apiBase: string) {
  if (apiBase && apiBase !== state.apiBase) {
    state = { ...state, apiBase };
    persist();
  }
}

export function markTokenInvalid() {
  if (state.tokenValid) {
    state = { ...state, tokenValid: false };
    persist();
  }
}
