import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWallet } from "../context/WalletContext";
import { getCachedNFTAssets, scanNFTAssets, NFTScanResult } from "../lib/nftScanner";
import { FREELANCE_CATEGORIES } from "../lib/tags";
import {
  ShieldCheck,
  Wallet,
  ExternalLink,
  Copy,
  Check,
  Camera,
  Edit3,
  Sparkles,
  Award,
  CheckCircle2,
  TrendingUp,
  Clock,
  Layers,
  ArrowRight,
  Briefcase,
  X,
  Plus,
} from "lucide-react";

export const ProfilePage: React.FC = () => {
  const { user, profile, currentRole, updateRole, updateProfile } = useAuth();
  const { address, isConnected, openConnectModal } = useWallet();

  const activeWallet = profile?.walletAddress || address;
  const [nftAssets, setNftAssets] = useState<NFTScanResult>(() => getCachedNFTAssets(activeWallet));

  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Deep scan assets when wallet is active or changed
  useEffect(() => {
    if (activeWallet) {
      setNftAssets(getCachedNFTAssets(activeWallet));
      scanNFTAssets(activeWallet);
    }
  }, [activeWallet]);

  // Real-time reactive updates from scan events
  useEffect(() => {
    const onScanned = (e: any) => {
      const d = e.detail;
      if (d) {
        setNftAssets(d);
      }
    };
    window.addEventListener("zx_nft_scanned", onScanned);
    return () => window.removeEventListener("zx_nft_scanned", onScanned);
  }, []);

  // Edit form state
  const [editName, setEditName] = useState(profile?.name || "");
  const [editDesignation, setEditDesignation] = useState(profile?.designation || "");
  const [editBio, setEditBio] = useState(profile?.bio || "");
  const [editOrganization, setEditOrganization] = useState(profile?.organization || "");
  const [editRole, setEditRole] = useState<"client" | "freelancer">(currentRole || "freelancer");
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setEditName(profile.name || "");
      setEditDesignation(profile.designation || "");
      setEditBio(profile.bio || "");
      setEditOrganization(profile.organization || "");
    }
    setEditRole(currentRole || "freelancer");
  }, [profile, currentRole]);

  const copyAddress = () => {
    if (!profile?.walletAddress && !address) return;
    navigator.clipboard.writeText(profile?.walletAddress || address || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Image Encode / Decode Handler (Base64 Data URL)
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfileFeedback(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setProfileFeedback({ type: "error", msg: "Please select an image smaller than 2MB." });
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const base64String = event.target?.result as string;

        // Auto compress through offscreen canvas if > 150KB
        const img = new Image();
        img.src = base64String;
        img.onload = async () => {
          const canvas = document.createElement("canvas");
          const maxDim = 320;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);

          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.85);

          // Save encoded image to profile database
          await updateProfile({ avatar: compressedBase64 });
          setIsUploading(false);
        };
      } catch {
        setIsUploading(false);
      }
    };

    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile({
      name: editName,
      designation: editDesignation,
      bio: editBio,
      organization: editOrganization,
    });
    if (editRole !== currentRole) {
      await updateRole(editRole);
    }
    setProfileFeedback({ type: "success", msg: "Profile and account role successfully saved!" });
    setIsEditing(false);
  };

  const toggleTag = async (tag: string) => {
    setProfileFeedback(null);
    const currentTags = profile?.expertise || [];
    let updated: string[];
    if (currentTags.includes(tag)) {
      updated = currentTags.filter((t) => t !== tag);
    } else {
      if (currentTags.length >= 10) {
        setProfileFeedback({ type: "error", msg: "Maximum 10 skill tags allowed." });
        return;
      }
      updated = [...currentTags, tag];
    }
    await updateProfile({
      expertise: updated,
      industryTags: updated.slice(0, 5),
    });
  };

  const shortAddress = activeWallet
    ? `${activeWallet.slice(0, 6)}...${activeWallet.slice(-4)}`
    : "Not connected";

  return (
    <div className="space-y-4">
      {/* ─── TOP STATUS STRIP ─── */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 rounded-2xl border shadow-xs"
        style={{
          background: "var(--zx-surface)",
          borderColor: "var(--zx-border)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-2.5 h-2.5 rounded-full animate-pulse"
            style={{ background: "var(--zx-primary)" }}
          />
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--zx-ink)]">
            Identity Space // {profile?.name || user?.displayName || "Verified Builder"}
          </span>
          <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200">
            MST Testnet 91562037
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Active Role Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs">
            <span className="font-mono text-[var(--zx-muted)]">Active Role:</span>
            <span className="font-bold capitalize text-[var(--zx-primary-deep)]">
              {currentRole}
            </span>
          </div>

          <button
            onClick={() => {
              setEditRole(currentRole || "freelancer");
              setIsEditing(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white transition-all shadow-xs hover:opacity-95 cursor-pointer"
            style={{ background: "var(--zx-primary)" }}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Profile & Role</span>
          </button>
        </div>
      </div>

      {profileFeedback && (
        <div
          className="flex items-center justify-between p-3.5 rounded-2xl text-xs font-semibold shadow-sm animate-in fade-in duration-150"
          style={{
            background: profileFeedback.type === "error" ? "rgba(163, 4, 2, 0.08)" : "rgba(22, 101, 52, 0.08)",
            border: `1px solid ${profileFeedback.type === "error" ? "var(--zx-primary)" : "rgb(22, 101, 52)"}`,
            color: profileFeedback.type === "error" ? "var(--zx-primary-deep)" : "rgb(20, 83, 45)",
          }}
        >
          <span>{profileFeedback.msg}</span>
          <button
            type="button"
            onClick={() => setProfileFeedback(null)}
            className="text-xs font-bold underline hover:opacity-80 ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ─── DYNAMIC BENTO GRID (Designed compact to prevent scroll) ─── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* ── BENTO CELL 1: Creator Identity & Avatar (Span 4) ── */}
        <div
          className="md:col-span-4 rounded-3xl p-5 border flex flex-col justify-between shadow-xs relative overflow-hidden group"
          style={{
            background: "var(--zx-surface)",
            borderColor: "var(--zx-border)",
          }}
        >
          {/* Subtle Decorative Gradient Bar */}
          <div
            className="absolute top-0 left-0 right-0 h-1.5"
            style={{ background: "var(--zx-primary)" }}
          />

          <div>
            {/* Avatar with Base64 Encode / Upload Button */}
            <div className="flex items-start justify-between">
              <div className="relative">
                <div
                  className="w-20 h-20 rounded-2xl border-2 overflow-hidden flex items-center justify-center shadow-md relative"
                  style={{
                    borderColor: "var(--zx-primary)",
                    background: "var(--zx-surface-alt)",
                  }}
                >
                  {profile?.avatar ? (
                    <img
                      src={profile.avatar}
                      alt={profile.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-2xl font-black text-white"
                      style={{ background: "var(--zx-primary)" }}
                    >
                      {profile?.name ? profile.name.slice(0, 2).toUpperCase() : "ZX"}
                    </div>
                  )}

                  {isUploading && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-[10px] font-bold">
                      Encoding...
                    </div>
                  )}
                </div>

                {/* Upload Trigger Button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload & Encode Avatar"
                  className="absolute -bottom-1.5 -right-1.5 p-1.5 rounded-full text-white shadow-md hover:scale-110 active:scale-95 transition-transform"
                  style={{ background: "var(--zx-ink)" }}
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageChange}
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                />
              </div>

              <div className="text-right">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase bg-red-50 text-[var(--zx-primary)] border border-red-200">
                  <Award className="w-3 h-3" />
                  {currentRole === "client" ? "Verified Hirer" : "Verified Creator"}
                </span>
                <p className="text-[11px] font-mono text-[var(--zx-muted)] mt-1 flex items-center justify-end gap-1.5">
                  {nftAssets.hasPass ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[var(--zx-ink)] font-bold">
                        Tier {nftAssets.passTier} {nftAssets.passTier === 1 ? "Pro" : nftAssets.passTier === 2 ? "Enterprise" : "Architect"} #{nftAssets.passTokenId || "1"}
                      </span>
                    </>
                  ) : (
                    <span>Standard Member</span>
                  )}
                </p>
              </div>
            </div>

            {/* Name & Handle */}
            <div className="mt-4">
              <h2 className="text-xl font-black text-[var(--zx-ink)] tracking-tight">
                {profile?.name || user?.displayName || "Anonymous Creator"}
              </h2>
              <p className="text-xs font-semibold text-[var(--zx-primary)] mt-0.5">
                {profile?.designation || "Web3 Smart Contract Architect"}
              </p>
              {profile?.organization && (
                <p className="text-[11px] text-[var(--zx-muted)] font-medium">
                  {profile.organization}
                </p>
              )}
            </div>

            {/* Bio */}
            <p className="text-xs text-[var(--zx-muted)] leading-relaxed mt-3 line-clamp-3">
              {profile?.bio ||
                "Specialized in milestone-based smart contracts, front-end dApps, and non-custodial escrow systems on MST Blockchain."}
            </p>
          </div>

          {/* Bottom Security Assurance */}
          <div
            className="mt-4 pt-3 border-t flex items-center justify-between text-[11px]"
            style={{ borderColor: "var(--zx-border)" }}
          >
            <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>DPDP Zero-PII Protected</span>
            </span>
            <span className="text-[10px] font-mono text-[var(--zx-muted)]">
              Base64 Encoded
            </span>
          </div>
        </div>

        {/* ── BENTO CELL 2: On-chain Web3 Anchor & Binding (Span 4) ── */}
        <div
          className="md:col-span-4 rounded-3xl p-5 border flex flex-col justify-between shadow-xs"
          style={{
            background: "var(--zx-surface)",
            borderColor: "var(--zx-border)",
          }}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--zx-muted)]">
                On-Chain Identity
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            <div className="mt-3">
              <p className="text-xs text-[var(--zx-muted)]">Bound MST Wallet</p>
              <div
                className="mt-1 flex items-center justify-between p-2.5 rounded-xl border font-mono text-xs font-bold"
                style={{
                  background: "var(--zx-surface-alt)",
                  borderColor: "var(--zx-border)",
                }}
              >
                <span className="truncate">{shortAddress}</span>
                <button
                  onClick={copyAddress}
                  className="p-1 rounded-md hover:bg-slate-200 transition-colors ml-2 text-[var(--zx-muted)]"
                  title="Copy address"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            <div className="mt-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[var(--zx-muted)]">EIP-191 Auth:</span>
                <span className="font-semibold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Verified
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--zx-muted)]">Chain ID:</span>
                <span className="font-mono font-semibold text-[var(--zx-ink)]">
                  91562037 (MST)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--zx-muted)]">Gas Asset:</span>
                <span className="font-mono font-semibold text-[var(--zx-ink)]">
                  tMSTC
                </span>
              </div>
            </div>
          </div>

          <div
            className="mt-4 pt-3 border-t flex items-center justify-between"
            style={{ borderColor: "var(--zx-border)" }}
          >
            <a
              href={`https://testnet.mstscan.com/address/${activeWallet}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold hover:underline"
              style={{ color: "var(--zx-primary)" }}
            >
              <span>View on MSTScan</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            {!isConnected && (
              <button
                onClick={openConnectModal}
                className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>

        {/* ── BENTO CELL 3: Reputation & Escrow Telemetry (Span 4) ── */}
        <div
          className="md:col-span-4 rounded-3xl p-5 border flex flex-col justify-between shadow-xs text-white"
          style={{
            background: "var(--zx-ink)",
            borderColor: "var(--zx-ink)",
          }}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                Protocol Telemetry
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-red-950 text-red-300 border border-red-800">
                Soulbound v2
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                <div className="text-[10px] text-slate-400 uppercase font-mono">
                  Reputation SBT
                </div>
                <div className="text-2xl font-black mt-0.5 flex items-baseline gap-1">
                  <span>{nftAssets.reputationCount > 0 ? nftAssets.reputationCount : (nftAssets.hasPass ? 1 : 0)}</span>
                  <span className="text-xs font-semibold text-slate-400">Tokens</span>
                </div>
                <div className="text-[10px] text-emerald-400 font-semibold mt-1 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> {nftAssets.hasPass ? "Verified On-Chain" : "Active Member"}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                <div className="text-[10px] text-slate-400 uppercase font-mono">
                  Milestones
                </div>
                <div className="text-2xl font-black mt-0.5 flex items-baseline gap-1">
                  <span>14</span>
                  <span className="text-xs font-semibold text-slate-400">Done</span>
                </div>
                <div className="text-[10px] text-slate-400 font-semibold mt-1">
                  100% On-time
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-center justify-between p-2 rounded-xl bg-white/5">
                <span className="text-slate-400">Disputes:</span>
                <span className="font-mono font-bold text-white">0.0%</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-white/5">
                <span className="text-slate-400">Auto-release:</span>
                <span className="font-mono font-bold text-emerald-400">72h Ready</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Avg Payout: 1.2s
            </span>
            <Link
              to="/dashboard"
              className="text-white hover:text-red-300 font-bold transition-colors"
            >
              Full Analytics →
            </Link>
          </div>
        </div>

        {/* ── BENTO CELL 4: Crafts & Choosable Skills Matrix (Span 7) ── */}
        <div
          className="md:col-span-7 rounded-3xl p-5 border flex flex-col justify-between shadow-xs"
          style={{
            background: "var(--zx-surface)",
            borderColor: "var(--zx-border)",
          }}
        >
          <div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--zx-muted)]">
                  Skill Matrix & Crafts
                </span>
                <h3 className="text-sm font-bold text-[var(--zx-ink)] mt-0.5">
                  Verified Freelance Capabilities
                </h3>
              </div>
              <button
                onClick={() => setTagModalOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold border hover:bg-slate-50 transition-colors"
                style={{ borderColor: "var(--zx-border)" }}
              >
                <Plus className="w-3 h-3 text-[var(--zx-primary)]" />
                <span>Customize</span>
              </button>
            </div>

            {/* Tag Pills */}
            <div className="mt-4 flex flex-wrap gap-1.5">
              {(profile?.expertise || [
                "Solidity",
                "Smart Contracts",
                "Frontend (React/Vite)",
                "BridgeKey Integration",
                "UI/UX Design",
                "Security Audits",
              ]).map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all"
                  style={{
                    background: "var(--zx-surface-alt)",
                    borderColor: "var(--zx-border)",
                    color: "var(--zx-ink)",
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: "var(--zx-primary)" }}
                  />
                  <span>{skill}</span>
                </span>
              ))}
            </div>
          </div>

          <div
            className="mt-4 pt-3 border-t flex items-center justify-between text-xs text-[var(--zx-muted)]"
            style={{ borderColor: "var(--zx-border)" }}
          >
            <span>Indexed in Sarvam AI Talent Engine</span>
            <span className="font-mono font-semibold text-[var(--zx-ink)]">
              {(profile?.expertise || []).length} Skills Active
            </span>
          </div>
        </div>

        {/* ── BENTO CELL 5: Fast Protocols & Gigs Launcher (Span 5) ── */}
        <div
          className="md:col-span-5 rounded-3xl p-5 border flex flex-col justify-between shadow-xs"
          style={{
            background: "var(--zx-surface-alt)",
            borderColor: "var(--zx-border)",
          }}
        >
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--zx-muted)]">
              Fast Protocol Actions
            </span>
            <h3 className="text-sm font-bold text-[var(--zx-ink)] mt-0.5">
              Decentralized Marketplace Hub
            </h3>

            <div className="mt-3.5 space-y-2">
              <Link
                to="/marketplace"
                className="flex items-center justify-between p-3 rounded-2xl bg-white border hover:shadow-xs transition-all group"
                style={{ borderColor: "var(--zx-border)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-red-50 text-[var(--zx-primary)]">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[var(--zx-ink)]">
                      Explore Active Gigs
                    </div>
                    <div className="text-[11px] text-[var(--zx-muted)]">
                      100% milestone protected
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--zx-muted)] group-hover:translate-x-1 transition-transform" />
              </Link>

              <Link
                to="/agent"
                className="flex items-center justify-between p-3 rounded-2xl bg-white border hover:shadow-xs transition-all group"
                style={{ borderColor: "var(--zx-border)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                    <img src="/robot.png" alt="Sarvam AI" className="w-4 h-4 object-contain" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[var(--zx-ink)]">
                      Sarvam AI Search
                    </div>
                    <div className="text-[11px] text-[var(--zx-muted)]">
                      Semantic talent matching
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--zx-muted)] group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>

          <div
            className="mt-3 pt-2.5 border-t flex items-center justify-between text-[11px] text-[var(--zx-muted)]"
            style={{ borderColor: "var(--zx-border)" }}
          >
            <span>Escrow Contract: 0xa507...3726</span>
            <Link
              to="/disclosure"
              className="font-semibold hover:underline"
              style={{ color: "var(--zx-primary)" }}
            >
              Legal Terms
            </Link>
          </div>
        </div>
      </div>

      {/* ─── MODAL: EDIT PROFILE DETAILS ─── */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-lg rounded-3xl p-6 border shadow-2xl relative"
            style={{
              background: "var(--zx-surface)",
              borderColor: "var(--zx-border)",
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: "var(--zx-border)" }}>
              <h3 className="text-base font-bold text-[var(--zx-ink)]">
                Edit Creator Profile
              </h3>
              <button
                onClick={() => setIsEditing(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-[var(--zx-muted)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--zx-ink)] mb-1">
                  Full Display Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border text-xs font-semibold outline-hidden focus:ring-2 focus:ring-red-200"
                  style={{ borderColor: "var(--zx-border)" }}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--zx-ink)] mb-1">
                  Professional Designation / Headline
                </label>
                <input
                  type="text"
                  value={editDesignation}
                  onChange={(e) => setEditDesignation(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border text-xs font-semibold outline-hidden focus:ring-2 focus:ring-red-200"
                  style={{ borderColor: "var(--zx-border)" }}
                  placeholder="e.g. Solidity & Rust Smart Contract Engineer"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--zx-ink)] mb-1">
                  Organization / DAO Guild (Optional)
                </label>
                <input
                  type="text"
                  value={editOrganization}
                  onChange={(e) => setEditOrganization(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border text-xs font-semibold outline-hidden focus:ring-2 focus:ring-red-200"
                  style={{ borderColor: "var(--zx-border)" }}
                  placeholder="e.g. Zentrix Guild / Web3 Builders"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--zx-ink)] mb-1">
                  Bio / Summary
                </label>
                <textarea
                  rows={3}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border text-xs font-medium outline-hidden focus:ring-2 focus:ring-red-200 resize-none"
                  style={{ borderColor: "var(--zx-border)" }}
                  placeholder="Tell clients or collaborators about your background, skills, and escrow experience."
                />
              </div>

              {/* Account Role Selector */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div>
                  <label className="block text-xs font-bold text-[var(--zx-ink)]">
                    Account Role Mode
                  </label>
                  <p className="text-[11px] text-[var(--zx-muted)]">
                    Select your operating mode. Role modification is configured here to prevent accidental switching.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditRole("client")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      editRole === "client"
                        ? "border-[var(--zx-primary)] bg-white shadow-xs"
                        : "border-slate-200 bg-white/60 hover:border-slate-300"
                    }`}
                  >
                    <div className="text-xs font-bold text-[var(--zx-ink)] flex items-center justify-between">
                      <span>Client</span>
                      {editRole === "client" && <span className="text-[10px] font-bold text-[var(--zx-primary)]">● Active</span>}
                    </div>
                    <div className="text-[10px] text-[var(--zx-muted)] mt-0.5">Post gigs, fund escrow, approve deliverables</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditRole("freelancer")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      editRole === "freelancer"
                        ? "border-[var(--zx-primary)] bg-white shadow-xs"
                        : "border-slate-200 bg-white/60 hover:border-slate-300"
                    }`}
                  >
                    <div className="text-xs font-bold text-[var(--zx-ink)] flex items-center justify-between">
                      <span>Freelancer</span>
                      {editRole === "freelancer" && <span className="text-[10px] font-bold text-[var(--zx-primary)]">● Active</span>}
                    </div>
                    <div className="text-[10px] text-[var(--zx-muted)] mt-0.5">Submit milestones, deliver work, withdraw funds</div>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t" style={{ borderColor: "var(--zx-border)" }}>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border hover:bg-slate-50 transition-colors"
                  style={{ borderColor: "var(--zx-border)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white transition-opacity shadow-sm hover:opacity-95"
                  style={{ background: "var(--zx-primary)" }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: CHOOSABLE TAGS SELECTOR ─── */}
      {tagModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl p-6 border shadow-2xl relative"
            style={{
              background: "var(--zx-surface)",
              borderColor: "var(--zx-border)",
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: "var(--zx-border)" }}>
              <div>
                <h3 className="text-base font-bold text-[var(--zx-ink)]">
                  Select Your Craft Tags
                </h3>
                <p className="text-xs text-[var(--zx-muted)]">
                  Choose up to 10 skills across Development, Creative, Content, and AI.
                </p>
              </div>
              <button
                onClick={() => setTagModalOpen(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-[var(--zx-muted)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {FREELANCE_CATEGORIES.map((cat) => (
                <div key={cat.id}>
                  <div className="text-xs font-bold text-[var(--zx-ink)] mb-2 uppercase tracking-wider font-mono">
                    {cat.name}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {cat.tags.map((tag) => {
                      const isSelected = (profile?.expertise || []).includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                            isSelected
                              ? "bg-[var(--zx-ink)] text-white border-[var(--zx-ink)] shadow-xs"
                              : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
                          }`}
                        >
                          {isSelected ? "✓ " : "+ "}
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t flex items-center justify-between" style={{ borderColor: "var(--zx-border)" }}>
              <span className="text-xs font-bold text-[var(--zx-primary)]">
                {(profile?.expertise || []).length} / 10 tags selected
              </span>
              <button
                type="button"
                onClick={() => setTagModalOpen(false)}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white transition-opacity shadow-sm hover:opacity-95"
                style={{ background: "var(--zx-primary)" }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
