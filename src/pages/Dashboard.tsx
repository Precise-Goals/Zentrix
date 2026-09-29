import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWallet } from "../context/WalletContext";
import { ethers } from "ethers";
import { CONTRACT_ADDRESSES, CONTRACT_ABIS, RPC_URL } from "../contracts";
import { getCachedNFTAssets, scanNFTAssets } from "../lib/nftScanner";
import { rtdb } from "../lib/firebase";
import { ref, onValue, update } from "firebase/database";
import {
  Award,
  Wallet,
  Clock,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  Loader2,
  Lock,
  Zap,
  Briefcase,
  FileText,
  Send,
  Check,
  XCircle,
  ArrowRight,
  ShieldCheck,
  Layers,
  ChevronRight,
  AlertTriangle,
  PlusCircle,
  Inbox,
  UserCheck,
} from "lucide-react";

interface OnChainMetrics {
  withdrawable: string;   // ethers.formatEther result
  passTokenId: number | null;
  passTier: number;       // 0=Free, 1=PRO, 2=Enterprise
  reputationTokenCount: number;
  loading: boolean;
  error: string | null;
}

export interface MilestoneData {
  title: string;
  amount: string;
  deadlineDays?: number;
  acceptanceCriteria?: string;
  status?: "pending" | "review" | "approved" | "rejected";
  cid?: string;
  submittedAt?: string;
  approvedAt?: string;
  rejectionReason?: string;
}

export interface ProposalData {
  id?: string;
  freelancerAddress: string;
  freelancerName?: string;
  proposalText: string;
  submittedAt: string;
  status?: "Submitted" | "Accepted" | "Rejected";
}

export interface GigData {
  id: string;
  title: string;
  description: string;
  client: string;
  totalBudget: string;
  reviewWindowHours?: number;
  category?: string;
  tags?: string[];
  technologies?: string[];
  status: "Open" | "Submitted" | "Assigned" | "Active" | "Completed" | "Cancelled";
  milestones?: MilestoneData[];
  proposals?: Record<string, ProposalData> | ProposalData[];
  assignedFreelancer?: string;
  freelancer?: string;
  acceptedAt?: string;
}

interface TxState {
  hash: string | null;
  status: "pending" | "confirmed" | "error" | null;
  action: string;
  error?: string;
}

export const DashboardPage: React.FC = () => {
  const { currentRole } = useAuth();
  const { address, signer, isConnected, connectWallet, openConnectModal } = useWallet();

  // ── On-chain Metrics ─────────────────────────────────────────────
  const [metrics, setMetrics] = useState<OnChainMetrics>(() => {
    const cachedNft = getCachedNFTAssets(address);
    return {
      withdrawable: "0",
      passTokenId: cachedNft.passTokenId ? Number(cachedNft.passTokenId) : null,
      passTier: cachedNft.passTier ?? 0,
      reputationTokenCount: cachedNft.reputationCount ?? 0,
      loading: false,
      error: null,
    };
  });

  useEffect(() => {
    if (address) {
      const cache = getCachedNFTAssets(address);
      setMetrics((prev) => ({
        ...prev,
        passTokenId: cache.passTokenId ? Number(cache.passTokenId) : prev.passTokenId,
        passTier: cache.passTier || prev.passTier,
        reputationTokenCount: cache.reputationCount || prev.reputationTokenCount,
      }));
    }
  }, [address]);

  // ── Real RTDB Gigs & Live Subscription ────────────────────────────
  const [allGigs, setAllGigs] = useState<GigData[]>([]);
  const [isLoadingGigs, setIsLoadingGigs] = useState<boolean>(true);

  useEffect(() => {
    const gigsRef = ref(rtdb, "gigs");
    setIsLoadingGigs(true);
    const unsubscribe = onValue(
      gigsRef,
      (snapshot) => {
        setIsLoadingGigs(false);
        if (snapshot.exists()) {
          const val = snapshot.val();
          let list: GigData[] = [];
          if (Array.isArray(val)) {
            list = val.filter(Boolean);
          } else if (typeof val === "object" && val !== null) {
            list = Object.values(val);
          }
          setAllGigs(list);
        } else {
          setAllGigs([]);
        }
      },
      (err) => {
        console.error("Failed to load RTDB gigs", err);
        setIsLoadingGigs(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // ── Tab & UI State ────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"overview" | "milestones" | "proposals" | "reputation">("overview");
  const [milestoneFilter, setMilestoneFilter] = useState<"all" | "active" | "open" | "completed">("all");

  // Interactive inputs for deliverable submissions
  const [submissionInputs, setSubmissionInputs] = useState<Record<string, string>>({});
  // Rejection modal state
  const [rejectionModal, setRejectionModal] = useState<{
    gigId: string;
    milestoneIndex: number;
    title: string;
  } | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Transaction Status Banner state (Hard Rule 8)
  const [txState, setTxState] = useState<TxState | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);

  // Helper to extract clean proposals list
  const getProposalsList = useCallback((gig: GigData): ProposalData[] => {
    if (!gig.proposals) return [];
    if (Array.isArray(gig.proposals)) return gig.proposals.filter(Boolean);
    return Object.values(gig.proposals);
  }, []);

  // ── Derived Data for Connected User ───────────────────────────────
  const userAddr = (address || "").toLowerCase();

  // Client's created gigs
  const clientGigs = useMemo(() => {
    if (!userAddr) return [];
    return allGigs.filter((g) => g.client?.toLowerCase() === userAddr);
  }, [allGigs, userAddr]);

  // Freelancer's assigned or active gigs
  const freelancerGigs = useMemo(() => {
    if (!userAddr) return [];
    return allGigs.filter(
      (g) =>
        g.freelancer?.toLowerCase() === userAddr ||
        g.assignedFreelancer?.toLowerCase() === userAddr
    );
  }, [allGigs, userAddr]);

  // Relevant gigs based on current active role
  const userRelevantGigs = useMemo(() => {
    return currentRole === "client" ? clientGigs : freelancerGigs;
  }, [currentRole, clientGigs, freelancerGigs]);

  // Proposals received (Client view)
  const receivedProposals = useMemo(() => {
    const list: { gig: GigData; proposal: ProposalData }[] = [];
    clientGigs.forEach((gig) => {
      const props = getProposalsList(gig);
      props.forEach((prop) => {
        list.push({ gig, proposal: prop });
      });
    });
    return list;
  }, [clientGigs, getProposalsList]);

  // Proposals submitted (Freelancer view)
  const mySubmittedProposals = useMemo(() => {
    if (!userAddr) return [];
    const list: { gig: GigData; proposal: ProposalData }[] = [];
    allGigs.forEach((gig) => {
      const props = getProposalsList(gig);
      props.forEach((prop) => {
        if (prop.freelancerAddress?.toLowerCase() === userAddr) {
          list.push({ gig, proposal: prop });
        }
      });
    });
    return list;
  }, [allGigs, userAddr, getProposalsList]);

  // User Stats
  const stats = useMemo(() => {
    if (currentRole === "client") {
      const inEscrow = clientGigs.reduce((acc, g) => acc + (parseFloat(g.totalBudget) || 0), 0);
      const activeCount = clientGigs.filter((g) => g.status === "Active" || g.status === "Assigned").length;
      const completedCount = clientGigs.filter((g) => g.status === "Completed").length;
      const pendingReviewsCount = clientGigs.reduce((acc, g) => {
        if (g.milestones) {
          return acc + g.milestones.filter((m) => m.status === "review").length;
        }
        return acc;
      }, 0);
      return {
        totalGigs: clientGigs.length,
        inEscrow: inEscrow.toFixed(2),
        activeCount,
        completedCount,
        pendingReviewsCount,
        proposalsCount: receivedProposals.length,
      };
    } else {
      const potentialEarnings = freelancerGigs.reduce((acc, g) => acc + (parseFloat(g.totalBudget) || 0), 0);
      const activeCount = freelancerGigs.filter((g) => g.status === "Active").length;
      const assignedCount = freelancerGigs.filter((g) => g.status === "Assigned").length;
      const completedCount = freelancerGigs.filter((g) => g.status === "Completed").length;
      return {
        totalGigs: freelancerGigs.length,
        potentialEarnings: potentialEarnings.toFixed(2),
        activeCount,
        assignedCount,
        completedCount,
        proposalsCount: mySubmittedProposals.length,
      };
    }
  }, [currentRole, clientGigs, freelancerGigs, receivedProposals, mySubmittedProposals]);

  // High-priority active milestone needing immediate user attention
  const priorityActionMilestone = useMemo(() => {
    for (const gig of userRelevantGigs) {
      if (gig.status === "Active" && gig.milestones) {
        for (let i = 0; i < gig.milestones.length; i++) {
          const m = gig.milestones[i];
          const st = m.status || "pending";
          if (currentRole === "client" && st === "review") {
            return { gig, milestone: m, index: i, type: "review_needed" as const };
          }
          if (currentRole === "freelancer" && (st === "pending" || st === "rejected")) {
            return { gig, milestone: m, index: i, type: "deliverable_due" as const };
          }
        }
      }
    }
    // Secondary check: assigned gig waiting for freelancer acceptance
    if (currentRole === "freelancer") {
      const assignedGig = freelancerGigs.find((g) => g.status === "Assigned");
      if (assignedGig) {
        return {
          gig: assignedGig,
          milestone: assignedGig.milestones?.[0] || { title: "Gig Assignment", amount: assignedGig.totalBudget },
          index: 0,
          type: "accept_assignment" as const,
        };
      }
    }
    return null;
  }, [userRelevantGigs, freelancerGigs, currentRole]);

  // ── Fetch On-chain Metrics ────────────────────────────────────────
  const fetchMetrics = useCallback(async () => {
    if (!address) return;
    setMetrics((m) => ({ ...m, loading: true, error: null }));
    try {
      const readProvider = new ethers.JsonRpcProvider(RPC_URL);
      const escrow = new ethers.Contract(
        CONTRACT_ADDRESSES.ZentrixEscrow,
        CONTRACT_ABIS.ZentrixEscrow,
        readProvider
      );

      let withdrawable = "0";
      try {
        const raw = await escrow.withdrawable(address);
        withdrawable = ethers.formatEther(raw);
      } catch (_) {}

      const scan = await scanNFTAssets(address);
      setMetrics({
        withdrawable,
        passTokenId: scan.passTokenId ? Number(scan.passTokenId) : null,
        passTier: scan.passTier ?? 0,
        reputationTokenCount: scan.reputationCount,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      setMetrics((m) => ({ ...m, loading: false, error: err?.message ?? "Chain read failed" }));
    }
  }, [address]);

  useEffect(() => {
    if (isConnected) fetchMetrics();
  }, [isConnected, fetchMetrics]);

  useEffect(() => {
    if (address) {
      scanNFTAssets(address).catch(() => {});
      const interval = setInterval(() => {
        scanNFTAssets(address).catch(() => {});
      }, 15000);
      return () => clearInterval(interval);
    }
  }, [address]);

  // ── Action Handlers (Hard Rule 8 Compliant) ───────────────────────

  // 1. Pull Withdraw Escrow Funds
  const handleWithdraw = async () => {
    if (!isConnected || !signer) {
      connectWallet();
      return;
    }
    if (parseFloat(metrics.withdrawable) <= 0) return;

    setIsProcessingAction(true);
    setTxState({
      hash: null,
      status: "pending",
      action: "Initiating pull withdraw on MST Testnet...",
    });

    try {
      const escrow = new ethers.Contract(CONTRACT_ADDRESSES.ZentrixEscrow, CONTRACT_ABIS.ZentrixEscrow, signer);
      const tx = await escrow.withdraw();
      setTxState({
        hash: tx.hash,
        status: "pending",
        action: "Confirming withdraw transaction on MST Testnet...",
      });
      await tx.wait();
      setTxState({
        hash: tx.hash,
        status: "confirmed",
        action: "Withdrawal completed successfully! Funds transferred to your wallet.",
      });
      await fetchMetrics();
    } catch (err: any) {
      setTxState({
        hash: null,
        status: "error",
        action: "Withdrawal failed",
        error: err?.reason || err?.message || "Transaction was rejected or reverted.",
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // 2. Client assigns freelancer and funds/locks agreement
  const handleAssignFreelancer = async (gigId: string, freelancerAddress: string) => {
    if (!isConnected || !signer) {
      openConnectModal();
      return;
    }

    setIsProcessingAction(true);
    setTxState({
      hash: null,
      status: "pending",
      action: `Assigning freelancer ${freelancerAddress.slice(0, 6)}... on-chain...`,
    });

    try {
      const escrow = new ethers.Contract(CONTRACT_ADDRESSES.ZentrixEscrow, CONTRACT_ABIS.ZentrixEscrow, signer);
      const onChainGigId = parseInt(gigId) || 1;
      const tx = await escrow.assignAndFund(onChainGigId, freelancerAddress, ethers.ZeroHash, "");
      setTxState({
        hash: tx.hash,
        status: "pending",
        action: "Confirming freelancer assignment on MST Testnet...",
      });
      await tx.wait();

      // Update Firebase RTDB
      await update(ref(rtdb, `gigs/${gigId}`), {
        status: "Assigned",
        freelancer: freelancerAddress.toLowerCase(),
        assignedFreelancer: freelancerAddress.toLowerCase(),
      });
      await update(ref(rtdb, `gigs/${gigId}/proposals/${freelancerAddress}`), {
        status: "Accepted",
      });

      setTxState({
        hash: tx.hash,
        status: "confirmed",
        action: `Freelancer successfully assigned on-chain! Escrow locked.`,
      });
    } catch (err: any) {
      setTxState({
        hash: null,
        status: "error",
        action: "Assignment failed",
        error: err?.reason || err?.message || "Transaction was rejected or reverted.",
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // 3. Freelancer accepts assignment
  const handleAcceptAssignment = async (gigId: string) => {
    if (!isConnected || !signer) {
      openConnectModal();
      return;
    }

    setIsProcessingAction(true);
    setTxState({
      hash: null,
      status: "pending",
      action: "Accepting project assignment on-chain...",
    });

    try {
      const escrow = new ethers.Contract(CONTRACT_ADDRESSES.ZentrixEscrow, CONTRACT_ABIS.ZentrixEscrow, signer);
      const onChainGigId = parseInt(gigId) || 1;
      const tx = await escrow.acceptAssignment(onChainGigId);
      setTxState({
        hash: tx.hash,
        status: "pending",
        action: "Confirming acceptance on MST Testnet...",
      });
      await tx.wait();

      await update(ref(rtdb, `gigs/${gigId}`), {
        status: "Active",
        acceptedAt: new Date().toISOString(),
      });

      setTxState({
        hash: tx.hash,
        status: "confirmed",
        action: "Assignment accepted! Agreement is now Active. You may begin deliverable work.",
      });
    } catch (err: any) {
      setTxState({
        hash: null,
        status: "error",
        action: "Acceptance failed",
        error: err?.reason || err?.message || "Transaction was rejected or reverted.",
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // 4. Freelancer submits deliverable for review
  const handleSubmitMilestone = async (gigId: string, milestoneIndex: number) => {
    if (!isConnected || !signer) {
      openConnectModal();
      return;
    }

    const key = `${gigId}-${milestoneIndex}`;
    const evidenceCid = (submissionInputs[key] || "").trim();
    if (!evidenceCid) {
      setTxState({
        hash: null,
        status: "error",
        action: "Deliverable evidence required",
        error: "Please enter an IPFS CID, GitHub link, or deliverable proof before submitting.",
      });
      return;
    }

    setIsProcessingAction(true);
    setTxState({
      hash: null,
      status: "pending",
      action: `Anchoring deliverable proof on-chain for Milestone #${milestoneIndex + 1}...`,
    });

    try {
      const escrow = new ethers.Contract(CONTRACT_ADDRESSES.ZentrixEscrow, CONTRACT_ABIS.ZentrixEscrow, signer);
      const onChainGigId = parseInt(gigId) || 1;
      const tx = await escrow.submitMilestone(onChainGigId, milestoneIndex, evidenceCid);
      setTxState({
        hash: tx.hash,
        status: "pending",
        action: "Confirming deliverable submission on MST Testnet...",
      });
      await tx.wait();

      await update(ref(rtdb, `gigs/${gigId}/milestones/${milestoneIndex}`), {
        status: "review",
        cid: evidenceCid,
        submittedAt: new Date().toLocaleString(),
      });

      // Clear input
      setSubmissionInputs((prev) => ({ ...prev, [key]: "" }));

      setTxState({
        hash: tx.hash,
        status: "confirmed",
        action: `Milestone #${milestoneIndex + 1} deliverable submitted! Client review window is active.`,
      });
    } catch (err: any) {
      setTxState({
        hash: null,
        status: "error",
        action: "Submission failed",
        error: err?.reason || err?.message || "Transaction was rejected or reverted.",
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // 5. Client approves milestone deliverable
  const handleApproveMilestone = async (gigId: string, milestoneIndex: number, totalMilestones: number) => {
    if (!isConnected || !signer) {
      openConnectModal();
      return;
    }

    setIsProcessingAction(true);
    setTxState({
      hash: null,
      status: "pending",
      action: `Approving Milestone #${milestoneIndex + 1} and releasing escrow on-chain...`,
    });

    try {
      const escrow = new ethers.Contract(CONTRACT_ADDRESSES.ZentrixEscrow, CONTRACT_ABIS.ZentrixEscrow, signer);
      const onChainGigId = parseInt(gigId) || 1;
      // 5-star rating by default
      const tx = await escrow.approveMilestone(onChainGigId, milestoneIndex, 5);
      setTxState({
        hash: tx.hash,
        status: "pending",
        action: "Confirming milestone approval on MST Testnet...",
      });
      await tx.wait();

      await update(ref(rtdb, `gigs/${gigId}/milestones/${milestoneIndex}`), {
        status: "approved",
        approvedAt: new Date().toLocaleString(),
      });

      // If last milestone, complete gig
      if (milestoneIndex === totalMilestones - 1) {
        await update(ref(rtdb, `gigs/${gigId}`), { status: "Completed" });
      }

      setTxState({
        hash: tx.hash,
        status: "confirmed",
        action: `Milestone #${milestoneIndex + 1} approved! Escrow payment released to freelancer.`,
      });
      await fetchMetrics();
    } catch (err: any) {
      setTxState({
        hash: null,
        status: "error",
        action: "Approval failed",
        error: err?.reason || err?.message || "Transaction was rejected or reverted.",
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // 6. Client requests revision / rejects milestone deliverable
  const handleRejectMilestone = async () => {
    if (!rejectionModal) return;
    const { gigId, milestoneIndex } = rejectionModal;

    if (!isConnected || !signer) {
      openConnectModal();
      return;
    }

    const reason = rejectionReason.trim() || "Revision requested on deliverable.";

    setIsProcessingAction(true);
    setTxState({
      hash: null,
      status: "pending",
      action: `Requesting revisions on-chain for Milestone #${milestoneIndex + 1}...`,
    });

    try {
      const escrow = new ethers.Contract(CONTRACT_ADDRESSES.ZentrixEscrow, CONTRACT_ABIS.ZentrixEscrow, signer);
      const onChainGigId = parseInt(gigId) || 1;
      const tx = await escrow.rejectMilestone(onChainGigId, milestoneIndex, reason);
      setTxState({
        hash: tx.hash,
        status: "pending",
        action: "Confirming revision request on MST Testnet...",
      });
      await tx.wait();

      await update(ref(rtdb, `gigs/${gigId}/milestones/${milestoneIndex}`), {
        status: "rejected",
        rejectionReason: reason,
      });

      setRejectionModal(null);
      setRejectionReason("");

      setTxState({
        hash: tx.hash,
        status: "confirmed",
        action: `Revision request recorded on-chain. Freelancer notified to re-submit work.`,
      });
    } catch (err: any) {
      setTxState({
        hash: null,
        status: "error",
        action: "Revision request failed",
        error: err?.reason || err?.message || "Transaction was rejected or reverted.",
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // ── Not connected guard ──────────────────────────────────────────
  if (!address && !isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[55vh] gap-6 text-center max-w-md mx-auto px-4">
        <div
          className="w-16 h-16 rounded-3xl flex items-center justify-center shadow-sm"
          style={{ background: "var(--zx-surface-alt)", border: "1px solid var(--zx-border)" }}
        >
          <Wallet className="w-8 h-8" style={{ color: "var(--zx-primary-deep)" }} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black" style={{ color: "var(--zx-ink)" }}>
            Connect Your Wallet
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "var(--zx-muted)" }}>
            Connect your BridgeKey or Web3 wallet to access your live on-chain escrow agreements, track deliverables, and manage payments on MST Testnet.
          </p>
        </div>
        <button
          onClick={openConnectModal}
          className="inline-flex items-center gap-2 font-bold rounded-2xl px-6 py-3 text-sm shadow-md hover:opacity-90 transition-all cursor-pointer"
          style={{ background: "var(--zx-primary-deep)", color: "var(--zx-cream)" }}
        >
          <Wallet className="w-4 h-4" />
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4"
        style={{ borderBottom: "1px solid var(--zx-border)" }}
      >
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black" style={{ color: "var(--zx-ink)" }}>
              Dashboard
            </h1>
            <span
              className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border"
              style={{
                background: "var(--zx-surface-alt)",
                borderColor: "var(--zx-border)",
                color: "var(--zx-muted)",
              }}
            >
              MST Testnet (91562037)
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs font-mono" style={{ color: "var(--zx-muted)" }}>
              {address}
            </p>
            <a
              href={`https://testnet.mstscan.com/address/${address}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs hover:underline flex items-center gap-0.5 font-bold"
              style={{ color: "var(--zx-primary-deep)" }}
              title="View on MSTScan"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Role & Quick Link */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs shadow-xs"
            style={{ background: "var(--zx-surface)", borderColor: "var(--zx-border)" }}
          >
            <span className="font-mono text-[var(--zx-muted)]">Active Role:</span>
            <span
              className="font-bold capitalize px-2.5 py-0.5 rounded-lg border text-[11px]"
              style={{
                background: "var(--zx-surface-alt)",
                borderColor: "var(--zx-border)",
                color: "var(--zx-primary-deep)",
              }}
            >
              {currentRole}
            </span>
            <Link
              to="/profile"
              className="font-semibold underline ml-1 hover:opacity-80 transition-opacity text-[11px]"
              style={{ color: "var(--zx-primary-deep)" }}
              title="Change role in profile settings"
            >
              Change →
            </Link>
          </div>

          <Link
            to="/marketplace"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border text-xs font-bold transition-all shadow-xs hover:bg-[var(--zx-surface-alt)]"
            style={{ borderColor: "var(--zx-border)", color: "var(--zx-ink)" }}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Marketplace</span>
          </Link>
        </div>
      </div>

      {/* ── Transaction Status Banner (Hard Rule 8) ────────────────── */}
      {txState && (
        <div
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl text-xs font-semibold shadow-xs animate-in fade-in duration-200"
          style={{
            background:
              txState.status === "confirmed"
                ? "rgba(22, 163, 74, 0.1)"
                : txState.status === "error"
                ? "rgba(163, 4, 2, 0.08)"
                : "rgba(217, 119, 6, 0.1)",
            border: `1px solid ${
              txState.status === "confirmed"
                ? "var(--zx-success)"
                : txState.status === "error"
                ? "var(--zx-danger)"
                : "var(--zx-warning)"
            }`,
            color:
              txState.status === "confirmed"
                ? "var(--zx-success)"
                : txState.status === "error"
                ? "var(--zx-danger)"
                : "var(--zx-warning)",
          }}
        >
          <div className="flex items-center gap-2.5">
            {txState.status === "confirmed" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : txState.status === "error" ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
            )}
            <div className="space-y-0.5">
              <span className="font-bold">{txState.action}</span>
              {txState.error && <p className="text-[11px] opacity-90 font-mono">{txState.error}</p>}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
            {txState.hash && (
              <a
                href={`https://testnet.mstscan.com/tx/${txState.hash}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 font-bold underline hover:opacity-80"
              >
                <span>MSTScan Tx</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <button
              onClick={() => setTxState(null)}
              className="text-xs font-bold underline hover:opacity-80 cursor-pointer ml-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── Bento Metrics ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Withdrawable / Escrow balance */}
        <div
          className="rounded-3xl p-6 space-y-3 relative overflow-hidden shadow-xs"
          style={{
            background: "linear-gradient(135deg, var(--zx-surface) 0%, var(--zx-surface-alt) 100%)",
            border: "2px solid var(--zx-primary)",
          }}
        >
          <div
            className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10"
            style={{ background: "var(--zx-primary)", filter: "blur(20px)" }}
          />
          <div className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--zx-primary-deep)" }}>
            {currentRole === "client" ? "Withdrawable / Refunded Balance" : "Available to Withdraw"}
          </div>
          <div className="text-4xl font-black font-mono" style={{ color: "var(--zx-ink)" }}>
            {metrics.loading ? (
              <Loader2 className="w-8 h-8 animate-spin inline" style={{ color: "var(--zx-primary)" }} />
            ) : (
              <>
                {parseFloat(metrics.withdrawable).toFixed(4)}{" "}
                <span className="text-lg opacity-60" style={{ color: "var(--zx-muted)" }}>
                  tMSTC
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleWithdraw}
              disabled={isProcessingAction || metrics.loading || parseFloat(metrics.withdrawable) <= 0}
              className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "var(--zx-primary-deep)", color: "white" }}
            >
              {isProcessingAction ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wallet className="w-3.5 h-3.5" />}
              <span>{parseFloat(metrics.withdrawable) > 0 ? "Pull Withdraw Funds" : "Zero Balance"}</span>
            </button>
            <button
              onClick={fetchMetrics}
              title="Refresh on-chain balance"
              className="p-2 rounded-xl border hover:bg-slate-100 transition-colors"
              style={{ borderColor: "var(--zx-border)", color: "var(--zx-muted)" }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ZentrixPass Tier */}
        <div
          className="rounded-3xl p-6 space-y-3 relative overflow-hidden flex items-start justify-between gap-4 shadow-xs"
          style={{ background: "var(--zx-surface)", border: "1px solid var(--zx-border)" }}
        >
          <div className="space-y-3 flex-1">
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--zx-muted)" }}>
              ZentrixPass Tier
            </div>
            <div className="flex items-baseline gap-2">
              <div className="text-3xl sm:text-4xl font-black">
                {metrics.loading && !metrics.passTier ? (
                  <Loader2 className="w-8 h-8 animate-spin inline" style={{ color: "var(--zx-primary)" }} />
                ) : (
                  <span
                    className={
                      metrics.passTier === 2
                        ? "text-amber-700"
                        : metrics.passTier === 1
                        ? "text-emerald-700"
                        : "text-[var(--zx-ink)]"
                    }
                  >
                    {metrics.passTier === 2 ? "Enterprise" : metrics.passTier === 1 ? "PRO" : "Free"}
                  </span>
                )}
              </div>
              <span className="text-xs font-bold font-mono" style={{ color: "var(--zx-muted)" }}>
                {metrics.passTier === 2
                  ? "(15 AI/day)"
                  : metrics.passTier === 1
                  ? "(10 AI/day)"
                  : "(2 AI/day)"}
              </span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "var(--zx-muted)" }}>
              {metrics.passTier === 2
                ? "Enterprise Soulbound Pass active — full quota"
                : metrics.passTier === 1
                ? "PRO Soulbound Pass active — 10 queries daily"
                : "Free Starter allowance on MST Testnet"}
            </p>
            {metrics.passTier === 0 ? (
              <Link
                to="/pricing"
                className="inline-flex items-center gap-1 text-xs font-bold hover:underline"
                style={{ color: "var(--zx-primary-deep)" }}
              >
                <span>Upgrade to PRO Pass →</span>
              </Link>
            ) : (
              <div className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Pass #{metrics.passTokenId || 1} Anchored</span>
              </div>
            )}
          </div>

          <div
            className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 shrink-0 bg-black shadow-md relative group transition-all duration-300 ${
              metrics.passTier === 2
                ? "border-amber-400/90 shadow-amber-950/20"
                : metrics.passTier === 1
                ? "border-emerald-400/90 shadow-emerald-950/20"
                : "border-slate-300 shadow-slate-200"
            }`}
          >
            <img
              src={metrics.passTier === 2 ? "/2.gif" : metrics.passTier === 1 ? "/1.gif" : "/robot.png"}
              alt="Zentrix Pass"
              className={`w-full h-full object-cover transition-all duration-500 ${
                metrics.passTier > 0
                  ? "grayscale-0 group-hover:scale-110"
                  : "grayscale opacity-75 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-105"
              }`}
            />
            <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-full bg-black/80 backdrop-blur-xs text-[9px] font-mono font-bold text-slate-300 border border-white/20 flex items-center gap-1">
              {metrics.passTier > 0 ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{metrics.passTier === 2 ? "ENT" : "PRO"}</span>
                </>
              ) : (
                <>
                  <Lock className="w-2.5 h-2.5 text-slate-400" />
                  <span>FREE</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Reputation Credentials */}
        <div
          className="rounded-3xl p-6 space-y-3 shadow-xs"
          style={{ background: "var(--zx-surface)", border: "1px solid var(--zx-border)" }}
        >
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--zx-muted)" }}>
            Soulbound Credentials
          </div>
          <div className="text-4xl font-black font-mono" style={{ color: "var(--zx-ink)" }}>
            {metrics.loading && metrics.reputationTokenCount === 0 ? (
              <Loader2 className="w-8 h-8 animate-spin inline" style={{ color: "var(--zx-primary)" }} />
            ) : (
              metrics.reputationTokenCount
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--zx-success)" }}>
            <Award className="w-3.5 h-3.5" />
            <span>Non-transferable ERC-721 SBT</span>
          </div>
          <p className="text-xs" style={{ color: "var(--zx-muted)" }}>
            Earned automatically on verified milestone approval and project completion.
          </p>
        </div>
      </div>

      {/* ── Sub-Stats Bar ───────────────────────────────────────────── */}
      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl border text-xs"
        style={{ background: "var(--zx-surface)", borderColor: "var(--zx-border)" }}
      >
        <div>
          <span className="text-[11px] block font-mono" style={{ color: "var(--zx-muted)" }}>
            {currentRole === "client" ? "Posted Gigs" : "Assigned Workrooms"}
          </span>
          <span className="text-lg font-black font-mono" style={{ color: "var(--zx-ink)" }}>
            {currentRole === "client" ? stats.totalGigs : stats.totalGigs}
          </span>
        </div>
        <div>
          <span className="text-[11px] block font-mono" style={{ color: "var(--zx-muted)" }}>
            {currentRole === "client" ? "Escrow Committed" : "Potential Value"}
          </span>
          <span className="text-lg font-black font-mono" style={{ color: "var(--zx-primary-deep)" }}>
            {currentRole === "client" ? `${stats.inEscrow} tMSTC` : `${stats.potentialEarnings} tMSTC`}
          </span>
        </div>
        <div>
          <span className="text-[11px] block font-mono" style={{ color: "var(--zx-muted)" }}>
            {currentRole === "client" ? "Active Agreements" : "Active Workrooms"}
          </span>
          <span className="text-lg font-black font-mono" style={{ color: "var(--zx-ink)" }}>
            {stats.activeCount}
          </span>
        </div>
        <div>
          <span className="text-[11px] block font-mono" style={{ color: "var(--zx-muted)" }}>
            {currentRole === "client" ? "Proposals Received" : "Applications Submitted"}
          </span>
          <span className="text-lg font-black font-mono" style={{ color: "var(--zx-ink)" }}>
            {stats.proposalsCount}
          </span>
        </div>
      </div>

      {/* ── Tabbed Workspace ────────────────────────────────────────── */}
      <div
        className="rounded-3xl overflow-hidden shadow-xs"
        style={{ background: "var(--zx-surface)", border: "1px solid var(--zx-border)" }}
      >
        {/* Tabs Bar */}
        <div className="flex border-b" style={{ borderColor: "var(--zx-border)" }}>
          {[
            { id: "overview", label: "Overview", icon: Layers },
            { id: "milestones", label: "Workrooms & Milestones", icon: CheckCircle2, badge: userRelevantGigs.length },
            {
              id: "proposals",
              label: currentRole === "client" ? "Received Proposals" : "My Applications",
              icon: Inbox,
              badge: currentRole === "client" ? receivedProposals.length : mySubmittedProposals.length,
            },
            { id: "reputation", label: "SBT Credentials", icon: Award, badge: metrics.reputationTokenCount },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className="flex-1 py-4 px-3 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                style={
                  isActive
                    ? {
                        color: "var(--zx-primary-deep)",
                        borderBottom: "2px solid var(--zx-primary-deep)",
                        background: "var(--zx-surface-alt)",
                      }
                    : { color: "var(--zx-muted)" }
                }
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.id}</span>
                {typeof tab.badge === "number" && tab.badge > 0 && (
                  <span
                    className="px-1.5 py-0.2 rounded-full text-[10px] font-mono"
                    style={{
                      background: isActive ? "var(--zx-primary-deep)" : "var(--zx-border)",
                      color: isActive ? "white" : "var(--zx-muted)",
                    }}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div className="p-6">
          {/* ══════════════════════════════════════════════════════════
              TAB 1: OVERVIEW
             ══════════════════════════════════════════════════════════ */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Priority Action Card */}
              {priorityActionMilestone ? (
                <div
                  className="p-5 rounded-2xl border space-y-3"
                  style={{
                    background: "var(--zx-cream)",
                    borderColor:
                      priorityActionMilestone.type === "review_needed"
                        ? "var(--zx-warning)"
                        : "var(--zx-primary)",
                  }}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span
                      className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full"
                      style={{
                        background:
                          priorityActionMilestone.type === "review_needed"
                            ? "rgba(217, 119, 6, 0.15)"
                            : "rgba(163, 4, 2, 0.1)",
                        color:
                          priorityActionMilestone.type === "review_needed"
                            ? "var(--zx-warning)"
                            : "var(--zx-primary-deep)",
                      }}
                    >
                      <AlertTriangle className="w-3 h-3" />
                      {priorityActionMilestone.type === "review_needed"
                        ? "Action Required: Client Review Needed"
                        : priorityActionMilestone.type === "accept_assignment"
                        ? "Action Required: Accept Assignment"
                        : "Action Required: Deliverable Due"}
                    </span>
                    <span className="text-xs font-mono font-bold" style={{ color: "var(--zx-primary-deep)" }}>
                      Gig ID #{priorityActionMilestone.gig.id}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-black" style={{ color: "var(--zx-ink)" }}>
                      {priorityActionMilestone.gig.title}
                    </h3>
                    <p className="text-xs font-semibold mt-0.5" style={{ color: "var(--zx-muted)" }}>
                      Milestone {priorityActionMilestone.index + 1}: {priorityActionMilestone.milestone.title}
                    </p>
                    {priorityActionMilestone.milestone.acceptanceCriteria && (
                      <p className="text-xs mt-1 text-[var(--zx-muted)]">
                        Criteria: {priorityActionMilestone.milestone.acceptanceCriteria}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t" style={{ borderColor: "var(--zx-border)" }}>
                    <div className="text-xs font-mono" style={{ color: "var(--zx-muted)" }}>
                      Escrow: <strong style={{ color: "var(--zx-ink)" }}>{priorityActionMilestone.milestone.amount} tMSTC</strong>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setActiveTab("milestones")}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-colors hover:bg-slate-100 cursor-pointer"
                        style={{ borderColor: "var(--zx-border)", color: "var(--zx-ink)" }}
                      >
                        Open Workroom →
                      </button>

                      {currentRole === "client" && priorityActionMilestone.type === "review_needed" && (
                        <button
                          onClick={() =>
                            handleApproveMilestone(
                              priorityActionMilestone.gig.id,
                              priorityActionMilestone.index,
                              priorityActionMilestone.gig.milestones?.length || 1
                            )
                          }
                          disabled={isProcessingAction}
                          className="px-4 py-1.5 rounded-xl text-xs font-bold text-white shadow-xs hover:opacity-90 transition-all cursor-pointer flex items-center gap-1.5"
                          style={{ background: "var(--zx-success)" }}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve & Release Funds</span>
                        </button>
                      )}

                      {currentRole === "freelancer" && priorityActionMilestone.type === "accept_assignment" && (
                        <button
                          onClick={() => handleAcceptAssignment(priorityActionMilestone.gig.id)}
                          disabled={isProcessingAction}
                          className="px-4 py-1.5 rounded-xl text-xs font-bold text-white shadow-xs hover:opacity-90 transition-all cursor-pointer flex items-center gap-1.5"
                          style={{ background: "var(--zx-primary-deep)" }}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Accept Assignment</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="p-5 rounded-2xl border text-center space-y-2"
                  style={{ background: "var(--zx-surface-alt)", borderColor: "var(--zx-border)" }}
                >
                  <CheckCircle2 className="w-8 h-8 mx-auto" style={{ color: "var(--zx-success)" }} />
                  <h4 className="text-sm font-bold" style={{ color: "var(--zx-ink)" }}>
                    All Caught Up
                  </h4>
                  <p className="text-xs" style={{ color: "var(--zx-muted)" }}>
                    No pending deliverables or reviews currently require your immediate action.
                  </p>
                </div>
              )}

              {/* Recent Gigs List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-wide" style={{ color: "var(--zx-ink)" }}>
                    {currentRole === "client" ? "Your Posted Gigs" : "Your Assigned Workrooms"}
                  </h3>
                  <button
                    onClick={() => setActiveTab("milestones")}
                    className="text-xs font-bold hover:underline flex items-center gap-1"
                    style={{ color: "var(--zx-primary-deep)" }}
                  >
                    <span>View all in Milestones</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                {isLoadingGigs ? (
                  <div className="py-8 text-center space-y-2">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: "var(--zx-primary)" }} />
                    <p className="text-xs" style={{ color: "var(--zx-muted)" }}>
                      Loading verified gigs from Firebase RTDB...
                    </p>
                  </div>
                ) : userRelevantGigs.length === 0 ? (
                  <div
                    className="py-12 text-center rounded-2xl border space-y-3"
                    style={{ background: "var(--zx-cream)", borderColor: "var(--zx-border)" }}
                  >
                    <Briefcase className="w-8 h-8 mx-auto" style={{ color: "var(--zx-border)" }} />
                    <div className="space-y-1">
                      <p className="text-sm font-bold" style={{ color: "var(--zx-ink)" }}>
                        {currentRole === "client" ? "No Gigs Posted Yet" : "No Active Workrooms"}
                      </p>
                      <p className="text-xs max-w-sm mx-auto" style={{ color: "var(--zx-muted)" }}>
                        {currentRole === "client"
                          ? "Post a gig on the marketplace to lock milestone escrow and hire verified talent."
                          : "Explore open gigs on the marketplace and submit proposals to start working."}
                      </p>
                    </div>
                    <Link
                      to="/marketplace"
                      className="inline-flex items-center gap-1 text-xs font-bold px-4 py-2 rounded-xl text-white shadow-xs hover:opacity-90 transition-all cursor-pointer"
                      style={{ background: "var(--zx-primary-deep)" }}
                    >
                      <span>Explore Marketplace</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {userRelevantGigs.slice(0, 5).map((gig) => {
                      const approvedCount = gig.milestones?.filter((m) => m.status === "approved").length || 0;
                      const totalM = gig.milestones?.length || 1;
                      return (
                        <div
                          key={gig.id}
                          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl border transition-all hover:bg-[var(--zx-surface-alt)]"
                          style={{ borderColor: "var(--zx-border)", background: "var(--zx-surface)" }}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm" style={{ color: "var(--zx-ink)" }}>
                                {gig.title}
                              </span>
                              <span
                                className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                                style={{
                                  background:
                                    gig.status === "Completed"
                                      ? "rgba(22, 163, 74, 0.12)"
                                      : gig.status === "Active"
                                      ? "rgba(217, 119, 6, 0.12)"
                                      : "var(--zx-surface-alt)",
                                  color:
                                    gig.status === "Completed"
                                      ? "var(--zx-success)"
                                      : gig.status === "Active"
                                      ? "var(--zx-warning)"
                                      : "var(--zx-primary-deep)",
                                }}
                              >
                                {gig.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs font-mono" style={{ color: "var(--zx-muted)" }}>
                              <span>ID: #{gig.id}</span>
                              <span>·</span>
                              <span>Budget: <strong style={{ color: "var(--zx-ink)" }}>{gig.totalBudget} tMSTC</strong></span>
                              <span>·</span>
                              <span>{approvedCount}/{totalM} Milestones Approved</span>
                            </div>
                          </div>

                          <button
                            onClick={() => setActiveTab("milestones")}
                            className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl border hover:bg-slate-100 transition-colors cursor-pointer self-end sm:self-center"
                            style={{ borderColor: "var(--zx-border)", color: "var(--zx-ink)" }}
                          >
                            <span>Manage</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              TAB 2: WORKROOMS & MILESTONES
             ══════════════════════════════════════════════════════════ */}
          {activeTab === "milestones" && (
            <div className="space-y-6">
              {/* Header and filters */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b" style={{ borderColor: "var(--zx-border)" }}>
                <div>
                  <h3 className="font-bold text-base" style={{ color: "var(--zx-ink)" }}>
                    {currentRole === "client" ? "Client Workrooms & Milestones" : "Freelancer Active Workrooms"}
                  </h3>
                  <p className="text-xs" style={{ color: "var(--zx-muted)" }}>
                    Milestone escrow anchored by ZentrixEscrow on MST Testnet. Immutable upon approval.
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  {(["all", "active", "open", "completed"] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setMilestoneFilter(filter)}
                      className="px-2.5 py-1 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer"
                      style={
                        milestoneFilter === filter
                          ? { background: "var(--zx-primary-deep)", color: "white" }
                          : { background: "var(--zx-surface-alt)", color: "var(--zx-muted)" }
                      }
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              {isLoadingGigs ? (
                <div className="py-12 text-center space-y-2">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto" style={{ color: "var(--zx-primary)" }} />
                  <p className="text-xs" style={{ color: "var(--zx-muted)" }}>
                    Loading verified gigs from Firebase RTDB...
                  </p>
                </div>
              ) : userRelevantGigs.length === 0 ? (
                <div
                  className="py-16 text-center rounded-2xl border space-y-3"
                  style={{ background: "var(--zx-cream)", borderColor: "var(--zx-border)" }}
                >
                  <Briefcase className="w-10 h-10 mx-auto" style={{ color: "var(--zx-border)" }} />
                  <h4 className="text-base font-black" style={{ color: "var(--zx-ink)" }}>
                    {currentRole === "client" ? "No Gigs Found For Your Address" : "No Assigned Workrooms"}
                  </h4>
                  <p className="text-xs max-w-sm mx-auto" style={{ color: "var(--zx-muted)" }}>
                    {currentRole === "client"
                      ? "You haven't posted any gigs yet. Create a gig with milestone plans to anchor funds on MST Testnet."
                      : "You have not been assigned to any gigs yet. Browse open gigs and submit proposals to get started."}
                  </p>
                  <Link
                    to="/marketplace"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs hover:opacity-90 transition-all cursor-pointer"
                    style={{ background: "var(--zx-primary-deep)" }}
                  >
                    <span>Browse Marketplace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ) : (
                <div className="space-y-6">
                  {userRelevantGigs
                    .filter((g) => {
                      if (milestoneFilter === "active") return g.status === "Active" || g.status === "Assigned";
                      if (milestoneFilter === "open") return g.status === "Open" || g.status === "Submitted";
                      if (milestoneFilter === "completed") return g.status === "Completed";
                      return true;
                    })
                    .map((gig) => {
                      const totalMilestones = gig.milestones?.length || 1;
                      const approvedCount = gig.milestones?.filter((m) => m.status === "approved").length || 0;

                      return (
                        <div
                          key={gig.id}
                          className="rounded-2xl border overflow-hidden shadow-xs"
                          style={{ borderColor: "var(--zx-border)", background: "var(--zx-surface)" }}
                        >
                          {/* Gig Header */}
                          <div
                            className="p-5 border-b flex flex-col md:flex-row md:items-center justify-between gap-4"
                            style={{ background: "var(--zx-cream)", borderColor: "var(--zx-border)" }}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <h4 className="text-base font-black" style={{ color: "var(--zx-ink)" }}>
                                  {gig.title}
                                </h4>
                                <span
                                  className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full"
                                  style={{
                                    background:
                                      gig.status === "Completed"
                                        ? "rgba(22, 163, 74, 0.12)"
                                        : gig.status === "Active"
                                        ? "rgba(217, 119, 6, 0.12)"
                                        : "var(--zx-surface-alt)",
                                    color:
                                      gig.status === "Completed"
                                        ? "var(--zx-success)"
                                        : gig.status === "Active"
                                        ? "var(--zx-warning)"
                                        : "var(--zx-primary-deep)",
                                  }}
                                >
                                  {gig.status}
                                </span>
                                {gig.category && (
                                  <span
                                    className="text-[10px] font-mono px-2 py-0.5 rounded-md border"
                                    style={{ background: "white", borderColor: "var(--zx-border)", color: "var(--zx-muted)" }}
                                  >
                                    {gig.category}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[var(--zx-muted)]">{gig.description}</p>
                              <div className="flex items-center gap-4 text-[11px] font-mono pt-1 text-[var(--zx-muted)] flex-wrap">
                                <span>Gig ID: <strong>#{gig.id}</strong></span>
                                <span>·</span>
                                <span>Total Escrow: <strong style={{ color: "var(--zx-primary-deep)" }}>{gig.totalBudget} tMSTC</strong></span>
                                <span>·</span>
                                <span>Progress: <strong>{approvedCount}/{totalMilestones} Approved</strong></span>
                                {gig.freelancer && (
                                  <>
                                    <span>·</span>
                                    <span>Freelancer: {gig.freelancer.slice(0, 6)}...{gig.freelancer.slice(-4)}</span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Gig Level Action */}
                            <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                              {gig.status === "Assigned" && currentRole === "freelancer" && (
                                <button
                                  onClick={() => handleAcceptAssignment(gig.id)}
                                  disabled={isProcessingAction}
                                  className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs hover:opacity-90 transition-all cursor-pointer flex items-center gap-1.5"
                                  style={{ background: "var(--zx-primary-deep)" }}
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Accept Assignment</span>
                                </button>
                              )}
                              {gig.status === "Assigned" && currentRole === "client" && (
                                <span className="text-xs text-[var(--zx-muted)] font-mono">
                                  Waiting for freelancer acceptance...
                                </span>
                              )}
                              <a
                                href={`https://testnet.mstscan.com/address/${CONTRACT_ADDRESSES.ZentrixEscrow}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-xl border hover:bg-slate-100 transition-colors"
                                style={{ borderColor: "var(--zx-border)", color: "var(--zx-ink)" }}
                              >
                                <span>Escrow Contract</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </div>

                          {/* Milestones in this Gig */}
                          <div className="p-4 space-y-3">
                            {!gig.milestones || gig.milestones.length === 0 ? (
                              <p className="text-xs text-center py-4 text-[var(--zx-muted)]">
                                No milestone items configured for this gig.
                              </p>
                            ) : (
                              gig.milestones.map((m, idx) => {
                                const mStatus = m.status || "pending";
                                const submissionKey = `${gig.id}-${idx}`;
                                const currentInputValue = submissionInputs[submissionKey] || "";

                                return (
                                  <div
                                    key={idx}
                                    className="p-4 rounded-xl border space-y-3 transition-all"
                                    style={{
                                      background:
                                        mStatus === "approved"
                                          ? "rgba(22, 163, 74, 0.03)"
                                          : mStatus === "review"
                                          ? "rgba(217, 119, 6, 0.03)"
                                          : "var(--zx-surface)",
                                      borderColor: "var(--zx-border)",
                                    }}
                                  >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <div
                                            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                                            style={
                                              mStatus === "approved"
                                                ? { background: "var(--zx-success)", color: "white" }
                                                : mStatus === "review"
                                                ? { background: "rgba(217, 119, 6, 0.15)", color: "var(--zx-warning)" }
                                                : { background: "var(--zx-surface-alt)", color: "var(--zx-muted)" }
                                            }
                                          >
                                            {mStatus === "approved" ? "✓" : idx + 1}
                                          </div>
                                          <span className="font-bold text-sm" style={{ color: "var(--zx-ink)" }}>
                                            {m.title}
                                          </span>
                                          <span
                                            className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                                            style={{
                                              background:
                                                mStatus === "approved"
                                                  ? "rgba(22, 163, 74, 0.12)"
                                                  : mStatus === "review"
                                                  ? "rgba(217, 119, 6, 0.12)"
                                                  : mStatus === "rejected"
                                                  ? "rgba(163, 4, 2, 0.12)"
                                                  : "var(--zx-surface-alt)",
                                              color:
                                                mStatus === "approved"
                                                  ? "var(--zx-success)"
                                                  : mStatus === "review"
                                                  ? "var(--zx-warning)"
                                                  : mStatus === "rejected"
                                                  ? "var(--zx-danger)"
                                                  : "var(--zx-muted)",
                                            }}
                                          >
                                            {mStatus === "review" ? "Under Review" : mStatus}
                                          </span>
                                        </div>

                                        {m.acceptanceCriteria && (
                                          <p className="text-xs text-[var(--zx-muted)] pl-8">
                                            Criteria: {m.acceptanceCriteria}
                                          </p>
                                        )}

                                        <div className="flex items-center gap-3 text-[11px] font-mono pl-8 text-[var(--zx-muted)]">
                                          <span>Escrow Amount: <strong style={{ color: "var(--zx-ink)" }}>{m.amount} tMSTC</strong></span>
                                          {m.deadlineDays && <span>· Deadline: {m.deadlineDays} days</span>}
                                          {m.submittedAt && <span>· Submitted: {m.submittedAt}</span>}
                                          {m.approvedAt && <span className="text-emerald-700">· Approved: {m.approvedAt}</span>}
                                        </div>
                                      </div>

                                      {/* Status Tag / Quick Summary */}
                                      <div className="shrink-0 self-end sm:self-center">
                                        {mStatus === "approved" ? (
                                          <span
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
                                            style={{
                                              background: "rgba(22, 163, 74, 0.12)",
                                              color: "var(--zx-success)",
                                              border: "1px solid var(--zx-success)",
                                            }}
                                          >
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            <span>Approved (Released)</span>
                                          </span>
                                        ) : mStatus === "review" ? (
                                          <span
                                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold"
                                            style={{
                                              background: "rgba(217, 119, 6, 0.12)",
                                              color: "var(--zx-warning)",
                                              border: "1px solid var(--zx-warning)",
                                            }}
                                          >
                                            <Clock className="w-3.5 h-3.5" />
                                            <span>Under Client Review</span>
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>

                                    {/* Evidence CID display */}
                                    {m.cid && (
                                      <div className="p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2" style={{ background: "var(--zx-surface-alt)", borderColor: "var(--zx-border)" }}>
                                        <div className="flex items-center gap-2 overflow-hidden">
                                          <FileText className="w-3.5 h-3.5 shrink-0 text-[var(--zx-primary-deep)]" />
                                          <span className="font-mono truncate">
                                            Evidence Proof: <strong>{m.cid}</strong>
                                          </span>
                                        </div>
                                        {m.cid.startsWith("Qm") || m.cid.startsWith("ba") ? (
                                          <a
                                            href={`https://ipfs.io/ipfs/${m.cid}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-xs font-bold underline shrink-0 flex items-center gap-1"
                                            style={{ color: "var(--zx-primary-deep)" }}
                                          >
                                            <span>IPFS View</span>
                                            <ExternalLink className="w-3 h-3" />
                                          </a>
                                        ) : m.cid.startsWith("http") ? (
                                          <a
                                            href={m.cid}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-xs font-bold underline shrink-0 flex items-center gap-1"
                                            style={{ color: "var(--zx-primary-deep)" }}
                                          >
                                            <span>Open Deliverable</span>
                                            <ExternalLink className="w-3 h-3" />
                                          </a>
                                        ) : null}
                                      </div>
                                    )}

                                    {/* Rejection note display */}
                                    {m.rejectionReason && (
                                      <div className="p-2.5 rounded-xl border text-xs flex items-center gap-2" style={{ background: "rgba(163, 4, 2, 0.05)", borderColor: "var(--zx-danger)", color: "var(--zx-danger)" }}>
                                        <XCircle className="w-3.5 h-3.5 shrink-0" />
                                        <span>Revision Requested: {m.rejectionReason}</span>
                                      </div>
                                    )}

                                    {/* Action Buttons Area */}
                                    <div className="pt-2 border-t flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2" style={{ borderColor: "var(--zx-border)" }}>
                                      {/* Freelancer Action: Submit deliverable */}
                                      {currentRole === "freelancer" && (mStatus === "pending" || mStatus === "rejected") && (
                                        <div className="flex flex-col sm:flex-row items-stretch gap-2 w-full">
                                          <input
                                            type="text"
                                            placeholder="IPFS CID, GitHub PR link, or deliverable proof..."
                                            value={currentInputValue}
                                            onChange={(e) =>
                                              setSubmissionInputs((prev) => ({
                                                ...prev,
                                                [submissionKey]: e.target.value,
                                              }))
                                            }
                                            className="flex-1 px-3 py-1.5 text-xs rounded-xl border"
                                            style={{
                                              borderColor: "var(--zx-border)",
                                              background: "var(--zx-surface)",
                                              color: "var(--zx-ink)",
                                            }}
                                          />
                                          <button
                                            onClick={() => handleSubmitMilestone(gig.id, idx)}
                                            disabled={isProcessingAction || !currentInputValue.trim()}
                                            className="px-4 py-1.5 rounded-xl text-xs font-bold text-white shadow-xs hover:opacity-90 transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                            style={{ background: "var(--zx-primary-deep)" }}
                                          >
                                            <Send className="w-3 h-3" />
                                            <span>Submit Deliverable</span>
                                          </button>
                                        </div>
                                      )}

                                      {/* Client Action: Review & Approve / Reject */}
                                      {currentRole === "client" && mStatus === "review" && (
                                        <div className="flex items-center gap-2">
                                          <button
                                            onClick={() =>
                                              setRejectionModal({
                                                gigId: gig.id,
                                                milestoneIndex: idx,
                                                title: m.title,
                                              })
                                            }
                                            disabled={isProcessingAction}
                                            className="px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors hover:bg-slate-100 cursor-pointer"
                                            style={{ borderColor: "var(--zx-border)", color: "var(--zx-danger)" }}
                                          >
                                            Request Revision
                                          </button>
                                          <button
                                            onClick={() => handleApproveMilestone(gig.id, idx, totalMilestones)}
                                            disabled={isProcessingAction}
                                            className="px-4 py-1.5 rounded-xl text-xs font-bold text-white shadow-xs hover:opacity-90 transition-all cursor-pointer flex items-center gap-1.5"
                                            style={{ background: "var(--zx-success)" }}
                                          >
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            <span>Approve & Release Funds</span>
                                          </button>
                                        </div>
                                      )}

                                      {currentRole === "client" && mStatus === "pending" && (
                                        <span className="text-xs text-[var(--zx-muted)] font-mono">
                                          Freelancer is actively preparing this deliverable.
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              TAB 3: PROPOSALS (CLIENT & FREELANCER VIEWS)
             ══════════════════════════════════════════════════════════ */}
          {activeTab === "proposals" && (
            <div className="space-y-6">
              {currentRole === "client" ? (
                /* Client: Proposals Received */
                <div className="space-y-4">
                  <div className="border-b pb-2" style={{ borderColor: "var(--zx-border)" }}>
                    <h3 className="font-bold text-base" style={{ color: "var(--zx-ink)" }}>
                      Received Proposals ({receivedProposals.length})
                    </h3>
                    <p className="text-xs" style={{ color: "var(--zx-muted)" }}>
                      Review applicants for your posted gigs. Assigning locks on-chain milestone escrow.
                    </p>
                  </div>

                  {receivedProposals.length === 0 ? (
                    <div
                      className="py-16 text-center rounded-2xl border space-y-3"
                      style={{ background: "var(--zx-cream)", borderColor: "var(--zx-border)" }}
                    >
                      <Inbox className="w-10 h-10 mx-auto" style={{ color: "var(--zx-border)" }} />
                      <h4 className="text-base font-black" style={{ color: "var(--zx-ink)" }}>
                        No Proposals Received Yet
                      </h4>
                      <p className="text-xs max-w-sm mx-auto" style={{ color: "var(--zx-muted)" }}>
                        Your posted gigs are live on the Marketplace. When freelancers submit proposals, they will appear here for review.
                      </p>
                      <Link
                        to="/marketplace"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs hover:opacity-90 transition-all cursor-pointer"
                        style={{ background: "var(--zx-primary-deep)" }}
                      >
                        <span>View Gigs in Marketplace</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {receivedProposals.map(({ gig, proposal }, index) => {
                        const isAssigned = gig.status === "Assigned" || gig.status === "Active" || gig.status === "Completed";
                        const isThisFreelancerAssigned =
                          gig.freelancer?.toLowerCase() === proposal.freelancerAddress.toLowerCase();

                        return (
                          <div
                            key={index}
                            className="p-5 rounded-2xl border space-y-3"
                            style={{ background: "var(--zx-surface)", borderColor: "var(--zx-border)" }}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <span className="text-[10px] font-bold uppercase font-mono px-2 py-0.5 rounded-md border" style={{ background: "var(--zx-surface-alt)", borderColor: "var(--zx-border)", color: "var(--zx-muted)" }}>
                                  Target Gig: #{gig.id}
                                </span>
                                <h4 className="font-black text-sm mt-1" style={{ color: "var(--zx-ink)" }}>
                                  {gig.title}
                                </h4>
                              </div>
                              <div className="text-right">
                                <span className="text-xs font-mono font-bold" style={{ color: "var(--zx-primary-deep)" }}>
                                  Budget: {gig.totalBudget} tMSTC
                                </span>
                              </div>
                            </div>

                            <div className="p-3.5 rounded-xl border text-xs space-y-2" style={{ background: "var(--zx-cream)", borderColor: "var(--zx-border)" }}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <UserCheck className="w-3.5 h-3.5" style={{ color: "var(--zx-primary-deep)" }} />
                                  <span className="font-mono font-bold">{proposal.freelancerAddress}</span>
                                </div>
                                <span className="text-[10px] font-mono text-[var(--zx-muted)]">
                                  {proposal.submittedAt}
                                </span>
                              </div>
                              <p className="text-xs leading-relaxed" style={{ color: "var(--zx-ink)" }}>
                                {proposal.proposalText}
                              </p>
                            </div>

                            <div className="flex items-center justify-between pt-1">
                              <span className="text-[11px] font-mono text-[var(--zx-muted)]">
                                Status:{" "}
                                <strong style={{ color: isThisFreelancerAssigned ? "var(--zx-success)" : "var(--zx-ink)" }}>
                                  {isThisFreelancerAssigned ? "Assigned to this Gig" : proposal.status || "Submitted"}
                                </strong>
                              </span>

                              <div className="flex items-center gap-2">
                                {isThisFreelancerAssigned ? (
                                  <span
                                    className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1"
                                    style={{ background: "rgba(22, 163, 74, 0.12)", color: "var(--zx-success)" }}
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Assigned</span>
                                  </span>
                                ) : isAssigned ? (
                                  <span className="text-xs text-[var(--zx-muted)] font-mono">
                                    Another freelancer assigned
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleAssignFreelancer(gig.id, proposal.freelancerAddress)}
                                    disabled={isProcessingAction}
                                    className="px-4 py-1.5 rounded-xl text-xs font-bold text-white shadow-xs hover:opacity-90 transition-all cursor-pointer flex items-center gap-1.5"
                                    style={{ background: "var(--zx-primary-deep)" }}
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Accept & Assign Freelancer</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* Freelancer: Submitted Applications */
                <div className="space-y-4">
                  <div className="border-b pb-2" style={{ borderColor: "var(--zx-border)" }}>
                    <h3 className="font-bold text-base" style={{ color: "var(--zx-ink)" }}>
                      My Submitted Applications ({mySubmittedProposals.length})
                    </h3>
                    <p className="text-xs" style={{ color: "var(--zx-muted)" }}>
                      Proposals you have submitted to clients on the Zentrix marketplace.
                    </p>
                  </div>

                  {mySubmittedProposals.length === 0 ? (
                    <div
                      className="py-16 text-center rounded-2xl border space-y-3"
                      style={{ background: "var(--zx-cream)", borderColor: "var(--zx-border)" }}
                    >
                      <Inbox className="w-10 h-10 mx-auto" style={{ color: "var(--zx-border)" }} />
                      <h4 className="text-base font-black" style={{ color: "var(--zx-ink)" }}>
                        No Proposals Submitted
                      </h4>
                      <p className="text-xs max-w-sm mx-auto" style={{ color: "var(--zx-muted)" }}>
                        You haven't submitted any gig applications yet. Browse the marketplace and apply with your proposed milestones.
                      </p>
                      <Link
                        to="/marketplace"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs hover:opacity-90 transition-all cursor-pointer"
                        style={{ background: "var(--zx-primary-deep)" }}
                      >
                        <span>Explore Marketplace</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {mySubmittedProposals.map(({ gig, proposal }, index) => {
                        const isAssignedToMe =
                          gig.freelancer?.toLowerCase() === userAddr ||
                          gig.assignedFreelancer?.toLowerCase() === userAddr;

                        return (
                          <div
                            key={index}
                            className="p-5 rounded-2xl border space-y-3"
                            style={{ background: "var(--zx-surface)", borderColor: "var(--zx-border)" }}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <span className="text-[10px] font-bold uppercase font-mono px-2 py-0.5 rounded-md border" style={{ background: "var(--zx-surface-alt)", borderColor: "var(--zx-border)", color: "var(--zx-muted)" }}>
                                  Target Gig: #{gig.id}
                                </span>
                                <h4 className="font-black text-sm mt-1" style={{ color: "var(--zx-ink)" }}>
                                  {gig.title}
                                </h4>
                              </div>
                              <span className="text-xs font-mono font-bold" style={{ color: "var(--zx-primary-deep)" }}>
                                Budget: {gig.totalBudget} tMSTC
                              </span>
                            </div>

                            <div className="p-3.5 rounded-xl border text-xs space-y-1.5" style={{ background: "var(--zx-cream)", borderColor: "var(--zx-border)" }}>
                              <p className="text-xs font-semibold" style={{ color: "var(--zx-ink)" }}>
                                Your Proposal: {proposal.proposalText}
                              </p>
                              <p className="text-[10px] font-mono text-[var(--zx-muted)]">
                                Submitted: {proposal.submittedAt}
                              </p>
                            </div>

                            <div className="flex items-center justify-between pt-1">
                              <span className="text-[11px] font-mono">
                                Client Status:{" "}
                                <strong
                                  style={{
                                    color: isAssignedToMe ? "var(--zx-success)" : "var(--zx-muted)",
                                  }}
                                >
                                  {isAssignedToMe ? "Accepted & Assigned!" : "Under Consideration"}
                                </strong>
                              </span>

                              {isAssignedToMe && gig.status === "Assigned" && (
                                <button
                                  onClick={() => handleAcceptAssignment(gig.id)}
                                  disabled={isProcessingAction}
                                  className="px-4 py-1.5 rounded-xl text-xs font-bold text-white shadow-xs hover:opacity-90 transition-all cursor-pointer flex items-center gap-1.5"
                                  style={{ background: "var(--zx-primary-deep)" }}
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Accept Agreement & Start</span>
                                </button>
                              )}

                              {isAssignedToMe && gig.status === "Active" && (
                                <button
                                  onClick={() => setActiveTab("milestones")}
                                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold border hover:bg-slate-100 transition-colors cursor-pointer"
                                  style={{ borderColor: "var(--zx-border)", color: "var(--zx-ink)" }}
                                >
                                  Go to Workroom →
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              TAB 4: REPUTATION SOULBOUND CREDENTIALS
             ══════════════════════════════════════════════════════════ */}
          {activeTab === "reputation" && (
            <div className="space-y-6">
              <div className="border-b pb-2 flex items-center justify-between" style={{ borderColor: "var(--zx-border)" }}>
                <div>
                  <h3 className="font-bold text-base" style={{ color: "var(--zx-ink)" }}>
                    Soulbound Reputation Credentials (ERC-721)
                  </h3>
                  <p className="text-xs" style={{ color: "var(--zx-muted)" }}>
                    Immutable credentials issued by ZentrixReputation upon verified milestone delivery on MST Testnet.
                  </p>
                </div>
                <button
                  onClick={fetchMetrics}
                  className="flex items-center gap-1 text-xs font-bold hover:underline"
                  style={{ color: "var(--zx-primary-deep)" }}
                >
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>

              {metrics.reputationTokenCount === 0 ? (
                <div
                  className="py-16 text-center rounded-2xl border space-y-3"
                  style={{ background: "var(--zx-cream)", borderColor: "var(--zx-border)" }}
                >
                  <Award className="w-12 h-12 mx-auto" style={{ color: "var(--zx-border)" }} />
                  <h4 className="text-base font-black" style={{ color: "var(--zx-ink)" }}>
                    No Soulbound Credentials Yet
                  </h4>
                  <p className="text-xs max-w-sm mx-auto" style={{ color: "var(--zx-muted)" }}>
                    Credentials are minted on-chain automatically when a client approves deliverables on final milestones. Complete your first gig to earn an immutable credential!
                  </p>
                  <Link
                    to="/marketplace"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs hover:opacity-90 transition-all cursor-pointer"
                    style={{ background: "var(--zx-primary-deep)" }}
                  >
                    <span>Browse Marketplace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Array.from({ length: metrics.reputationTokenCount }).map((_, i) => (
                    <div
                      key={i}
                      className="p-5 rounded-2xl space-y-3 border"
                      style={{ background: "var(--zx-cream)", borderColor: "var(--zx-border)" }}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full"
                          style={{ background: "var(--zx-surface-alt)", color: "var(--zx-primary-deep)" }}
                        >
                          ERC-721 Soulbound
                        </span>
                        <span className="text-xs font-bold font-mono" style={{ color: "var(--zx-success)" }}>
                          ★ 5.0 / 5.0
                        </span>
                      </div>
                      <div>
                        <h4 className="font-bold text-sm" style={{ color: "var(--zx-ink)" }}>
                          Reputation Credential #{i + 1}
                        </h4>
                        <p className="text-xs mt-1" style={{ color: "var(--zx-muted)" }}>
                          Verified deliverable approved on MST Testnet by client agreement.
                        </p>
                      </div>
                      <div
                        className="text-[10px] font-mono pt-2 flex items-center justify-between"
                        style={{ borderTop: "1px solid var(--zx-border)", color: "var(--zx-muted)" }}
                      >
                        <span>Contract: {CONTRACT_ADDRESSES.ZentrixReputation.slice(0, 14)}...</span>
                        <a
                          href={`https://testnet.mstscan.com/address/${CONTRACT_ADDRESSES.ZentrixReputation}`}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline flex items-center gap-0.5 font-bold"
                          style={{ color: "var(--zx-primary-deep)" }}
                        >
                          <span>MSTScan</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Modal: Request Revision ─────────────────────────────────── */}
      {rejectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-md p-6 rounded-3xl border shadow-xl space-y-4"
            style={{ background: "var(--zx-surface)", borderColor: "var(--zx-border)" }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black" style={{ color: "var(--zx-ink)" }}>
                Request Deliverable Revision
              </h3>
              <button
                onClick={() => setRejectionModal(null)}
                className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <XCircle className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <p className="text-xs" style={{ color: "var(--zx-muted)" }}>
              Provide constructive feedback for <strong>{rejectionModal.title}</strong>. This feedback will be recorded on-chain and the milestone status will switch to <code>rejected</code> until re-submitted.
            </p>

            <textarea
              rows={3}
              placeholder="Explain required changes, missing criteria, or issues..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full p-3 text-xs rounded-xl border focus:outline-hidden"
              style={{
                borderColor: "var(--zx-border)",
                background: "var(--zx-surface-alt)",
                color: "var(--zx-ink)",
              }}
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectionModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold border hover:bg-slate-100 transition-colors cursor-pointer"
                style={{ borderColor: "var(--zx-border)", color: "var(--zx-ink)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleRejectMilestone}
                disabled={isProcessingAction || !rejectionReason.trim()}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs hover:opacity-90 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "var(--zx-danger)" }}
              >
                {isProcessingAction ? "Submitting..." : "Submit Revision Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
