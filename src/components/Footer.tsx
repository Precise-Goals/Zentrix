import React from "react";
import { Link } from "react-router-dom";
import {
  ExternalLink,
  ShieldCheck,
  Zap,
  Terminal,
  Cpu,
  Layers,
  Sparkles,
} from "lucide-react";

export const Footer: React.FC = () => {
  return (
    <footer
      className="zx-footer mt-16 border-t overflow-hidden relative"
      style={{
        background: "var(--zx-surface)",
        borderColor: "var(--zx-border)",
      }}
    >
      {/* Top Subtle Red Accent Line */}
      <div
        className="zx-footer-accent-line h-1 w-full"
        style={{ background: "var(--zx-primary)" }}
      />

      <div className="zx-footer-container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
        {/* ─── DIRECTORY GRID ─── */}
        <div className="zx-footer-grid grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Column 1: Brand Info */}
          <div className="zx-footer-brand col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <img
                src="/navlogo.png"
                alt="Zentrix Logo"
                className="zx-footer-logo h-8 w-auto object-contain"
              />
            </div>
            <p className="text-xs text-[var(--zx-muted)] leading-relaxed max-w-sm">
              Non-custodial milestone escrow marketplace on MST Blockchain Testnet. Sarvam-30B AI talent matching, Pass NFT credits, and soulbound reputation credentials.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                MST Testnet 91562037
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                Sarvam 105B Ready
              </span>
            </div>
          </div>

          {/* Column 2: Protocol */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--zx-ink)]">
              Protocol
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link
                  to="/marketplace"
                  className="text-[var(--zx-muted)] hover:text-[var(--zx-primary)] transition-colors"
                >
                  Gig Marketplace
                </Link>
              </li>
              <li>
                <Link
                  to="/agent"
                  className="text-[var(--zx-muted)] hover:text-[var(--zx-primary)] transition-colors"
                >
                  Sarvam AI Agent
                </Link>
              </li>
              <li>
                <Link
                  to="/dashboard"
                  className="text-[var(--zx-muted)] hover:text-[var(--zx-primary)] transition-colors"
                >
                  Escrow Dashboard
                </Link>
              </li>
              <li>
                <Link
                  to="/pricing"
                  className="text-[var(--zx-muted)] hover:text-[var(--zx-primary)] transition-colors"
                >
                  Pass NFT Tiers
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Support */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--zx-ink)]">
              Support
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link
                  to="/contact"
                  className="text-[var(--zx-muted)] hover:text-[var(--zx-primary)] transition-colors"
                >
                  Contact Us (RTDB)
                </Link>
              </li>
              <li>
                <Link
                  to="/manual"
                  className="text-[var(--zx-muted)] hover:text-[var(--zx-primary)] transition-colors"
                >
                  User Manual & Guide
                </Link>
              </li>
              <li>
                <Link
                  to="/disclosure"
                  className="text-[var(--zx-muted)] hover:text-[var(--zx-primary)] transition-colors flex items-center gap-1"
                >
                  <span>Operating Disclosure</span>
                  <ShieldCheck className="w-3 h-3 text-[var(--zx-primary)]" />
                </Link>
              </li>
              <li>
                <Link
                  to="/disclosure#auto-release"
                  className="text-[var(--zx-muted)] hover:text-[var(--zx-primary)] transition-colors"
                >
                  72h Auto-Release Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: MST Ecosystem */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--zx-ink)]">
              Ecosystem
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a
                  href="https://testnet.mstscan.com/address/0xa50759E9CE985Fbb06503CaeC0DB9D1fB1233726"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--zx-muted)] hover:text-[var(--zx-primary)] transition-colors flex items-center gap-1"
                >
                  <span>MSTScan Contract</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                <a
                  href="https://bridgekey.io"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--zx-muted)] hover:text-[var(--zx-primary)] transition-colors flex items-center gap-1"
                >
                  <span>BridgeKey RPC</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                <Link
                  to="/about"
                  className="text-[var(--zx-muted)] hover:text-[var(--zx-primary)] transition-colors"
                >
                  Architecture & Docs
                </Link>
              </li>
              <li>
                <Link
                  to="/profile"
                  className="text-[var(--zx-muted)] hover:text-[var(--zx-primary)] transition-colors"
                >
                  Creator Profile
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* ─── ANTIGRAVITY BIT FONT WATERMARK BANNER ─── */}
        <div className="zx-footer-watermark pt-6 pb-2 border-t border-b overflow-hidden relative select-none" style={{ borderColor: "var(--zx-border)" }}>
          {/* <div className="zx-footer-watermark-text text-center font-black tracking-[0.25em] sm:tracking-[0.45em] text-3xl sm:text-6xl lg:text-7xl text-slate-900/10 transition-all duration-500 hover:text-[var(--zx-primary)]/15">
            Zentrix.
          </div> */}
          <img style={{
            marginBottom:"2%"
          }} src="/footlogo.png" alt="Footer" />
          <div className="zx-footer-watermark-sub text-center text-[15px] font-mono tracking-widest uppercase text-[var(--zx-muted)] mt-1">
            • ANTIGRAVITY AGENTIC ARCHITECTURE • NON-CUSTODIAL EVM • MST TESTNET 91562037 •
          </div>
        </div>

        {/* ─── BOTTOM COPYRIGHT & TELEMETRY BAR ─── */}
        <div className="zx-footer-bottom-bar mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--zx-muted)]">
          <div className="zx-footer-copyright flex items-center gap-2">
            <span className="font-bold text-[var(--zx-ink)]">Zentrix Protocol</span>
            <span>· MIT License · MST Blockchain Buildathon 2026</span>
          </div>

          <div className="zx-footer-telemetry flex items-center gap-3 font-mono text-[11px]">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>RPC 200 OK</span>
            </span>
            <span>·</span>
            <span>Chain: 91562037</span>
            <span>·</span>
            <span className="text-[var(--zx-primary)] font-bold">tMSTC</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
