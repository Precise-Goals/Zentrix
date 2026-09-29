import type { VercelRequest, VercelResponse } from "@vercel/node";
import { CORS_HEADERS } from "./_lib/shared";
import { processAgentPipeline } from "./_lib/agentEngine";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Always set CORS headers on every response
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    let payload = req.body;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch {
        payload = { prompt: payload };
      }
    }
    const result = await processAgentPipeline(payload || {});
    return res.status(result.status).json(result.data);
  } catch (err: any) {
    console.error("[Agent API] Unhandled error:", err);
    return res.status(500).json({ error: err?.message || "Internal server error" });
  }
}

