import { processAgentPipeline } from "../api/_lib/agentEngine";

async function run() {
  console.log("=== TEST 1: Smart contracts and DeFi ===");
  const t0 = Date.now();
  const res1 = await processAgentPipeline({
    prompt: "What gigs match my skills in smart contracts and DeFi?",
    role: "freelancer",
  });
  console.log("Status:", res1.status, "Time:", Date.now() - t0, "ms");
  console.log("Gigs found:", res1.data.gigs?.length);
  console.log("Top gig:", res1.data.gigs?.[0]?.title);
  console.log("Answer preview:\n", res1.data.answer?.slice(0, 300));

  console.log("\n=== TEST 2: React and TypeScript ===");
  const t1 = Date.now();
  const res2 = await processAgentPipeline({
    prompt: "Show open frontend projects requiring React and TypeScript",
    role: "freelancer",
  });
  console.log("Status:", res2.status, "Time:", Date.now() - t1, "ms");
  console.log("Gigs found:", res2.data.gigs?.length);
  console.log("Top gig:", res2.data.gigs?.[0]?.title);
  console.log("Answer preview:\n", res2.data.answer?.slice(0, 300));
}

run().catch(console.error);
