import React, { createContext, useContext, useState, useEffect } from "react";
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ref, get, set } from "firebase/database";
import { auth, db, rtdb, googleProvider } from "../lib/firebase";

export type UserRole = "client" | "freelancer";

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  designation?: string;
  organization?: string;
  bio?: string;
  avatar?: string;
  phone?: string;
  walletAddress?: string;
  industryTags?: string[];
  expertise?: string[];
  isOnboarded: boolean;
  isWalletBound: boolean;
}

export interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  currentRole: UserRole | null;
  loginWithGoogle: () => Promise<FirebaseUser | null>;
  loginWithEmail: (email: string, pass: string) => Promise<FirebaseUser | null>;
  registerWithEmail: (email: string, pass: string) => Promise<FirebaseUser | null>;
  logout: () => Promise<void>;
  updateRole: (role: UserRole) => void;
  saveOnboarding: (data: Partial<UserProfile>, role: UserRole, walletAddress: string) => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  bindWallet: (walletAddress: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    try {
      if (typeof window !== "undefined") {
        const activeUid = localStorage.getItem("zx_active_uid");
        if (activeUid) {
          const cachedRaw = localStorage.getItem(`zx_user_profile_${activeUid}`);
          if (cachedRaw) return JSON.parse(cachedRaw);
        }
      }
    } catch {}
    return null;
  });
  const [currentRole, setCurrentRole] = useState<UserRole | null>(() => {
    try {
      if (typeof window !== "undefined") {
        const activeRole = localStorage.getItem("zx_active_role") as UserRole;
        if (activeRole) return activeRole;
      }
    } catch {}
    return null;
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      if (fbUser) {
        localStorage.setItem("zx_active_uid", fbUser.uid);
        localStorage.setItem("zx_active_email", fbUser.email || "");
        // 1. Instant hydration from local cache
        const cachedRaw = localStorage.getItem(`zx_user_profile_${fbUser.uid}`);
        if (cachedRaw) {
          try {
            const cachedData = JSON.parse(cachedRaw) as UserProfile;
            setProfile(cachedData);
            setCurrentRole(cachedData.role || "freelancer");
          } catch {}
        }

        let resolved = false;

        // 2. Fetch from Firebase Realtime Database (active & connected)
        try {
          const rtdbSnap = await get(ref(rtdb, `users/${fbUser.uid}`));
          if (rtdbSnap.exists()) {
            const data = rtdbSnap.val() as UserProfile;
            setProfile(data);
            setCurrentRole(data.role || "freelancer");
            localStorage.setItem(`zx_user_profile_${fbUser.uid}`, JSON.stringify(data));
            resolved = true;
          }
        } catch {
          // RTDB read non-critical, will fallback to Firestore
        }

        // 3. Fallback to Firestore with timeout if not found in RTDB
        if (!resolved) {
          try {
            const userDocPromise = getDoc(doc(db, "users", fbUser.uid));
            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Firestore timeout")), 1500)
            );
            const userDoc = await Promise.race([userDocPromise, timeoutPromise]);
            if (userDoc && userDoc.exists()) {
              const data = userDoc.data() as UserProfile;
              setProfile(data);
              setCurrentRole(data.role || "freelancer");
              localStorage.setItem(`zx_user_profile_${fbUser.uid}`, JSON.stringify(data));
              resolved = true;
            }
          } catch (e) {
            // Firestore may be disabled or offline on project growup-dec3f; silently handle
          }
        }

        if (!resolved && !cachedRaw) {
          setProfile(null);
          setCurrentRole(null);
        }
      } else {
        setProfile(null);
        setCurrentRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      const res = await signInWithPopup(auth, googleProvider);
      return res.user;
    } catch (e: any) {
      if (e?.code === "auth/popup-blocked" || e?.code === "auth/popup-closed-by-user") {
        try {
          await signInWithRedirect(auth, googleProvider);
          return null;
        } catch (redirectErr) {
          throw redirectErr;
        }
      }
      throw e;
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const res = await signInWithEmailAndPassword(auth, email, pass);
      return res.user;
    } catch (e) {
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const registerWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const res = await createUserWithEmailAndPassword(auth, email, pass);
      return res.user;
    } catch (e) {
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setProfile(null);
    setCurrentRole(null);
    localStorage.removeItem("zx_active_uid");
    localStorage.removeItem("zx_active_email");
    localStorage.removeItem("zx_active_role");
  };

  const updateRole = (role: UserRole) => {
    setCurrentRole(role);
    localStorage.setItem("zx_active_role", role);
    if (profile) {
      const updated = { ...profile, role };
      setProfile(updated);
      if (user?.uid) {
        localStorage.setItem(`zx_user_profile_${user.uid}`, JSON.stringify(updated));
      }
    }
  };

  const saveOnboarding = async (data: Partial<UserProfile>, role: UserRole, walletAddress: string) => {
    if (!user) throw new Error("Must be logged in to onboard");

    const newProfile: UserProfile = {
      uid: user.uid,
      name: data.name || user.displayName || "Anonymous User",
      email: user.email || data.email || "",
      role: role,
      designation: data.designation || "",
      organization: data.organization || "",
      bio: data.bio || "",
      avatar: data.avatar || "",
      phone: data.phone || "",
      walletAddress: walletAddress.toLowerCase(),
      industryTags: data.industryTags || [],
      expertise: data.expertise || [],
      isOnboarded: true,
      isWalletBound: true,
    };

    // 1. Instant local persistence
    localStorage.setItem(`zx_user_profile_${user.uid}`, JSON.stringify(newProfile));
    localStorage.setItem(`zx_user_role_${user.uid}`, role);

    // 2. Save to Firebase Realtime Database
    try {
      await set(ref(rtdb, `users/${user.uid}`), newProfile);
      const roleCollection = role === "client" ? "clients" : "freelancers";
      await set(ref(rtdb, `${roleCollection}/${user.uid}`), {
        public: {
          uid: user.uid,
          name: newProfile.name,
          designation: newProfile.designation,
          organization: newProfile.organization,
          bio: newProfile.bio,
          avatar: newProfile.avatar,
          industryTags: newProfile.industryTags,
          expertise: newProfile.expertise,
          walletAddress: newProfile.walletAddress,
        },
        private: {
          email: newProfile.email,
          phone: newProfile.phone,
        },
      });
      await set(ref(rtdb, `wallets/${walletAddress.toLowerCase()}`), {
        uid: user.uid,
        boundAt: Date.now(),
      });
    } catch {
      // RTDB save non-critical — localStorage already persisted
    }

    // 3. Asynchronously attempt Firestore sync without blocking
    try {
      const fsPromise = Promise.all([
        setDoc(doc(db, "users", user.uid), newProfile, { merge: true }),
        setDoc(
          doc(db, role === "client" ? "clients" : "freelancers", user.uid),
          {
            public: {
              uid: user.uid,
              name: newProfile.name,
              designation: newProfile.designation,
              organization: newProfile.organization,
              industryTags: newProfile.industryTags,
              expertise: newProfile.expertise,
              walletAddress: newProfile.walletAddress,
            },
            private: {
              email: newProfile.email,
              phone: newProfile.phone,
            },
          },
          { merge: true }
        ),
        setDoc(
          doc(db, "wallets", walletAddress.toLowerCase()),
          { uid: user.uid, boundAt: Date.now() },
          { merge: true }
        ),
      ]);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Firestore timeout")), 1500)
      );
      await Promise.race([fsPromise, timeoutPromise]);
    } catch (e) {
      // Non-fatal if Firestore API is disabled or offline
    }

    setProfile(newProfile);
    setCurrentRole(role);
  };

  const bindWallet = async (walletAddress: string) => {
    if (!user) throw new Error("User not logged in");
    const lowerAddress = walletAddress.toLowerCase();

    // 1. Instant local persistence
    if (profile) {
      const updated = { ...profile, walletAddress: lowerAddress, isWalletBound: true };
      localStorage.setItem(`zx_user_profile_${user.uid}`, JSON.stringify(updated));
      setProfile(updated);
    }

    // 2. Realtime Database save
    try {
      await set(ref(rtdb, `users/${user.uid}/walletAddress`), lowerAddress);
      await set(ref(rtdb, `users/${user.uid}/isWalletBound`), true);
      await set(ref(rtdb, `wallets/${lowerAddress}`), { uid: user.uid, boundAt: Date.now() });
    } catch {
      // RTDB non-critical
    }

    // 3. Firestore background sync
    try {
      const fsPromise = setDoc(
        doc(db, "users", user.uid),
        { walletAddress: lowerAddress, isWalletBound: true },
        { merge: true }
      );
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Firestore timeout")), 1500)
      );
      await Promise.race([fsPromise, timeoutPromise]);
    } catch {}
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) throw new Error("User not logged in");
    const current = profile || {
      uid: user.uid,
      name: user.displayName || "Anonymous User",
      email: user.email || "",
      role: "freelancer" as UserRole,
      isOnboarded: true,
      isWalletBound: false,
    };
    const updated: UserProfile = {
      ...current,
      ...data,
    };

    localStorage.setItem(`zx_user_profile_${user.uid}`, JSON.stringify(updated));
    setProfile(updated);
    if (updated.role) {
      setCurrentRole(updated.role);
    }

    try {
      await set(ref(rtdb, `users/${user.uid}`), updated);
      const roleCollection = updated.role === "client" ? "clients" : "freelancers";
      await set(ref(rtdb, `${roleCollection}/${user.uid}/public`), {
        uid: user.uid,
        name: updated.name,
        designation: updated.designation,
        organization: updated.organization,
        bio: updated.bio,
        avatar: updated.avatar,
        industryTags: updated.industryTags,
        expertise: updated.expertise,
        walletAddress: updated.walletAddress,
      });
    } catch {
      // RTDB non-critical
    }

    try {
      const fsPromise = setDoc(doc(db, "users", user.uid), updated, { merge: true });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Firestore timeout")), 1500)
      );
      await Promise.race([fsPromise, timeoutPromise]);
    } catch (e) {}
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        currentRole,
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        logout,
        updateRole,
        saveOnboarding,
        updateProfile,
        bindWallet,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
