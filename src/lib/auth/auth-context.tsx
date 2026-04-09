"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase/config";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import type { Role, UserProfile } from "@/types";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string, companyId: string, role: Role) => Promise<User>;
  signOut: () => Promise<void>;
  hasRole: (requiredRole: Role) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const ROLE_LEVEL: Record<Role, number> = {
  SUPER_ADMIN: 4,
  COMPANY_ADMIN: 3,
  MANAGER: 2,
  EMPLOYEE: 1,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionIdRef = useRef<string | null>(null);

  // Helper: start a session via the API
  const startSession = async (userProfile: UserProfile, firebaseUser: User) => {
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          employeeName: userProfile.displayName,
          department: "General",
        }),
      });
      const data = await res.json();
      if (data.success && data.data?.id) {
        sessionIdRef.current = data.data.id;
        sessionStorage.setItem("hr-session-id", data.data.id);
      }
    } catch {
      // Session tracking is non-blocking
    }
  };

  // Helper: end a session via the API
  const endSessionApi = async (firebaseUser: User) => {
    try {
      const sid = sessionIdRef.current || sessionStorage.getItem("hr-session-id");
      const token = await firebaseUser.getIdToken();
      await fetch("/api/sessions/end", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId: sid }),
      });
      sessionIdRef.current = null;
      sessionStorage.removeItem("hr-session-id");
    } catch {
      // Session tracking is non-blocking
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const profileDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        if (profileDoc.exists()) {
          setProfile(profileDoc.data() as UserProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    // Fetch profile and start session
    const profileDoc = await getDoc(doc(db, "users", cred.user.uid));
    if (profileDoc.exists()) {
      const userProfile = profileDoc.data() as UserProfile;
      setProfile(userProfile);
      await startSession(userProfile, cred.user);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    displayName: string,
    companyId: string,
    role: Role
  ) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const userProfile: UserProfile = {
      uid: cred.user.uid,
      email,
      displayName,
      role,
      companyId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await setDoc(doc(db, "users", cred.user.uid), {
      ...userProfile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setProfile(userProfile);
    return cred.user;
  };

  const signOut = async () => {
    if (user) {
      await endSessionApi(user);
    }
    await firebaseSignOut(auth);
    setProfile(null);
  };

  const hasRole = (requiredRole: Role): boolean => {
    if (!profile) return false;
    return ROLE_LEVEL[profile.role] >= ROLE_LEVEL[requiredRole];
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, signIn, signUp, signOut, hasRole }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
