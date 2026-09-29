import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { useAuth } from "../context/AuthContext";
import { useWallet } from "../context/WalletContext";
import { getCachedNFTAssets, scanNFTAssets } from "../lib/nftScanner";
import {
  Send,
  Zap,
  AlertCircle,
  User,
  RefreshCw,
  Coins,
  Clock,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Award,
  Briefcase,
  Sparkles,
} from "lucide-react";

export interface GigCardData {
  id: string;
  title: string;
  budget: string;
  escrowPercent?: string;
  tags: string[];
  reviewWindow?: string;
  description?: string;
  clientAddress?: string;
  status?: string;
}

export interface FreelancerCardData {
  id: string;
  name: string;
  handle?: string;
  designation: string;
  skills: string[];
  reputation: number;
  tier?: string;
  walletAddress: string;
  milestonesCompleted?: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
  creditsLeft?: number;
  gigs?: GigCardData[];
  freelancers?: FreelancerCardData[];
}

/* ─── Gig Interactive Card Component (Clickable Hyperlink) ─────────────────── */
const GigCard: React.FC<{ gig: GigCardData }> = ({ gig }) => (
  <Link
    to="/marketplace"
    className="zx-chat-gig-card group block rounded-2xl p-4 border transition-all duration-200 hover:shadow-lg hover:border-[var(--zx-primary)] space-y-3 cursor-pointer no-underline text-inherit"
    style={{
      background: "var(--zx-surface)",
      borderColor: "var(--zx-border)",
    }}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--zx-muted)]">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Escrow Verified · MST Testnet</span>
        </div>
        <h4 className="text-sm font-bold text-[var(--zx-ink)] group-hover:text-[var(--zx-primary-deep)] transition-colors leading-snug">
          {gig.title}
        </h4>
      </div>
      <div className="shrink-0 text-right">
        <div
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-black"
          style={{
            background: "color-mix(in srgb, var(--zx-primary-deep) 8%, transparent)",
            color: "var(--zx-primary-deep)",
            border: "1px solid color-mix(in srgb, var(--zx-primary-deep) 20%, transparent)",
          }}
        >
          <Coins className="w-3.5 h-3.5 text-[var(--zx-primary)]" />
          <span>{gig.budget}</span>
        </div>
        <div className="text-[10px] font-mono text-emerald-600 font-bold mt-0.5">
          {gig.escrowPercent || "100%"} Funded
        </div>
      </div>
    </div>

    {gig.description && (
      <p className="text-xs text-[var(--zx-muted)] line-clamp-2 leading-relaxed">
        {gig.description}
      </p>
    )}

    {/* Tags and Review Window */}
    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
      {gig.tags.map((tag) => (
        <span
          key={tag}
          className="px-2 py-0.5 rounded-md font-medium text-slate-700 bg-slate-100 border border-slate-200"
        >
          {tag}
        </span>
      ))}
      {gig.reviewWindow && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium text-amber-800 bg-amber-50 border border-amber-200">
          <Clock className="w-3 h-3 text-amber-600" />
          <span>{gig.reviewWindow}</span>
        </span>
      )}
    </div>

    {/* Footer with Marketplace Hyperlink Action */}
    <div
      className="pt-2 border-t flex items-center justify-between gap-2"
      style={{ borderColor: "var(--zx-border)" }}
    >
      {gig.clientAddress ? (
        <span className="text-[11px] font-mono text-[var(--zx-muted)]">
          Client: {gig.clientAddress.slice(0, 6)}...{gig.clientAddress.slice(-4)}
        </span>
      ) : (
        <span className="text-[11px] font-mono text-[var(--zx-muted)]">Non-Custodial Escrow</span>
      )}
      <span
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-opacity group-hover:opacity-95 shadow-xs"
        style={{ background: "var(--zx-primary)" }}
      >
        <Briefcase className="w-3.5 h-3.5" />
        <span>View Gig in Marketplace</span>
        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
      </span>
    </div>
  </Link>
);

/* ─── Freelancer Interactive Card Component (Clickable Hyperlink) ─────────── */
const FreelancerCard: React.FC<{ freelancer: FreelancerCardData }> = ({ freelancer }) => (
  <Link
    to="/profile"
    className="zx-chat-freelancer-card group block rounded-2xl p-4 border transition-all duration-200 hover:shadow-lg hover:border-[var(--zx-primary)] space-y-3 cursor-pointer no-underline text-inherit"
    style={{
      background: "var(--zx-surface)",
      borderColor: "var(--zx-border)",
    }}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-xs group-hover:scale-105 transition-transform"
          style={{ background: "var(--zx-primary)" }}
        >
          {freelancer.name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h4 className="text-sm font-bold text-[var(--zx-ink)] group-hover:text-[var(--zx-primary-deep)] transition-colors leading-tight">
            {freelancer.name}
          </h4>
          <div className="text-[11px] text-[var(--zx-muted)] font-medium">
            {freelancer.handle || `@${freelancer.name.toLowerCase().replace(/\s+/g, "")}`}
          </div>
          <p className="text-xs font-semibold text-[var(--zx-primary-deep)] mt-0.5">
            {freelancer.designation}
          </p>
        </div>
      </div>

      <div className="text-right shrink-0">
        <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
          <Award className="w-3 h-3 text-emerald-600" />
          <span>{freelancer.reputation}/100</span>
        </div>
        <div className="text-[10px] font-mono text-[var(--zx-muted)] mt-0.5">
          {freelancer.tier || "Tier 2 Builder"}
        </div>
      </div>
    </div>

    {/* Skills */}
    <div className="flex flex-wrap gap-1.5 text-[11px]">
      {freelancer.skills.map((skill) => (
        <span
          key={skill}
          className="px-2 py-0.5 rounded-md font-medium text-slate-700 bg-slate-100 border border-slate-200"
        >
          {skill}
        </span>
      ))}
    </div>

    {/* Footer with Profile Hyperlink Action & Wallet */}
    <div
      className="pt-2 border-t flex items-center justify-between gap-2"
      style={{ borderColor: "var(--zx-border)" }}
    >
      <span className="text-[11px] font-mono text-[var(--zx-muted)]">
        {freelancer.walletAddress.slice(0, 6)}...{freelancer.walletAddress.slice(-4)}
      </span>
      <span
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-opacity group-hover:opacity-95 shadow-xs"
        style={{ background: "var(--zx-ink)" }}
      >
        <User className="w-3.5 h-3.5" />
        <span>View Verified Profile</span>
        <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
      </span>
    </div>
  </Link>
);

/* ─── Robust Text Parsing & Clean Utilities ──────────────────────────────── */
function parseGigsFromText(text: string): GigCardData[] {
  const gigs: GigCardData[] = [];
  const seenIds = new Set<string>();

  if (text.includes("BridgeKey Multi-Sig") || text.includes("BridgeKey Wallet Integration")) {
    seenIds.add("1");
    gigs.push({
      id: "1",
      title: "Implement BridgeKey Multi-Sig Wallet Integration",
      budget: "3.5 tMSTC",
      escrowPercent: "100%",
      tags: ["Solidity", "React", "BridgeKey Integration"],
      reviewWindow: "72h Auto-Release Protected",
      description: "Build native BridgeKey signature request and transaction confirmation hooks with EIP-712 support.",
      clientAddress: "0x73595081334A18D4298A160b162faB4Fb4B3c85B",
    });
  }

  if (text.includes("3D Brand Identity") || text.includes("Spline Motion")) {
    seenIds.add("4");
    gigs.push({
      id: "4",
      title: "3D Brand Identity & Interactive Spline Motion",
      budget: "2.5 tMSTC",
      escrowPercent: "100%",
      tags: ["Blender", "Spline", "Three.js"],
      reviewWindow: "48h Auto-Release Protected",
      description: "Create futuristic 3D assets, geometric glass emblems, and interactive canvas components for Zentrix DApp.",
      clientAddress: "0x7FC1d02922d4865fd53De59697407a42e64d1Cad",
    });
  }

  if (
    text.includes("MST Developer Documentation") ||
    text.includes("MST Blockchain Developer Documentation") ||
    text.includes("Whitepaper")
  ) {
    seenIds.add("5");
    gigs.push({
      id: "5",
      title: "Comprehensive MST Developer Documentation & Whitepaper",
      budget: "1.8 tMSTC",
      escrowPercent: "100%",
      tags: ["Technical Writing", "GitBook", "Solidity"],
      reviewWindow: "72h Auto-Release Protected",
      description: "Write in-depth developer tutorials, contract walkthroughs, and technical whitepaper explaining milestone escrow.",
      clientAddress: "0x73595081334A18D4298A160b162faB4Fb4B3c85B",
    });
  }

  if (text.includes("Solidity Escrow Contract Invariant") || text.includes("Contract Invariant Fuzzing")) {
    seenIds.add("2");
    gigs.push({
      id: "2",
      title: "Solidity Escrow Contract Invariant Fuzzing",
      budget: "2.0 tMSTC",
      escrowPercent: "100%",
      tags: ["Smart Contracts", "Security Audits", "Foundry"],
      reviewWindow: "48h Auto-Release Protected",
      description: "Write Foundry and Echidna fuzz tests asserting that total contract balance equals locked funds.",
      clientAddress: "0x7FC1d02922d4865fd53De59697407a42e64d1Cad",
    });
  }

  // Regex fallback for dynamic gig bullet outputs
  if (gigs.length === 0) {
    const regex = /\d+\.\s+\*\*([^*]+)\*\*[\s\S]*?(?:Budget:\*\*?\s*([^\n]+))?[\s\S]*?(?:Tags:\*\*?\s*([^\n]+))?/gi;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const title = match[1]?.trim();
      const budget = match[2]?.trim() || "Escrow Funded";
      const tagsStr = match[3]?.trim() || "Web3, MST";
      const tags = tagsStr.split(",").map((t) => t.trim()).filter(Boolean);
      if (title && !seenIds.has(title)) {
        seenIds.add(title);
        gigs.push({
          id: `custom-${gigs.length + 1}`,
          title,
          budget,
          escrowPercent: "100%",
          tags: tags.length > 0 ? tags : ["Web3", "MST Testnet"],
          reviewWindow: "72h Auto-Release Protected",
        });
      }
    }
  }

  return gigs;
}

function parseFreelancersFromText(text: string): FreelancerCardData[] {
  const freelancers: FreelancerCardData[] = [];
  const seen = new Set<string>();

  if (text.includes("Alex Dev")) {
    seen.add("Alex Dev");
    freelancers.push({
      id: "f1",
      name: "Alex Dev",
      handle: "@alexdev",
      designation: "Senior Smart Contract Engineer",
      skills: ["Solidity", "OpenZeppelin v5", "Hardhat", "Foundry"],
      reputation: 99.4,
      tier: "Tier 2 Builder Pass",
      walletAddress: "0x8cA0f3176997F32CCBb4598Fc8C966C95aeEEc9e",
      milestonesCompleted: 14,
    });
  }

  if (text.includes("Priya Sharma")) {
    seen.add("Priya Sharma");
    freelancers.push({
      id: "f2",
      name: "Priya Sharma",
      handle: "@priyasharma",
      designation: "Lead Frontend Web3 Architect",
      skills: ["React", "Vite", "BridgeKey", "TypeScript", "Tailwind"],
      reputation: 98.8,
      tier: "Tier 2 Builder Pass",
      walletAddress: "0x7FC1d02922d4865fd53De59697407a42e64d1Cad",
      milestonesCompleted: 11,
    });
  }

  if (text.includes("Vikram Malhotra")) {
    seen.add("Vikram Malhotra");
    freelancers.push({
      id: "f3",
      name: "Vikram Malhotra",
      handle: "@vikramm",
      designation: "Web3 Security Auditor & QA",
      skills: ["Slither", "Echidna", "Invariant Fuzzing", "Solidity"],
      reputation: 99.1,
      tier: "Tier 2 Builder Pass",
      walletAddress: "0x73595081334A18D4298A160b162faB4Fb4B3c85B",
      milestonesCompleted: 18,
    });
  }

  return freelancers;
}

function getIntroAndOutro(text: string): { intro: string; outro: string } {
  // Find where the first numbered list item starts: "1. **"
  const firstIndex = text.search(/\d+\.\s+\*\*/);
  if (firstIndex === -1) {
    return { intro: text, outro: "" };
  }

  const intro = text.slice(0, firstIndex).trim();

  // Find where the list ends and outro starts (e.g. "All milestones" or "Both creators")
  const rest = text.slice(firstIndex);
  const outroMatch = rest.match(/\n\n([A-Z][^\n]+(?:smart contract|MST Blockchain|ZentrixEscrow|MST Testnet|creators|talent)[\s\S]*)$/i);
  const outro = outroMatch ? outroMatch[1].trim() : "";

  return { intro, outro };
}

/* ─── Animated loading dots ─────────────────────────────────────────────── */
const LoadingDots: React.FC = () => (
  <span className="inline-flex items-center gap-1" aria-label="AI is thinking">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: "var(--zx-muted)",
          display: "inline-block",
          animation: `zx-dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
        }}
      />
    ))}
  </span>
);

/* ─── Example prompts per role ───────────────────────────────────────────── */
const CLIENT_PROMPTS = [
  "Find me a senior Solidity developer experienced with OpenZeppelin v5.",
  "Who has built frontend apps with BridgeKey wallet integration?",
  "Recommend auditors for invariant fuzz testing and Slither reports.",
];

const FREELANCER_PROMPTS = [
  "What gigs match my skills in smart contracts and DeFi?",
  "Show open frontend projects requiring React and TypeScript.",
  "Find gigs with milestone-based escrow paying more than 2 tMSTC.",
];

export const AgentPage: React.FC = () => {
  const { profile, currentRole } = useAuth();
  const { address, provider, isConnected, connectWallet } = useWallet();

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Dynamic on-chain NFT pass tier detection (0 = Free: 5, 1 = Pro: 10, 2 = Enterprise: 15)
  const [userTier, setUserTier] = useState<number>(() => {
    const cached = getCachedNFTAssets(address);
    return cached.passTier || 0;
  });

  const maxCredits = userTier === 2 ? 15 : userTier === 1 ? 10 : 5;
  const [creditsLeft, setCreditsLeft] = useState<number>(maxCredits);

  // Scan on-chain NFT assets whenever address or provider changes
  useEffect(() => {
    if (!address) {
      setUserTier(0);
      setCreditsLeft(5);
      return;
    }

    const cached = getCachedNFTAssets(address);
    if (typeof cached.passTier === "number") {
      setUserTier(cached.passTier);
    }

    scanNFTAssets(address, provider)
      .then((res) => {
        if (typeof res.passTier === "number") {
          setUserTier(res.passTier);
        }
      })
      .catch(() => {});
  }, [address, provider]);

  // Synchronize creditsLeft ceiling when userTier changes
  useEffect(() => {
    setCreditsLeft((prev) => {
      if (prev <= 5 && maxCredits > 5) return maxCredits;
      return Math.min(prev, maxCredits);
    });
  }, [maxCredits]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const samplePrompts = currentRole === "client" ? CLIENT_PROMPTS : FREELANCER_PROMPTS;

  /* Auto-scroll to bottom when messages change */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend ?? input).trim();
    if (!text || isLoading) return;

    setErrorBanner(null);

    const userMsg: Message = { role: "user", content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          messages: updatedMessages.map(({ role, content }) => ({ role, content })),
          walletAddress: address || "anonymous",
          role: currentRole || "freelancer",
          tier: userTier,
        }),
      });

      const data = await res.json();

      if (res.status === 429) {
        setPaywallOpen(true);
        const tierTitle = userTier === 2 ? "Enterprise" : userTier === 1 ? "Pro" : "Free";
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              data.error ||
              `⚠️ Daily query quota exhausted (${maxCredits}/${maxCredits} for ${tierTitle} Tier). Reset happens at midnight IST. Upgrade your ZentrixPass to unlock more queries.`,
            isError: true,
          },
        ]);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || `Agent request failed (${res.status})`);
      }

      if (typeof data.creditsLeft === "number") {
        setCreditsLeft(data.creditsLeft);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer || "No response generated.",
          creditsLeft: data.creditsLeft,
          gigs: data.gigs,
          freelancers: data.freelancers,
        },
      ]);
    } catch (err: any) {
      const errMsg = err.message || "Failed to contact Sarvam AI service.";
      setErrorBanner(errMsg);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: errMsg,
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <>
      {/* Dot-bounce keyframe injected inline so it's co-located */}
      <style>{`
        @keyframes zx-dot-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>

      <div className="max-w-4xl mx-auto space-y-4">

        {/* ─── Top Banner ─── */}
        <div
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4"
          style={{
            background: "var(--zx-surface)",
            border: "1px solid var(--zx-border)",
            borderRadius: "1rem",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 flex items-center justify-center p-0 shrink-0"
              style={{overflow:"hidden", background: "var(--zx-primary-deep)", borderRadius: "6rem" }}
            >
                <img src="/robot.png" alt="AI Bot" className="robocontain" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-[var(--zx-ink)]">Zentrix AI Agent</h1>
              <p className="text-xs text-[var(--zx-muted)]">
                Powered by Sarvam 30B ·{" "}
                <span className="font-semibold text-[var(--zx-primary-deep)] uppercase">
                  {currentRole || "Freelancer"}
                </span>
                {" "}· Server-side only
              </p>
            </div>
          </div>

          {/* Credit meter */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs font-bold text-[var(--zx-ink)]">
                {creditsLeft} / {maxCredits} Credits Left
              </div>
              <div className="text-[10px] text-[var(--zx-muted)]">
                {userTier === 2
                  ? "Enterprise Pass (15/day)"
                  : userTier === 1
                  ? "Pro Pass (10/day)"
                  : "Free Tier (5/day)"}{" "}
                · Resets Midnight IST
              </div>
            </div>
            <Link to="/pricing" className="btn-secondary text-xs py-1.5 px-3">
              <Zap className="w-3.5 h-3.5" />
              <span>{userTier > 0 ? "Pass Details" : "Upgrade Pass"}</span>
            </Link>
          </div>
        </div>

        {/* ─── Error Banner ─── */}
        {errorBanner && (
          <div
            className="flex items-start gap-2 px-4 py-3 text-sm"
            style={{
              background: "color-mix(in srgb, var(--zx-danger) 10%, transparent)",
              border: "1px solid var(--zx-danger)",
              borderRadius: "0.75rem",
              color: "var(--zx-danger)",
            }}
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorBanner}</span>
            <button
              onClick={() => setErrorBanner(null)}
              className="ml-auto text-xs opacity-60 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}

        {/* ─── Chat Thread ─── */}
        <div
          className="flex flex-col"
          style={{
            background: "var(--zx-surface)",
            border: "1px solid var(--zx-border)",
            borderRadius: "1rem",
            minHeight: "420px",
            maxHeight: "540px",
            overflowY: "auto",
            padding: "1.25rem",
            gap: "1rem",
          }}
        >
          {/* ── Empty state ── */}
          {isEmpty && !isLoading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center py-8">
              <div
                className="w-16 h-16 flex items-center justify-center p-3"
                style={{ background: "var(--zx-surface-alt)", borderRadius: "1.25rem" }}
              >
                <img src="/robot.png" alt="AI Bot" className="w-10 h-10 object-contain" />
              </div>
              <div>
                <p className="text-base font-bold text-[var(--zx-ink)]">Ask Zentrix AI</p>
                <p className="text-sm text-[var(--zx-muted)] mt-1 max-w-xs">
                  I can match gigs, evaluate requirements, and surface verified talent — all server-side and privacy-preserving.
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full max-w-md">
                <p className="text-[11px] font-semibold text-[var(--zx-muted)] uppercase tracking-wider">
                  Try an example
                </p>
                {samplePrompts.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(p)}
                    className="text-xs p-3 text-left transition-colors"
                    style={{
                      background: "var(--zx-cream)",
                      border: "1px solid var(--zx-border)",
                      borderRadius: "0.75rem",
                      color: "var(--zx-ink)",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "var(--zx-surface-alt)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "var(--zx-cream)")
                    }
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Messages ── */}
          {messages.map((m, idx) => {
            const isAssistant = m.role === "assistant";
            const gigs = isAssistant ? (m.gigs && m.gigs.length > 0 ? m.gigs : parseGigsFromText(m.content)) : [];
            const freelancers = isAssistant ? (m.freelancers && m.freelancers.length > 0 ? m.freelancers : parseFreelancersFromText(m.content)) : [];
            const hasCards = gigs.length > 0 || freelancers.length > 0;
            const { intro, outro } = hasCards ? getIntroAndOutro(m.content) : { intro: m.content, outro: "" };

            return (
              <div
                key={idx}
                className={`flex items-end gap-2 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                style={{
                  maxWidth: hasCards ? "98%" : "88%",
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  width: hasCards ? "100%" : "auto",
                }}
              >
                {/* Avatar */}
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mb-1 overflow-hidden"
                  style={{
                    background: m.role === "user" ? "var(--zx-primary-deep)" : "var(--zx-surface-alt)",
                    color: m.role === "user" ? "var(--zx-cream)" : "var(--zx-primary-deep)",
                  }}
                >
                  {m.role === "user" ? (
                    <User className="w-3.5 h-3.5" />
                  ) : (
                    <img src="/robot.png" alt="AI Bot" className="w-4 h-4 object-contain" />
                  )}
                </div>

                {/* Bubble */}
                <div
                  className="text-xs sm:text-sm leading-relaxed"
                  style={{
                    padding: "0.875rem 1.125rem",
                    borderRadius: m.role === "user" ? "1rem 1rem 0.25rem 1rem" : "1rem 1rem 1rem 0.25rem",
                    background: m.isError
                      ? "color-mix(in srgb, var(--zx-danger) 10%, transparent)"
                      : m.role === "user"
                      ? "var(--zx-primary-deep)"
                      : "var(--zx-cream)",
                    color: m.isError
                      ? "var(--zx-danger)"
                      : m.role === "user"
                      ? "white"
                      : "var(--zx-ink)",
                    border: m.role === "assistant"
                      ? `1px solid ${m.isError ? "var(--zx-danger)" : "var(--zx-border)"}`
                      : "none",
                    width: hasCards ? "100%" : "auto",
                  }}
                >
                  {m.isError && <AlertCircle className="w-3.5 h-3.5 inline mr-1 mb-0.5" />}

                  {m.role === "user" ? (
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  ) : (
                    <div className="space-y-3">
                      {/* Markdown Response Intro */}
                      {intro && (
                        <div className="zx-agent-markdown leading-relaxed">
                          <ReactMarkdown
                            components={{
                              p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                              strong: ({ node, ...props }) => <strong className="font-bold text-[var(--zx-ink)]" {...props} />,
                              ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-2 space-y-1" {...props} />,
                              ol: ({ node, ...props }) => <ol className="list-decimal pl-4 mb-2 space-y-1" {...props} />,
                              li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
                              code: ({ node, inline, ...props }: any) =>
                                inline ? (
                                  <code className="px-1.5 py-0.5 rounded bg-black/5 font-mono text-[11px] text-[var(--zx-primary-deep)]" {...props} />
                                ) : (
                                  <code className="block p-2 rounded-lg bg-black/90 text-white font-mono text-[11px] overflow-x-auto my-2" {...props} />
                                ),
                              a: ({ node, ...props }) => (
                                <a
                                  className="font-bold underline hover:opacity-80 transition-opacity"
                                  style={{ color: "var(--zx-primary)" }}
                                  target={props.href?.startsWith("http") ? "_blank" : undefined}
                                  rel={props.href?.startsWith("http") ? "noreferrer" : undefined}
                                  {...props}
                                />
                              ),
                            }}
                          >
                            {intro}
                          </ReactMarkdown>
                        </div>
                      )}

                      {/* Interactive Gig Cards */}
                      {gigs.length > 0 && (
                        <div className="space-y-2.5 pt-1">
                          {gigs.map((gig) => (
                            <GigCard key={gig.id} gig={gig} />
                          ))}
                        </div>
                      )}

                      {/* Interactive Freelancer Cards */}
                      {freelancers.length > 0 && (
                        <div className="space-y-2.5 pt-1">
                          {freelancers.map((freelancer) => (
                            <FreelancerCard key={freelancer.id} freelancer={freelancer} />
                          ))}
                        </div>
                      )}

                      {/* Markdown Response Outro */}
                      {outro && (
                        <div className="zx-agent-markdown leading-relaxed pt-2 border-t border-slate-200/80 text-[11px] text-slate-600">
                          <ReactMarkdown
                            components={{
                              p: ({ node, ...props }) => <p className="mb-1 last:mb-0" {...props} />,
                              strong: ({ node, ...props }) => <strong className="font-bold text-[var(--zx-ink)]" {...props} />,
                            }}
                          >
                            {outro}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* ── Loading indicator ── */}
          {isLoading && (
            <div className="flex items-end gap-2" style={{ maxWidth: "88%", alignSelf: "flex-start" }}>
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ background: "var(--zx-surface-alt)", color: "var(--zx-primary-deep)" }}
              >
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              </div>
              <div
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "1rem 1rem 1rem 0.25rem",
                  background: "var(--zx-cream)",
                  border: "1px solid var(--zx-border)",
                }}
              >
                <LoadingDots />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ─── Suggested Prompts (when chat is active) ─── */}
        {!isEmpty && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-[var(--zx-muted)] uppercase tracking-wider">
              Suggested Queries
            </span>
            <div className="flex flex-wrap gap-2">
              {samplePrompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(p)}
                  disabled={isLoading}
                  className="text-xs p-2 transition-colors disabled:opacity-50"
                  style={{
                    background: "var(--zx-surface)",
                    border: "1px solid var(--zx-border)",
                    borderRadius: "0.625rem",
                    color: "var(--zx-ink)",
                    textAlign: "left",
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── Powered-by label ─── */}
        <p className="text-center text-[10px] text-[var(--zx-muted)]">
          Powered by <span className="font-semibold">Sarvam 30B</span> · Server-side only · Zero-PII
        </p>

        {/* ─── Input Bar ─── */}
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            placeholder="Ask Sarvam AI to match gigs or evaluate requirements…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            style={{
              background: "var(--zx-surface)",
              border: "1px solid var(--zx-border)",
              borderRadius: "0.75rem",
              color: "var(--zx-ink)",
              padding: "0.875rem 1rem",
              outline: "none",
              flex: 1,
              fontSize: "0.8125rem",
              transition: "box-shadow 0.15s",
            }}
            onFocus={(e) =>
              (e.currentTarget.style.boxShadow = "0 0 0 2px var(--zx-focus-ring)")
            }
            onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="btn-primary py-3.5 px-5 shadow-sm"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>

        {/* ─── Paywall Modal ─── */}
        {paywallOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "color-mix(in srgb, var(--zx-primary-deep) 45%, transparent)", backdropFilter: "blur(4px)" }}
          >
            <div
              className="w-full max-w-md p-6 text-center space-y-4"
              style={{
                background: "var(--zx-surface)",
                border: "1px solid var(--zx-border)",
                borderRadius: "1.25rem",
                boxShadow: "0 25px 50px -12px color-mix(in srgb, var(--zx-primary-deep) 25%, transparent)",
              }}
            >
              <div
                className="w-12 h-12 flex items-center justify-center mx-auto"
                style={{ background: "var(--zx-surface-alt)", borderRadius: "9999px" }}
              >
                <Zap className="w-6 h-6 text-[var(--zx-primary-deep)]" />
              </div>
              <h3 className="text-xl font-extrabold text-[var(--zx-ink)]">
                {userTier > 0 ? "Daily Pass Quota Reached" : "Daily Free Limit Reached"}
              </h3>
              <p className="text-xs text-[var(--zx-muted)] leading-relaxed">
                You have used your {maxCredits} daily queries for the {userTier === 2 ? "Enterprise" : userTier === 1 ? "Pro" : "Free"} tier.
                {userTier < 2
                  ? " Upgrade your ZentrixPass NFT on MST Testnet to unlock more queries daily."
                  : " Your queries will automatically replenish at midnight IST."}
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button onClick={() => setPaywallOpen(false)} className="btn-secondary text-xs">
                  Close
                </button>
                <Link to="/pricing" onClick={() => setPaywallOpen(false)} className="btn-primary text-xs">
                  View Pass Tiers
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
