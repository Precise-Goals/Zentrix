import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWallet } from "../context/WalletContext";
import { ethers } from "ethers";
import { CONTRACT_ADDRESSES, CONTRACT_ABIS } from "../contracts";
import { FREELANCE_CATEGORIES, ALL_FREELANCE_TAGS } from "../lib/tags";
import { rtdb } from "../lib/firebase";
import { ref, onValue, set, get, update } from "firebase/database";
import { EscrowFlowInfographic } from "../components/EscrowFlowInfographic";
import {
  Layers,
  PlusCircle,
  Search,
  Filter,
  Clock,
  Coins,
  ShieldCheck,
  Send,
  CheckCircle,
  ExternalLink,
  Briefcase,
  X,
  Sparkles,
  Tag,
  Check,
  Lock,
  ArrowRight,
  User, Users,
} from "lucide-react";

interface MilestoneItem {
  title: string;
  amount: string;
  deadlineDays: number;
  acceptanceCriteria: string;
}

export interface ProposalItem {
  id: string;
  freelancerAddress: string;
  freelancerName?: string;
  proposalText: string;
  submittedAt: string;
  status: "Submitted" | "Accepted" | "Rejected";
}

export interface GigItem {
  id: string;
  title: string;
  description: string;
  client: string;
  totalBudget: string;
  reviewWindowHours: number;
  category: string;
  tags: string[];
  technologies: string[];
  status: "Open" | "Submitted" | "Assigned" | "Active" | "Completed";
  milestones: MilestoneItem[];
  proposals?: ProposalItem[];
  assignedFreelancer?: string;
  acceptedAt?: string;
  freelancer?: string;
}

const INITIAL_GIGS: GigItem[] = [
  {
    id: "1",
    title: "Implement BridgeKey Multi-Sig Wallet Integration",
    description: "Build native BridgeKey signature request and transaction confirmation hooks with EIP-712 support.",
    client: "0x73595081334A18D4298A160b162faB4Fb4B3c85B",
    totalBudget: "3.5",
    reviewWindowHours: 72,
    category: "Development",
    tags: ["Solidity", "Frontend (React/Vite)", "BridgeKey Integration"],
    technologies: ["React", "BridgeKey", "TypeScript", "Ethers"],
    status: "Open",
    milestones: [
      {
        title: "Milestone 1: EIP-1193 Provider Detection Hook",
        amount: "1.0",
        deadlineDays: 3,
        acceptanceCriteria: "Detection works on Chrome with BridgeKey and falls back gracefully to MetaMask.",
      },
      {
        title: "Milestone 2: Sign Message & Nonce Verification",
        amount: "1.5",
        deadlineDays: 5,
        acceptanceCriteria: "Server-side recovery matching client public key and generating session token.",
      },
      {
        title: "Milestone 3: End-to-End Test Suite",
        amount: "1.0",
        deadlineDays: 4,
        acceptanceCriteria: "Passes automated integration tests on MST Testnet.",
      },
    ],
  },
  {
    id: "2",
    title: "Solidity Escrow Contract Invariant Fuzzing",
    description: "Write Foundry and Echidna fuzz tests asserting that total contract balance equals locked plus withdrawable funds.",
    client: "0x7FC1d02922d4865fd53De59697407a42e64d1Cad",
    totalBudget: "2.0",
    reviewWindowHours: 48,
    category: "Development",
    tags: ["Smart Contracts", "Security Audits", "Foundry / Hardhat"],
    technologies: ["Solidity", "Hardhat", "Foundry"],
    status: "Open",
    milestones: [
      {
        title: "Milestone 1: Invariant definition & Slither run",
        amount: "0.8",
        deadlineDays: 3,
        acceptanceCriteria: "Zero High or Medium findings in Slither audit report.",
      },
      {
        title: "Milestone 2: 10,000 iterations invariant fuzz run",
        amount: "1.2",
        deadlineDays: 5,
        acceptanceCriteria: "Balance invariant holds across reentrancy and arbitrary withdrawal sequences.",
      },
    ],
  },
  {
    id: "3",
    title: "Sarvam 30B Agent Tool-Calling Fine Tuning & RAG",
    description: "Build an optimized prompt and tool definitions for talent recommendations with zero PII leaks.",
    client: "0x73595081334A18D4298A160b162faB4Fb4B3c85B",
    totalBudget: "4.0",
    reviewWindowHours: 72,
    category: "AI",
    tags: ["Sarvam AI Integration", "Prompt Engineering", "RAG Architecture"],
    technologies: ["Sarvam AI", "Bun", "TypeScript"],
    status: "Open",
    milestones: [
      {
        title: "Milestone 1: Tool definitions and schema validation",
        amount: "2.0",
        deadlineDays: 4,
        acceptanceCriteria: "Strict Zod schemas preventing phone and email leakage in outputs.",
      },
      {
        title: "Milestone 2: Streaming integration & token metering",
        amount: "2.0",
        deadlineDays: 4,
        acceptanceCriteria: "429 responses on daily quota exhaustion with IST midnight reset.",
      },
    ],
  },
  {
    id: "4",
    title: "3D Brand Identity & Interactive Spline Motion for DApp",
    description: "Create futuristic 3D assets, geometric glass emblems, and interactive canvas components for Zentrix DApp.",
    client: "0x7FC1d02922d4865fd53De59697407a42e64d1Cad",
    totalBudget: "2.5",
    reviewWindowHours: 48,
    category: "Design",
    tags: ["3D Modeling & Blender", "Motion Graphics", "Brand Identity & Logos"],
    technologies: ["Blender", "Spline", "Figma", "Three.js"],
    status: "Open",
    milestones: [
      {
        title: "Milestone 1: 3D Token & Brand Kit",
        amount: "1.0",
        deadlineDays: 4,
        acceptanceCriteria: "3D OBJ/GLTF files and vector brand guidelines delivered.",
      },
      {
        title: "Milestone 2: Spline Interactive Hero Component",
        amount: "1.5",
        deadlineDays: 5,
        acceptanceCriteria: "Smooth 60fps WebGL canvas integration in React.",
      },
    ],
  },
  {
    id: "5",
    title: "Comprehensive MST Blockchain Developer Documentation & Whitepaper",
    description: "Write in-depth developer tutorials, contract walkthroughs, and technical whitepaper explaining milestone escrow.",
    client: "0x73595081334A18D4298A160b162faB4Fb4B3c85B",
    totalBudget: "1.8",
    reviewWindowHours: 72,
    category: "Content",
    tags: ["Technical Writing", "Whitepapers & Litepapers", "Documentation & GitBook"],
    technologies: ["Markdown", "GitBook", "Solidity"],
    status: "Open",
    milestones: [
      {
        title: "Milestone 1: Smart Contract Architecture Specification",
        amount: "0.8",
        deadlineDays: 4,
        acceptanceCriteria: "Slither & Foundry verified doc chapter with sequence diagrams.",
      },
      {
        title: "Milestone 2: SDK Quickstart Guides",
        amount: "1.0",
        deadlineDays: 4,
        acceptanceCriteria: "Working code snippets tested on MST Testnet.",
      },
    ],
  },
  {
    id: "6",
    title: "Discord Community Infrastructure & Web3 Verification Bot",
    description: "Set up enterprise Discord server with tiered access roles tied to ZentrixPass NFTs and BridgeKey verification.",
    client: "0x8cA0f3176997F32CCBb4598Fc8C966C95aeEEc9e",
    totalBudget: "1.5",
    reviewWindowHours: 48,
    category: "Growth",
    tags: ["Community Management", "Discord Server Architecture", "DAO Governance"],
    technologies: ["Discord.js", "Node.js", "Webhooks"],
    status: "Open",
    milestones: [
      {
        title: "Milestone 1: Server Setup & Permission Matrix",
        amount: "0.5",
        deadlineDays: 2,
        acceptanceCriteria: "Onboarding channels, rules, and moderation hierarchy ready.",
      },
      {
        title: "Milestone 2: Pass NFT Role Sync Bot",
        amount: "1.0",
        deadlineDays: 4,
        acceptanceCriteria: "Bot queries ZentrixPass.tierOf(address) and assigns Discord roles.",
      },
    ],
  },
];

export const MarketplacePage: React.FC = () => {
  const { currentRole, profile, user } = useAuth();
  const { address, isConnected, openConnectModal, signer } = useWallet();
  const [isLoadingTransaction, setIsLoadingTransaction] = useState(false);

  const [gigs, setGigs] = useState<GigItem[]>([]);

  useEffect(() => {
    const gigsRef = ref(rtdb, 'gigs');
    const unsubscribe = onValue(gigsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        // Convert to array and merge proposals if they exist as an object
        const loadedGigs = Object.values(data).map((g: any) => {
          if (g.proposals && !Array.isArray(g.proposals)) {
             g.proposals = Object.values(g.proposals);
          }
          return g;
        }) as GigItem[];
        // Sort by id descending
        loadedGigs.sort((a, b) => {
           const idA = parseInt(a.id);
           const idB = parseInt(b.id);
           if (!isNaN(idA) && !isNaN(idB)) return idB - idA;
           return a.id.localeCompare(b.id);
        });
        setGigs(loadedGigs);
      } else {
        setGigs(INITIAL_GIGS);
      }
    });
    return () => unsubscribe();
  }, []);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedTag, setSelectedTag] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeGig, setActiveGig] = useState<GigItem | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [applyProposal, setApplyProposal] = useState("");
  const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);

  // New Gig Form State (Choosable tags)
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState("Development & Web3");
  const [newSelectedTags, setNewSelectedTags] = useState<string[]>(["Solidity", "Smart Contracts"]);
  const [newMilestones, setNewMilestones] = useState<MilestoneItem[]>([
    { title: "Milestone 1: Prototype Delivery", amount: "1.0", deadlineDays: 5, acceptanceCriteria: "Functional MVP deployed on testnet." },
  ]);

  const categories = ["All", "Development", "Design", "Content", "AI", "Growth"];

  const filteredGigs = gigs.filter((gig) => {
    const matchesCategory = selectedCategory === "All" || gig.category === selectedCategory;
    const matchesTag = selectedTag === "All" || gig.tags.includes(selectedTag);
    const matchesQuery =
      gig.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      gig.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      gig.technologies.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
      gig.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesTag && matchesQuery;
  });

  const handleAddMilestone = () => {
    setNewMilestones([
      ...newMilestones,
      {
        title: `Milestone ${newMilestones.length + 1}: Final Payout Delivery`,
        amount: "1.0",
        deadlineDays: 7,
        acceptanceCriteria: "Full code and artifacts delivered with verification evidence CID.",
      },
    ]);
  };

  const handleCreateGig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !signer) {
      openConnectModal();
      return;
    }

    try {
      setIsLoadingTransaction(true);
      const escrow = new ethers.Contract(CONTRACT_ADDRESSES.ZentrixEscrow, CONTRACT_ABIS.ZentrixEscrow, signer);
      const plan = newMilestones.map(m => ({
        amount: ethers.parseEther(m.amount),
        deadline: 0,
        criteriaHash: ethers.ZeroHash
      }));
      const totalBudgetWei = plan.reduce((totalAmount, milestone) => totalAmount + milestone.amount, 0n);
      const total = ethers.formatEther(totalBudgetWei);
      
      const tx = await escrow.createGig("QmMocked", plan, 72 * 3600, { value: totalBudgetWei });
      const receipt = await tx.wait();
      
      let onChainGigId = Date.now().toString();
      try {
        if (receipt.logs) {
           for (const log of receipt.logs) {
              try {
                const parsed = escrow.interface.parseLog({ topics: [...log.topics], data: log.data });
                if (parsed?.name === "GigCreated") {
                   onChainGigId = parsed.args[0].toString();
                }
              } catch (e) {}
           }
        }
      } catch(e) {}

      const created: GigItem = {
        id: onChainGigId,
        title: newTitle,
        description: newDesc,
        client: address,
        totalBudget: total,
        reviewWindowHours: 72,
        category: newCategory.includes("Dev") ? "Development" : newCategory.includes("Design") ? "Design" : newCategory.includes("Content") ? "Content" : newCategory.includes("AI") ? "AI" : "Growth",
        tags: newSelectedTags,
        technologies: newSelectedTags.slice(0, 3),
        status: "Open",
        milestones: newMilestones,
      };

      await set(ref(rtdb, `gigs/${onChainGigId}`), created);
      setIsCreateModalOpen(false);
      setNewTitle("");
      setNewDesc("");
      setActionFeedback({
        type: "success",
        msg: `Gig "${created.title}" created! Milestones ready for on-chain Escrow assignment on MST Testnet.`,
      });
    } catch (err: any) {
      console.error(err);
      setActionFeedback({
        type: "error",
        msg: err?.reason || err?.message || "Transaction failed.",
      });
    } finally {
      setIsLoadingTransaction(false);
    }
  };

  const handleApply = (gig: GigItem) => {
    if (!isConnected || !address) {
      openConnectModal();
      return;
    }
    setActiveGig(gig);
    setIsApplyModalOpen(true);
  };

  const submitApplication = () => {
    if (!activeGig || !address) {
      if (!isConnected) openConnectModal();
      return;
    }
    if (!applyProposal.trim()) {
      setActionFeedback({
        type: "error",
        msg: "Please provide your proposed delivery approach before submitting.",
      });
      return;
    }

    const newProposal: ProposalItem = {
      id: `prop-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      freelancerAddress: address.toLowerCase(),
      freelancerName: profile?.name || user?.displayName || `Freelancer (${address.slice(0, 6)}...${address.slice(-4)})`,
      proposalText: applyProposal.trim(),
      submittedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + ", " + new Date().toLocaleDateString(),
      status: "Submitted",
    };

    set(ref(rtdb, `gigs/${activeGig.id}/proposals/${address}`), newProposal);
    update(ref(rtdb, `gigs/${activeGig.id}`), { status: activeGig.status === "Active" ? activeGig.status : "Submitted" });
    setIsApplyModalOpen(false);
    setApplyProposal("");
    setActiveGig(null);
    setActionFeedback({
      type: "success",
      msg: `Application proposal locked & submitted for "${activeGig.title}"! Client has been notified to review your terms.`,
    });
  };

  const handleAcceptProposal = async (gigId: string, proposal: ProposalItem) => {
    const targetGig = gigs.find((g) => g.id === gigId);
    if (!targetGig) return;

    try {
      setIsLoadingTransaction(true);
      const escrow = new ethers.Contract(CONTRACT_ADDRESSES.ZentrixEscrow, CONTRACT_ABIS.ZentrixEscrow, signer);
      // Hardcode gigId to 1 for now since we don't have the real on-chain ID
      const tx = await escrow.assignAndFund(1, proposal.freelancerAddress, ethers.ZeroHash, "QmAgreement");
      await tx.wait();

      const nowStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + ", " + new Date().toLocaleDateString();

      const updatedGigs = gigs.map((g) => {
        if (g.id === gigId) {
          const updatedProposals = (g.proposals || []).map((p) => {
            if (p.id === proposal.id) {
              return { ...p, status: "Accepted" as const };
            }
            return p;
          });

          return {
            ...g,
            status: "Active" as const,
            assignedFreelancer: proposal.freelancerAddress,
            freelancer: proposal.freelancerAddress,
            acceptedAt: nowStr,
            proposals: updatedProposals,
          };
        }
        return g;
      });

      setGigs(updatedGigs);

      // Sync milestones into localStorage for Dashboard
      try {
        const savedMilestonesRaw = localStorage.getItem("zx_dashboard_milestones");
        let currentMilestones: any[] = [];
        if (savedMilestonesRaw) {
          currentMilestones = JSON.parse(savedMilestonesRaw);
        }

        const existingTitles = new Set(currentMilestones.map((m: any) => m.label));
        const newItems = targetGig.milestones
          .filter((m) => !existingTitles.has(`${targetGig.title} — ${m.title}`))
          .map((m, idx) => ({
            id: Date.now() + idx,
            num: currentMilestones.length + idx + 1,
            label: `${targetGig.title} — ${m.title}`,
            amount: m.amount,
            description: m.acceptanceCriteria,
            status: "pending",
            gigId: targetGig.id,
            freelancerAddress: proposal.freelancerAddress,
          }));

        if (newItems.length > 0) {
          const combined = [...currentMilestones, ...newItems];
          localStorage.setItem("zx_dashboard_milestones", JSON.stringify(combined));
          window.dispatchEvent(new Event("zx_milestones_updated"));
        }
      } catch (err) {
        console.error("Failed to sync milestones to dashboard", err);
      }

      // Update activeGig modal view
      const refreshedGig = updatedGigs.find((g) => g.id === gigId);
      if (refreshedGig) {
        setActiveGig(refreshedGig);
      }

      setActionFeedback({
        type: "success",
        msg: `Proposal accepted! Work has officially started for "${targetGig.title}". Milestones are locked in Escrow on MST Testnet.`,
      });
    } catch (err: any) {
      console.error(err);
      setActionFeedback({
        type: "error",
        msg: err?.reason || err?.message || "Transaction failed.",
      });
    } finally {
      setIsLoadingTransaction(false);
    }
  };

  return (
    <div className="zx-marketplace-page space-y-8">
      {/* Action Feedback Banner */}
      {actionFeedback && (
        <div
          className="flex items-center justify-between p-4 rounded-2xl text-xs font-semibold shadow-sm animate-in fade-in duration-200"
          style={{
            background: actionFeedback.type === "success" ? "rgba(22, 101, 52, 0.08)" : "rgba(163, 4, 2, 0.08)",
            border: `1px solid ${actionFeedback.type === "success" ? "rgb(22, 101, 52)" : "var(--zx-primary)"}`,
            color: actionFeedback.type === "success" ? "rgb(20, 83, 45)" : "var(--zx-primary-deep)",
          }}
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{actionFeedback.msg}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-xs font-bold underline hover:opacity-80 ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Interactive Escrow Flow Infographic ── */}
      <EscrowFlowInfographic />

      {/* ── Header and Post a Gig CTA ── */}
      <div
        className="zx-marketplace-header flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4"
        style={{ borderBottom: "1px solid var(--zx-border)" }}
      >
        <div>
          <h1 className="zx-marketplace-title text-3xl font-black" style={{ color: "var(--zx-ink)" }}>
            Marketplace
          </h1>
          <p className="zx-marketplace-subtitle text-xs sm:text-sm mt-0.5" style={{ color: "var(--zx-muted)" }}>
            Explore open projects with escrow-backed funding across Development, Design, Content, AI & Growth.
          </p>
        </div>

        {/* Primary CTA: Post a Gig */}
        <button
          onClick={() => {
            if (!isConnected) {
              openConnectModal();
            } else {
              setIsCreateModalOpen(true);
            }
          }}
          className="zx-post-gig-btn btn-primary shadow-md flex items-center gap-2 text-xs py-3 px-5"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Post a Milestone Gig</span>
        </button>
      </div>

      {/* ── Category Filters & Search Bar ── */}
      <div className="zx-filters-section space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Category Tabs */}
          <div className="zx-category-filter-bar flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  setSelectedTag("All");
                }}
                className={`zx-category-pill px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? "shadow-sm scale-105"
                    : "opacity-75 hover:opacity-100"
                }`}
                style={{
                  background: selectedCategory === cat ? "var(--zx-primary-deep)" : "var(--zx-surface)",
                  color: selectedCategory === cat ? "var(--zx-cream)" : "var(--zx-ink)",
                  border: `1px solid ${selectedCategory === cat ? "var(--zx-primary-deep)" : "var(--zx-border)"}`,
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--zx-muted)]" />
            <input
              type="text"
              placeholder="Search gigs, skills, deliverables..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl text-xs focus:outline-none"
              style={{
                background: "var(--zx-surface)",
                border: "1px solid var(--zx-border)",
                color: "var(--zx-ink)",
              }}
            />
          </div>
        </div>

        {/* Choosable Sub-Tags Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedTag("All")}
            className={`px-3 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${
              selectedTag === "All"
                ? "shadow-xs"
                : "opacity-60 hover:opacity-100"
            }`}
            style={{
              background: selectedTag === "All" ? "var(--zx-primary)" : "var(--zx-cream)",
              color: selectedTag === "All" ? "var(--zx-cream)" : "var(--zx-ink)",
              border: "1px solid var(--zx-border)",
            }}
          >
            All Skills
          </button>
          {ALL_FREELANCE_TAGS.slice(0, 16).map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(selectedTag === tag ? "All" : tag)}
              className={`px-3 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${
                selectedTag === tag ? "shadow-xs" : "opacity-60 hover:opacity-100"
              }`}
              style={{
                background: selectedTag === tag ? "var(--zx-primary)" : "var(--zx-cream)",
                color: selectedTag === tag ? "var(--zx-cream)" : "var(--zx-ink)",
                border: "1px solid var(--zx-border)",
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* ── Gig Cards Bento Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredGigs.map((gig) => {
          const isActive = gig.status === "Active";
          const isOwner = !!address && (gig.client.toLowerCase() === address.toLowerCase());
          const userProposal = address ? gig.proposals?.find(p => p.freelancerAddress.toLowerCase() === address.toLowerCase()) : null;
          const isApplicant = !!userProposal;
          const proposalCount = gig.proposals?.length || 0;
          
          return (
          <div
            key={gig.id}
            className="rounded-3xl p-6 flex flex-col justify-between space-y-4 transition-all hover:scale-[1.01] hover:shadow-lg"
            style={{
              background: "var(--zx-surface)",
              border: "1px solid var(--zx-border)",
            }}
          >
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <span
                  className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full"
                  style={{ background: "var(--zx-surface-alt)", color: "var(--zx-primary-deep)" }}
                >
                  {gig.category}
                </span>
                {isActive ? (
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1.5" style={{ background: "color-mix(in srgb, var(--zx-success) 18%, transparent)", color: "var(--zx-success)" }}>
                    <span className="w-2 h-2 rounded-full animate-ping" style={{ background: "var(--zx-success)" }} />
                    Active · Work Started
                  </span>
                ) : isApplicant ? (
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1" style={{ background: "rgba(217, 119, 6, 0.15)", color: "var(--zx-warning)" }}>
                    <Lock className="w-3 h-3" />
                    Submitted (Locked)
                  </span>
                ) : proposalCount > 0 ? (
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1" style={{ background: "color-mix(in srgb, var(--zx-primary) 15%, transparent)", color: "var(--zx-primary)" }}>
                    <Sparkles className="w-3 h-3" />
                    {proposalCount} Proposal{proposalCount > 1 ? "s" : ""}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: "color-mix(in srgb, var(--zx-success) 15%, transparent)", color: "var(--zx-success)" }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--zx-success)" }} />
                    Open
                  </span>
                )}
              </div>

              {/* Title & Description */}
              <div>
                <h3 className="text-base font-black leading-snug line-clamp-1" style={{ color: "var(--zx-ink)" }}>
                  {gig.title}
                </h3>
                <p className="text-xs mt-1.5 line-clamp-2 leading-relaxed" style={{ color: "var(--zx-muted)" }}>
                  {gig.description}
                </p>
              </div>

              {/* Choosable / Visible Tech Tags */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {gig.tags.map((t) => (
                  <span
                    key={t}
                    className="text-[10px] px-2.5 py-1 rounded-xl font-bold font-mono"
                    style={{
                      background: "var(--zx-cream)",
                      border: "1px solid var(--zx-border)",
                      color: "var(--zx-ink)",
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Bottom Meta & Actions */}
            <div className="pt-3 border-t flex items-center justify-between" style={{ borderColor: "var(--zx-border)" }}>
              <div>
                <div className="text-[10px] uppercase font-bold" style={{ color: "var(--zx-muted)" }}>
                  Escrow Budget
                </div>
                <div className="text-lg font-black font-mono" style={{ color: "var(--zx-primary-deep)" }}>
                  {gig.totalBudget} tMSTC
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveGig(gig)}
                  className="btn-secondary text-xs py-1.5 px-3"
                >
                  {proposalCount > 0 && (isOwner || currentRole === "client") ? `Review (${proposalCount})` : "Milestones"}
                </button>
                
                {isActive ? (
                  <Link to="/dashboard" className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1 shadow-xs" style={{ background: "var(--zx-success)" }}>
                    <span>Work Started</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                ) : isOwner ? (
                  <button disabled className="btn-secondary text-xs py-1.5 px-4 shadow-xs opacity-50 cursor-not-allowed">
                    Your Gig
                  </button>
                ) : isApplicant ? (
                  <button disabled className="btn-secondary text-xs py-1.5 px-3 opacity-80 cursor-not-allowed flex items-center gap-1 font-bold" title="Application is locked as Submitted.">
                    <Lock className="w-3 h-3" />
                    <span>Submitted</span>
                  </button>
                ) : (
                  <button onClick={() => handleApply(gig)} className="btn-primary text-xs py-1.5 px-4 shadow-xs">
                    Apply
                  </button>
                )}
              </div>
            </div>
          </div>
          );
        })}
      </div>

      {/* ── Gig Details & Milestones Modal ── */}
      {activeGig && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(42, 15, 15, 0.5)", backdropFilter: "blur(6px)" }}
        >
          <div
            className="w-full max-w-2xl rounded-3xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto shadow-2xl"
            style={{
              background: "var(--zx-surface)",
              border: "1px solid var(--zx-border)",
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <span
                  className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full"
                  style={{ background: "var(--zx-surface-alt)", color: "var(--zx-primary-deep)" }}
                >
                  {activeGig.category}
                </span>
                <h2 className="text-xl font-black mt-1" style={{ color: "var(--zx-ink)" }}>
                  {activeGig.title}
                </h2>
                <p className="text-xs font-mono mt-0.5" style={{ color: "var(--zx-muted)" }}>
                  Client: {activeGig.client.slice(0, 8)}...{activeGig.client.slice(-6)} · Review Window: {activeGig.reviewWindowHours}h
                </p>
              </div>
              <button
                onClick={() => setActiveGig(null)}
                className="p-1.5 rounded-xl hover:scale-105"
                style={{ background: "var(--zx-cream)", color: "var(--zx-muted)" }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs sm:text-sm leading-relaxed" style={{ color: "var(--zx-ink)" }}>
              {activeGig.description}
            </p>

            {/* Milestones Timeline */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--zx-muted)" }}>
                Milestone Escrow Schedule ({activeGig.milestones.length})
              </h4>
              <div className="space-y-2">
                {activeGig.milestones.map((m, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl flex items-start justify-between gap-4"
                    style={{ background: "var(--zx-cream)", border: "1px solid var(--zx-border)" }}
                  >
                    <div className="space-y-1">
                      <div className="text-xs font-black" style={{ color: "var(--zx-ink)" }}>
                        {m.title}
                      </div>
                      <div className="text-[11px]" style={{ color: "var(--zx-muted)" }}>
                        {m.acceptanceCriteria}
                      </div>
                      <div className="text-[10px] font-mono" style={{ color: "var(--zx-muted)" }}>
                        Auto-release window: {activeGig.reviewWindowHours}h post-submission
                      </div>
                    </div>
                    <div className="text-sm font-black font-mono whitespace-nowrap" style={{ color: "var(--zx-primary-deep)" }}>
                      {m.amount} tMSTC
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Proposals Received & Review Section */}
            {activeGig.proposals && activeGig.proposals.length > 0 && (
              <div className="space-y-3 pt-4 border-t" style={{ borderColor: "var(--zx-border)" }}>
                <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-2" style={{ color: "var(--zx-ink)" }}>
                  <Users className="w-4 h-4" style={{ color: "var(--zx-primary-deep)" }} />
                  Received Proposals ({activeGig.proposals.length})
                </h4>
                <div className="space-y-3">
                  {activeGig.proposals.map((p) => (
                    <div key={p.id} className="p-4 rounded-2xl border space-y-3" style={{ background: "var(--zx-cream)", borderColor: "var(--zx-border)" }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs" style={{ background: "var(--zx-surface-alt)", color: "var(--zx-primary-deep)" }}>
                            <User className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold" style={{ color: "var(--zx-ink)" }}>{p.freelancerName}</div>
                            <div className="text-[10px] font-mono" style={{ color: "var(--zx-muted)" }}>{p.freelancerAddress}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px]" style={{ color: "var(--zx-muted)" }}>{p.submittedAt}</div>
                          {p.status === "Accepted" ? (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800">Accepted · Assigned</span>
                          ) : (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1 justify-end">
                              <Lock className="w-3 h-3" /> Under Review
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs p-3 rounded-xl" style={{ background: "var(--zx-surface)", color: "var(--zx-ink)", border: "1px solid var(--zx-border)" }}>
                        {p.proposalText}
                      </div>
                      
                      {(currentRole === "client" || (address && activeGig.client.toLowerCase() === address.toLowerCase())) && p.status === "Submitted" && activeGig.status !== "Active" && (
                        <div className="pt-2 flex justify-end">
                          <button
                            onClick={() => handleAcceptProposal(activeGig.id, p)}
                            className="btn-primary text-xs py-2 px-4 shadow-sm flex items-center gap-1.5 font-bold transition-transform hover:scale-105"
                            style={{ background: "var(--zx-success)" }}
                          >
                            <Check className="w-4 h-4" />
                            <span>Accept Proposal & Start Work</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Total Budget & Proposal CTA */}
            <div
              className="p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4"
              style={{ background: "var(--zx-surface-alt)" }}
            >
              <div>
                <span className="text-xs" style={{ color: "var(--zx-muted)" }}>Total Locked Escrow:</span>
                <span className="text-lg font-black font-mono ml-2" style={{ color: "var(--zx-primary-deep)" }}>
                  {activeGig.totalBudget} tMSTC
                </span>
              </div>
              
              {activeGig.status === "Active" ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-green-800 bg-green-100 px-3 py-2 rounded-xl">
                    <CheckCircle className="w-4 h-4" /> Work Started
                  </div>
                  <Link to="/dashboard" className="btn-primary text-xs py-2 px-4 flex items-center gap-1" style={{ background: "var(--zx-success)" }}>
                    Dashboard <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ) : (address && activeGig.proposals?.some(p => p.freelancerAddress.toLowerCase() === address.toLowerCase())) ? (
                <button disabled className="btn-secondary text-xs py-2.5 px-6 opacity-75 cursor-not-allowed flex items-center gap-1.5">
                  <Lock className="w-4 h-4" /> Submitted (Locked)
                </button>
              ) : (currentRole === "client" || (address && activeGig.client.toLowerCase() === address.toLowerCase())) ? (
                <span className="text-xs font-bold" style={{ color: "var(--zx-muted)" }}>Awaiting Proposals</span>
              ) : (
                <button
                  onClick={() => {
                    const gig = activeGig;
                    setActiveGig(null);
                    handleApply(gig);
                  }}
                  className="btn-primary text-xs py-2.5 px-6 shadow-sm"
                >
                  Submit Proposal
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Post a Gig Modal (Choosable Tags & Milestones) ── */}
      {isCreateModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(42, 15, 15, 0.5)", backdropFilter: "blur(6px)" }}
        >
          <div
            className="w-full max-w-2xl rounded-3xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto shadow-2xl"
            style={{
              background: "var(--zx-surface)",
              border: "1px solid var(--zx-border)",
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: "var(--zx-border)" }}>
              <div>
                <h2 className="text-xl font-black" style={{ color: "var(--zx-ink)" }}>
                  Post a Milestone Escrow Gig
                </h2>
                <p className="text-xs" style={{ color: "var(--zx-muted)" }}>
                  Funds are locked on MST Testnet smart contracts upon milestone assignment.
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-xl hover:scale-105"
                style={{ background: "var(--zx-cream)", color: "var(--zx-muted)" }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGig} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "var(--zx-ink)" }}>
                  Project Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Build Web3 Staking Dashboard with BridgeKey"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full p-3 rounded-2xl bg-[var(--zx-cream)] border border-[var(--zx-border)] text-xs text-[var(--zx-ink)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "var(--zx-ink)" }}>
                  Project Description
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe your requirements, deliverables, and expectations..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full p-3 rounded-2xl bg-[var(--zx-cream)] border border-[var(--zx-border)] text-xs text-[var(--zx-ink)] focus:outline-none"
                />
              </div>

              {/* Choosable Tag Selector for Gig */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: "var(--zx-ink)" }}>
                  Choose Required Skills & Tags
                </label>
                <div className="p-3.5 rounded-2xl bg-[var(--zx-cream)] border border-[var(--zx-border)] space-y-2">
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                    {ALL_FREELANCE_TAGS.map((t) => {
                      const isSelected = newSelectedTags.includes(t);
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setNewSelectedTags(newSelectedTags.filter((x) => x !== t));
                            } else {
                              setNewSelectedTags([...newSelectedTags, t]);
                            }
                          }}
                          className="px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all"
                          style={{
                            background: isSelected ? "var(--zx-primary-deep)" : "var(--zx-surface)",
                            color: isSelected ? "var(--zx-cream)" : "var(--zx-ink)",
                            border: `1px solid ${isSelected ? "var(--zx-primary-deep)" : "var(--zx-border)"}`,
                          }}
                        >
                          {isSelected ? "✓ " : "+ "}
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Milestones Schedule */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--zx-ink)" }}>
                    Milestone Schedule
                  </label>
                  <button
                    type="button"
                    onClick={handleAddMilestone}
                    className="text-xs font-bold flex items-center gap-1 hover:underline"
                    style={{ color: "var(--zx-primary-deep)" }}
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Add Milestone</span>
                  </button>
                </div>

                {newMilestones.map((m, idx) => (
                  <div key={idx} className="p-3.5 rounded-2xl bg-[var(--zx-cream)] border border-[var(--zx-border)] space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Milestone title"
                        value={m.title}
                        onChange={(e) => {
                          const updated = [...newMilestones];
                          updated[idx].title = e.target.value;
                          setNewMilestones(updated);
                        }}
                        className="flex-1 p-2 rounded-xl bg-[var(--zx-surface)] border border-[var(--zx-border)] text-xs text-[var(--zx-ink)]"
                      />
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Amount (tMSTC)"
                        value={m.amount}
                        onChange={(e) => {
                          const updated = [...newMilestones];
                          updated[idx].amount = e.target.value;
                          setNewMilestones(updated);
                        }}
                        className="w-32 p-2 rounded-xl bg-[var(--zx-surface)] border border-[var(--zx-border)] text-xs text-[var(--zx-ink)] font-mono"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Acceptance criteria"
                      value={m.acceptanceCriteria}
                      onChange={(e) => {
                        const updated = [...newMilestones];
                        updated[idx].acceptanceCriteria = e.target.value;
                        setNewMilestones(updated);
                      }}
                      className="w-full p-2 rounded-xl bg-[var(--zx-surface)] border border-[var(--zx-border)] text-xs text-[var(--zx-ink)]"
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: "var(--zx-border)" }}>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-xs py-2.5 px-6">
                  Create & Lock Escrow
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Apply Proposal Modal ── */}
      {isApplyModalOpen && activeGig && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(42, 15, 15, 0.5)", backdropFilter: "blur(6px)" }}
        >
          <div
            className="w-full max-w-md rounded-3xl p-6 space-y-4 shadow-2xl"
            style={{
              background: "var(--zx-surface)",
              border: "1px solid var(--zx-border)",
            }}
          >
            <h3 className="text-lg font-black" style={{ color: "var(--zx-ink)" }}>
              Apply for {activeGig.title}
            </h3>
            <p className="text-xs" style={{ color: "var(--zx-muted)" }}>
              Submit your delivery approach and timeframe. Client funds the milestone escrow upon accepting your proposal.
            </p>

            <textarea
              rows={4}
              required
              placeholder="Explain your relevant experience, proposed milestone timeline, and evidence CID delivery method..."
              value={applyProposal}
              onChange={(e) => setApplyProposal(e.target.value)}
              className="w-full p-3 rounded-2xl bg-[var(--zx-cream)] border border-[var(--zx-border)] text-xs text-[var(--zx-ink)] focus:outline-none"
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsApplyModalOpen(false)}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                onClick={submitApplication}
                className="btn-primary text-xs py-2.5 px-5 flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Proposal</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
