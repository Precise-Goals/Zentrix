// Shared data and helpers for Zentrix serverless functions
// Rule: No PII on chain, no secrets in client code. Sarvam called server-side only.

// IST Date helper (UTC+5:30)
export function getISTDateString(): string {
  const d = new Date();
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const istDate = new Date(utc + 5.5 * 3600000);
  return istDate.toISOString().slice(0, 10);
}

// Tier query allowances
export const TIER_LIMITS: Record<number, number> = {
  0: 2,  // Free Tier
  1: 10, // Pro Pass NFT
  2: 15, // Enterprise Pass NFT
};

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Sarvam tool definitions
export const AGENT_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_gigs",
      description: "Search open freelance gigs and project milestones available on Zentrix marketplace.",
      parameters: {
        type: "object",
        properties: {
          tag: { type: "string", description: "Filter by industry tag, e.g. web3, frontend, smart-contracts" },
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

