import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { Contract } from "ethers";
import {
  Check,
  Zap,
  ShieldCheck,
  Crown,
  ExternalLink,
  Loader2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Award,
  Calendar,
  Lock,
} from "lucide-react";
import { useWallet } from "../context/WalletContext";
import { CONTRACT_ADDRESSES, CONTRACT_ABIS, RPC_URL } from "../contracts";
import { getCachedNFTAssets, scanNFTAssets } from "../lib/nftScanner";

type TxStage = "idle" | "pending" | "confirmed" | "error";

interface TierData {
  priceWei: bigint;
  priceEth: string;
}

interface ChainState {
  userTier: number;        // 0=None, 1=Pro, 2=Enterprise
  expiresAt: number;       // Unix timestamp in seconds
  tokenId: string;         // Token ID string
  prices: { [tierId: number]: TierData };
  loading: boolean;
  error: string | null;
}

export const PricingPage: React.FC = () => {
  const { address, signer, provider, isConnected, isCorrectNetwork, switchNetwork, openConnectModal } =
    useWallet();

  const cached = getCachedNFTAssets(address);
  const [chain, setChain] = useState<ChainState>({
    userTier: cached.passTier,
    expiresAt: cached.passExpiresAt || 0,
    tokenId: cached.passTokenId || "0",
    prices: {
      0: { priceWei: 0n, priceEth: "0" },
      1: { priceWei: ethers.parseEther("5"), priceEth: "5.00" },
      2: { priceWei: ethers.parseEther("15"), priceEth: "15.00" },
    },
    loading: false,
    error: null,
  });

  const [txTier, setTxTier] = useState<number | null>(null);
  const [txStage, setTxStage] = useState<TxStage>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  // ── Fetch on-chain data ──────────────────────────────────────────────────
  const fetchChainData = useCallback(async () => {
    setChain((s) => ({ ...s, error: null }));
    try {
      const rpc = new ethers.JsonRpcProvider(RPC_URL);

      const passContract = new Contract(
        CONTRACT_ADDRESSES.ZentrixPass,
        CONTRACT_ABIS.ZentrixPass,
        rpc
      );

      // Fetch prices for Tier 1 (Pro) and Tier 2 (Enterprise)
      const [p1, p2] = await Promise.all([
        passContract.tierPrices(1).catch(() => ethers.parseEther("5")),
        passContract.tierPrices(2).catch(() => ethers.parseEther("15")),
      ]);

      let userTier = 0;
      let expiresAt = 0;
      let tokenId = "0";

      if (address) {
        // Deep scan MST blockchain for user pass & token assets
        const scan = await scanNFTAssets(address);
        userTier = scan.passTier;
        expiresAt = scan.passExpiresAt || 0;
        tokenId = scan.passTokenId || "0";
      }

      const toPair = (wei: bigint): TierData => ({
        priceWei: wei,
        priceEth: parseFloat(ethers.formatEther(wei)).toFixed(2),
      });

      setChain({
        userTier,
        expiresAt,
        tokenId,
        prices: {
          0: { priceWei: 0n, priceEth: "0" },
          1: toPair(p1),
          2: toPair(p2),
        },
        loading: false,
        error: null,
      });
    } catch (err: any) {
      setChain((s) => ({
        ...s,
        loading: false,
        error: "Unable to query MST Testnet pass contract: " + (err?.message ?? "Network error"),
      }));
    }
  }, [address]);

  useEffect(() => {
    fetchChainData();
  }, [fetchChainData]);

  // Periodic background re-scan to keep assets fresh on reload and live updates
  useEffect(() => {
    if (address) {
      scanNFTAssets(address).catch(() => {});
      const interval = setInterval(() => {
        scanNFTAssets(address).catch(() => {});
      }, 12000);
      return () => clearInterval(interval);
    }
  }, [address]);

  useEffect(() => {
    const onScanned = (e: any) => {
      const d = e.detail;
      if (d) {
        setChain((prev) => ({
          ...prev,
          userTier: d.passTier > 0 ? d.passTier : prev.userTier,
          expiresAt: d.passExpiresAt || prev.expiresAt,
          tokenId: d.passTokenId || prev.tokenId,
        }));
      }
    };
    window.addEventListener("zx_nft_scanned", onScanned);
    return () => window.removeEventListener("zx_nft_scanned", onScanned);
  }, []);

  // ── Real on-chain buy handler ────────────────────────────────────────────
  const handleBuy = async (tierId: number) => {
    if (!isConnected || !address) {
      openConnectModal();
      return;
    }
    if (!isCorrectNetwork) {
      await switchNetwork();
      return;
    }
    if (!signer) return;

    const price = chain.prices[tierId];
    if (!price || price.priceWei === 0n) return;

    setTxTier(tierId);
    setTxStage("pending");
    setTxHash(null);
    setTxError(null);

    try {
      const passContract = new Contract(
        CONTRACT_ADDRESSES.ZentrixPass,
        CONTRACT_ABIS.ZentrixPass,
        signer
      );

      // Prompt BridgeKey wallet transaction
      const tx = await passContract.buy(tierId, { value: price.priceWei });
      setTxHash(tx.hash);

      // Wait for block confirmation on MST Testnet
      await tx.wait();
      setTxStage("confirmed");

      // Deep scan and refresh on-chain state
      await scanNFTAssets(address);
      await fetchChainData();
    } catch (err: any) {
      setTxStage("error");
      const msg = (err?.message || err?.error?.message || "").toLowerCase();
      if (
        err?.code === -32603 ||
        msg.includes("bridgekey was updated") ||
        msg.includes("refresh this page")
      ) {
        setTxError("BridgeKey extension was updated. Please refresh the page and reconnect your wallet.");
      } else {
        setTxError(err?.reason ?? err?.message ?? "Transaction was rejected or failed on chain.");
      }
    } finally {
      setTxTier(null);
    }
  };

  const calculateDaysLeft = (expiry: number) => {
    if (!expiry) return null;
    const now = Math.floor(Date.now() / 1000);
    const diff = expiry - now;
    if (diff <= 0) return "Expired";
    const days = Math.floor(diff / 86400);
    return `${days} days remaining`;
  };

  return (
    <div className="zx-pricing-page min-h-screen py-8 px-4 sm:px-6 max-w-7xl mx-auto space-y-8">
      {/* ── Top Hero ──────────────────────────────────────────────────────── */}
      <div className="zx-pricing-hero text-center max-w-3xl mx-auto space-y-4">
        <div className="zx-pricing-badge-wrap inline-flex items-center">
          <div
            className="zx-pricing-badge inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
            style={{
              background: "rgba(163, 4, 2, 0.08)",
              color: "var(--zx-primary-deep)",
              border: "1px solid rgba(163, 4, 2, 0.2)",
            }}
          >
            <Sparkles className="zx-badge-icon w-3.5 h-3.5 text-[var(--zx-primary)]" />
            <span className="zx-badge-text">Non-Transferable Soulbound NFTs</span>
          </div>
        </div>

        <h1 className="zx-pricing-title text-3xl sm:text-5xl font-black text-[var(--zx-ink)] tracking-tight">
          ZentrixPass <span className="zx-pricing-title-highlight" style={{ color: "var(--zx-primary)" }}>Subscription Plans</span>
        </h1>

        <p className="zx-pricing-subtitle text-sm sm:text-base text-slate-700 leading-relaxed font-medium">
          Choose a tier to mint an ERC-721 Soulbound Access Pass on MST Testnet. Gain daily Sarvam AI queries,
          reputation multipliers, and prioritized milestone matchmaking.
        </p>
      </div>

      {/* ── Transaction Status Notices (No Alert Fallbacks) ────────────────── */}
      {txStage === "pending" && txHash && (
        <div
          className="zx-tx-banner zx-tx-pending p-4 rounded-2xl flex items-center justify-between text-xs font-semibold shadow-sm animate-in fade-in duration-200"
          style={{
            background: "rgba(234, 88, 12, 0.08)",
            border: "1px solid rgb(234, 88, 12)",
            color: "rgb(194, 65, 12)",
          }}
        >
          <div className="zx-tx-status flex items-center gap-2.5">
            <Loader2 className="zx-tx-spinner w-4 h-4 animate-spin text-orange-600" />
            <span className="zx-tx-message">BridgeKey transaction submitted — awaiting block confirmation on MST Testnet...</span>
          </div>
          <a
            href={`https://testnet.mstscan.com/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="zx-tx-explorer-link flex items-center gap-1 font-bold hover:underline"
          >
            <span>MSTScan</span> <ExternalLink className="zx-tx-icon w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {txStage === "confirmed" && txHash && (
        <div
          className="zx-tx-banner zx-tx-confirmed p-4 rounded-2xl flex items-center justify-between text-xs font-semibold shadow-sm animate-in fade-in duration-200"
          style={{
            background: "rgba(22, 101, 52, 0.08)",
            border: "1px solid rgb(22, 101, 52)",
            color: "rgb(20, 83, 45)",
          }}
        >
          <div className="zx-tx-status flex items-center gap-2.5">
            <Check className="zx-tx-check-icon w-4 h-4 text-emerald-600" />
            <span className="zx-tx-message">Success! Your Soulbound Pass has been minted and permanently bound to your wallet.</span>
          </div>
          <a
            href={`https://testnet.mstscan.com/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="zx-tx-explorer-link flex items-center gap-1 font-bold hover:underline"
          >
            <span>View on MSTScan</span> <ExternalLink className="zx-tx-icon w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {txStage === "error" && txError && (
        <div
          className="zx-tx-banner zx-tx-error p-4 rounded-2xl flex items-start justify-between text-xs font-semibold shadow-sm animate-in fade-in duration-200"
          style={{
            background: "rgba(163, 4, 2, 0.08)",
            border: "1px solid var(--zx-primary)",
            color: "var(--zx-primary-deep)",
          }}
        >
          <div className="zx-tx-status flex items-center gap-2">
            <AlertCircle className="zx-tx-alert-icon w-4 h-4 shrink-0" />
            <span className="zx-tx-message">Transaction error: {txError}</span>
          </div>
          <button
            onClick={() => setTxStage("idle")}
            className="zx-tx-dismiss-btn text-xs underline hover:opacity-80 ml-4 font-bold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {chain.error && (
        <div
          className="zx-error-banner p-4 rounded-2xl flex items-center justify-between text-xs font-medium"
          style={{
            background: "rgba(163, 4, 2, 0.06)",
            border: "1px solid rgba(163, 4, 2, 0.2)",
            color: "var(--zx-primary-deep)",
          }}
        >
          <span className="zx-error-message">{chain.error}</span>
          <button
            onClick={fetchChainData}
            className="zx-retry-btn flex items-center gap-1 font-bold underline hover:opacity-80 cursor-pointer"
          >
            <RefreshCw className="zx-retry-icon w-3.5 h-3.5" /> <span>Retry</span>
          </button>
        </div>
      )}

      {/* ── BIG PREVIEW OF CURRENT NFT (Centered directly above 3 columns) ─── */}
      {isConnected && chain.userTier > 0 && (
        <div className="zx-current-nft-preview zx-nft-preview-card  mx-auto p-6 sm:p-8 rounded-3xl border shadow-xl text-center relative overflow-hidden bg-white/95 backdrop-blur-xl">
          <div
            className="zx-nft-glow zx-nft-glow-top absolute -top-16 -right-16 w-44 h-44 rounded-full opacity-20 pointer-events-none"
            style={{ background: "var(--zx-primary)", filter: "blur(40px)" }}
          />
          <div
            className="zx-nft-glow zx-nft-glow-bottom absolute -bottom-16 -left-16 w-44 h-44 rounded-full opacity-15 pointer-events-none"
            style={{ background: "var(--zx-primary-deep)", filter: "blur(40px)" }}
          />

          <div className="zx-nft-preview-content relative z-10 space-y-4">
            <div className="zx-nft-status-pill inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <span className="zx-nft-status-dot w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="zx-nft-status-text">Active Soulbound NFT Token</span>
            </div>

            <h2 className="zx-nft-title text-2xl font-black text-[var(--zx-ink)]">
              {chain.userTier === 1 ? "Pro Pass NFT" : "Enterprise Pass NFT"}
            </h2>

            {/* Big NFT Visual - Unlocked in Full Original Color */}
            <div className="zx-nft-visual-wrapper relative mx-auto rounded-3xl overflow-hidden border-2 border-emerald-400/60 shadow-2xl bg-black group">
              <img
                src={chain.userTier === 1 ? "/1.gif" : "/2.gif"}
                alt="Active Pass NFT"
                className="zx-nft-visual-img w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="zx-nft-token-pill absolute top-2 right-2 px-2.5 py-0.5 rounded-full bg-black/75 backdrop-blur-md text-[10px] font-mono font-bold text-white border border-white/20">
                #{chain.tokenId}
              </div>
            </div>

            {/* Metadata Badges */}
            <div className="zx-nft-meta-badges flex flex-wrap items-center justify-center gap-3 pt-2 text-xs">
              <div className="zx-nft-meta-badge zx-badge-soulbound flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 font-semibold border border-slate-200">
                <Lock className="zx-meta-icon w-3.5 h-3.5 text-slate-500" />
                <span>Non-Transferable</span>
              </div>

              {chain.expiresAt > 0 && (
                <div className="zx-nft-meta-badge zx-badge-expiry flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 font-semibold border border-amber-200">
                  <Calendar className="zx-meta-icon w-3.5 h-3.5 text-amber-600" />
                  <span>{calculateDaysLeft(chain.expiresAt)}</span>
                </div>
              )}

              <a
                href={`https://testnet.mstscan.com/token/${CONTRACT_ADDRESSES.ZentrixPass}?a=${chain.tokenId}`}
                target="_blank"
                rel="noreferrer"
                className="zx-nft-explorer-link flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-50 text-[var(--zx-primary-deep)] font-semibold border border-red-200 hover:bg-red-100 transition-colors"
              >
                <span>MSTScan NFT Details</span>
                <ExternalLink className="zx-explorer-icon w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── THREE COLUMNAR CARDS: Free, Pro, Enterprise ───────────────────── */}
      <div className="zx-pricing-grid grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch pt-2">
        {/* ── 1. FREE PLAN ──────────────────────────────────────────────── */}
        <div
          className="zx-pricing-card zx-card-free rounded-3xl p-6 sm:p-8 flex flex-col justify-between border shadow-sm transition-all duration-300 hover:shadow-md"
          style={{
            background: "rgba(255, 255, 255, 0.95)",
            borderColor: "var(--zx-border)",
          }}
        >
          <div className="zx-card-body space-y-6">
            <div className="zx-card-header flex items-center justify-between">
              <span className="zx-tier-badge zx-tier-badge-free text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                Starter
              </span>
              <Award className="zx-tier-icon w-5 h-5 text-slate-400" />
            </div>

            <div className="zx-card-title-group">
              <h3 className="zx-card-title text-2xl font-black text-[var(--zx-ink)]">Free Plan</h3>
              <p className="zx-card-desc text-xs text-slate-600 mt-1 font-medium leading-relaxed">
                Standard access for independent talent and clients beginning on-chain milestones.
              </p>
            </div>

            {/* Price */}
            <div className="zx-price-group flex items-baseline gap-1.5">
              <span className="zx-price-amount text-4xl sm:text-5xl font-black font-mono text-[var(--zx-ink)]">0</span>
              <span className="zx-price-currency text-sm font-bold text-slate-500">tMSTC</span>
            </div>

            {/* Feature List */}
            <div className="zx-features-section pt-4 border-t border-slate-100 space-y-3">
              <div className="zx-features-heading text-xs font-bold text-slate-900 uppercase tracking-wide">Included:</div>
              <ul className="zx-features-list space-y-2.5 text-xs text-slate-700 font-medium">
                <li className="zx-feature-item flex items-start gap-2">
                  <Check className="zx-check-icon w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="zx-feature-text">2 Sarvam AI queries per day</span>
                </li>
                <li className="zx-feature-item flex items-start gap-2">
                  <Check className="zx-check-icon w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="zx-feature-text">Full marketplace browsing & gig submissions</span>
                </li>
                <li className="zx-feature-item flex items-start gap-2">
                  <Check className="zx-check-icon w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="zx-feature-text">Non-custodial milestone escrow protection</span>
                </li>
                <li className="zx-feature-item flex items-start gap-2">
                  <Check className="zx-check-icon w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="zx-feature-text">Public reputation NFT verification</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="zx-card-footer pt-8">
            <button
              disabled
              className="zx-pricing-btn zx-btn-disabled w-full py-3.5 rounded-2xl text-xs font-bold bg-slate-100 text-slate-500 cursor-not-allowed border border-slate-200"
            >
              {chain.userTier === 0 ? "Active by Default" : "Standard Tier"}
            </button>
          </div>
        </div>

        {/* ── 2. PRO PLAN (1.gif) ───────────────────────────────────────── */}
        <div
          className="zx-pricing-card zx-card-pro rounded-3xl p-6 sm:p-8 flex flex-col justify-between border-2 shadow-xl relative overflow-hidden transition-all duration-300 hover:shadow-2xl"
          style={{
            background: "rgba(255, 255, 255, 0.98)",
            borderColor: "var(--zx-primary)",
            boxShadow: "0 10px 30px -5px rgba(163, 4, 2, 0.12)",
          }}
        >
          {/* Popular Tag */}
          <div
            className="zx-popular-badge absolute top-4 right-4 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white shadow-sm"
            style={{ background: "var(--zx-primary)" }}
          >
            Most Popular
          </div>

          <div className="zx-card-body space-y-6">
            <div className="zx-card-header flex items-center gap-2">
              <span
                className="zx-tier-badge zx-tier-badge-pro text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full"
                style={{ background: "rgba(163, 4, 2, 0.1)", color: "var(--zx-primary-deep)" }}
              >
                Pro Tier
              </span>
            </div>

            {/* NFT Image Preview - Grayscale if unowned, Original Color if owned */}
            <div className={`zx-card-nft-frame w-full h-44 rounded-2xl overflow-hidden border relative bg-black shadow-inner transition-all duration-300 ${
              chain.userTier >= 1 ? "border-emerald-400/80 shadow-emerald-950/20" : "border-slate-200"
            }`}>
              <img
                src="/1.gif"
                alt="Zentrix Pro Pass NFT"
                className={`zx-card-nft-img w-full h-full object-cover transition-all duration-500 ${
                  chain.userTier >= 1
                    ? "grayscale-0 hover:scale-105"
                    : "grayscale opacity-75 hover:grayscale-0 hover:opacity-100 hover:scale-105"
                }`}
              />
              {chain.userTier >= 1 ? (
                <div className="zx-card-nft-status zx-status-owned absolute bottom-2 left-2 px-2.5 py-0.5 rounded-full bg-emerald-950/85 backdrop-blur-sm text-[10px] font-mono font-bold text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm">
                  <span className="zx-status-dot w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>✦ Owned · Full Color</span>
                </div>
              ) : (
                <div className="zx-card-nft-status zx-status-unowned absolute bottom-2 left-2 px-2.5 py-0.5 rounded-full bg-black/85 backdrop-blur-sm text-[10px] font-mono font-bold text-slate-300 border border-white/20 flex items-center gap-1.5">
                  <Lock className="zx-lock-icon w-3 h-3 text-slate-400" />
                  <span>Grayscale · Mint for Color</span>
                </div>
              )}
            </div>

            <div className="zx-card-title-group">
              <h3 className="zx-card-title text-2xl font-black text-[var(--zx-ink)]">Pro Plan</h3>
              <p className="zx-card-desc text-xs text-slate-600 mt-1 font-medium leading-relaxed">
                For active freelancers and clients requiring advanced AI search throughput.
              </p>
            </div>

            {/* Price */}
            <div className="zx-price-group flex items-baseline gap-1.5">
              <span className="zx-price-amount text-4xl sm:text-5xl font-black font-mono text-[var(--zx-ink)]">
                {chain.prices[1]?.priceEth ?? "5.00"}
              </span>
              <span className="zx-price-currency text-sm font-bold text-slate-500">tMSTC / 30 days</span>
            </div>

            {/* Feature List */}
            <div className="zx-features-section pt-4 border-t border-slate-100 space-y-3">
              <div className="zx-features-heading text-xs font-bold text-slate-900 uppercase tracking-wide">Pro Benefits:</div>
              <ul className="zx-features-list space-y-2.5 text-xs text-slate-800 font-medium">
                <li className="zx-feature-item flex items-start gap-2">
                  <Check className="zx-check-icon w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="zx-feature-text"><strong>10 Sarvam AI queries</strong> per day</span>
                </li>
                <li className="zx-feature-item flex items-start gap-2">
                  <Check className="zx-check-icon w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="zx-feature-text">Non-transferable Soulbound NFT minted to wallet</span>
                </li>
                <li className="zx-feature-item flex items-start gap-2">
                  <Check className="zx-check-icon w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="zx-feature-text">Priority semantic talent match scoring</span>
                </li>
                <li className="zx-feature-item flex items-start gap-2">
                  <Check className="zx-check-icon w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="zx-feature-text">Pro verified badge across search results</span>
                </li>
                <li className="zx-feature-item flex items-start gap-2">
                  <Check className="zx-check-icon w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="zx-feature-text">30-day on-chain validity with renew support</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="zx-card-footer pt-8">
            <button
              onClick={() => handleBuy(1)}
              disabled={txTier === 1 || chain.userTier === 1}
              className={`zx-pricing-btn zx-btn-pro w-full py-3.5 rounded-2xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 ${
                chain.userTier === 1
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-300 cursor-not-allowed"
                  : txTier === 1
                  ? "opacity-80 cursor-wait text-white"
                  : "hover:opacity-95 text-white active:scale-[0.99] cursor-pointer"
              }`}
              style={
                chain.userTier === 1
                  ? {}
                  : { background: "var(--zx-primary)" }
              }
            >
              {txTier === 1 ? (
                <>
                  <Loader2 className="zx-btn-spinner w-4 h-4 animate-spin" />
                  <span>Confirming in BridgeKey...</span>
                </>
              ) : chain.userTier === 1 ? (
                "✦ Active Pro Pass"
              ) : isConnected ? (
                "Mint Pro Pass"
              ) : (
                "Connect Wallet to Mint"
              )}
            </button>
          </div>
        </div>

        {/* ── 3. ENTERPRISE PLAN (2.gif) ─────────────────────────────────── */}
        <div
          className="zx-pricing-card zx-card-enterprise rounded-3xl p-6 sm:p-8 flex flex-col justify-between border shadow-sm transition-all duration-300 hover:shadow-md"
          style={{
            background: "rgba(255, 255, 255, 0.95)",
            borderColor: "var(--zx-border)",
          }}
        >
          <div className="zx-card-body space-y-6">
            <div className="zx-card-header flex items-center justify-between">
              <span className="zx-tier-badge zx-tier-badge-enterprise text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                Enterprise
              </span>
              <Crown className="zx-tier-icon w-5 h-5 text-amber-600" />
            </div>

            {/* NFT Image Preview - Grayscale if unowned, Original Color if owned */}
            <div className={`zx-card-nft-frame w-full h-44 rounded-2xl overflow-hidden border relative bg-black shadow-inner transition-all duration-300 ${
              chain.userTier === 2 ? "border-emerald-400/80 shadow-emerald-950/20" : "border-slate-200"
            }`}>
              <img
                src="/2.gif"
                alt="Zentrix Enterprise Pass NFT"
                className={`zx-card-nft-img w-full h-full object-cover transition-all duration-500 ${
                  chain.userTier === 2
                    ? "grayscale-0 hover:scale-105"
                    : "grayscale opacity-75 hover:grayscale-0 hover:opacity-100 hover:scale-105"
                }`}
              />
              {chain.userTier === 2 ? (
                <div className="zx-card-nft-status zx-status-owned absolute bottom-2 left-2 px-2.5 py-0.5 rounded-full bg-emerald-950/85 backdrop-blur-sm text-[10px] font-mono font-bold text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm">
                  <span className="zx-status-dot w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>✦ Owned · Full Color</span>
                </div>
              ) : (
                <div className="zx-card-nft-status zx-status-unowned absolute bottom-2 left-2 px-2.5 py-0.5 rounded-full bg-black/85 backdrop-blur-sm text-[10px] font-mono font-bold text-slate-300 border border-white/20 flex items-center gap-1.5">
                  <Lock className="zx-lock-icon w-3 h-3 text-slate-400" />
                  <span>Grayscale · Mint for Color</span>
                </div>
              )}
            </div>

            <div className="zx-card-title-group">
              <h3 className="zx-card-title text-2xl font-black text-[var(--zx-ink)]">Enterprise Plan</h3>
              <p className="zx-card-desc text-xs text-slate-600 mt-1 font-medium leading-relaxed">
                For dev shops, venture DAOs, and high-frequency hiring clients.
              </p>
            </div>

            {/* Price */}
            <div className="zx-price-group flex items-baseline gap-1.5">
              <span className="zx-price-amount text-4xl sm:text-5xl font-black font-mono text-[var(--zx-ink)]">
                {chain.prices[2]?.priceEth ?? "15.00"}
              </span>
              <span className="zx-price-currency text-sm font-bold text-slate-500">tMSTC / 30 days</span>
            </div>

            {/* Feature List */}
            <div className="zx-features-section pt-4 border-t border-slate-100 space-y-3">
              <div className="zx-features-heading text-xs font-bold text-slate-900 uppercase tracking-wide">Enterprise Power:</div>
              <ul className="zx-features-list space-y-2.5 text-xs text-slate-800 font-medium">
                <li className="zx-feature-item flex items-start gap-2">
                  <Check className="zx-check-icon w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="zx-feature-text"><strong>15 Sarvam AI queries</strong> per day</span>
                </li>
                <li className="zx-feature-item flex items-start gap-2">
                  <Check className="zx-check-icon w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="zx-feature-text">Exclusive Tier 2 Soulbound NFT on MST Testnet</span>
                </li>
                <li className="zx-feature-item flex items-start gap-2">
                  <Check className="zx-check-icon w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="zx-feature-text">High-frequency multi-milestone escrow support</span>
                </li>
                <li className="zx-feature-item flex items-start gap-2">
                  <Check className="zx-check-icon w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="zx-feature-text">Dedicated arbitration & dispute assistance</span>
                </li>
                <li className="zx-feature-item flex items-start gap-2">
                  <Check className="zx-check-icon w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="zx-feature-text">Early access to upcoming cross-chain protocol features</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="zx-card-footer pt-8">
            <button
              onClick={() => handleBuy(2)}
              disabled={txTier === 2 || chain.userTier === 2}
              className={`zx-pricing-btn zx-btn-enterprise w-full py-3.5 rounded-2xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 ${
                chain.userTier === 2
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-300 cursor-not-allowed"
                  : txTier === 2
                  ? "opacity-80 cursor-wait text-white"
                  : "bg-black text-white hover:bg-slate-900 active:scale-[0.99] cursor-pointer"
              }`}
            >
              {txTier === 2 ? (
                <>
                  <Loader2 className="zx-btn-spinner w-4 h-4 animate-spin" />
                  <span>Confirming in BridgeKey...</span>
                </>
              ) : chain.userTier === 2 ? (
                "✦ Active Enterprise Pass"
              ) : isConnected ? (
                "Mint Enterprise Pass"
              ) : (
                "Connect Wallet to Mint"
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Network & Protocol Verification Row ───────────────────────────── */}
      <div className="zx-pricing-footer zx-pricing-trust-row grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-slate-200">
        <div className="zx-trust-card zx-trust-soulbound p-4 rounded-2xl bg-white/80 border border-slate-200 text-xs space-y-1">
          <div className="zx-trust-card-header font-bold text-slate-900 flex items-center gap-1.5">
            <ShieldCheck className="zx-trust-icon w-4 h-4 text-[var(--zx-primary)]" />
            <span className="zx-trust-title">Non-Transferable (Soulbound)</span>
          </div>
          <p className="zx-trust-card-desc text-slate-600 leading-relaxed font-medium">
            Passes cannot be sold, transferred, or drained. They reside strictly within the minting wallet address.
          </p>
        </div>

        <div className="zx-trust-card zx-trust-duration p-4 rounded-2xl bg-white/80 border border-slate-200 text-xs space-y-1">
          <div className="zx-trust-card-header font-bold text-slate-900 flex items-center gap-1.5">
            <Calendar className="zx-trust-icon w-4 h-4 text-emerald-700" />
            <span className="zx-trust-title">30-Day On-Chain Duration</span>
          </div>
          <p className="zx-trust-card-desc text-slate-600 leading-relaxed font-medium">
            Enforced directly by the smart contract timestamp. Re-minting resets your 30-day window seamlessly.
          </p>
        </div>

        <div className="zx-trust-card zx-trust-contract p-4 rounded-2xl bg-white/80 border border-slate-200 text-xs space-y-1">
          <div className="zx-trust-card-header font-bold text-slate-900 flex items-center gap-1.5">
            <Zap className="zx-trust-icon w-4 h-4 text-amber-600" />
            <span className="zx-trust-title">Direct Smart Contract Call</span>
          </div>
          <p className="zx-trust-card-desc text-slate-600 leading-relaxed font-medium">
            Payments are executed directly to <code>ZentrixPass.sol</code> without intermediaries or platform cuts.
          </p>
        </div>
      </div>
    </div>
  );
};
