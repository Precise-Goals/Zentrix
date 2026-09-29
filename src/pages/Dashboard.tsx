import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWallet } from "../context/WalletContext";
import { ethers } from "ethers";
import { CONTRACT_ADDRESSES, CONTRACT_ABIS } from "../contracts";
import { getCachedNFTAssets, scanNFTAssets } from "../lib/nftScanner";
import { rtdb } from "../lib/firebase";
import { ref, onValue, set, get, update } from "firebase/database";
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
} from "lucide-react";

interface OnChainMetrics {
  withdrawable: string;   // ethers.formatEther result
  passTokenId: number | null;
  passTier: number;       // 0=Free, 1=PRO, 2=Enterprise
  reputationTokenCount: number;
  loading: boolean;
  error: string | null;
}

export interface DashboardMilestone {
  id: number;
  num: number;
  label: string;
  amount: string;
  description: string;
  status: "pending" | "review" | "approved";
  submittedAt?: string;
  approvedAt?: string;
}

const DEFAULT_MILESTONES: DashboardMilestone[] = [
  {
    id: 1,
    num: 1,
    label: "EIP-1193 Provider Hook & BridgeKey Multi-Sig Integration",
    amount: "1.0",
    description: "Connector hook detecting BridgeKey chrome extension and MST chain 91562037.",
    status: "approved",
    approvedAt: "2026-09-28 14:32",
  },
  {
    id: 2,
    num: 2,
    label: "Milestone Smart Contract Escrow Architecture",
    amount: "1.5",
    description: "Non-reentrant multi-party pull custody with auto-release window logic.",
    status: "review",
    submittedAt: "2026-09-29 00:15",
  },
  {
    id: 3,
    num: 3,
    label: "End-to-End Verification & SBT Minting Hook",
    amount: "1.0",
    description: "ZentrixReputation soulbound credential emission upon mentor milestone approval.",
    status: "pending",
  },
];

const TIER_LABELS: Record<number, string> = {
  0: "Free",
  1: "PRO",
  2: "Enterprise",
};

export const DashboardPage: React.FC = () => {
  const { currentRole } = useAuth();
  const { address, signer, provider, isConnected, connectWallet, openConnectModal } = useWallet();

  const cachedNft = getCachedNFTAssets(address);
  const [metrics, setMetrics] = useState<OnChainMetrics>({
    withdrawable: "0",
    passTokenId: cachedNft.passTokenId ? Number(cachedNft.passTokenId) : null,
    passTier: cachedNft.passTier ?? 0,
    reputationTokenCount: cachedNft.reputationCount,
    loading: false,
    error: null,
  });

  const [milestones, setMilestones] = useState<DashboardMilestone[]>(() => {
    try {
      const saved = localStorage.getItem("zx_dashboard_milestones");
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return DEFAULT_MILESTONES;
  });

  const [milestoneNotice, setMilestoneNotice] = useState<{
    type: "success" | "info" | "warning" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem("zx_dashboard_milestones", JSON.stringify(milestones));
    } catch (_) {}
  }, [milestones]);

  useEffect(() => {
    const handleMilestonesUpdated = () => {
      try {
        const saved = localStorage.getItem("zx_dashboard_milestones");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
             setMilestones(parsed);
          }
        }
      } catch (_) {}
    };
    window.addEventListener("zx_milestones_updated", handleMilestonesUpdated);
    window.addEventListener("storage", handleMilestonesUpdated);
    return () => {
      window.removeEventListener("zx_milestones_updated", handleMilestonesUpdated);
      window.removeEventListener("storage", handleMilestonesUpdated);
    };
  }, []);

  const [activeTab, setActiveTab] = useState<"overview" | "milestones" | "reputation" | "proposals">("overview");
  const [clientGigs, setClientGigs] = useState<any[]>([]);
  const [withdrawing, setWithdrawing] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<"pending" | "confirmed" | null>(null);
  const [withdrawFeedback, setWithdrawFeedback] = useState<{ type: "error" | "info" | "warning"; msg: string } | null>(null);

  // Freelancer submits milestone for review
  const handleSubmitForReview = async (num: number) => {
    setMilestoneNotice(null);
    try {
      if (!signer) throw new Error("Wallet not connected");
      const escrow = new ethers.Contract(CONTRACT_ADDRESSES.ZentrixEscrow, CONTRACT_ABIS.ZentrixEscrow, signer);
      
      setMilestoneNotice({ type: "success", message: "Transaction pending on MST Testnet..." });
      const tx = await escrow.submitMilestone(
        1, // mock gigId since we rely on localStorage
        num - 1, // index
        "QmMockedEvidenceCID"
      );
      await tx.wait();

      setMilestones((prev) =>
        prev.map((m) => {
          if (m.num === num) {
            if (m.status === "approved") return m;
            return {
              ...m,
              status: "review",
              submittedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            };
          }
          return m;
        })
      );
      setMilestoneNotice({ type: "success", message: `Milestone #${num} deliverable anchored on-chain!` });
    } catch(err: any) {
      setMilestoneNotice({ type: "error", message: err.message || "Transaction failed" });
    }
  };

  // Client/Mentor approves milestone (Immutable - cannot be reverted!)
  const handleApproveMilestone = async (num: number) => {
    setMilestoneNotice(null);
    try {
      if (!signer) throw new Error("Wallet not connected");
      const escrow = new ethers.Contract(CONTRACT_ADDRESSES.ZentrixEscrow, CONTRACT_ABIS.ZentrixEscrow, signer);
      
      setMilestoneNotice({ type: "success", message: "Transaction pending on MST Testnet..." });
      const tx = await escrow.approveMilestone(
        1, // mock gigId
        num - 1, // index
        5 // rating out of 5
      );
      await tx.wait();

      setMilestones((prev) =>
        prev.map((m) => {
          if (m.num === num) {
            if (m.status === "approved") return m;
            return {
              ...m,
              status: "approved",
              approvedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            };
          }
          return m;
        })
      );
      setMilestoneNotice({ type: "success", message: `Milestone #${num} approved! Funds released on-chain!` });
    } catch(err: any) {
      setMilestoneNotice({ type: "error", message: err.message || "Transaction failed" });
    }
  };

  // Find active milestone for Overview card
  const activeMilestone =
    milestones.find((m) => m.status !== "approved") || milestones[milestones.length - 1];

  useEffect(() => {
    if (activeTab === "proposals" && address && currentRole === "client") {
      const gigsRef = ref(rtdb, 'gigs');
      const unsubscribe = onValue(gigsRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          const myGigs = Object.values(data).filter((g: any) => g.client?.toLowerCase() === address.toLowerCase());
          setClientGigs(myGigs);
        }
      });
      return () => unsubscribe();
    }
  }, [activeTab, address, currentRole]);

  const handleAssign = async (gigId: string, freelancerAddress: string) => {
    if (!signer) return;
    try {
      const escrow = new ethers.Contract(CONTRACT_ADDRESSES.ZentrixEscrow, CONTRACT_ABIS.ZentrixEscrow, signer);
      // Ensure gigId is a number or parseable. Assuming onChainGigId is an integer string
      const tx = await escrow.assignAndFund(parseInt(gigId) || 1, freelancerAddress, ethers.ZeroHash, "");
      await tx.wait();
      
      await update(ref(rtdb, `gigs/${gigId}`), { status: 'Assigned', freelancer: freelancerAddress });
      alert("Freelancer Assigned Successfully!");
    } catch(e: any) {
      alert("Error: " + e.message);
    }
  };

  // ── Fetch on-chain data ─────────────────────────────────────────
  const fetchMetrics = useCallback(async () => {
    if (!address || !provider) return;

    setMetrics((m) => ({ ...m, loading: true, error: null }));
    try {
      const escrow = new ethers.Contract(
        CONTRACT_ADDRESSES.ZentrixEscrow,
        CONTRACT_ABIS.ZentrixEscrow,
        provider
      );

      // Withdrawable balance from escrow
      let withdrawable = "0";
      try {
        const raw = await escrow.withdrawable(address);
        withdrawable = ethers.formatEther(raw);
      } catch (_) { /* address has no balance yet */ }

      // Deep scan all on-chain NFT assets (Passes, Events, SBTs)
      const scan = await scanNFTAssets(address, provider);
      const passTier = scan.passTier ?? 0;
      const passTokenId = scan.passTokenId ? Number(scan.passTokenId) : null;
      const reputationTokenCount = scan.reputationCount;

      setMetrics({
        withdrawable,
        passTokenId,
        passTier,
        reputationTokenCount,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      setMetrics((m) => ({ ...m, loading: false, error: err?.message ?? "Chain read failed" }));
    }
  }, [address, provider]);

  useEffect(() => {
    if (isConnected) fetchMetrics();
  }, [isConnected, fetchMetrics]);

  // Periodic background re-scan to keep assets fresh on reload and live updates
  useEffect(() => {
    if (address) {
      scanNFTAssets(address, provider);
      const interval = setInterval(() => {
        scanNFTAssets(address, provider);
      }, 12000);
      return () => clearInterval(interval);
    }
  }, [address, provider]);

  useEffect(() => {
    const onScanned = (e: any) => {
      const d = e.detail;
      if (d) {
        setMetrics((m) => ({
          ...m,
          passTier: typeof d.passTier === "number" ? d.passTier : m.passTier,
          passTokenId: d.passTokenId ? Number(d.passTokenId) : m.passTokenId,
          reputationTokenCount: d.reputationCount ?? m.reputationTokenCount,
        }));
      }
    };
    window.addEventListener("zx_nft_scanned", onScanned);
    return () => window.removeEventListener("zx_nft_scanned", onScanned);
  }, []);

  // ── Pull withdraw ────────────────────────────────────────────────
  const handleWithdraw = async () => {
    setWithdrawFeedback(null);
    if (!isConnected || !signer) { connectWallet(); return; }
    if (parseFloat(metrics.withdrawable) <= 0) {
      setWithdrawFeedback({ type: "info", msg: "No withdrawable balance currently on this address." });
      return;
    }
    setWithdrawing(true);
    setTxHash(null);
    setTxStatus("pending");
    try {
      const escrow = new ethers.Contract(
        CONTRACT_ADDRESSES.ZentrixEscrow,
        CONTRACT_ABIS.ZentrixEscrow,
        signer
      );
      const tx = await escrow.withdraw();
      setTxHash(tx.hash);
      await tx.wait();
      setTxStatus("confirmed");
      await fetchMetrics(); // refresh after withdrawal
    } catch (err: any) {
      setWithdrawFeedback({ type: "warning", msg: err?.reason ?? err?.message ?? "Withdrawal transaction failed or was rejected." });
      setTxStatus(null);
    } finally {
      setWithdrawing(false);
    }
  };

  // ── Not connected guard ──────────────────────────────────────────
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 text-center">
        <div className="w-16 h-16 rounded-3xl flex items-center justify-center"
          style={{ background: "var(--zx-surface-alt)" }}>
          <Wallet className="w-8 h-8" style={{ color: "var(--zx-primary-deep)" }} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black" style={{ color: "var(--zx-ink)" }}>Connect Your Wallet</h2>
          <p className="text-sm" style={{ color: "var(--zx-muted)" }}>
            Connect BridgeKey to see your real on-chain escrow balance, pass tier, and reputation.
          </p>
        </div>
        <button onClick={openConnectModal}
          className="inline-flex items-center gap-2 font-bold rounded-2xl px-6 py-3 text-sm shadow-md"
          style={{ background: "var(--zx-primary-deep)", color: "var(--zx-cream)" }}>
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4"
        style={{ borderBottom: "1px solid var(--zx-border)" }}>
        <div>
          <h1 className="text-3xl font-black" style={{ color: "var(--zx-ink)" }}>Dashboard</h1>
          <p className="text-sm mt-1 font-mono" style={{ color: "var(--zx-muted)" }}>
            {address?.slice(0, 8)}...{address?.slice(-6)}
          </p>
        </div>

        {/* Read-only Role Display - Shifting is restricted to Profile Settings */}
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
            className="font-semibold underline ml-1 hover:opacity-80 transition-opacity flex items-center gap-1"
            style={{ color: "var(--zx-primary-deep)" }}
            title="Role can only be changed in Profile Settings"
          >
            Change in Profile →
          </Link>
        </div>
      </div>

      {/* Milestone action notice */}
      {milestoneNotice && (
        <div
          className="flex items-center justify-between p-4 rounded-2xl text-xs font-semibold shadow-xs animate-in fade-in duration-200"
          style={{
            background:
              milestoneNotice.type === "success"
                ? "rgba(47, 125, 79, 0.1)"
                : "rgba(216, 64, 64, 0.08)",
            border: `1px solid ${
              milestoneNotice.type === "success" ? "var(--zx-success)" : "var(--zx-primary)"
            }`,
            color:
              milestoneNotice.type === "success" ? "var(--zx-success)" : "var(--zx-primary-deep)",
          }}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{milestoneNotice.message}</span>
          </div>
          <button
            onClick={() => setMilestoneNotice(null)}
            className="text-xs font-bold underline hover:opacity-80 ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Tx status banner (Hard Rule 8) ───────────────────────────── */}
      {txHash && (
        <div className="flex items-center justify-between gap-4 p-4 rounded-2xl text-xs font-semibold"
          style={{
            background: txStatus === "confirmed"
              ? "rgba(47,125,79,0.1)" : "rgba(216,64,64,0.08)",
            border: `1px solid ${txStatus === "confirmed" ? "var(--zx-success)" : "var(--zx-primary)"}`,
          }}>
          <div className="flex items-center gap-2">
            {txStatus === "confirmed"
              ? <CheckCircle2 className="w-4 h-4" style={{ color: "var(--zx-success)" }} />
              : <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--zx-primary)" }} />
            }
            <span style={{ color: "var(--zx-ink)" }}>
              {txStatus === "confirmed" ? "Withdrawal confirmed" : "Transaction pending..."}
              {" "}— {txHash.slice(0, 10)}...{txHash.slice(-8)}
            </span>
          </div>
          <a href={`https://testnet.mstscan.com/tx/${txHash}`} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 font-bold hover:underline"
            style={{ color: "var(--zx-primary-deep)" }}>
            MSTScan <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* Withdraw Notice / Feedback */}
      {withdrawFeedback && (
        <div
          className="flex items-center justify-between p-4 rounded-2xl text-xs font-semibold shadow-sm animate-in fade-in duration-200"
          style={{
            background: withdrawFeedback.type === "error" ? "rgba(163, 4, 2, 0.08)" : "rgba(30, 41, 59, 0.05)",
            border: `1px solid ${withdrawFeedback.type === "error" ? "var(--zx-primary)" : "var(--zx-border)"}`,
            color: withdrawFeedback.type === "error" ? "var(--zx-primary-deep)" : "var(--zx-ink)",
          }}
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{withdrawFeedback.msg}</span>
          </div>
          <button
            onClick={() => setWithdrawFeedback(null)}
            className="text-xs font-bold underline hover:opacity-80 ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Bento metrics ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Withdrawable balance */}
        <div className="rounded-3xl p-6 space-y-3 relative overflow-hidden shadow-xs"
          style={{
            background: "linear-gradient(135deg, var(--zx-surface) 0%, var(--zx-surface-alt) 100%)",
            border: "2px solid var(--zx-primary)",
          }}>
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10"
            style={{ background: "var(--zx-primary)", filter: "blur(20px)" }} />
          <div className="text-xs font-bold uppercase tracking-wide text-[var(--zx-primary-deep)]">
            {currentRole === "client" ? "Locked in Escrow" : "Available to Withdraw"}
          </div>
          <div className="text-4xl font-black font-mono text-[var(--zx-ink)]">
            {metrics.loading
              ? <Loader2 className="w-8 h-8 animate-spin inline text-[var(--zx-primary)]" />
              : <>{parseFloat(metrics.withdrawable).toFixed(4)} <span className="text-lg opacity-60 text-[var(--zx-muted)]">tMSTC</span></>
            }
          </div>
          {currentRole === "freelancer" && (
            <button onClick={handleWithdraw} disabled={withdrawing || metrics.loading}
              className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm"
              style={{ background: "var(--zx-primary-deep)", color: "white" }}>
              {withdrawing ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              {withdrawing ? "Processing..." : "Pull Withdraw"}
            </button>
          )}
        </div>

        {/* Pass tier */}
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
                {(metrics.loading && !metrics.passTier) ? (
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
              <span className="text-xs font-bold font-mono text-[var(--zx-muted)]">
                {metrics.passTier === 2
                  ? "(15 queries/day)"
                  : metrics.passTier === 1
                  ? "(10 queries/day)"
                  : "(2 queries/day)"}
              </span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "var(--zx-muted)" }}>
              {metrics.passTier === 2
                ? "Enterprise Soulbound NFT active — 15 AI queries daily"
                : metrics.passTier === 1
                ? "Pro Soulbound NFT active — 10 AI queries daily"
                : "Free Starter allowance — 2 AI queries daily"}
            </p>
            {metrics.passTier === 0 ? (
              <Link
                to="/pricing"
                className="inline-flex items-center gap-1 text-xs font-bold hover:underline"
                style={{ color: "var(--zx-primary-deep)" }}
              >
                <span>Upgrade to PRO or Enterprise Pass →</span>
              </Link>
            ) : (
              <div className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Soulbound NFT Active · Full Color</span>
              </div>
            )}
          </div>

          {/* Fixed Mini NFT Visual preview */}
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
              alt={
                metrics.passTier === 2
                  ? "Enterprise Pass NFT"
                  : metrics.passTier === 1
                  ? "PRO Pass NFT"
                  : "Free Starter Pass"
              }
              className={`w-full h-full object-cover transition-all duration-500 ${
                metrics.passTier > 0
                  ? "grayscale-0 group-hover:scale-110"
                  : "grayscale opacity-75 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-105"
              }`}
            />
            {metrics.passTier > 0 ? (
              <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-full bg-black/80 backdrop-blur-xs text-[9px] font-mono font-bold text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{metrics.passTier === 2 ? "ENT" : "PRO"}</span>
              </div>
            ) : (
              <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-full bg-black/80 backdrop-blur-xs text-[9px] font-mono font-bold text-slate-300 border border-white/20 flex items-center gap-1">
                <Lock className="w-2.5 h-2.5 text-slate-400" />
                <span>FREE</span>
              </div>
            )}
          </div>
        </div>

        {/* Reputation */}
        <div className="rounded-3xl p-6 space-y-3"
          style={{ background: "var(--zx-surface)", border: "1px solid var(--zx-border)" }}>
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--zx-muted)" }}>
            Soulbound Credentials
          </div>
          <div className="text-4xl font-black" style={{ color: "var(--zx-ink)" }}>
            {(metrics.loading && metrics.reputationTokenCount === 0 && !cachedNft.reputationCount)
              ? <Loader2 className="w-8 h-8 animate-spin inline" style={{ color: "var(--zx-primary)" }} />
              : metrics.reputationTokenCount
            }
          </div>
          <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--zx-success)" }}>
            <Award className="w-3.5 h-3.5" />
            Non-transferable ERC-721
          </div>
        </div>
      </div>

      {/* Error state */}
      {metrics.error && (
        <div className="flex items-center gap-2 p-4 rounded-2xl text-xs"
          style={{ background: "rgba(163,29,29,0.08)", border: "1px solid var(--zx-danger)", color: "var(--zx-danger)" }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Chain read error: {metrics.error}</span>
          <button onClick={fetchMetrics} className="ml-auto flex items-center gap-1 font-bold hover:underline">
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div className="rounded-3xl overflow-hidden"
        style={{ background: "var(--zx-surface)", border: "1px solid var(--zx-border)" }}>
        <div className="flex gap-0 border-b" style={{ borderColor: "var(--zx-border)" }}>
          {(["overview", "milestones", "reputation", ...(currentRole === "client" ? ["proposals"] as const : [])] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="flex-1 text-xs font-bold py-4 capitalize transition-all"
              style={activeTab === tab
                ? { color: "var(--zx-primary-deep)", borderBottom: "2px solid var(--zx-primary-deep)" }
                : { color: "var(--zx-muted)" }}>
              {tab}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Overview tab */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              <p className="text-xs" style={{ color: "var(--zx-muted)" }}>
                On-chain data pulled live from ZentrixEscrow at{" "}
                <code className="font-mono text-[var(--zx-primary-deep)]">
                  {CONTRACT_ADDRESSES.ZentrixEscrow.slice(0, 10)}...
                </code>
              </p>
              <div
                className="p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                style={{ background: "var(--zx-cream)", border: "1px solid var(--zx-border)" }}
              >
                <div>
                  <span
                    className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full"
                    style={{
                      background:
                        activeMilestone.status === "approved"
                          ? "rgba(47, 125, 79, 0.12)"
                          : activeMilestone.status === "review"
                          ? "rgba(217, 119, 6, 0.12)"
                          : "var(--zx-surface-alt)",
                      color:
                        activeMilestone.status === "approved"
                          ? "var(--zx-success)"
                          : activeMilestone.status === "review"
                          ? "var(--zx-warning)"
                          : "var(--zx-primary-deep)",
                    }}
                  >
                    <TrendingUp className="w-3 h-3" />
                    {activeMilestone.status === "approved"
                      ? "Approved & Non-Reversible"
                      : activeMilestone.status === "review"
                      ? "Under Review (Awaiting Client)"
                      : "In Progress (Pending Submission)"}
                  </span>
                  <h4 className="text-sm font-bold mt-2" style={{ color: "var(--zx-ink)" }}>
                    {activeMilestone.label}
                  </h4>
                  <p className="text-xs text-[var(--zx-muted)] mt-1">{activeMilestone.description}</p>
                  <p className="text-xs mt-1.5 font-mono" style={{ color: "var(--zx-muted)" }}>
                    Milestone {activeMilestone.num} of {milestones.length} · Escrow:{" "}
                    <span className="font-bold" style={{ color: "var(--zx-primary-deep)" }}>
                      {activeMilestone.amount} tMSTC
                    </span>
                    {" "}· Contract:{" "}
                    <code className="text-[10px]">
                      {CONTRACT_ADDRESSES.ZentrixEscrow.slice(0, 10)}...
                    </code>
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 self-end md:self-center">
                  <a
                    href={`https://testnet.mstscan.com/address/${CONTRACT_ADDRESSES.ZentrixEscrow}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-xl transition-all hover:bg-slate-100"
                    style={{ background: "var(--zx-surface)", border: "1px solid var(--zx-border)", color: "var(--zx-ink)" }}
                  >
                    MSTScan <ExternalLink className="w-3 h-3" />
                  </a>

                  {activeMilestone.status === "approved" ? (
                    <button
                      disabled
                      className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl opacity-80 cursor-not-allowed text-white shadow-xs"
                      style={{ background: "var(--zx-success)" }}
                      title="Once approved, milestone status is permanent and cannot be changed"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Approved (Locked)
                    </button>
                  ) : currentRole === "client" ? (
                    <button
                      onClick={() => handleApproveMilestone(activeMilestone.num)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl text-white shadow-xs hover:opacity-90 transition-all cursor-pointer"
                      style={{ background: "var(--zx-success)" }}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {activeMilestone.status === "review" ? "Approve Milestone" : "Approve Early"}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSubmitForReview(activeMilestone.num)}
                      disabled={activeMilestone.status === "review"}
                      className={`inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl text-white shadow-xs transition-all ${
                        activeMilestone.status === "review"
                          ? "opacity-60 cursor-not-allowed"
                          : "cursor-pointer hover:opacity-90"
                      }`}
                      style={{ background: "var(--zx-primary-deep)" }}
                    >
                      {activeMilestone.status === "review" ? "Under Review (Waiting)" : "Submit for Review"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}


          {/* Proposals tab */}
          {activeTab === "proposals" && currentRole === "client" && (
            <div className="space-y-4">
              <h3 className="font-bold text-lg" style={{ color: "var(--zx-ink)" }}>Received Proposals</h3>
              {clientGigs.length === 0 ? (
                <p className="text-sm text-gray-500">No gigs found for your address.</p>
              ) : (
                clientGigs.map((gig: any) => {
                  const proposals = gig.proposals ? Object.values(gig.proposals) : [];
                  return (
                    <div key={gig.id} className="p-4 rounded-2xl border" style={{ background: "var(--zx-cream)", borderColor: "var(--zx-border)" }}>
                      <h4 className="font-bold mb-2">{gig.title}</h4>
                      {proposals.length === 0 ? (
                        <p className="text-xs text-gray-500">No proposals yet.</p>
                      ) : (
                        <div className="space-y-3 mt-3">
                          {proposals.map((prop: any) => (
                            <div key={prop.freelancerAddress} className="p-3 bg-white rounded-xl border flex justify-between items-center">
                              <div>
                                <p className="text-xs font-mono mb-1">{prop.freelancerAddress}</p>
                                <p className="text-sm text-gray-700">{prop.proposalText || prop.pitch}</p>
                              </div>
                              <button 
                                onClick={() => handleAssign(gig.id, prop.freelancerAddress)}
                                disabled={gig.status === "Assigned" || gig.status === "Active"}
                                className={`px-4 py-1.5 rounded-lg text-white text-xs font-bold ${gig.status === "Assigned" || gig.status === "Active" ? "bg-gray-400" : "bg-emerald-600 hover:bg-emerald-700"}`}
                              >
                                {gig.status === "Assigned" || gig.status === "Active" ? "Assigned" : "Assign"}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* Milestones tab */}
          {activeTab === "milestones" && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1">
                <p className="text-xs" style={{ color: "var(--zx-muted)" }}>
                  Milestone-gated escrow lifecycle. Freelancers submit deliverables; Mentors/Clients approve.
                </p>
                <span className="text-[11px] font-bold text-[var(--zx-primary-deep)]">
                  Invariant: Once Approved, status cannot be changed.
                </span>
              </div>

              {milestones.map(({ num, label, amount, description, status, submittedAt, approvedAt }) => (
                <div
                  key={num}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl transition-all"
                  style={{ background: "var(--zx-cream)", border: "1px solid var(--zx-border)" }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5"
                      style={
                        status === "approved"
                          ? { background: "var(--zx-success)", color: "white" }
                          : status === "review"
                          ? { background: "rgba(217,119,6,0.15)", color: "var(--zx-warning)" }
                          : { background: "var(--zx-surface)", color: "var(--zx-muted)", border: "1px solid var(--zx-border)" }
                      }
                    >
                      {status === "approved" ? "✓" : num}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold" style={{ color: "var(--zx-ink)" }}>
                          Milestone {num}: {label}
                        </span>
                        <span
                          className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full"
                          style={
                            status === "approved"
                              ? { background: "rgba(47,125,79,0.12)", color: "var(--zx-success)" }
                              : status === "review"
                              ? { background: "rgba(217,119,6,0.12)", color: "var(--zx-warning)" }
                              : { background: "var(--zx-surface)", color: "var(--zx-muted)", border: "1px solid var(--zx-border)" }
                          }
                        >
                          {status === "approved" ? "Approved" : status === "review" ? "Under Review" : "Pending"}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--zx-muted)] mt-1">{description}</p>
                      <div className="text-[11px] font-mono mt-1" style={{ color: "var(--zx-muted)" }}>
                        Escrow: <strong style={{ color: "var(--zx-ink)" }}>{amount} tMSTC</strong>
                        {status === "review" && (
                          <span className="ml-2 text-amber-700">· 72h auto-release window active {submittedAt ? `(Submitted ${submittedAt})` : ""}</span>
                        )}
                        {status === "approved" && (
                          <span className="ml-2 text-emerald-700 font-semibold">· Permanently Approved {approvedAt ? `(${approvedAt})` : ""}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    {status === "approved" ? (
                      <span
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold opacity-80 cursor-not-allowed"
                        style={{
                          background: "rgba(47,125,79,0.12)",
                          color: "var(--zx-success)",
                          border: "1px solid var(--zx-success)",
                        }}
                        title="Once approved, milestone status cannot be changed"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approved (Locked)
                      </span>
                    ) : status === "review" ? (
                      currentRole === "client" ? (
                        <button
                          onClick={() => handleApproveMilestone(num)}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white shadow-xs hover:opacity-90 transition-all flex items-center gap-1 cursor-pointer"
                          style={{ background: "var(--zx-success)" }}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Approve Milestone
                        </button>
                      ) : (
                        <span
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                          style={{
                            background: "rgba(217,119,6,0.12)",
                            color: "var(--zx-warning)",
                            border: "1px solid var(--zx-warning)",
                          }}
                        >
                          Awaiting Client Review
                        </span>
                      )
                    ) : (
                      /* pending status */
                      currentRole === "freelancer" ? (
                        <button
                          onClick={() => handleSubmitForReview(num)}
                          className="px-4 py-1.5 rounded-xl text-xs font-bold text-white shadow-xs hover:opacity-90 transition-all cursor-pointer"
                          style={{ background: "var(--zx-primary-deep)" }}
                        >
                          Submit for Review
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[var(--zx-muted)]">Pending Submission</span>
                          <button
                            onClick={() => handleApproveMilestone(num)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors hover:bg-slate-100 cursor-pointer"
                            style={{ borderColor: "var(--zx-border)", color: "var(--zx-ink)" }}
                          >
                            Approve Early
                          </button>
                        </div>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Reputation tab */}
          {activeTab === "reputation" && (
            <div className="space-y-3">
              {metrics.reputationTokenCount === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <Award className="w-10 h-10 mx-auto" style={{ color: "var(--zx-border)" }} />
                  <p className="text-sm" style={{ color: "var(--zx-muted)" }}>
                    No soulbound credentials yet. Complete your first gig to earn your first SBT.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Array.from({ length: metrics.reputationTokenCount }).map((_, i) => (
                    <div key={i} className="p-5 rounded-2xl space-y-3"
                      style={{ background: "var(--zx-cream)", border: "1px solid var(--zx-border)" }}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                          style={{ background: "var(--zx-surface-alt)", color: "var(--zx-primary-deep)" }}>
                          ERC-721 Soulbound
                        </span>
                        <span className="text-xs font-bold" style={{ color: "var(--zx-success)" }}>5.0 / 5.0</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-sm" style={{ color: "var(--zx-ink)" }}>
                          Credential #{i + 1}
                        </h4>
                        <p className="text-xs mt-1" style={{ color: "var(--zx-muted)" }}>
                          Issued by ZentrixReputation on milestone approval.
                        </p>
                      </div>
                      <div className="text-[10px] font-mono pt-2" style={{ borderTop: "1px solid var(--zx-border)", color: "var(--zx-muted)" }}>
                        {CONTRACT_ADDRESSES.ZentrixReputation.slice(0, 18)}... · Token #{i + 1}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between text-xs pt-2">
                <span style={{ color: "var(--zx-muted)" }}>
                  {metrics.reputationTokenCount} credential{metrics.reputationTokenCount !== 1 ? "s" : ""} on-chain
                </span>
                <button onClick={fetchMetrics}
                  className="flex items-center gap-1 font-bold hover:underline"
                  style={{ color: "var(--zx-primary-deep)" }}>
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
