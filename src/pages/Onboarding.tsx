import React, { useState, useRef } from "react";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import { useAuth, UserRole } from "../context/AuthContext";
import { useWallet } from "../context/WalletContext";
import { FREELANCE_CATEGORIES } from "../lib/tags";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  UserCheck,
  Briefcase,
  Wallet,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Hash,
  Search,
  Check,
  Crown,
  Zap,
  Globe,
  Star,
  Layers,
  Camera,
  Flame,
  Clock,
  Compass,
  AlertCircle,
} from "lucide-react";

export const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  let from = (location.state as any)?.from || "/dashboard"; if (from === "/login" || from === "/onboarding") from = "/dashboard";
  const { user, profile, saveOnboarding } = useAuth();
  const { address, isConnected, isCorrectNetwork, switchNetwork, openConnectModal, signMessage, connectWallet } = useWallet();

  // Discord Sequential Pop-up Steps (1 to 5)
  // Step 1: Choose Realm / Role
  // Step 2: Avatar & Profile Identity (Base64 Image Encoding)
  // Step 3: Interactive Choosable Craft Tags
  // Step 4: Personalization & Rates
  // Step 5: Web3 Anchor & Binding (EIP-191 Signature)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Profile Form State
  const [role, setRole] = useState<UserRole>("freelancer");
  const [name, setName] = useState(user?.displayName || "Anonymous Creator");
  const [handle, setHandle] = useState(
    (user?.displayName || "creator").toLowerCase().replace(/[^a-z0-9]/g, "")
  );
  const [avatarDataUrl, setAvatarDataUrl] = useState<string>("");
  const [designation, setDesignation] = useState("Web3 Full-Stack Developer");
  const [organization, setOrganization] = useState("");
  const [bio, setBio] = useState(
    "Building decentralized milestone systems on MST Blockchain. Passionate about trustless smart contract escrow."
  );

  // Choosable Tags State
  const [activeCategory, setActiveCategory] = useState<string>("dev");
  const [selectedTags, setSelectedTags] = useState<string[]>([
    "Solidity",
    "Smart Contracts",
    "Frontend (React/Vite)",
    "BridgeKey Integration",
  ]);

  // Personalization Preferences State
  const [expLevel, setExpLevel] = useState<string>("Specialist (3+ yrs Web3)");
  const [rateRange, setRateRange] = useState<string>("1–5 tMSTC / milestone");
  const [availability, setAvailability] = useState<string>("Immediate (Full-Time)");

  // Submission & Signature State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signatureStatus, setSignatureStatus] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sequential protection: user must authenticate (Email/Google) first
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If already onboarded, redirect immediately to intended destination
  if (profile?.isOnboarded) {
    return <Navigate to={from} replace />;
  }

  // Avatar Base64 Image Encoder
  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStepError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setStepError("Please choose an image under 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      const img = new Image();
      img.src = result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 280;
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

        const compressed = canvas.toDataURL("image/jpeg", 0.82);
        setAvatarDataUrl(compressed);
      };
    };
    reader.readAsDataURL(file);
  };

  // Toggle Choosable Tag
  const toggleTag = (tag: string) => {
    setStepError(null);
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      if (selectedTags.length >= 10) {
        setStepError("Maximum 10 craft tags allowed.");
        return;
      }
      setSelectedTags([...selectedTags, tag]);
    }
  };

  // Step 5: Web3 Binding Handler
  const handleWalletBinding = async () => {
    if (!address || !isConnected) {
      try {
        await connectWallet("bridgekey");
      } catch (err: any) {
        setStepError(err.message || "Failed to connect BridgeKey. Please install and authorize the extension.");
      }
      return;
    }

    if (!isCorrectNetwork) {
      const switched = await switchNetwork();
      if (!switched) {
        setStepError("Please switch your wallet to MST Testnet (Chain ID 91562037).");
        return;
      }
    }

    setIsSubmitting(true);
    setSignatureStatus("Requesting EIP-191 binding signature via wallet...");
    setStepError(null);

    try {
      // 1. Prepare deterministic EIP-191 binding message
      const nonce = `Zentrix Web3 Onboarding Binding\nWallet: ${address}\nUID: ${user.uid}\nNetwork: MST Testnet (Chain ID 91562037)\nTimestamp: ${Date.now()}`;

      // 2. Request user signature in BridgeKey or connected wallet
      await signMessage(nonce);

      setSignatureStatus("Verified! Anchoring your credentials on MST Testnet...");

      // 3. Save profile to Firebase & Local Cache
      await saveOnboarding(
        {
          name,
          email: user?.email || `${handle}@zentrix.network`,
          phone: "Protected DPDP 2023",
          designation,
          organization: role === "client" ? organization : undefined,
          bio,
          avatar: avatarDataUrl,
          industryTags: selectedTags.slice(0, 5),
          expertise: selectedTags,
        },
        role,
        address
      );

      setIsSuccess(true);
      setTimeout(() => {
        navigate(from, { replace: true });
      }, 1200);
    } catch (err: any) {

      const isBridgeKeyNotConnected =
        err?.message?.toLowerCase().includes("not connected to bridgekey") ||
        err?.message?.toLowerCase().includes("connect the site first");

      if (err?.code === "NO_PROVIDER") {
        setStepError("No wallet extension detected. Please install BridgeKey or MetaMask, connect it, then try again.");
        openConnectModal();
      } else if (isBridgeKeyNotConnected) {
        setStepError("BridgeKey needs to authorize this site. Opening connection popup…");
        try {
          await connectWallet("bridgekey");
          setStepError("Wallet connected! Click 'Sign & Complete Onboarding' to finish.");
        } catch {
          setStepError("Please open BridgeKey, click 'Connected Sites', and authorize this site to connect.");
        }
      } else if (err?.code === 4001 || err?.message?.includes("rejected") || err?.message?.includes("User denied")) {
        setStepError("Signature request cancelled. Please sign the confirmation in your wallet to complete onboarding.");
      } else {
        setStepError(err?.message || "Failed to bind wallet. Please check your wallet extension and try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepsList = [
    { num: 1, label: "Role & Realm" },
    { num: 2, label: "Identity & Avatar" },
    { num: 3, label: "Craft Tags" },
    { num: 4, label: "Preferences" },
    { num: 5, label: "MST Anchor" },
  ];

  return (
    <div className="max-w-2xl mx-auto py-4 sm:py-8 space-y-6">
      {/* ── Discord Schematic Progress Header ── */}
      <div
        className="rounded-3xl p-4 sm:p-5 border shadow-xs"
        style={{
          background: "var(--zx-surface)",
          borderColor: "var(--zx-border)",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--zx-ink)]">
              # setup-wizard // question-{currentStep}-of-5
            </span>
          </div>
          <span className="text-xs font-mono font-bold text-[var(--zx-primary)]">
            {Math.round((currentStep / 5) * 100)}% Complete
          </span>
        </div>

        {/* Step Indicators Bar */}
        <div className="grid grid-cols-5 gap-1.5 mt-3">
          {stepsList.map((s) => (
            <div
              key={s.num}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s.num <= currentStep
                  ? "bg-[var(--zx-primary)]"
                  : "bg-slate-200"
              }`}
            />
          ))}
        </div>
      </div>

      {/* ── Discord Sequential Pop-up Question Card ── */}
      <div
        className="rounded-3xl border shadow-md overflow-hidden relative"
        style={{
          background: "var(--zx-surface)",
          borderColor: "var(--zx-border)",
        }}
      >
        {/* Accent Top Border */}
        <div
          className="h-1.5 w-full"
          style={{ background: "var(--zx-primary)" }}
        />

        <div className="p-6 sm:p-8 space-y-4">
          {stepError && (
            <div
              className="flex items-center justify-between p-3.5 rounded-2xl text-xs font-semibold shadow-sm animate-in fade-in duration-150"
              style={{
                background: "rgba(163, 4, 2, 0.08)",
                border: "1px solid var(--zx-primary)",
                color: "var(--zx-primary-deep)",
              }}
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{stepError}</span>
              </div>
              <button
                type="button"
                onClick={() => setStepError(null)}
                className="text-xs font-bold underline hover:opacity-80 ml-3"
              >
                Dismiss
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* ── STEP 1: CHOOSE REALM / ROLE ── */}
            {currentStep === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="space-y-6"
              >
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--zx-primary)]">
                    Question 01
                  </span>
                  <h2 className="text-2xl font-black text-[var(--zx-ink)] tracking-tight mt-1">
                    What brings you to Zentrix?
                  </h2>
                  <p className="text-xs text-[var(--zx-muted)] mt-1">
                    Select your primary operating mode. You can toggle between Hirer and Creator anytime.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Freelancer Card */}
                  <button
                    type="button"
                    onClick={() => setRole("freelancer")}
                    className={`p-5 rounded-2xl border text-left transition-all relative ${
                      role === "freelancer"
                        ? "border-[var(--zx-primary)] ring-2 ring-red-100 bg-red-50/20 shadow-xs"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                        style={{ background: "var(--zx-primary)" }}
                      >
                        <Briefcase className="w-5 h-5" />
                      </div>
                      {role === "freelancer" && (
                        <CheckCircle2 className="w-5 h-5 text-[var(--zx-primary)]" />
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-[var(--zx-ink)] mt-3">
                      I want to Work & Build
                    </h3>
                    <p className="text-xs text-[var(--zx-muted)] mt-1 leading-relaxed">
                      Deliver milestones, get paid in tMSTC, and earn non-custodial soulbound reputation credentials.
                    </p>
                  </button>

                  {/* Client Card */}
                  <button
                    type="button"
                    onClick={() => setRole("client")}
                    className={`p-5 rounded-2xl border text-left transition-all relative ${
                      role === "client"
                        ? "border-[var(--zx-primary)] ring-2 ring-red-100 bg-red-50/20 shadow-xs"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                        style={{ background: "var(--zx-ink)" }}
                      >
                        <UserCheck className="w-5 h-5" />
                      </div>
                      {role === "client" && (
                        <CheckCircle2 className="w-5 h-5 text-[var(--zx-ink)]" />
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-[var(--zx-ink)] mt-3">
                      I want to Hire Talent
                    </h3>
                    <p className="text-xs text-[var(--zx-muted)] mt-1 leading-relaxed">
                      Lock payments in smart contract escrow with 72h auto-release protections and Sarvam AI talent search.
                    </p>
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── STEP 2: AVATAR & CREATOR IDENTITY ── */}
            {currentStep === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="space-y-6"
              >
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--zx-primary)]">
                    Question 02
                  </span>
                  <h2 className="text-2xl font-black text-[var(--zx-ink)] tracking-tight mt-1">
                    Set your public creator handle & photo
                  </h2>
                  <p className="text-xs text-[var(--zx-muted)] mt-1">
                    Your avatar is encoded directly to Base64 and stored in your decentralized profile record.
                  </p>
                </div>

                {/* Avatar Uploader Section */}
                <div className="flex items-center gap-5 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="relative shrink-0">
                    <div
                      className="w-20 h-20 rounded-2xl border-2 overflow-hidden flex items-center justify-center shadow-md relative"
                      style={{
                        borderColor: "var(--zx-primary)",
                        background: "var(--zx-surface)",
                      }}
                    >
                      {avatarDataUrl ? (
                        <img
                          src={avatarDataUrl}
                          alt="Avatar preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center text-xl font-black text-white"
                          style={{ background: "var(--zx-primary)" }}
                        >
                          {name ? name.slice(0, 2).toUpperCase() : "ZX"}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute -bottom-1 -right-1 p-1.5 rounded-full text-white shadow hover:scale-105 transition-transform"
                      style={{ background: "var(--zx-ink)" }}
                      title="Upload photo"
                    >
                      <Camera className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleAvatarFile}
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                    />
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-[var(--zx-ink)]">
                      Creator Avatar (Base64 Encoded)
                    </h4>
                    <p className="text-[11px] text-[var(--zx-muted)] mt-0.5">
                      PNG, JPG or WebP under 2MB. Stored directly into Firestore and Realtime Database.
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-2 text-xs font-bold hover:underline"
                      style={{ color: "var(--zx-primary)" }}
                    >
                      Browse Image File →
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold text-[var(--zx-ink)] mb-1">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border text-xs font-semibold outline-hidden focus:ring-2 focus:ring-red-200"
                        style={{ borderColor: "var(--zx-border)" }}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[var(--zx-ink)] mb-1">
                        Handle (@username)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-xs text-[var(--zx-muted)] font-mono">
                          @
                        </span>
                        <input
                          type="text"
                          value={handle}
                          onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                          className="w-full pl-7 pr-3.5 py-2.5 rounded-xl border text-xs font-mono font-semibold outline-hidden focus:ring-2 focus:ring-red-200"
                          style={{ borderColor: "var(--zx-border)" }}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--zx-ink)] mb-1">
                      Professional Designation
                    </label>
                    <input
                      type="text"
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border text-xs font-semibold outline-hidden focus:ring-2 focus:ring-red-200"
                      style={{ borderColor: "var(--zx-border)" }}
                      placeholder="e.g. Smart Contract Developer & Security Researcher"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--zx-ink)] mb-1">
                      Bio / Introduction
                    </label>
                    <textarea
                      rows={2}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border text-xs font-medium outline-hidden focus:ring-2 focus:ring-red-200 resize-none"
                      style={{ borderColor: "var(--zx-border)" }}
                      placeholder="Brief description of what you do best."
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── STEP 3: INTERACTIVE CHOOSABLE CRAFT TAGS ── */}
            {currentStep === 3 && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="space-y-5"
              >
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--zx-primary)]">
                    Question 03
                  </span>
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-black text-[var(--zx-ink)] tracking-tight mt-1">
                      Choose your craft tags
                    </h2>
                    <span className="text-xs font-bold font-mono px-2.5 py-1 rounded-full bg-red-50 text-[var(--zx-primary)] border border-red-200">
                      {selectedTags.length} / 10 Selected
                    </span>
                  </div>
                  <p className="text-xs text-[var(--zx-muted)] mt-1">
                    Click to select your specialized capabilities. These feed directly into Sarvam AI semantic matching.
                  </p>
                </div>

                {/* Category Pills Bar */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {FREELANCE_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                        activeCategory === cat.id
                          ? "bg-[var(--zx-ink)] text-white shadow-xs"
                          : "bg-slate-100 text-[var(--zx-muted)] hover:text-[var(--zx-ink)]"
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>

                {/* Choosable Tag Chips Grid */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 min-h-[180px]">
                  {FREELANCE_CATEGORIES.filter((c) => c.id === activeCategory).map((cat) => (
                    <div key={cat.id} className="flex flex-wrap gap-2">
                      {cat.tags.map((tag) => {
                        const isSelected = selectedTags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(tag)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5 ${
                              isSelected
                                ? "bg-[var(--zx-primary)] text-white border-[var(--zx-primary)] shadow-xs scale-102"
                                : "bg-white text-slate-800 border-slate-200 hover:border-slate-300 hover:bg-slate-100/60"
                            }`}
                          >
                            <span>{isSelected ? "✓" : "+"}</span>
                            <span>{tag}</span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {/* Selected Tags Preview */}
                <div className="text-xs">
                  <span className="font-bold text-[var(--zx-muted)] uppercase tracking-wider text-[10px]">
                    Your Selected Stack:
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {selectedTags.length === 0 ? (
                      <span className="text-[var(--zx-muted)] italic">
                        No tags selected yet. Click any tag above!
                      </span>
                    ) : (
                      selectedTags.map((tag) => (
                        <span
                          key={tag}
                          onClick={() => toggleTag(tag)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white border border-slate-300 text-slate-800 cursor-pointer hover:bg-red-50 hover:border-red-200 hover:text-red-700 transition-colors"
                          title="Click to remove"
                        >
                          <span>{tag}</span>
                          <span className="text-slate-400">×</span>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── STEP 4: PERSONALIZATION & WORK PREFERENCES ── */}
            {currentStep === 4 && (
              <motion.div
                key="step-4"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="space-y-6"
              >
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--zx-primary)]">
                    Question 04
                  </span>
                  <h2 className="text-2xl font-black text-[var(--zx-ink)] tracking-tight mt-1">
                    Personalize your work preferences
                  </h2>
                  <p className="text-xs text-[var(--zx-muted)] mt-1">
                    Help us match you with optimal escrow contracts and verified project opportunities.
                  </p>
                </div>

                {/* Experience Tier Selector */}
                <div>
                  <label className="block text-xs font-bold text-[var(--zx-ink)] mb-2">
                    Experience Level
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { title: "Apprentice", sub: "0–1 yr in Web3" },
                      { title: "Specialist", sub: "2–4 yrs in Web3" },
                      { title: "Architect", sub: "5+ yrs Lead/Auditor" },
                    ].map((lvl) => (
                      <button
                        key={lvl.title}
                        type="button"
                        onClick={() => setExpLevel(`${lvl.title} (${lvl.sub})`)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          expLevel.includes(lvl.title)
                            ? "border-[var(--zx-primary)] bg-red-50/20 ring-1 ring-red-100"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <div className="text-xs font-bold text-[var(--zx-ink)]">
                          {lvl.title}
                        </div>
                        <div className="text-[10px] text-[var(--zx-muted)]">
                          {lvl.sub}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target Milestone Size */}
                <div>
                  <label className="block text-xs font-bold text-[var(--zx-ink)] mb-2">
                    Expected Milestone Size
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      "Micro (< 1 tMSTC)",
                      "Standard (1–5 tMSTC)",
                      "High-Value (5–20 tMSTC)",
                    ].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setRateRange(rate)}
                        className={`p-3 rounded-xl border text-center text-xs font-bold transition-all ${
                          rateRange === rate
                            ? "border-[var(--zx-primary)] bg-red-50/20 text-[var(--zx-primary)]"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        {rate}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Availability */}
                <div>
                  <label className="block text-xs font-bold text-[var(--zx-ink)] mb-2">
                    Availability
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      "Immediate (Full-Time)",
                      "Part-Time (10–20h/wk)",
                      "Bounty / Project-Based",
                    ].map((avail) => (
                      <button
                        key={avail}
                        type="button"
                        onClick={() => setAvailability(avail)}
                        className={`p-3 rounded-xl border text-center text-xs font-bold transition-all ${
                          availability === avail
                            ? "border-[var(--zx-primary)] bg-red-50/20 text-[var(--zx-primary)]"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        {avail}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── STEP 5: WEB3 ANCHOR & BINDING ── */}
            {currentStep === 5 && (
              <motion.div
                key="step-5"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="space-y-6"
              >
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--zx-primary)]">
                    Final Step 05
                  </span>
                  <h2 className="text-2xl font-black text-[var(--zx-ink)] tracking-tight mt-1">
                    Cryptographic Web3 Anchor
                  </h2>
                  <p className="text-xs text-[var(--zx-muted)] mt-1">
                    Sign an EIP-191 message to cryptographically tie your Zentrix profile to your MST Testnet address.
                  </p>
                </div>

                {/* Wallet Connection Status */}
                <div
                  className="p-4 rounded-2xl border"
                  style={{
                    background: "var(--zx-surface-alt)",
                    borderColor: "var(--zx-border)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                        style={{ background: "var(--zx-primary)" }}
                      >
                        <Wallet className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[var(--zx-ink)]">
                          {isConnected && address
                            ? `${address.slice(0, 8)}...${address.slice(-6)}`
                            : "No Wallet Connected"}
                        </div>
                        <div className="text-[11px] text-[var(--zx-muted)]">
                          MST Testnet (Chain ID 91562037)
                        </div>
                      </div>
                    </div>

                    {!isConnected ? (
                      <button
                        type="button"
                        onClick={openConnectModal}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-95 shadow-xs cursor-pointer"
                        style={{ background: "var(--zx-primary)" }}
                      >
                        Connect Wallet
                      </button>
                    ) : !isCorrectNetwork ? (
                      <button
                        type="button"
                        onClick={switchNetwork}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 transition-colors cursor-pointer"
                      >
                        Switch to MST
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Connected</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Profile Confirmation Summary */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--zx-muted)]">Role:</span>
                    <span className="font-bold capitalize text-[var(--zx-ink)]">
                      {role}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--zx-muted)]">Creator:</span>
                    <span className="font-bold text-[var(--zx-ink)]">
                      {name} (@{handle})
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--zx-muted)]">Skills Chosen:</span>
                    <span className="font-bold text-[var(--zx-primary)]">
                      {selectedTags.length} craft tags
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--zx-muted)]">Privacy Standard:</span>
                    <span className="font-semibold text-emerald-700 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> DPDP Zero-PII
                    </span>
                  </div>
                </div>

                {signatureStatus && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-mono flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{signatureStatus}</span>
                  </div>
                )}

                {isSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Successfully verified! Redirecting to your destination...</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Discord Schematic Action Navigation Buttons ── */}
          <div
            className="flex items-center justify-between pt-6 mt-6 border-t"
            style={{ borderColor: "var(--zx-border)" }}
          >
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold border hover:bg-slate-50 transition-colors cursor-pointer"
                style={{ borderColor: "var(--zx-border)" }}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            ) : (
              <div />
            )}

            {currentStep < 5 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => (prev + 1) as any)}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-opacity shadow-xs hover:opacity-95 cursor-pointer"
                style={{ background: "var(--zx-primary)" }}
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleWalletBinding}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white transition-opacity shadow-md hover:opacity-95 disabled:opacity-50 cursor-pointer"
                style={{ background: "var(--zx-primary)" }}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Anchoring to MST...</span>
                  </>
                ) : !isConnected ? (
                  <>
                    <Wallet className="w-4 h-4" />
                    <span>Connect MST Wallet</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Sign & Complete Onboarding</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
