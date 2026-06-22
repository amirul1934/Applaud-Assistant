// Single-user authentication: one login, signed JWT in an httpOnly cookie.
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "./config.js";

const COOKIE = "applaud_session";

export function issueToken(): string {
  return jwt.sign({ sub: config.auth.username }, config.auth.secret, {
    expiresIn: "30d",
  });
}

export function login(req: Request, res: Response) {
  const { username, password } = req.body ?? {};
  if (username !== config.auth.username || password !== config.auth.password) {
    return res.status(401).json({ error: "invalid credentials" });
  }
  res.cookie(COOKIE, issueToken(), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
  res.json({ ok: true });
}

export function logout(_req: Request, res: Response) {
  res.clearCookie(COOKIE);
  res.json({ ok: true });
}

// Guard for everything under /api except the auth endpoints.
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE] ?? req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "unauthenticated" });
  try {
    jwt.verify(token, config.auth.secret);
    next();
  } catch {
    res.status(401).json({ error: "invalid session" });
  }
}
