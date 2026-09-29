import crypto from "crypto";
import { verifyMessage } from "ethers";

// IST Date helper (UTC+5:30)
function getISTDateString(): string {
  const d = new Date();
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const istDate = new Date(utc + 5.5 * 3600000);
  return istDate.toISOString().slice(0, 10);
}

// Tier query allowances (Pro = 10, Enterprise = 15, Free = 2)
const TIER_LIMITS: Record<number, number> = {
  0: 2,  // Free Tier
  1: 10, // Pro Pass NFT (10 queries/day)
  2: 15, // Enterprise Pass NFT (15 queries/day)
};

// In-memory usage store: key = `${walletAddress}_${istDate}` -> count
const usageStore = new Map<string, number>();

// Sarvam AI Tools Definition
const AGENT_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_gigs",
      description: "Search open freelance gigs and project milestones available on Zentrix marketplace.",
      parameters: {
        type: "object",
        properties: {
          tag: { type: "string", description: "Filter by industry tag or category, e.g. web3, frontend, smart-contracts" },
          minBudget: { type: "number", description: "Minimum budget in tMSTC" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_freelancers",
      description: "Search verified freelance talent profiles on Zentrix.",
      parameters: {
        type: "object",
        properties: {
          skill: { type: "string", description: "Technology or expertise, e.g. Solidity, React, Rust, UI/UX" },
        },
      },
    },
  },
];

const VERIFIED_GIGS = [
  {
    id: "1",
    title: "Implement BridgeKey Multi-Sig Wallet Integration",
    budget: "3.5 tMSTC",
    escrowPercent: "100%",
    tags: ["Solidity", "React", "BridgeKey Integration"],
    reviewWindow: "72h Auto-Release Protected",
    description: "Build native BridgeKey signature request and transaction confirmation hooks with EIP-712 support.",
    clientAddress: "0x73595081334A18D4298A160b162faB4Fb4B3c85B",
    status: "Open",
  },
  {
    id: "4",
    title: "3D Brand Identity & Interactive Spline Motion",
    budget: "2.5 tMSTC",
    escrowPercent: "100%",
    tags: ["Blender", "Spline", "Three.js"],
    reviewWindow: "48h Auto-Release Protected",
    description: "Create futuristic 3D assets, geometric glass emblems, and interactive canvas components for Zentrix DApp.",
    clientAddress: "0x7FC1d02922d4865fd53De59697407a42e64d1Cad",
    status: "Open",
  },
  {
    id: "5",
    title: "Comprehensive MST Developer Documentation & Whitepaper",
    budget: "1.8 tMSTC",
    escrowPercent: "100%",
    tags: ["Technical Writing", "GitBook", "Solidity"],
    reviewWindow: "72h Auto-Release Protected",
    description: "Write in-depth developer tutorials, contract walkthroughs, and technical whitepaper explaining milestone escrow.",
    clientAddress: "0x73595081334A18D4298A160b162faB4Fb4B3c85B",
    status: "Open",
  },
  {
    id: "2",
    title: "Solidity Escrow Contract Invariant Fuzzing",
    budget: "2.0 tMSTC",
    escrowPercent: "100%",
    tags: ["Smart Contracts", "Security Audits", "Foundry"],
    reviewWindow: "48h Auto-Release Protected",
    description: "Write Foundry and Echidna fuzz tests asserting that total contract balance equals locked plus withdrawable funds.",
    clientAddress: "0x7FC1d02922d4865fd53De59697407a42e64d1Cad",
    status: "Open",
  },
];

const VERIFIED_FREELANCERS = [
  {
    id: "f1",
    name: "Alex Dev",
    handle: "@alexdev",
    designation: "Senior Smart Contract Engineer",
    skills: ["Solidity", "OpenZeppelin v5", "Hardhat", "Foundry"],
    reputation: 99.4,
    tier: "Tier 2 Builder Pass",
    walletAddress: "0x8cA0f3176997F32CCBb4598Fc8C966C95aeEEc9e",
    milestonesCompleted: 14,
  },
  {
    id: "f2",
    name: "Priya Sharma",
    handle: "@priyasharma",
    designation: "Lead Frontend Web3 Architect",
    skills: ["React", "Vite", "BridgeKey", "TypeScript", "Tailwind"],
    reputation: 98.8,
    tier: "Tier 2 Builder Pass",
    walletAddress: "0x7FC1d02922d4865fd53De59697407a42e64d1Cad",
    milestonesCompleted: 11,
  },
  {
    id: "f3",
    name: "Vikram Malhotra",
    handle: "@vikramm",
    designation: "Web3 Security Auditor & QA",
    skills: ["Slither", "Echidna", "Invariant Fuzzing", "Solidity"],
    reputation: 99.1,
    tier: "Tier 2 Builder Pass",
    walletAddress: "0x73595081334A18D4298A160b162faB4Fb4B3c85B",
    milestonesCompleted: 18,
  },
];

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

    // 4. POST /api/agent (Sarvam 30B LLM Proxy)
    if (url.pathname === "/api/agent" && req.method === "POST") {
      try {
        const body = await req.json();
        const { walletAddress, role = "freelancer", tier = 0 } = body;
        let prompt = body.prompt;

        // Support both prompt string and conversation messages array
        if (!prompt && Array.isArray(body.messages) && body.messages.length > 0) {
          const lastUserMessage = [...body.messages].reverse().find((m: any) => m.role === "user");
          prompt = lastUserMessage?.content || body.messages[body.messages.length - 1]?.content;
        }

        if (!prompt) {
          return Response.json({ error: "Prompt or message is required" }, { status: 400, headers: corsHeaders });
        }

        const apiKey = process.env.SARVAM_API_KEY;
        if (!apiKey) {
          return Response.json({ error: "SARVAM_API_KEY is not configured on the server." }, { status: 500, headers: corsHeaders });
        }

        // Rate & Credit Limiting
        const userWallet = (walletAddress || "anonymous").toLowerCase();
        const todayIST = getISTDateString();
        const usageKey = `${userWallet}_${todayIST}`;
        const numTier = Number(tier) === 2 ? 2 : Number(tier) === 1 ? 1 : 0;
        const allowedQueries = TIER_LIMITS[numTier] ?? 2;
        const currentQueries = usageStore.get(usageKey) || 0;

        if (currentQueries >= allowedQueries) {
          const tierName = numTier === 2 ? "Enterprise" : numTier === 1 ? "Pro" : "Free";
          return Response.json({
            error: `Daily query limit reached (${allowedQueries}/${allowedQueries} for ${tierName} Tier). Reset happens at midnight IST. Upgrade your ZentrixPass to unlock more queries.`,
            limitReached: true,
            current: currentQueries,
            allowed: allowedQueries,
            tier: numTier,
            resetAt: "Midnight IST",
            upgradeAvailable: numTier < 2,
          }, { status: 429, headers: corsHeaders });
        }

        const systemPrompt = `You are Zentrix Assistant, an expert AI agent assisting a ${role} on the Zentrix marketplace built on MST Blockchain.
- Native token: tMSTC (MST Testnet, Chain ID 91562037).
- If the user asks for available jobs or gigs, use the 'search_gigs' tool.
- If the user is a client looking for talent, use the 'search_freelancers' tool.
- Always provide clear, actionable summaries and explain why each recommendation matches their criteria.
- Never output personal contact information (no raw emails or phone numbers). Everything is negotiated through Zentrix escrow.`;

        // Sarvam Chat API request using the production-supported model.
        const sarvamPayload: any = {
          model: "sarvam-30b",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
        };

        const sarvamRes = await fetch("https://api.sarvam.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-subscription-key": apiKey,
          },
          body: JSON.stringify(sarvamPayload),
        });

        if (!sarvamRes.ok) {
          const errText = await sarvamRes.text();
          console.error("Sarvam API error response:", errText);
          return Response.json({ error: `Sarvam API error: ${sarvamRes.statusText}` }, { status: 502, headers: corsHeaders });
        }

        const sarvamData: any = await sarvamRes.json();
        const choice = sarvamData.choices?.[0];
        const message = choice?.message;
        let finalAnswer = message?.content || "";
        let returnedGigs: any[] | undefined = undefined;
        let returnedFreelancers: any[] | undefined = undefined;

        // Handle Tool Calls
        if (message?.tool_calls && message.tool_calls.length > 0) {
          const toolCall = message.tool_calls[0];
          const fnName = toolCall.function?.name;
          let toolResult: any[] = [];

          if (fnName === "search_gigs") {
            returnedGigs = VERIFIED_GIGS;
            toolResult = VERIFIED_GIGS;
          } else if (fnName === "search_freelancers") {
            returnedFreelancers = VERIFIED_FREELANCERS;
            toolResult = VERIFIED_FREELANCERS;
          }

          // Follow-up completion turn with the same production model.
          const followUpRes = await fetch("https://api.sarvam.ai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "api-subscription-key": apiKey,
            },
            body: JSON.stringify({
              model: "sarvam-30b",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt },
                message,
                {
                  role: "tool",
                  tool_call_id: toolCall.id,
                  name: fnName,
                  content: JSON.stringify(toolResult),
                },
              ],
              temperature: 0.3,
            }),
          });

          if (followUpRes.ok) {
            const followUpData: any = await followUpRes.json();
            finalAnswer = followUpData.choices?.[0]?.message?.content || finalAnswer;
          }
        }

        // Clean up or format raw <tool_call> tags if output by model in text
        if (finalAnswer.includes("<tool_call>") || finalAnswer.includes("&lt;tool_call&gt;")) {
          const isSearchGigs = finalAnswer.toLowerCase().includes("search_gigs");
          const isSearchFreelancers = finalAnswer.toLowerCase().includes("search_freelancers");

          if (isSearchGigs) {
            returnedGigs = VERIFIED_GIGS;
            finalAnswer = "Here are the top active gigs currently verified in the Zentrix Escrow on MST Testnet (Chain ID 91562037). All milestones are secured by non-custodial smart contracts with automated review windows:";
          } else if (isSearchFreelancers) {
            returnedFreelancers = VERIFIED_FREELANCERS;
            finalAnswer = "Here are verified talent profiles indexed on Zentrix with on-chain soulbound credentials on MST Testnet (Chain ID 91562037):";
          } else {
            finalAnswer = finalAnswer.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "").trim() ||
              "I have queried the Zentrix marketplace on MST Blockchain. You can view all active milestones on the Marketplace page.";
          }
        }

        // Context-aware fallback if the user specifically asked for gigs or talent
        const promptLower = prompt.toLowerCase();
        if (!returnedGigs && (promptLower.includes("gig") || promptLower.includes("job") || promptLower.includes("project"))) {
          returnedGigs = VERIFIED_GIGS;
          if (!finalAnswer || finalAnswer.length < 20) {
            finalAnswer = "Here are the top active gigs currently verified in the Zentrix Escrow on MST Testnet (Chain ID 91562037):";
          }
        }
        if (!returnedFreelancers && (promptLower.includes("freelancer") || promptLower.includes("developer") || promptLower.includes("talent") || promptLower.includes("auditor"))) {
          returnedFreelancers = VERIFIED_FREELANCERS;
          if (!finalAnswer || finalAnswer.length < 20) {
            finalAnswer = "Here are verified talent profiles indexed on Zentrix with on-chain soulbound credentials on MST Testnet (Chain ID 91562037):";
          }
        }

        // Increment usage
        usageStore.set(usageKey, currentQueries + 1);

        return Response.json({
          answer: finalAnswer,
          gigs: returnedGigs,
          freelancers: returnedFreelancers,
          creditsLeft: Math.max(0, allowedQueries - (currentQueries + 1)),
          totalLimit: allowedQueries,
          tier: numTier,
        }, { headers: corsHeaders });
      } catch (err: any) {
        return Response.json({ error: err?.message || "Internal server error" }, { status: 500, headers: corsHeaders });
      }
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
});

console.log(`Zentrix Backend Server running on http://localhost:${server.port} (local dev only)`);

