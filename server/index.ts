import crypto from "crypto";
import { verifyMessage } from "ethers";
import { processAgentPipeline } from "../api/_lib/agentEngine";

const PORT = Number(process.env.PORT || 3001);

const server = Bun.serve({
  port: PORT,
  async fetch(req: Request) {
    const url = new URL(req.url);

    // Standard CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept",
      "Access-Control-Max-Age": "86400",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // 1. Health check
    if (url.pathname === "/api/health") {
      return Response.json({ status: "ok", chainId: 91562037 }, { headers: corsHeaders });
    }

    // 2. GET /api/auth/nonce
    if (url.pathname === "/api/auth/nonce" && req.method === "GET") {
      const address = url.searchParams.get("address")?.toLowerCase();
      if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return Response.json({ error: "Valid wallet address required" }, { status: 400, headers: corsHeaders });
      }

      const nonce = `Sign this message to bind your BridgeKey wallet to your Zentrix account.\n\nWallet: ${address}\nNonce: ${crypto.randomBytes(16).toString("hex")}\nTimestamp: ${Date.now()}`;
      return Response.json({ nonce, address }, { headers: corsHeaders });
    }

    // 3. POST /api/auth/verify
    if (url.pathname === "/api/auth/verify" && req.method === "POST") {
      try {
        const { address, signature, message } = await req.json();
        if (!address || !signature || !message) {
          return Response.json({ error: "Address, signature, and message are required" }, { status: 400, headers: corsHeaders });
        }

        const recoveredAddress = verifyMessage(message, signature);
        if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
          return Response.json({ error: "Cryptographic signature verification failed" }, { status: 401, headers: corsHeaders });
        }

        return Response.json({
          success: true,
          verifiedAddress: recoveredAddress.toLowerCase(),
          timestamp: Date.now(),
        }, { headers: corsHeaders });
      } catch (err: any) {
        return Response.json({ error: err?.message || "Internal server error" }, { status: 500, headers: corsHeaders });
      }
    }

    // 4. POST /api/agent (Sarvam 105B Agent Pipeline with Semantic Search)
    if (url.pathname === "/api/agent" && req.method === "POST") {
      try {
        const body = await req.json();
        const result = await processAgentPipeline(body);
        return Response.json(result.data, { status: result.status, headers: corsHeaders });
      } catch (err: any) {
        return Response.json({ error: err?.message || "Internal server error" }, { status: 500, headers: corsHeaders });
      }
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
});

console.log(`Zentrix Backend Server running on http://localhost:${server.port} (local dev only)`);

