import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function authenticateAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const adminSecretHeader = req.headers["x-admin-secret"];

  if (adminSecretHeader && adminSecretHeader === env.ZENDESK_CLIENT_SECRET) {
    return next();
  }

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    try {
      jwt.verify(token, env.ZENDESK_CLIENT_SECRET);
      return next();
    } catch {
      return res.status(401).json({ error: "unauthorized", message: "Invalid authentication token." });
    }
  }

  return res.status(401).json({ error: "unauthorized", message: "Missing required admin credentials." });
}
