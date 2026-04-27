// csms-frontend/src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from "react";
import { authApi } from "@/lib/api";

export interface Admin {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  profile: string;
  organizationId: string;
  organizationName: string;
  organizationType: "school" | "company";
  isVerified: boolean;
  plan: string;
  authProvider?: "email" | "google";
}

interface AuthContextType {
  admin: Admin | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<Admin>;
  loginWithGoogle: () => Promise<Admin>;
  register: (data: RegisterData) => Promise<Admin>;
  logout: () => void;
  verifyEmail: (code: string) => Promise<boolean>;
  resendCode: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: (data: Partial<Admin>) => Promise<void>;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  password: string;
  orgName: string;
  orgType: "school" | "company";
  orgAddress: string;
  orgEmail: string;
  orgPhone: string;
  plan: string;
  billingCycle?: "monthly" | "yearly";
  province?: string;
  district?: string;
  apiSlug?: string;
  gender?: string;
  roleId?: string;
  profileImage?: string;
  logo?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

const mapOrgType = (value: unknown): "school" | "company" => {
  const normalized = String(value ?? "school").toLowerCase();
  if (normalized === "company" || normalized === "business") return "company";
  return "school";
};

const normalizeAdmin = (raw: Record<string, unknown>): Admin => {
  return {
    id: String(raw.id ?? ""),
    firstName: String(raw.firstName ?? raw.first_name ?? ""),
    lastName: String(raw.lastName ?? raw.last_name ?? ""),
    email: String(raw.email ?? ""),
    username: String(raw.username ?? ""),
    profile: String(raw.profile ?? "default.jpg"),
    organizationId: String(raw.organizationId ?? raw.organization_id ?? ""),
    organizationName: String(raw.organizationName ?? raw.organization_name ?? ""),
    organizationType: mapOrgType(raw.organizationType ?? raw.organization_type),
    isVerified: Boolean(raw.isVerified ?? raw.is_verified ?? false),
    plan: String(raw.plan ?? "free_trial"),
    authProvider: raw.authProvider as "email" | "google" || "email",
  };
};

const extractAuthPayload = (data: unknown): { admin: Admin; token?: string } => {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid auth response from server");
  }

  const payload = data as Record<string, unknown>;
  
  let adminRaw: Record<string, unknown>;
  let token: string | undefined;
  
  if (payload.admin && typeof payload.admin === "object") {
    adminRaw = payload.admin as Record<string, unknown>;
    token = typeof payload.token === "string" ? payload.token : undefined;
  } else {
    adminRaw = payload;
    token = typeof payload.token === "string" ? payload.token : undefined;
  }

  // Also check for authProvider in the response
  if (payload.authProvider) {
    adminRaw.authProvider = payload.authProvider;
  }

  if (!adminRaw.email && !adminRaw.id) {
    throw new Error("Missing admin details in auth response");
  }

  return {
    admin: normalizeAdmin(adminRaw),
    token,
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const storedAdmin = localStorage.getItem("csm_admin");
    const token = localStorage.getItem("csm_token");
    
    if (storedAdmin && token) {
      try {
        const parsedAdmin = JSON.parse(storedAdmin);
        setAdmin(parsedAdmin);
      } catch (e) {
        console.error("Error parsing stored admin:", e);
      }
    }
    
    const dm = localStorage.getItem("csm_darkmode") === "true";
    setDarkMode(dm);
    if (dm) document.documentElement.classList.add("dark");
    setIsLoading(false);
  }, []);

  const toggleDarkMode = () => {
    const newVal = !darkMode;
    setDarkMode(newVal);
    localStorage.setItem("csm_darkmode", String(newVal));
    document.documentElement.classList.toggle("dark", newVal);
  };

  const persistAdmin = (a: Admin, token?: string) => {
    setAdmin(a);
    localStorage.setItem("csm_admin", JSON.stringify(a));
    if (token) localStorage.setItem("csm_token", token);
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 1000));
        const mockAdmin: Admin = {
          id: "1", firstName: "Admin", lastName: "User", email, username: "admin",
          profile: "admin_default.jpg", organizationId: "1", organizationName: "Demo Organization",
          organizationType: "school", isVerified: true, plan: "free_trial", authProvider: "email",
        };
        persistAdmin(mockAdmin, "mock-token");
        return mockAdmin;
      } else {
        const res = await authApi.login(email, password);
        
        if (!res.success) {
          const errorMsg = res.error || "Login failed";
          throw new Error(errorMsg);
        }
        
        if (!res.data) {
          throw new Error("No data received from server");
        }
        
        const { admin: parsedAdmin, token } = extractAuthPayload(res.data);
        
        if (!token) {
          throw new Error("No authentication token received");
        }
        
        persistAdmin(parsedAdmin, token);
        return parsedAdmin;
      }
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    setIsLoading(true);
    try {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 1000));
        const mockAdmin: Admin = {
          id: "1", firstName: "Google", lastName: "User", email: "user@gmail.com",
          username: "googleuser", profile: "default.jpg", organizationId: "1",
          organizationName: "Demo Organization", organizationType: "school",
          isVerified: true, plan: "free_trial", authProvider: "google",
        };
        persistAdmin(mockAdmin, "mock-token");
        return mockAdmin;
      } else {
        throw new Error("Google sign-in is not yet implemented. Please use email/password.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterData) => {
    setIsLoading(true);
    try {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 1500));
        const newAdmin: Admin = {
          id: "1", 
          firstName: data.firstName, 
          lastName: data.lastName, 
          email: data.email,
          username: data.username, 
          profile: "admin_default.jpg", 
          organizationId: "1",
          organizationName: data.orgName, 
          organizationType: data.orgType,
          isVerified: false, 
          plan: data.plan,
          authProvider: "email",
        };
        persistAdmin(newAdmin, "mock-token");
        return newAdmin;
      } else {
        const res = await authApi.register(data as unknown as Record<string, unknown>);
        if (!res.success) {
          throw new Error(res.error || "Registration failed");
        }
        
        if (!res.data) {
          throw new Error("No data received from server");
        }
        
        const { admin: parsedAdmin, token } = extractAuthPayload(res.data);
        
        if (token) {
          persistAdmin(parsedAdmin, token);
        } else {
          setAdmin(parsedAdmin);
          localStorage.setItem("csm_admin", JSON.stringify(parsedAdmin));
        }
        
        return parsedAdmin;
      }
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (data: Partial<Admin>) => {
    setIsLoading(true);
    try {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 1000));
        if (admin) {
          const updatedAdmin = { ...admin, ...data };
          persistAdmin(updatedAdmin);
        }
        return;
      } else {
        const res = await authApi.updateProfile(data);
        if (!res.success) {
          throw new Error(res.error || "Failed to update profile");
        }
        
        if (admin) {
          const updatedAdmin = { ...admin, ...data };
          persistAdmin(updatedAdmin);
        }
      }
    } catch (error) {
      console.error("Update profile error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyEmail = async (code: string) => {
    if (!admin) {
      throw new Error("No admin data found");
    }
    
    if (USE_MOCK) {
      await new Promise((r) => setTimeout(r, 1000));
      if (code.length === 6) {
        const verified = { ...admin, isVerified: true };
        persistAdmin(verified);
        return true;
      }
      return false;
    } else {
      try {
        const res = await authApi.verifyEmail(code, admin.email);
        console.log("Verify email API response:", res);
        
        if (res.success) {
          const verified = { ...admin, isVerified: true };
          persistAdmin(verified);
          return true;
        }
        
        throw new Error(res.error || "Verification failed");
      } catch (error) {
        console.error("Verify email error:", error);
        throw error;
      }
    }
  };

  const resendCode = async () => {
    if (!admin) {
      throw new Error("No admin data found");
    }
    
    if (USE_MOCK) {
      await new Promise((r) => setTimeout(r, 1000));
    } else {
      const res = await authApi.resendCode(admin.email);
      if (!res.success) {
        throw new Error(res.error || "Failed to resend code");
      }
    }
  };

  const resetPassword = async (email: string) => {
    if (USE_MOCK) {
      await new Promise((r) => setTimeout(r, 1000));
    } else {
      const res = await authApi.forgotPassword(email);
      if (!res.success) {
        throw new Error(res.error || "Failed to send password reset link");
      }
    }
  };

  const logout = async () => {
    if (!USE_MOCK) {
      try {
        await authApi.logout();
      } catch (error) {
        console.error("Logout error:", error);
      }
    }
    setAdmin(null);
    localStorage.removeItem("csm_admin");
    localStorage.removeItem("csm_token");
    localStorage.removeItem("csm_refresh_token");
  };

  return (
    <AuthContext.Provider
      value={{
        admin,
        isAuthenticated: !!admin && admin.isVerified,
        isLoading,
        login,
        loginWithGoogle,
        register,
        logout,
        verifyEmail,
        resendCode,
        resetPassword,
        updateProfile,
        darkMode,
        toggleDarkMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};