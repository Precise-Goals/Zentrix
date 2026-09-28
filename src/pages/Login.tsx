import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  RefreshCw,
  ArrowRight,
  AlertCircle,
  Sparkles,
  Blocks,
  Globe,
  Zap,
} from "lucide-react";
import { motion } from "framer-motion";

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, loginWithGoogle, loginWithEmail, registerWithEmail } = useAuth();
  const from = (location.state as any)?.from || "/dashboard";

  useEffect(() => {
    if (user) {
      if (!profile?.isOnboarded) {
        navigate("/onboarding", { replace: true, state: { from } });
      } else {
        navigate(from, { replace: true });
      }
    }
  }, [user, profile, navigate, from]);

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isRegister) {
        await registerWithEmail(email, password);
      } else {
        await loginWithEmail(email, password);
      }
    } catch (err: any) {
      setError(err?.message || "Authentication failed. Please verify credentials.");
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    try {
      setLoading(true);
      await loginWithGoogle();
    } catch (err: any) {
      if (err?.code === "auth/popup-blocked") {
        setError("Popup blocked. Please allow popups for this site.");
      } else {
        setError(err?.message || "Google sign-in cancelled or failed.");
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-10 px-4 relative overflow-hidden bg-slate-50">
      {/* Dynamic Ambient Background */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <motion.div
          animate={{ scale: [1, 1.1, 1], rotate: [0, 15, 0], opacity: [0.3, 0.4, 0.3] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[10%] -left-[10%] w-[50vw] h-[50vw] rounded-full blur-[100px]"
          style={{ background: "radial-gradient(circle, var(--zx-primary) 0%, transparent 60%)" }}
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1], rotate: [0, -15, 0], opacity: [0.2, 0.3, 0.2] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[40%] -right-[10%] w-[40vw] h-[40vw] rounded-full blur-[100px]"
          style={{ background: "radial-gradient(circle, var(--zx-primary-deep) 0%, transparent 60%)" }}
        />
      </div>

      <div className="w-full max-w-5xl z-10 grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
        {/* Left Side: Bento Feature Cards */}
        <div className="hidden lg:grid grid-cols-2 gap-4">
          <div className="col-span-2 row-span-2 rounded-3xl p-8 relative overflow-hidden"
               style={{ background: "rgba(255, 255, 255, 0.4)", backdropFilter: "blur(20px)", border: "1px solid var(--zx-border)" }}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 blur-2xl rounded-full" />
            <Blocks className="w-12 h-12 mb-6 text-[var(--zx-primary-deep)]" />
            <h2 className="text-3xl font-black text-[var(--zx-ink)] mb-4">The Trust Protocol for Freelance Work.</h2>
            <p className="text-[var(--zx-muted)] font-medium leading-relaxed">
              Zentrix leverages MST Testnet smart contracts to eliminate counterparty risk. Payments are locked in decentralized escrow, governed by verifiable milestones.
            </p>
          </div>
          
          <div className="rounded-3xl p-6 relative overflow-hidden"
               style={{ background: "rgba(255, 255, 255, 0.6)", backdropFilter: "blur(20px)", border: "1px solid var(--zx-border)" }}>
            <Zap className="w-8 h-8 mb-4 text-amber-500" />
            <h3 className="text-lg font-bold text-[var(--zx-ink)] mb-2">Instant Settlement</h3>
            <p className="text-xs text-[var(--zx-muted)]">No invoice delays. 72h auto-release ensures you get paid in tMSTC instantly upon approval.</p>
          </div>

          <div className="rounded-3xl p-6 relative overflow-hidden"
               style={{ background: "rgba(255, 255, 255, 0.6)", backdropFilter: "blur(20px)", border: "1px solid var(--zx-border)" }}>
            <Globe className="w-8 h-8 mb-4 text-blue-500" />
            <h3 className="text-lg font-bold text-[var(--zx-ink)] mb-2">Soulbound Identity</h3>
            <p className="text-xs text-[var(--zx-muted)]">Build your on-chain reputation. Non-transferable ERC-721 credentials permanently anchor your expertise.</p>
          </div>
        </div>

        {/* Right Side: Auth Panel */}
        <div className="w-full max-w-md mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[2.5rem] p-8 sm:p-10 shadow-2xl relative overflow-hidden"
            style={{
              background: "rgba(255, 255, 255, 0.8)",
              backdropFilter: "blur(30px)",
              border: "1px solid rgba(255,255,255,0.8)",
              boxShadow: "0 25px 50px -12px rgba(42, 15, 15, 0.15), 0 0 0 1px rgba(255,255,255,0.5) inset"
            }}
          >
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6 shadow-lg bg-white border border-slate-100 relative">
                <img src="/navlogo.png" alt="Logo" className="w-10 h-10 object-contain drop-shadow-sm" />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-white">
                  <ShieldCheck className="w-3 h-3" />
                </div>
              </div>
              <h1 className="text-2xl font-black text-[var(--zx-ink)] mb-2 tracking-tight">
                {isRegister ? "Join Zentrix Network" : "Welcome Back"}
              </h1>
              <p className="text-sm text-[var(--zx-muted)] font-medium">
                {isRegister ? "Create your Web3 anchored profile" : "Enter your credentials to access escrow"}
              </p>
            </div>

            {error && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mb-6 p-4 rounded-2xl flex items-start gap-3 text-xs font-semibold" style={{ background: "rgba(220, 38, 38, 0.08)", border: "1px solid var(--zx-primary)", color: "var(--zx-primary-deep)" }}>
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1 leading-relaxed">{error}</div>
              </motion.div>
            )}

            {/* Google Auth */}
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full group relative flex items-center justify-center gap-3 py-3.5 px-4 rounded-2xl font-bold text-sm bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none"
            >
              <svg className="w-5 h-5 shrink-0 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                <path fill="var(--zx-primary-deep)" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="var(--zx-success)" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="var(--zx-warning)" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="var(--zx-primary)" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span className="text-slate-700">Continue with Google</span>
            </button>

            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--zx-muted)]">OR EMAIL</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {/* Email Form */}
            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--zx-ink)] ml-1">Email Address</label>
                <div className="relative group">
                  <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[var(--zx-primary)] transition-colors" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@domain.com"
                    className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white/60 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--zx-primary)] focus:border-transparent transition-all backdrop-blur-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--zx-ink)] ml-1">Password</label>
                <div className="relative group">
                  <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[var(--zx-primary)] transition-colors" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-11 pr-12 py-3 rounded-2xl bg-white/60 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--zx-primary)] focus:border-transparent transition-all backdrop-blur-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3.5 rounded-2xl text-sm font-bold text-white shadow-lg shadow-red-500/20 hover:shadow-red-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:pointer-events-none"
                style={{ background: "linear-gradient(135deg, var(--zx-primary) 0%, var(--zx-primary-deep) 100%)" }}
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span>{isRegister ? "Create Account & Continue" : "Sign In & Proceed"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 text-center">
              <button
                onClick={() => { setIsRegister(!isRegister); setError(null); }}
                className="text-sm font-bold text-[var(--zx-primary-deep)] hover:text-[var(--zx-primary)] transition-colors"
              >
                {isRegister ? "Already have an account? Sign In" : "New to Zentrix? Create an Account"}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
