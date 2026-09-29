import {
  TIER_LIMITS,
  VERIFIED_GIGS,
  VERIFIED_FREELANCERS,
  getISTDateString,
} from "./shared";

// In-memory rate store (resets on cold start)
const usageStore = new Map<string, number>();

// ─── Agent Tool Definitions ──────────────────────────────────────────────────
export const AGENT_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_gigs",
      description:
        "Search and rank open freelance gigs and milestones on Zentrix marketplace by tag, technology, or minimum budget.",
      parameters: {
        type: "object",
        properties: {
          tags: {
            type: "array",
            items: { type: "string" },
            description:
              "List of relevant technologies or category tags (e.g. ['React', 'TypeScript', 'frontend', 'Solidity'])",
          },
          minBudget: {
            type: "number",
            description: "Minimum budget in tMSTC (e.g. 2 means >= 2 tMSTC)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_freelancers",
      description:
        "Search and rank verified freelance talent on Zentrix by technical skill or domain expertise.",
      parameters: {
        type: "object",
        properties: {
          skills: {
            type: "array",
            items: { type: "string" },
            description:
              "List of technical skills or expertise (e.g. ['React', 'TypeScript', 'Solidity', 'Security'])",
          },
        },
      },
    },
  },
];

// ─── Semantic Tag & Skill Mapping ────────────────────────────────────────────
export const TAG_ALIAS_MAP: Record<string, string[]> = {
  react: ["React", "React.js", "ReactJS"],
  typescript: ["TypeScript", "TS"],
  javascript: ["JavaScript", "JS"],
  solidity: ["Solidity", "Smart Contracts"],
  frontend: ["React", "TypeScript", "JavaScript", "Vite", "Tailwind", "CSS", "UI/UX"],
  backend: ["Node.js", "Express", "Rust", "Go", "API"],
  "smart contract": ["Solidity", "OpenZeppelin", "Hardhat", "Foundry"],
  "smart contracts": ["Solidity", "OpenZeppelin", "Hardhat", "Foundry"],
  web3: ["Solidity", "Web3", "BridgeKey", "Ethers"],
  bridgekey: ["BridgeKey", "React", "TypeScript", "Web3"],
  security: ["Slither", "Echidna", "Foundry", "Security Audits", "Invariant Fuzzing"],
  audit: ["Slither", "Echidna", "Security Audits", "Invariant Fuzzing"],
  fuzz: ["Foundry", "Echidna", "Invariant Fuzzing"],
  invariant: ["Foundry", "Echidna", "Invariant Fuzzing"],
  defi: ["Solidity", "DeFi", "OpenZeppelin"],
  nft: ["NFT", "ERC721", "Solidity"],
  "3d": ["Blender", "Three.js", "Spline"],
  spline: ["Spline", "Three.js", "Blender"],
  documentation: ["Technical Writing", "GitBook"],
  "technical writing": ["Technical Writing", "GitBook"],
  vite: ["Vite", "React", "TypeScript"],
  tailwind: ["Tailwind", "CSS"],
  design: ["UI/UX", "Figma", "Blender"],
  "ui/ux": ["UI/UX", "Figma"],
};

export function extractTagsFromPrompt(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  const matched = new Set<string>();

  for (const [alias, tags] of Object.entries(TAG_ALIAS_MAP)) {
    if (lower.includes(alias)) {
      tags.forEach((t) => matched.add(t));
    }
  }

  // Extract explicit tech keywords or PascalCase identifiers
  const words = prompt.match(/\b[A-Za-z0-9#+.]+\b/g) || [];
  for (const w of words) {
    const wLower = w.toLowerCase();
    if (["react", "typescript", "solidity", "rust", "python", "vite", "figma", "foundry", "hardhat"].includes(wLower)) {
      matched.add(w.charAt(0).toUpperCase() + w.slice(1));
    }
  }

  return Array.from(matched);
}

// ─── Semantic Relevance Scoring ───────────────────────────────────────────────
export function scoreGigRelevance(gig: any, requestedTags: string[], minBudget?: number): number {
  if (minBudget !== undefined) {
    const budgetVal = parseFloat(String(gig.totalBudget || gig.budget || "0").replace(/[^\d.]/g, ""));
    if (!isNaN(budgetVal) && budgetVal < minBudget) return -1; // Excluded
  }

  if (requestedTags.length === 0) return 1;

  const targetTokens = [
    ...(gig.technologies || []),
    ...(gig.tags || []),
    gig.category || "",
    gig.title || "",
    gig.description || "",
  ]
    .join(" ")
    .toLowerCase();

  let score = 0;
  for (const tag of requestedTags) {
    const tLower = tag.toLowerCase();
    if (targetTokens.includes(tLower)) {
      score += 2; // Direct match
    } else {
      // Check partial token match
      const parts = tLower.split(/[\s-]+/);
      if (parts.some((p) => p.length > 2 && targetTokens.includes(p))) {
        score += 1;
      }
    }
  }

  return score;
}

export function scoreFreelancerRelevance(freelancer: any, requestedSkills: string[]): number {
  if (requestedSkills.length === 0) return 1;

  const targetTokens = [
    ...(freelancer.skills || []),
    freelancer.name || "",
    freelancer.designation || "",
  ]
    .join(" ")
    .toLowerCase();

  let score = 0;
  for (const skill of requestedSkills) {
    const sLower = skill.toLowerCase();
    if (targetTokens.includes(sLower)) {
      score += 2;
    } else {
      const parts = sLower.split(/[\s-]+/);
      if (parts.some((p) => p.length > 2 && targetTokens.includes(p))) {
        score += 1;
      }
    }
  }

  return score;
}

// ─── Firebase Fetch & Rank ───────────────────────────────────────────────────
const FB_BASE = "https://growup-dec3f-default-rtdb.asia-southeast1.firebasedatabase.app";

export async function fetchAndRankGigs(requestedTags: string[], minBudget?: number) {
  try {
    const fbRes = await fetch(`${FB_BASE}/gigs.json`);
    const data = await fbRes.json();
    const rawGigs: any[] = Object.values(data || {});

    const pool = rawGigs.length > 0 ? rawGigs : VERIFIED_GIGS;

    const scored = pool
      .map((g: any) => {
        const score = scoreGigRelevance(g, requestedTags, minBudget);
        return {
          score,
          gig: {
            id: String(g.id || Math.random()),
            title: g.title,
            budget: String(g.totalBudget ?? g.budget ?? "1.0").includes("tMSTC")
              ? String(g.totalBudget ?? g.budget)
              : `${g.totalBudget ?? g.budget} tMSTC`,
            escrowPercent: "100%",
            tags: g.technologies || g.tags || (g.category ? [g.category] : ["Web3"]),
            reviewWindow: (g.reviewWindowHours || 72) + "h Auto-Release",
            description: g.description,
            clientAddress: g.client || g.clientAddress,
            status: g.status || "Open",
          },
        };
      })
      .filter(({ score }) => score > 0 || requestedTags.length === 0)
      .sort((a, b) => b.score - a.score)
      .map(({ gig }) => gig);

    return scored.length > 0 ? scored : VERIFIED_GIGS;
  } catch {
    return VERIFIED_GIGS;
  }
}

export async function fetchAndRankFreelancers(requestedSkills: string[]) {
  try {
    const fbRes = await fetch(`${FB_BASE}/users.json`);
    const data = await fbRes.json();
    const rawUsers: any[] = Object.values(data || {}).filter((u: any) => u.role === "freelancer");

    const pool = rawUsers.length > 0 ? rawUsers : VERIFIED_FREELANCERS;

    const scored = pool
      .map((u: any) => {
        const score = scoreFreelancerRelevance(u, requestedSkills);
        return {
          score,
          freelancer: {
            id: u.uid || u.id || u.walletAddress,
            name: u.name || "Freelancer",
            handle: "@" + (u.name || "talent").replace(/\s+/g, "").toLowerCase(),
            designation: u.skills?.join(", ") || u.designation || "Web3 Developer",
            skills: u.skills || [],
            reputation: u.reputation || 99.0,
            tier: u.tier || "Platform Freelancer",
            walletAddress: u.walletAddress || "0x0000000000000000000000000000000000000000",
            milestonesCompleted: u.milestonesCompleted || 0,
          },
        };
      })
      .filter(({ score }) => score > 0 || requestedSkills.length === 0)
      .sort((a, b) => b.score - a.score)
      .map(({ freelancer }) => freelancer);

    return scored.length > 0 ? scored : VERIFIED_FREELANCERS;
  } catch {
    return VERIFIED_FREELANCERS;
  }
}

// ─── Full Agent Pipeline Execution ───────────────────────────────────────────
export interface AgentRequestPayload {
  prompt?: string;
  messages?: Array<{ role: string; content: string }>;
  walletAddress?: string;
  role?: string;
  tier?: number;
}

export interface AgentResult {
  status: number;
  data: any;
}

export async function processAgentPipeline(payload: AgentRequestPayload): Promise<AgentResult> {
  const { walletAddress, role = "freelancer", tier = 0 } = payload;
  let prompt: string = payload.prompt || "";

  if (!prompt && Array.isArray(payload.messages) && payload.messages.length > 0) {
    const lastUser = [...payload.messages].reverse().find((m) => m.role === "user");
    prompt = lastUser?.content || payload.messages[payload.messages.length - 1]?.content || "";
  }

  if (!prompt.trim()) {
    return { status: 400, data: { error: "Prompt or message is required" } };
  }

  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) {
    return { status: 500, data: { error: "SARVAM_API_KEY is not configured on the server." } };
  }

  // 1. Quota & Credit Management
  const userWallet = (walletAddress || "anonymous").toLowerCase();
  const todayIST = getISTDateString();
  const usageKey = `${userWallet}_${todayIST}`;
  const numTier = Number(tier) === 2 ? 2 : Number(tier) === 1 ? 1 : 0;
  const allowedQueries = TIER_LIMITS[numTier] ?? 2;
  const currentQueries = usageStore.get(usageKey) || 0;

  if (currentQueries >= allowedQueries) {
    const tierName = numTier === 2 ? "Enterprise" : numTier === 1 ? "Pro" : "Free";
    return {
      status: 429,
      data: {
        error: `Daily query limit reached (${allowedQueries}/${allowedQueries} for ${tierName} Tier). Resets at midnight IST. Upgrade your ZentrixPass to unlock more queries.`,
        limitReached: true,
        current: currentQueries,
        allowed: allowedQueries,
        tier: numTier,
        resetAt: "Midnight IST",
        upgradeAvailable: numTier < 2,
      },
    };
  }

  // 2. System Instructions for Sarvam
  const systemPrompt = `You are Zentrix Assistant, the expert AI matchmaking agent for the Zentrix freelance marketplace on MST Blockchain (Chain ID 91562037, native token tMSTC).
You are assisting a ${role}.

PIPELINE RULES:
1. When the user asks for open jobs, gigs, projects, or work (e.g. frontend, React, TypeScript, Solidity) -> CALL the 'search_gigs' tool with extracted 'tags' and optional 'minBudget'.
2. When the user looks for talent, developers, auditors, or people -> CALL the 'search_freelancers' tool with extracted 'skills'.
3. Always extract specific technologies into tags/skills arrays (e.g. ['React', 'TypeScript']).
4. After receiving tool results, provide an actionable, grounded summary detailing why each gig or talent matches their criteria.
5. All transactions and milestones are non-custodial on MST Testnet. Never disclose raw personal emails or phone numbers.`;

  // Model selection per Sarvam specification:
  // • Standard text completion/generation: "sarvam-105b"
  // • Chat, dialogue, or conversational assistance: "sarvam-105b-conversations"
  const MODEL_NAME = "sarvam-105b-conversations";

  let turn1Data: any = null;
  try {
    const sarvamRes = await fetch("https://api.sarvam.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": apiKey,
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        tools: AGENT_TOOLS,
        tool_choice: "auto",
        temperature: 0.2,
      }),
    });

    if (!sarvamRes.ok) {
      const errText = await sarvamRes.text();
      console.error("[AgentPipeline] Sarvam turn 1 error:", errText);
      return { status: 502, data: { error: `Sarvam API error: ${sarvamRes.statusText}` } };
    }

    turn1Data = await sarvamRes.json();
  } catch (err: any) {
    console.error("[AgentPipeline] Network fetch error:", err);
    return { status: 502, data: { error: "Failed to connect to Sarvam AI service" } };
  }

  const choice = turn1Data.choices?.[0];
  const message = choice?.message;
  let finalAnswer: string = message?.content || "";
  let returnedGigs: any[] | undefined = undefined;
  let returnedFreelancers: any[] | undefined = undefined;

  // 4. Stage 2: Tool Execution with Semantic Tag & Budget Scoring
  if (message?.tool_calls && message.tool_calls.length > 0) {
    const toolCall = message.tool_calls[0];
    const fnName = toolCall.function?.name;

    let fnArgs: any = {};
    try {
      fnArgs = JSON.parse(toolCall.function?.arguments || "{}");
    } catch {
      fnArgs = {};
    }

    // Merge model tags with algorithmic tag extraction for maximum recall
    const algorithmicTags = extractTagsFromPrompt(prompt);

    let toolResult: any[] = [];

    if (fnName === "search_gigs") {
      const modelTags: string[] = Array.isArray(fnArgs.tags) ? fnArgs.tags : fnArgs.tag ? [fnArgs.tag] : [];
      const combinedTags = Array.from(new Set([...modelTags, ...algorithmicTags]));
      const minBudget = typeof fnArgs.minBudget === "number" ? fnArgs.minBudget : undefined;

      returnedGigs = await fetchAndRankGigs(combinedTags, minBudget);
      toolResult = returnedGigs;
    } else if (fnName === "search_freelancers") {
      const modelSkills: string[] = Array.isArray(fnArgs.skills) ? fnArgs.skills : fnArgs.skill ? [fnArgs.skill] : [];
      const combinedSkills = Array.from(new Set([...modelSkills, ...algorithmicTags]));

      returnedFreelancers = await fetchAndRankFreelancers(combinedSkills);
      toolResult = returnedFreelancers;
    }

    // 5. Stage 3: Grounded Multi-Turn Synthesis via Sarvam 105B
    // IMPORTANT: Sarvam requires 'tools' to remain present when messages contain tool calls/results.
    try {
      const followUpRes = await fetch("https://api.sarvam.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-subscription-key": apiKey,
        },
        body: JSON.stringify({
          model: MODEL_NAME,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
            message,
            {
              role: "tool",
              tool_call_id: toolCall.id,
              name: fnName,
              content: JSON.stringify(toolResult.slice(0, 5)), // Top 5 relevant items
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
    } catch (followErr) {
      console.error("[AgentPipeline] Follow-up turn error:", followErr);
    }
  }

  // 6. Stage 4: Deterministic Fallback if model answered conversationally
  if (!returnedGigs && !returnedFreelancers) {
    const promptLower = prompt.toLowerCase();
    const extracted = extractTagsFromPrompt(prompt);

    const isGigQuery =
      promptLower.includes("gig") ||
      promptLower.includes("job") ||
      promptLower.includes("project") ||
      promptLower.includes("frontend") ||
      promptLower.includes("backend") ||
      promptLower.includes("work") ||
      promptLower.includes("open");

    const isFreelancerQuery =
      promptLower.includes("freelancer") ||
      promptLower.includes("developer") ||
      promptLower.includes("talent") ||
      promptLower.includes("auditor") ||
      promptLower.includes("engineer") ||
      promptLower.includes("hire") ||
      promptLower.includes("who");

    if (isGigQuery) {
      returnedGigs = await fetchAndRankGigs(extracted);
      if (!finalAnswer || finalAnswer.length < 20) {
        finalAnswer =
          extracted.length > 0
            ? `Here are open gigs on Zentrix matching **${extracted.slice(0, 3).join(", ")}**, secured by MST Testnet milestone escrow:`
            : "Here are open gigs currently available in the Zentrix marketplace:";
      }
    } else if (isFreelancerQuery) {
      returnedFreelancers = await fetchAndRankFreelancers(extracted);
      if (!finalAnswer || finalAnswer.length < 20) {
        finalAnswer =
          extracted.length > 0
            ? `Here are verified Zentrix freelancers specializing in **${extracted.slice(0, 3).join(", ")}**:`
            : "Here are verified talent profiles on Zentrix with on-chain credentials:";
      }
    }
  }

  // Strip any raw leaked <tool_call> tokens
  if (finalAnswer.includes("<tool_call>")) {
    finalAnswer = finalAnswer.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "").trim();
  }

  // Increment usage count
  usageStore.set(usageKey, currentQueries + 1);

  return {
    status: 200,
    data: {
      answer: finalAnswer || "Here are the top matches found on Zentrix marketplace:",
      gigs: returnedGigs,
      freelancers: returnedFreelancers,
      creditsLeft: Math.max(0, allowedQueries - (currentQueries + 1)),
      totalLimit: allowedQueries,
      tier: numTier,
    },
  };
}
