// src/context/AuthContext.jsx
import useCartStore from "@/context/cartStore";
import { getUserProfile, onAuthChange } from "@/firebase/auth";
import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const initCart = useCartStore((s) => s.initCart);
  const clearUserId = useCartStore((s) => s.clearUserId);

  useEffect(() => {
    const unsub = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const prof = await getUserProfile(firebaseUser.uid);
        setProfile(prof);

        // Block deactivated outlets
        if (prof?.role === "outlet" && prof?.active === false) {
          await import("@/firebase/auth").then((m) => m.logoutUser());
          setUser(null);
          setProfile(null);
          setLoading(false);
          navigate("/login");
          return;
        }

        initCart(firebaseUser.uid);
      } else {
        setUser(null);
        setProfile(null);
        clearUserId();
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const refreshProfile = async () => {
    if (user) {
      const prof = await getUserProfile(user.uid);
      setProfile(prof);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isAdmin: profile?.role === "admin",
        isOutlet: profile?.role === "outlet",
        outletId: profile?.outletId || null,
        outletName: profile?.outletName || null,
        refreshProfile,
      }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
