import {
  TIER_LIMITS,
  VERIFIED_GIGS,
  VERIFIED_FREELANCERS,
  getISTDateString,
} from "./shared";

const usageStore = new Map<string, number>();

export const AGENT_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_gigs",
      description: "Search and rank open freelance gigs on Zentrix marketplace by technology tags or minimum budget.",
      parameters: {
        type: "object",
        properties: {
          tags: { type: "array", items: { type: "string" }, description: "Tech tags e.g. ['React','TypeScript','Solidity']" },
          minBudget: { type: "number", description: "Minimum budget in tMSTC" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_freelancers",
      description: "Search and rank verified freelance talent on Zentrix by skill.",
      parameters: {
        type: "object",
        properties: {
          skills: { type: "array", items: { type: "string" }, description: "Skills e.g. ['React','Solidity','Security']" },
        },
      },
    },
  },
];

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
    if (lower.includes(alias)) tags.forEach((t) => matched.add(t));
  }
  const words = prompt.match(/\b[A-Za-z0-9#+.]+\b/g) || [];
  for (const w of words) {
    const wLower = w.toLowerCase();
    if (["react","typescript","solidity","rust","python","vite","figma","foundry","hardhat"].includes(wLower)) {
      matched.add(w.charAt(0).toUpperCase() + w.slice(1));
    }
  }
  return Array.from(matched);
}

export function scoreGigRelevance(gig: any, requestedTags: string[], minBudget?: number): number {
  if (minBudget !== undefined) {
    const bv = parseFloat(String(gig.totalBudget || gig.budget || "0").replace(/[^\d.]/g, ""));
    if (!isNaN(bv) && bv < minBudget) return -1;
  }
  if (requestedTags.length === 0) return 1;
  const tokens = [...(gig.technologies || []), ...(gig.tags || []), gig.category || "", gig.title || "", gig.description || ""].join(" ").toLowerCase();
  let score = 0;
  for (const tag of requestedTags) {
    const tl = tag.toLowerCase();
    if (tokens.includes(tl)) { score += 2; } else if (tl.split(/[\s-]+/).some((p) => p.length > 2 && tokens.includes(p))) { score += 1; }
  }
  return score;
}

export function scoreFreelancerRelevance(freelancer: any, requestedSkills: string[]): number {
  if (requestedSkills.length === 0) return 1;
  const tokens = [...(freelancer.skills || []), freelancer.name || "", freelancer.designation || ""].join(" ").toLowerCase();
  let score = 0;
  for (const skill of requestedSkills) {
    const sl = skill.toLowerCase();
    if (tokens.includes(sl)) { score += 2; } else if (sl.split(/[\s-]+/).some((p) => p.length > 2 && tokens.includes(p))) { score += 1; }
  }
  return score;
}

const FB_BASE = "https://growup-dec3f-default-rtdb.asia-southeast1.firebasedatabase.app";

function withAbort(timeoutMs: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

export async function fetchAndRankGigs(requestedTags: string[], minBudget?: number) {
  try {
    const { signal, clear } = withAbort(4000);
    const fbRes = await fetch(`${FB_BASE}/gigs.json`, { signal });
    clear();
    const data = await fbRes.json();
    const rawGigs: any[] = Object.values(data || {});
    const pool = rawGigs.length > 0 ? rawGigs : VERIFIED_GIGS;
    const scored = pool
      .map((g: any) => ({
        score: scoreGigRelevance(g, requestedTags, minBudget),
        gig: {
          id: String(g.id || Math.random()),
          title: g.title,
          budget: String(g.totalBudget ?? g.budget ?? "1.0").includes("tMSTC") ? String(g.totalBudget ?? g.budget) : `${g.totalBudget ?? g.budget} tMSTC`,
          escrowPercent: "100%",
          tags: g.technologies || g.tags || (g.category ? [g.category] : ["Web3"]),
          reviewWindow: (g.reviewWindowHours || 72) + "h Auto-Release",
          description: g.description,
          clientAddress: g.client || g.clientAddress,
          status: g.status || "Open",
        },
      }))
      .filter(({ score }) => score > 0 || requestedTags.length === 0)
      .sort((a, b) => b.score - a.score)
      .map(({ gig }) => gig);
    return scored.length > 0 ? scored : VERIFIED_GIGS;
  } catch { return VERIFIED_GIGS; }
}

export async function fetchAndRankFreelancers(requestedSkills: string[]) {
  try {
    const { signal, clear } = withAbort(4000);
    const fbRes = await fetch(`${FB_BASE}/users.json`, { signal });
    clear();
    const data = await fbRes.json();
    const rawUsers: any[] = Object.values(data || {}).filter((u: any) => u.role === "freelancer");
    const pool = rawUsers.length > 0 ? rawUsers : VERIFIED_FREELANCERS;
    const scored = pool
      .map((u: any) => ({
        score: scoreFreelancerRelevance(u, requestedSkills),
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
      }))
      .filter(({ score }) => score > 0 || requestedSkills.length === 0)
      .sort((a, b) => b.score - a.score)
      .map(({ freelancer }) => freelancer);
    return scored.length > 0 ? scored : VERIFIED_FREELANCERS;
  } catch { return VERIFIED_FREELANCERS; }
}

function buildGigSummary(gigs: any[], tags: string[]): string {
  const label = tags.length > 0 ? `**${tags.slice(0, 4).join(", ")}**` : "your criteria";
  let s = `Here are the top open gigs on Zentrix matching ${label}, secured by **MST Testnet milestone escrow**:\n\n`;
  for (const g of gigs.slice(0, 5)) {
    s += `**${g.title}** — ${g.budget}\n`;
    const t = Array.isArray(g.tags) ? g.tags.slice(0, 3).join(", ") : "";
    if (t) s += `Tags: ${t}\n`;
    if (g.description) s += `${String(g.description).slice(0, 100)}...\n`;
    s += "\n";
  }
  return (s + "All funds locked in non-custodial escrow on MST Testnet (Chain ID 91562037). Click any card to apply.").trim();
}

function buildFreelancerSummary(freelancers: any[], skills: string[]): string {
  const label = skills.length > 0 ? `**${skills.slice(0, 4).join(", ")}**` : "your criteria";
  let s = `Here are verified Zentrix freelancers specializing in ${label}:\n\n`;
  for (const f of freelancers.slice(0, 5)) {
    s += `**${f.name}** (${f.designation}) — ${f.reputation}% reputation\n`;
    const sk = Array.isArray(f.skills) ? f.skills.slice(0, 4).join(", ") : "";
    if (sk) s += `Skills: ${sk}\n`;
    if (f.milestonesCompleted) s += `${f.milestonesCompleted} milestones completed on-chain\n`;
    s += "\n";
  }
  return (s + "All profiles verified with on-chain milestone history on MST Testnet.").trim();
}

async function sarvamFetch(apiKey: string, body: any, timeoutMs: number): Promise<any | null> {
  const { signal, clear } = withAbort(timeoutMs);
  try {
    const res = await fetch("https://api.sarvam.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-subscription-key": apiKey },
      body: JSON.stringify(body),
      signal,
    });
    clear();
    if (!res.ok) {
      console.error("[AgentPipeline] Sarvam error:", res.status, await res.text());
      return null;
    }
    return await res.json();
  } catch (err: any) {
    clear();
    console.error("[AgentPipeline] Sarvam timeout/network:", err?.message);
    return null;
  }
}

export interface AgentRequestPayload {
  prompt?: string;
  messages?: Array<{ role: string; content: string }>;
  walletAddress?: string;
  role?: string;
  tier?: number;
}

export interface AgentResult { status: number; data: any; }

export async function processAgentPipeline(payload: AgentRequestPayload): Promise<AgentResult> {
  const { walletAddress, role = "freelancer", tier = 0 } = payload;
  let prompt: string = payload.prompt || "";

  if (!prompt && Array.isArray(payload.messages) && payload.messages.length > 0) {
    const lastUser = [...payload.messages].reverse().find((m) => m.role === "user");
    prompt = lastUser?.content || payload.messages[payload.messages.length - 1]?.content || "";
  }

  if (!prompt.trim()) return { status: 400, data: { error: "Prompt or message is required" } };

  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) return { status: 500, data: { error: "SARVAM_API_KEY is not configured on the server." } };

  // Stage 1: Quota check
  const userWallet = (walletAddress || "anonymous").toLowerCase();
  const usageKey = `${userWallet}_${getISTDateString()}`;
  const numTier = Number(tier) === 2 ? 2 : Number(tier) === 1 ? 1 : 0;
  const allowedQueries = TIER_LIMITS[numTier] ?? 2;
  const currentQueries = usageStore.get(usageKey) || 0;

  if (currentQueries >= allowedQueries) {
    const tierName = numTier === 2 ? "Enterprise" : numTier === 1 ? "Pro" : "Free";
    return {
      status: 429,
      data: {
        error: `Daily query limit reached (${allowedQueries}/${allowedQueries} for ${tierName} Tier). Resets at midnight IST. Upgrade your ZentrixPass to unlock more queries.`,
        limitReached: true, current: currentQueries, allowed: allowedQueries,
        tier: numTier, resetAt: "Midnight IST", upgradeAvailable: numTier < 2,
      },
    };
  }

  // Stage 2: Instant local tag extraction
  const algorithmicTags = extractTagsFromPrompt(prompt);
  const pl = prompt.toLowerCase();
  const isGigQuery = ["gig","job","project","frontend","backend","work","open","match","find","skill"].some((k) => pl.includes(k));
  const isFreelancerQuery = ["freelancer","developer","talent","auditor","engineer","hire","who"].some((k) => pl.includes(k));

  const systemPrompt = `You are Zentrix Assistant, the AI matchmaking agent for the Zentrix freelance marketplace on MST Blockchain (Chain ID 91562037, tMSTC).
Assisting a ${role}. Rules:
- For gigs/jobs/projects, call search_gigs with tags array.
- For talent/developers/auditors, call search_freelancers with skills array.
- Plain text only. No PII.`;

  // Stage 3: Parallel — Sarvam Turn 1 + Firebase fetch
  const [turn1Data, fetchedData] = await Promise.all([
    sarvamFetch(
      apiKey,
      { model: "sarvam-105b-conversations", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }], tools: AGENT_TOOLS, tool_choice: "auto", temperature: 0.2, max_tokens: 512 },
      7000
    ),
    (async (): Promise<{ gigs?: any[]; freelancers?: any[] }> => {
      if (isGigQuery) return { gigs: await fetchAndRankGigs(algorithmicTags) };
      if (isFreelancerQuery) return { freelancers: await fetchAndRankFreelancers(algorithmicTags) };
      return {};
    })(),
  ]);

  // Stage 4: Process Sarvam result
  let returnedGigs = fetchedData.gigs;
  let returnedFreelancers = fetchedData.freelancers;
  let finalAnswer = "";

  if (turn1Data) {
    const message = turn1Data.choices?.[0]?.message;
    if (message?.tool_calls?.length > 0) {
      const tc = message.tool_calls[0];
      const fnName = tc.function?.name;
      let fnArgs: any = {};
      try { fnArgs = JSON.parse(tc.function?.arguments || "{}"); } catch { fnArgs = {}; }

      if (fnName === "search_gigs") {
        const mt: string[] = Array.isArray(fnArgs.tags) ? fnArgs.tags : fnArgs.tag ? [fnArgs.tag] : [];
        const combined = Array.from(new Set([...mt, ...algorithmicTags]));
        returnedGigs = await fetchAndRankGigs(combined, typeof fnArgs.minBudget === "number" ? fnArgs.minBudget : undefined);
        finalAnswer = buildGigSummary(returnedGigs, combined);
      } else if (fnName === "search_freelancers") {
        const ms: string[] = Array.isArray(fnArgs.skills) ? fnArgs.skills : fnArgs.skill ? [fnArgs.skill] : [];
        const combined = Array.from(new Set([...ms, ...algorithmicTags]));
        returnedFreelancers = await fetchAndRankFreelancers(combined);
        finalAnswer = buildFreelancerSummary(returnedFreelancers, combined);
      }
    } else if (message?.content) {
      finalAnswer = message.content;
    }
  }

  // Stage 5: Deterministic fallback
  if (!returnedGigs && !returnedFreelancers) {
    if (isGigQuery) returnedGigs = await fetchAndRankGigs(algorithmicTags);
    else if (isFreelancerQuery) returnedFreelancers = await fetchAndRankFreelancers(algorithmicTags);
  }

  if (!finalAnswer || finalAnswer.length < 15) {
    if (returnedGigs) finalAnswer = buildGigSummary(returnedGigs, algorithmicTags);
    else if (returnedFreelancers) finalAnswer = buildFreelancerSummary(returnedFreelancers, algorithmicTags);
    else finalAnswer = "I can help you find gigs or talent on Zentrix. Try: 'Show me open Solidity gigs' or 'Find React TypeScript freelancers'.";
  }

  finalAnswer = finalAnswer.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "").trim();

  usageStore.set(usageKey, currentQueries + 1);

  return {
    status: 200,
    data: { answer: finalAnswer, gigs: returnedGigs, freelancers: returnedFreelancers, creditsLeft: Math.max(0, allowedQueries - (currentQueries + 1)), totalLimit: allowedQueries, tier: numTier },
  };
}
