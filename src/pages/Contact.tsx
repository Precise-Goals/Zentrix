import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ref, push, serverTimestamp } from "firebase/database";
import { rtdb } from "../lib/firebase";
import { useWallet } from "../context/WalletContext";
import { useAuth } from "../context/AuthContext";
import {
  Send,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  BookOpen,
  ExternalLink,
  RefreshCw,
  MessageSquare,
  Sparkles,
} from "lucide-react";

export const ContactPage: React.FC = () => {
  const { address, isConnected } = useWallet();
  const { profile, currentRole, user } = useAuth();

  const [name, setName] = useState(profile?.name || user?.displayName || "");
  const [email, setEmail] = useState(user?.email || "");
  const [topic, setTopic] = useState("Escrow & Milestone");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successTicket, setSuccessTicket] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg("Please provide your name or pseudonym.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setErrorMsg("Please enter a valid email address so we can reply to your query.");
      return;
    }
    if (!message.trim() || message.trim().length < 10) {
      setErrorMsg("Please include a brief description of your inquiry (minimum 10 characters).");
      return;
    }

    setSubmitting(true);

    try {
      // Generate a human-friendly ticket ID: ZX-REQ-XXXXX
      const ticketId = `ZX-REQ-${Math.floor(10000 + Math.random() * 90000)}`;

      const queryPayload = {
        ticketId,
        name: name.trim(),
        email: email.trim(),
        topic,
        subject: subject.trim() || `${topic} Support Request`,
        message: message.trim(),
        walletAddress: address || "Not Connected",
        role: currentRole || "Unspecified",
        status: "Open",
        createdAt: serverTimestamp(),
        clientTimestamp: new Date().toISOString(),
        network: "MST Testnet (Chain ID 91562037)",
      };

      // Push query directly into Firebase Realtime Database
      const queriesRef = ref(rtdb, "contact_queries");
      await push(queriesRef, queryPayload);

      setSuccessTicket(ticketId);
      setMessage("");
      setSubject("");
    } catch (err: any) {
      setErrorMsg(
        err?.message || "Failed to submit your query to Firebase Realtime Database. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSuccessTicket(null);
    setErrorMsg(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div
        className="rounded-3xl p-6 sm:p-8 border shadow-sm relative overflow-hidden"
        style={{
          background: "var(--zx-surface)",
          borderColor: "var(--zx-border)",
        }}
      >
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-[var(--zx-primary-deep)] border border-red-200">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Zentrix Support Desk · Realtime Sync</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[var(--zx-ink)]">
            Contact Support & Query Desk
          </h1>
          <p className="text-xs sm:text-sm text-[var(--zx-muted)] max-w-2xl leading-relaxed">
            Have questions regarding milestone escrow releases, BridgeKey wallet signing, or Pass NFT credits?
            Submit your inquiry directly to our real-time database desk for priority review.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {/* Contact Form (2 Columns) */}
        <div
          className="md:col-span-2 rounded-3xl p-6 sm:p-8 border shadow-sm space-y-6"
          style={{
            background: "var(--zx-surface)",
            borderColor: "var(--zx-border)",
          }}
        >
          {successTicket ? (
            <div className="text-center py-8 space-y-5 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-[var(--zx-ink)]">Query Successfully Dispatched</h3>
                <p className="text-xs text-[var(--zx-muted)] max-w-md mx-auto leading-relaxed">
                  Your support ticket has been persisted to the Zentrix Firebase Realtime Database. Our core team and arbitration stewards will review your query shortly.
                </p>
              </div>

              <div
                className="inline-block p-4 rounded-2xl border font-mono text-xs text-left"
                style={{
                  background: "var(--zx-surface-alt)",
                  borderColor: "var(--zx-border)",
                }}
              >
                <div className="text-[10px] text-[var(--zx-muted)] uppercase tracking-wider font-sans font-bold">
                  Reference Ticket ID
                </div>
                <div className="text-base font-black text-[var(--zx-primary-deep)] mt-0.5">
                  {successTicket}
                </div>
                <div className="text-[11px] text-[var(--zx-muted)] mt-1">
                  Status: <span className="text-emerald-600 font-bold">Open · Queued for Review</span>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={handleReset}
                  className="btn-primary py-2.5 px-6 text-xs font-bold"
                >
                  Submit Another Inquiry
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div
                  className="p-3.5 rounded-2xl flex items-center gap-2.5 text-xs font-semibold"
                  style={{
                    background: "rgba(163, 4, 2, 0.08)",
                    border: "1px solid var(--zx-primary)",
                    color: "var(--zx-primary-deep)",
                  }}
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--zx-ink)]">Your Name / Handle *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alex Dev"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border text-xs text-[var(--zx-ink)] bg-white focus:outline-none transition-shadow"
                    style={{ borderColor: "var(--zx-border)" }}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--zx-ink)]">Email Address *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex@domain.xyz"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border text-xs text-[var(--zx-ink)] bg-white focus:outline-none transition-shadow"
                    style={{ borderColor: "var(--zx-border)" }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--zx-ink)]">Inquiry Topic</label>
                  <select
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border text-xs text-[var(--zx-ink)] bg-white focus:outline-none transition-shadow"
                    style={{ borderColor: "var(--zx-border)" }}
                  >
                    <option value="Escrow & Milestone">Escrow & Milestone Protection</option>
                    <option value="BridgeKey & Wallet">BridgeKey & Wallet Signing</option>
                    <option value="Pass NFT & Credits">Pass NFT Credits & Rate Limits</option>
                    <option value="Smart Contract Bug">Smart Contract & Bug Bounty</option>
                    <option value="Dispute & Arbitration">Dispute & Arbitration</option>
                    <option value="General Support">General Platform Inquiries</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--zx-ink)]">Subject (Optional)</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Brief summary of query"
                    className="w-full px-3.5 py-2.5 rounded-xl border text-xs text-[var(--zx-ink)] bg-white focus:outline-none transition-shadow"
                    style={{ borderColor: "var(--zx-border)" }}
                  />
                </div>
              </div>

              {/* Connected Wallet Info */}
              <div
                className="p-3 rounded-xl border flex items-center justify-between text-xs"
                style={{
                  background: "var(--zx-surface-alt)",
                  borderColor: "var(--zx-border)",
                }}
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span className="font-medium text-[var(--zx-muted)]">Verified Wallet Attached:</span>
                </div>
                <span className="font-mono font-bold text-[var(--zx-ink)]">
                  {isConnected && address
                    ? `${address.slice(0, 6)}...${address.slice(-4)}`
                    : "Not Connected (Anonymous)"}
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--zx-ink)]">Your Message *</label>
                <textarea
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Detail your question, contract hash, or transaction link so our engineers can investigate..."
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border text-xs text-[var(--zx-ink)] bg-white focus:outline-none transition-shadow resize-none"
                  style={{ borderColor: "var(--zx-border)" }}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Persisting Query to RTDB…</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Submit Query to Firebase RTDB</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Sidebar Info (1 Column) */}
        <div className="space-y-4">
          <div
            className="rounded-3xl p-6 border shadow-sm space-y-4"
            style={{
              background: "var(--zx-surface)",
              borderColor: "var(--zx-border)",
            }}
          >
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
                <BookOpen className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-[var(--zx-ink)]">Before Submitting</h3>
            </div>
            <p className="text-xs text-[var(--zx-muted)] leading-relaxed">
              Most operational questions regarding BridgeKey extension signing, milestone submissions, and soulbound reputation minting are covered in our comprehensive documentation.
            </p>
            <Link
              to="/manual"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--zx-primary-deep)] hover:underline"
            >
              <span>Explore Zentrix User Manual</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          <div
            className="rounded-3xl p-6 border shadow-sm space-y-4"
            style={{
              background: "var(--zx-surface)",
              borderColor: "var(--zx-border)",
            }}
          >
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-red-50 text-[var(--zx-primary-deep)]">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-[var(--zx-ink)]">On-Chain Transparency</h3>
            </div>
            <p className="text-xs text-[var(--zx-muted)] leading-relaxed">
              Zentrix is non-custodial. Funds locked in milestones are held exclusively by the verified <code className="px-1 py-0.5 rounded bg-slate-100 font-mono text-[10px]">ZentrixEscrow</code> contract on MST Testnet (Chain ID 91562037).
            </p>
            <Link
              to="/disclosure"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--zx-primary-deep)] hover:underline"
            >
              <span>Review Legal Disclosures</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          <div
            className="rounded-3xl p-6 border shadow-sm space-y-2.5"
            style={{
              background: "var(--zx-surface)",
              borderColor: "var(--zx-border)",
            }}
          >
            <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--zx-muted)] font-bold">
              Network Status
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>MST Testnet Operational (91562037)</span>
            </div>
            <div className="text-[11px] font-mono text-[var(--zx-muted)]">
              RPC: testnetrpc.mstblockchain.com
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
