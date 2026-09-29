import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  CORS_HEADERS,
  TIER_LIMITS,
  VERIFIED_GIGS,
  VERIFIED_FREELANCERS,
  getISTDateString,
} from "./_lib/shared";

// NOTE: In-memory usage store resets per cold start. For persistent rate limiting
// across invocations, use a KV store (e.g. Vercel KV / Upstash Redis).
// This is acceptable for hackathon/demo use — spike task: ZENTRIX-RATE-PERSIST
const usageStore = new Map<string, number>();

const AGENT_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_gigs",
      description: "Search open freelance gigs and project milestones available on Zentrix marketplace.",
      parameters: {
        type: "object",
        properties: {
          tag: { type: "string", description: "Filter by industry tag or category" },
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
          skill: { type: "string", description: "Technology or expertise" },
        },
      },
    },
  },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return res.status(204).set(CORS_HEADERS).end();
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const body = req.body;
    const { walletAddress, role = "freelancer", tier = 0 } = body;
    let prompt: string = body.prompt;

    // Support both prompt string and conversation messages array
    if (!prompt && Array.isArray(body.messages) && body.messages.length > 0) {
      const lastUserMessage = [...body.messages].reverse().find((m: any) => m.role === "user");
      prompt = lastUserMessage?.content || body.messages[body.messages.length - 1]?.content;
    }

    if (!prompt) {
      return res.status(400).json({ error: "Prompt or message is required" });
    }

    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "SARVAM_API_KEY is not configured on the server." });
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
      return res.status(429).json({
        error: `Daily query limit reached (${allowedQueries}/${allowedQueries} for ${tierName} Tier). Reset happens at midnight IST. Upgrade your ZentrixPass to unlock more queries.`,
        limitReached: true,
        current: currentQueries,
        allowed: allowedQueries,
        tier: numTier,
        resetAt: "Midnight IST",
        upgradeAvailable: numTier < 2,
      });
    }

    const systemPrompt = `You are Zentrix Assistant, an expert AI agent assisting a ${role} on the Zentrix marketplace built on MST Blockchain.
- Native token: tMSTC (MST Testnet, Chain ID 91562037).
- If the user asks for available jobs or gigs, use the 'search_gigs' tool.
- If the user is a client looking for talent, use the 'search_freelancers' tool.
- Always provide clear, actionable summaries and explain why each recommendation matches their criteria.
- Never output personal contact information (no raw emails or phone numbers). Everything is negotiated through Zentrix escrow.`;

    // Sarvam Chat API Request
    const sarvamPayload: any = {
      model: "sarvam-30b",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      tools: AGENT_TOOLS,
      tool_choice: "auto",
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
      console.error("Sarvam API error:", errText);
      return res.status(502).json({ error: `Sarvam API error: ${sarvamRes.statusText}` });
    }

    const sarvamData: any = await sarvamRes.json();
    const choice = sarvamData.choices?.[0];
    const message = choice?.message;
    let finalAnswer: string = message?.content || "";
    let returnedGigs: any[] | undefined = undefined;
    let returnedFreelancers: any[] | undefined = undefined;

    // Handle Tool Calls
    if (message?.tool_calls && message.tool_calls.length > 0) {
      const toolCall = message.tool_calls[0];
      const fnName = toolCall.function?.name;
      let toolResult: any[] = [];

      if (fnName === "search_gigs") {
        try {
          const fbRes = await fetch("https://growup-dec3f-default-rtdb.asia-southeast1.firebasedatabase.app/gigs.json");
          const data = await fbRes.json();
          const liveGigs = Object.values(data || {}).map((g: any) => ({
            id: g.id,
            title: g.title,
            budget: g.totalBudget + " tMSTC",
            escrowPercent: "100%",
            tags: g.technologies || [g.category],
            reviewWindow: (g.reviewWindowHours || 72) + "h Auto-Release",
            description: g.description,
            clientAddress: g.client,
            status: g.status,
          }));
          returnedGigs = liveGigs.length > 0 ? liveGigs : VERIFIED_GIGS;
        } catch {
          returnedGigs = VERIFIED_GIGS;
        }
        toolResult = returnedGigs;
      } else if (fnName === "search_freelancers") {
        try {
          const fbRes = await fetch("https://growup-dec3f-default-rtdb.asia-southeast1.firebasedatabase.app/users.json");
          const data = await fbRes.json();
          const liveFreelancers = Object.values(data || {})
            .filter((u: any) => u.role === "freelancer")
            .map((u: any) => ({
              id: u.uid || u.walletAddress,
              name: u.name,
              handle: "@" + u.name.replace(/\s+/g, '').toLowerCase(),
              designation: u.skills?.join(", ") || "Freelancer",
              skills: u.skills || [],
              reputation: 99.0, // Mocked for now until we query contract
              tier: "Platform Freelancer",
              walletAddress: u.walletAddress,
              milestonesCompleted: 0,
            }));
          returnedFreelancers = liveFreelancers.length > 0 ? liveFreelancers : VERIFIED_FREELANCERS;
        } catch {
          returnedFreelancers = VERIFIED_FREELANCERS;
        }
        toolResult = returnedFreelancers;
      }

      // Follow-up completion turn
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
          tools: AGENT_TOOLS,
          temperature: 0.3,
        }),
      });

      if (followUpRes.ok) {
        const followUpData: any = await followUpRes.json();
        finalAnswer = followUpData.choices?.[0]?.message?.content || finalAnswer;
      }
    }

    // Clean up raw <tool_call> tags if output by model in text
    if (finalAnswer.includes("<tool_call>") || finalAnswer.includes("&lt;tool_call&gt;")) {
      const isSearchGigs = finalAnswer.toLowerCase().includes("search_gigs");
      const isSearchFreelancers = finalAnswer.toLowerCase().includes("search_freelancers");

      if (isSearchGigs) {
        try {
          const fbRes = await fetch("https://growup-dec3f-default-rtdb.asia-southeast1.firebasedatabase.app/gigs.json");
          const data = await fbRes.json();
          returnedGigs = Object.values(data || {}).map((g: any) => ({
            id: g.id, title: g.title, budget: g.totalBudget + " tMSTC", escrowPercent: "100%", tags: g.technologies || [g.category], reviewWindow: (g.reviewWindowHours || 72) + "h Auto-Release", description: g.description, clientAddress: g.client, status: g.status,
          }));
          if (returnedGigs.length === 0) returnedGigs = VERIFIED_GIGS;
        } catch { returnedGigs = VERIFIED_GIGS; }
        finalAnswer = "Here are the top active gigs currently verified in the Zentrix Escrow on MST Testnet (Chain ID 91562037). All milestones are secured by non-custodial smart contracts with automated review windows:";
      } else if (isSearchFreelancers) {
        try {
          const fbRes = await fetch("https://growup-dec3f-default-rtdb.asia-southeast1.firebasedatabase.app/users.json");
          const data = await fbRes.json();
          returnedFreelancers = Object.values(data || {}).filter((u: any) => u.role === "freelancer").map((u: any) => ({
            id: u.uid || u.walletAddress, name: u.name, handle: "@" + u.name.replace(/\s+/g, '').toLowerCase(), designation: u.skills?.join(", ") || "Freelancer", skills: u.skills || [], reputation: 99.0, tier: "Platform Freelancer", walletAddress: u.walletAddress, milestonesCompleted: 0,
          }));
          if (returnedFreelancers.length === 0) returnedFreelancers = VERIFIED_FREELANCERS;
        } catch { returnedFreelancers = VERIFIED_FREELANCERS; }
        finalAnswer = "Here are verified talent profiles indexed on Zentrix with on-chain soulbound credentials on MST Testnet (Chain ID 91562037):";
      } else {
        finalAnswer = finalAnswer.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "").trim() ||
          "I have queried the Zentrix marketplace on MST Blockchain. You can view all active milestones on the Marketplace page.";
      }
    }

    // Context-aware fallback
    const promptLower = prompt.toLowerCase();
    if (!returnedGigs && (promptLower.includes("gig") || promptLower.includes("job") || promptLower.includes("project"))) {
      try {
        const fbRes = await fetch("https://growup-dec3f-default-rtdb.asia-southeast1.firebasedatabase.app/gigs.json");
        const data = await fbRes.json();
        returnedGigs = Object.values(data || {}).map((g: any) => ({
          id: g.id, title: g.title, budget: g.totalBudget + " tMSTC", escrowPercent: "100%", tags: g.technologies || [g.category], reviewWindow: (g.reviewWindowHours || 72) + "h Auto-Release", description: g.description, clientAddress: g.client, status: g.status,
        }));
        if (returnedGigs.length === 0) returnedGigs = VERIFIED_GIGS;
      } catch { returnedGigs = VERIFIED_GIGS; }
      if (!finalAnswer || finalAnswer.length < 20) {
        finalAnswer = "Here are the top active gigs currently verified in the Zentrix Escrow on MST Testnet (Chain ID 91562037):";
      }
    }
    if (!returnedFreelancers && (promptLower.includes("freelancer") || promptLower.includes("developer") || promptLower.includes("talent") || promptLower.includes("auditor"))) {
      try {
        const fbRes = await fetch("https://growup-dec3f-default-rtdb.asia-southeast1.firebasedatabase.app/users.json");
        const data = await fbRes.json();
        returnedFreelancers = Object.values(data || {}).filter((u: any) => u.role === "freelancer").map((u: any) => ({
          id: u.uid || u.walletAddress, name: u.name, handle: "@" + u.name.replace(/\s+/g, '').toLowerCase(), designation: u.skills?.join(", ") || "Freelancer", skills: u.skills || [], reputation: 99.0, tier: "Platform Freelancer", walletAddress: u.walletAddress, milestonesCompleted: 0,
        }));
        if (returnedFreelancers.length === 0) returnedFreelancers = VERIFIED_FREELANCERS;
      } catch { returnedFreelancers = VERIFIED_FREELANCERS; }
      if (!finalAnswer || finalAnswer.length < 20) {
        finalAnswer = "Here are verified talent profiles indexed on Zentrix with on-chain soulbound credentials on MST Testnet (Chain ID 91562037):";
      }
    }

    // Increment usage
    usageStore.set(usageKey, currentQueries + 1);

    return res.status(200).json({
      answer: finalAnswer,
      gigs: returnedGigs,
      freelancers: returnedFreelancers,
      creditsLeft: Math.max(0, allowedQueries - (currentQueries + 1)),
      totalLimit: allowedQueries,
      tier: numTier,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Internal server error" });
  }
}
