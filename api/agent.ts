import type { VercelRequest, VercelResponse } from "@vercel/node";
import { CORS_HEADERS } from "./_lib/shared";
import { processAgentPipeline } from "./_lib/agentEngine";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    return res.status(204).set(CORS_HEADERS).end();
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const result = await processAgentPipeline(req.body);
    return res.status(result.status).json(result.data);
  } catch (err: any) {
    console.error("[Agent API] Unhandled error:", err);
    return res.status(500).json({ error: err?.message || "Internal server error" });
  }
}
