import React, { lazy, Suspense, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { SplashScreen } from "./components/SplashScreen";
import { Footer } from "./components/Footer";
import { CursorFollower } from "./components/CursorFollower";
import { useAuth } from "./context/AuthContext";
import { useWallet } from "./context/WalletContext";
import { NetworkGuard } from "./components/NetworkGuard";

const HomePage = lazy(() => import("./pages/Home").then(({ HomePage }) => ({ default: HomePage })));
const AboutPage = lazy(() => import("./pages/About").then(({ AboutPage }) => ({ default: AboutPage })));
const MarketplacePage = lazy(() => import("./pages/Marketplace").then(({ MarketplacePage }) => ({ default: MarketplacePage })));
const AgentPage = lazy(() => import("./pages/Agent").then(({ AgentPage }) => ({ default: AgentPage })));
const PricingPage = lazy(() => import("./pages/Pricing").then(({ PricingPage }) => ({ default: PricingPage })));
const DashboardPage = lazy(() => import("./pages/Dashboard").then(({ DashboardPage }) => ({ default: DashboardPage })));
const LoginPage = lazy(() => import("./pages/Login").then(({ LoginPage }) => ({ default: LoginPage })));
const OnboardingPage = lazy(() => import("./pages/Onboarding").then(({ OnboardingPage }) => ({ default: OnboardingPage })));
const ProfilePage = lazy(() => import("./pages/Profile").then(({ ProfilePage }) => ({ default: ProfilePage })));
const DisclosurePage = lazy(() => import("./pages/Disclosure").then(({ DisclosurePage }) => ({ default: DisclosurePage })));
const ContactPage = lazy(() => import("./pages/Contact").then(({ ContactPage }) => ({ default: ContactPage })));
const ManualPage = lazy(() => import("./pages/Manual").then(({ ManualPage }) => ({ default: ManualPage })));

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Strict authentication guard for Services & Monitor sections (except Pricing).
 * Permits access only to authenticated Firebase users or approved Web3 connected addresses.
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--zx-primary)", borderTopColor: "transparent" }}
        />
        <span className="text-xs font-mono text-[var(--zx-muted)]">Verifying authentication...</span>
      </div>
    );
  }

  // Mandatory sequential flow:
  // 1. Must be authenticated with Firebase user (Email / Google)
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // 2. Must be onboarded (Profile & Web3 wallet bound)
  if (!profile?.isOnboarded && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace state={{ from: location.pathname }} />;
  }

  return <NetworkGuard>{children}</NetworkGuard>;
};

export const App: React.FC = () => {
  const [showSplash, setShowSplash] = useState(true);

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--zx-cream)] text-[var(--zx-ink)]">
      <CursorFollower />
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Suspense
          fallback={
            <div className="flex min-h-[50vh] items-center justify-center">
              <div
                className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
                style={{ borderColor: "var(--zx-primary)", borderTopColor: "transparent" }}
              />
            </div>
          }
        >
          <Routes>
          {/* Public Routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/disclosure" element={<DisclosurePage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/manual" element={<ManualPage />} />

          {/* Protected Routes (Strict Login Required: Services & Monitor except pricing) */}
          <Route
            path="/marketplace"
            element={
              <ProtectedRoute>
                <MarketplacePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/agent"
            element={
              <ProtectedRoute>
                <AgentPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          </Routes>
        </Suspense>
      </main>

      <Footer />
    </div>
  );
};

export default App;
