import React from "react";
import { useWallet } from "../context/WalletContext";

interface NetworkGuardProps {
  children: React.ReactNode;
}

export const NetworkGuard: React.FC<NetworkGuardProps> = ({ children }) => {
  const { isConnected, isCorrectNetwork, switchNetwork } = useWallet();

  return (
    <>
      {children}
      {isConnected && !isCorrectNetwork && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/60 transition-all duration-300">
          <div
            className="p-8 border rounded-2xl max-w-md w-full text-center flex flex-col items-center gap-6 shadow-2xl"
            style={{
              backgroundColor: "var(--zx-dark)",
              borderColor: "var(--zx-border)",
            }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-2"
              style={{
                backgroundColor: "var(--zx-border)",
                color: "var(--zx-primary)",
              }}
            >
              <svg
                className="w-8 h-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h2
              className="text-2xl font-semibold"
              style={{ color: "var(--zx-text)" }}
            >
              Wrong Network
            </h2>

            <p className="text-sm" style={{ color: "var(--zx-muted)" }}>
              Zentrix requires the MST Testnet to function. Please switch your
              wallet network to continue.
            </p>

            <div
              className="w-full rounded p-3 text-xs font-mono text-left"
              style={{
                backgroundColor: "var(--zx-bg)",
                color: "var(--zx-text)",
              }}
            >
              <div>Network: MST Testnet</div>
              <div>Chain ID: 91562037</div>
            </div>

            <button
              onClick={() => switchNetwork()}
              className="w-full py-3 px-6 rounded-lg font-medium transition-all shadow-md active:scale-95"
              style={{
                backgroundColor: "var(--zx-primary)",
                color: "var(--zx-dark)",
              }}
            >
              Switch Network
            </button>
          </div>
        </div>
      )}
    </>
  );
};
