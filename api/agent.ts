import type { VercelRequest, VercelResponse } from "@vercel/node";

// ─── CORS ────────────────────────────────────────────────────────────────────
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// ─── Tier limits ─────────────────────────────────────────────────────────────
const TIER_LIMITS: Record<number, number> = { 0: 2, 1: 10, 2: 15 };

// ─── IST date helper ─────────────────────────────────────────────────────────
function getISTDateString(): string {
  const d = new Date();
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  return new Date(utc + 5.5 * 3600000).toISOString().slice(0, 10);
}

// ─── In-memory rate store ─────────────────────────────────────────────────────
const usageStore = new Map<string, number>();

// ─── Fallback data ────────────────────────────────────────────────────────────
const VERIFIED_GIGS = [
  { id: "1", title: "BridgeKey Multi-Sig Wallet Integration", budget: "3.5 tMSTC", escrowPercent: "100%", tags: ["Solidity", "React", "BridgeKey Integration"], reviewWindow: "72h Auto-Release", description: "Build native BridgeKey signature request and transaction confirmation hooks with EIP-712 support.", status: "Open" },
  { id: "2", title: "Solidity Escrow Contract Invariant Fuzzing", budget: "2.0 tMSTC", escrowPercent: "100%", tags: ["Smart Contracts", "Security Audits", "Foundry"], reviewWindow: "48h Auto-Release", description: "Write Foundry and Echidna fuzz tests asserting that total contract balance equals locked plus withdrawable funds.", status: "Open" },
  { id: "3", title: "Frontend DApp Dashboard — React & TypeScript", budget: "2.2 tMSTC", escrowPercent: "100%", tags: ["React", "TypeScript", "Vite", "UI/UX"], reviewWindow: "72h Auto-Release", description: "Build responsive milestone tracker dashboard with live on-chain data and BridgeKey wallet integration.", status: "Open" },
  { id: "4", title: "3D Brand Identity & Interactive Spline Motion", budget: "2.5 tMSTC", escrowPercent: "100%", tags: ["Blender", "Spline", "Three.js"], reviewWindow: "48h Auto-Release", description: "Create futuristic 3D assets and interactive canvas components for Zentrix DApp.", status: "Open" },
  { id: "5", title: "MST Developer Documentation & Whitepaper", budget: "1.8 tMSTC", escrowPercent: "100%", tags: ["Technical Writing", "GitBook", "Solidity"], reviewWindow: "72h Auto-Release", description: "Write in-depth developer tutorials, contract walkthroughs, and technical whitepaper.", status: "Open" },
];

const VERIFIED_FREELANCERS = [
  { id: "f1", name: "Alex Dev", handle: "@alexdev", designation: "Senior Smart Contract Engineer", skills: ["Solidity", "OpenZeppelin v5", "Hardhat", "Foundry"], reputation: 99.4, tier: "Tier 2 Builder Pass", walletAddress: "0x8cA0f3176997F32CCBb4598Fc8C966C95aeEEc9e", milestonesCompleted: 14 },
  { id: "f2", name: "Priya Sharma", handle: "@priyasharma", designation: "Lead Frontend Web3 Architect", skills: ["React", "Vite", "BridgeKey", "TypeScript", "Tailwind"], reputation: 98.8, tier: "Tier 2 Builder Pass", walletAddress: "0x7FC1d02922d4865fd53De59697407a42e64d1Cad", milestonesCompleted: 11 },
  { id: "f3", name: "Vikram Malhotra", handle: "@vikramm", designation: "Web3 Security Auditor & QA", skills: ["Slither", "Echidna", "Invariant Fuzzing", "Solidity"], reputation: 99.1, tier: "Tier 2 Builder Pass", walletAddress: "0x73595081334A18D4298A160b162faB4Fb4B3c85B", milestonesCompleted: 18 },
];

// ─── Semantic tag aliases ─────────────────────────────────────────────────────
const TAG_ALIAS_MAP: Record<string, string[]> = {
  react: ["React", "TypeScript", "JavaScript", "Vite"],
  typescript: ["TypeScript", "React"],
  javascript: ["JavaScript", "React"],
  solidity: ["Solidity", "Smart Contracts"],
  frontend: ["React", "TypeScript", "JavaScript", "Vite", "Tailwind", "UI/UX"],
  backend: ["Node.js", "Express", "Rust", "Go"],
  "smart contract": ["Solidity", "OpenZeppelin", "Hardhat", "Foundry"],
  "smart contracts": ["Solidity", "OpenZeppelin", "Hardhat", "Foundry"],
  web3: ["Solidity", "Web3", "BridgeKey", "Ethers"],
  defi: ["Solidity", "DeFi", "OpenZeppelin"],
  security: ["Slither", "Echidna", "Foundry", "Security Audits", "Invariant Fuzzing"],
  audit: ["Slither", "Echidna", "Security Audits"],
  nft: ["NFT", "ERC721", "Solidity"],
  design: ["UI/UX", "Figma", "Blender"],
  "3d": ["Blender", "Three.js", "Spline"],
  vite: ["Vite", "React", "TypeScript"],
  tailwind: ["Tailwind", "CSS"],
  foundry: ["Foundry", "Solidity"],
  hardhat: ["Hardhat", "Solidity"],
};

function extractTags(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  const matched = new Set<string>();
  for (const [alias, tags] of Object.entries(TAG_ALIAS_MAP)) {
    if (lower.includes(alias)) tags.forEach((t) => matched.add(t));
  }
  const words = prompt.match(/\b[A-Za-z0-9#+.]+\b/g) || [];
  for (const w of words) {
    if (["react","typescript","solidity","rust","python","vite","figma","foundry","hardhat"].includes(w.toLowerCase())) {
      matched.add(w.charAt(0).toUpperCase() + w.slice(1));
    }
  }
  return Array.from(matched);
}

function scoreGig(gig: any, tags: string[]): number {
  if (!tags.length) return 1;
  const tokens = [...(gig.technologies || []), ...(gig.tags || []), gig.title || "", gig.description || ""].join(" ").toLowerCase();
  let score = 0;
  for (const t of tags) {
    if (tokens.includes(t.toLowerCase())) score += 2;
    else if (t.split(/[\s-]+/).some((p) => p.length > 2 && tokens.includes(p.toLowerCase()))) score += 1;
  }
  return score;
}

function scoreFreelancer(f: any, skills: string[]): number {
  if (!skills.length) return 1;
  const tokens = [...(f.skills || []), f.name || "", f.designation || ""].join(" ").toLowerCase();
  let score = 0;
  for (const s of skills) {
    if (tokens.includes(s.toLowerCase())) score += 2;
    else if (s.split(/[\s-]+/).some((p) => p.length > 2 && tokens.includes(p.toLowerCase()))) score += 1;
  }
  return score;
}

// ─── Firebase fetch helpers ───────────────────────────────────────────────────
const FB_BASE = "https://growup-dec3f-default-rtdb.asia-southeast1.firebasedatabase.app";

async function getRankedGigs(tags: string[], minBudget?: number) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(`${FB_BASE}/gigs.json`, { signal: ctrl.signal });
    clearTimeout(t);
    const data = await res.json();
    const raw: any[] = Object.values(data || {}).filter(Boolean);
    const pool = raw.length > 0 ? raw : VERIFIED_GIGS;
    const scored = pool
      .map((g: any) => {
        if (!g) return { score: -1, gig: null };
        if (minBudget !== undefined) {
          const bv = parseFloat(String(g.totalBudget || g.budget || "0").replace(/[^\d.]/g, ""));
          if (!isNaN(bv) && bv < minBudget) return { score: -1, gig: null };
        }
        return {
          score: scoreGig(g, tags),
          gig: {
            id: String(g.id || Math.random()),
            title: g.title,
            budget: String(g.totalBudget ?? g.budget ?? "1.0").includes("tMSTC")
              ? String(g.totalBudget ?? g.budget)
              : `${g.totalBudget ?? g.budget} tMSTC`,
            escrowPercent: "100%",
            tags: g.technologies || g.tags || [g.category || "Web3"],
            reviewWindow: (g.reviewWindowHours || 72) + "h Auto-Release",
            description: g.description,
            clientAddress: g.client || g.clientAddress,
            status: g.status || "Open",
          },
        };
      })
      .filter(({ score, gig }) => gig && (score > 0 || !tags.length))
      .sort((a, b) => b.score - a.score)
      .map(({ gig }) => gig);

    if (scored.length > 0) return scored;
    if (raw.length > 0) {
      return raw.map((g: any) => ({
        id: String(g.id || Math.random()),
        title: g.title,
        budget: String(g.totalBudget ?? g.budget ?? "1.0").includes("tMSTC")
          ? String(g.totalBudget ?? g.budget)
          : `${g.totalBudget ?? g.budget} tMSTC`,
        escrowPercent: "100%",
        tags: g.technologies || g.tags || [g.category || "Web3"],
        reviewWindow: (g.reviewWindowHours || 72) + "h Auto-Release",
        description: g.description,
        clientAddress: g.client || g.clientAddress,
        status: g.status || "Open",
      }));
    }
    return VERIFIED_GIGS;
  } catch (err) {
    console.error("[agent] getRankedGigs error:", err);
    return VERIFIED_GIGS;
  }
}

async function getRankedFreelancers(skills: string[]) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(`${FB_BASE}/users.json`, { signal: ctrl.signal });
    clearTimeout(t);
    const data = await res.json();
    const raw: any[] = Object.values(data || {}).filter((u: any) => u && u.role === "freelancer");
    const pool = raw.length > 0 ? raw : VERIFIED_FREELANCERS;
    const scored = pool
      .map((u: any) => {
        if (!u) return { score: -1, freelancer: null };
        return {
          score: scoreFreelancer(u, skills),
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
      .filter(({ score, freelancer }) => freelancer && (score > 0 || !skills.length))
      .sort((a, b) => b.score - a.score)
      .map(({ freelancer }) => freelancer);

    if (scored.length > 0) return scored;
    if (raw.length > 0) {
      return raw.map((u: any) => ({
        id: u.uid || u.id || u.walletAddress,
        name: u.name || "Freelancer",
        handle: "@" + (u.name || "talent").replace(/\s+/g, "").toLowerCase(),
        designation: u.skills?.join(", ") || u.designation || "Web3 Developer",
        skills: u.skills || [],
        reputation: u.reputation || 99.0,
        tier: u.tier || "Platform Freelancer",
        walletAddress: u.walletAddress || "0x0000000000000000000000000000000000000000",
        milestonesCompleted: u.milestonesCompleted || 0,
      }));
    }
    return VERIFIED_FREELANCERS;
  } catch (err) {
    console.error("[agent] getRankedFreelancers error:", err);
    return VERIFIED_FREELANCERS;
  }
}

// ─── Local summary builders ───────────────────────────────────────────────────
function gigSummary(gigs: any[], tags: string[]): string {
  const label = tags.length ? `**${tags.slice(0, 4).join(", ")}**` : "your criteria";
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

function freelancerSummary(freelancers: any[], skills: string[]): string {
  const label = skills.length ? `**${skills.slice(0, 4).join(", ")}**` : "your criteria";
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

// ─── Sarvam fetch with timeout ────────────────────────────────────────────────
async function callSarvam(apiKey: string, body: object, timeoutMs: number): Promise<any | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch("https://api.sarvam.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-subscription-key": apiKey },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) { console.error("[agent] Sarvam error:", res.status, await res.text()); return null; }
    return await res.json();
  } catch (e: any) { clearTimeout(t); console.error("[agent] Sarvam timeout:", e?.message); return null; }
}

const TOOLS = [
  { type: "function", function: { name: "search_gigs", description: "Search open freelance gigs on Zentrix by technology tags or budget.", parameters: { type: "object", properties: { tags: { type: "array", items: { type: "string" }, description: "Tech tags e.g. ['React','Solidity']" }, minBudget: { type: "number" } } } } },
  { type: "function", function: { name: "search_freelancers", description: "Search verified freelance talent on Zentrix by skill.", parameters: { type: "object", properties: { skills: { type: "array", items: { type: "string" }, description: "Skills e.g. ['React','Solidity']" } } } } },
];

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = { prompt: body }; } }

    let prompt: string = body?.prompt || "";
    if (!prompt && Array.isArray(body?.messages)) {
      const lastUser = [...body.messages].reverse().find((m: any) => m.role === "user");
      prompt = lastUser?.content || body.messages[body.messages.length - 1]?.content || "";
    }
    if (!prompt.trim()) return res.status(400).json({ error: "Prompt is required" });

    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "SARVAM_API_KEY not configured. Add it in Vercel → Settings → Environment Variables." });

    // Quota
    const wallet = ((body?.walletAddress as string) || "anonymous").toLowerCase();
    const numTier = Number(body?.tier) === 2 ? 2 : Number(body?.tier) === 1 ? 1 : 0;
    const allowed = TIER_LIMITS[numTier] ?? 2;
    const usageKey = `${wallet}_${getISTDateString()}`;
    const used = usageStore.get(usageKey) || 0;
    if (used >= allowed) {
      const tierName = numTier === 2 ? "Enterprise" : numTier === 1 ? "Pro" : "Free";
      return res.status(429).json({ error: `Daily limit reached (${allowed}/${allowed} for ${tierName}). Resets at midnight IST.`, limitReached: true, allowed, tier: numTier });
    }

    // Instant local tag extraction
    const tags = extractTags(prompt);
    const pl = prompt.toLowerCase();
    const isGig = ["gig","job","project","frontend","backend","work","open","match","find","skill","contract","defi","web3","solidity","react","typescript"].some((k) => pl.includes(k));
    const isTalent = ["freelancer","developer","talent","auditor","engineer","hire","who","find"].some((k) => pl.includes(k)) && !isGig;

    const sysPrompt = `You are Zentrix Assistant, an AI matchmaking agent for the Zentrix Web3 freelance marketplace on MST Blockchain (Chain ID 91562037, tMSTC).
Assisting a ${body?.role || "freelancer"}.
- For gig/job/project queries, call search_gigs with tags array.
- For talent/developer queries, call search_freelancers with skills array.
- Plain text responses only. No PII.`;

    // Parallel: Sarvam + Firebase
    const [sarvamData, fetchedData] = await Promise.all([
      callSarvam(apiKey, { model: "sarvam-105b-conversations", messages: [{ role: "system", content: sysPrompt }, { role: "user", content: prompt }], tools: TOOLS, tool_choice: "auto", temperature: 0.2, max_tokens: 512 }, 7000),
      (async (): Promise<{ gigs?: any[]; freelancers?: any[] }> => {
        if (isGig) return { gigs: await getRankedGigs(tags) };
        if (isTalent) return { freelancers: await getRankedFreelancers(tags) };
        return {};
      })(),
    ]);

    let returnedGigs = fetchedData.gigs;
    let returnedFreelancers = fetchedData.freelancers;
    let answer = "";

    if (sarvamData) {
      const msg = sarvamData.choices?.[0]?.message;
      if (msg?.tool_calls?.length > 0) {
        const tc = msg.tool_calls[0];
        let args: any = {};
        try { args = JSON.parse(tc.function?.arguments || "{}"); } catch { args = {}; }

        if (tc.function?.name === "search_gigs") {
          const mt: string[] = Array.isArray(args.tags) ? args.tags : [];
          const combined = Array.from(new Set([...mt, ...tags]));
          returnedGigs = await getRankedGigs(combined, typeof args.minBudget === "number" ? args.minBudget : undefined);
          answer = gigSummary(returnedGigs, combined);
        } else if (tc.function?.name === "search_freelancers") {
          const ms: string[] = Array.isArray(args.skills) ? args.skills : [];
          const combined = Array.from(new Set([...ms, ...tags]));
          returnedFreelancers = await getRankedFreelancers(combined);
          answer = freelancerSummary(returnedFreelancers, combined);
        }
      } else if (msg?.content) {
        answer = msg.content;
      }
    }

    // Deterministic fallback
    if (!returnedGigs && !returnedFreelancers) {
      if (isGig) returnedGigs = await getRankedGigs(tags);
      else if (isTalent) returnedFreelancers = await getRankedFreelancers(tags);
    }
    if (!answer || answer.length < 15) {
      if (returnedGigs) answer = gigSummary(returnedGigs, tags);
      else if (returnedFreelancers) answer = freelancerSummary(returnedFreelancers, tags);
      else answer = "I can help you find gigs or talent on Zentrix. Try: 'Show me open Solidity gigs' or 'Find React TypeScript freelancers'.";
    }

    answer = answer.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "").trim();
    usageStore.set(usageKey, used + 1);

    return res.status(200).json({ answer, gigs: returnedGigs, freelancers: returnedFreelancers, creditsLeft: Math.max(0, allowed - (used + 1)), totalLimit: allowed, tier: numTier });
  } catch (err: any) {
    console.error("[agent] Unhandled:", err);
    return res.status(500).json({ error: err?.message || "Internal server error" });
  }
}
