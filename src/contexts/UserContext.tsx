import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";

export interface UserFile {
    id: number;
    name: string;
    type: "folder" | "file";
    date: string;
    size: string;
    icon?: any;
    color?: string;
}

export interface UserProfile {
    id?: number;
    name?: string;
    firstName?: string;
    lastName?: string;
    email: string;
    plan: string;
    role: "user" | "distributor";
    referralCode?: string;
    walletBalance?: number;
    workspace?: { status: string; planId?: number; plan?: { name: string } } | null;
}

interface UserContextType {
    user: UserProfile;
    files: UserFile[];
    updateUser: (data: Partial<UserProfile>) => void;
    loginAs: (data: Partial<UserProfile>) => void;
    logout: () => void;
    refreshUser: () => Promise<void>;
    addFile: (file: UserFile) => void;
    deleteFile: (id: number) => void;
    renameFile: (id: number, newName: string) => void;
    isLoadingAuth: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const DEFAULT_USER: UserProfile = {
    name: "",
    firstName: "",
    lastName: "",
    email: sessionStorage.getItem("wmd_user_email") || "",
    plan: "",
    role: (sessionStorage.getItem("wmd_user_role") as "user" | "distributor") || "user",
};

export function UserProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<UserProfile>(DEFAULT_USER);
    const [files, setFiles] = useState<UserFile[]>([]);
    const [isLoadingAuth, setIsLoadingAuth] = useState(true);

    const applyMeResponse = (data: any) => {
        const fetchedRole = (data?.user?.role || "user").toLowerCase();
        const isAdmin = fetchedRole === "admin" || fetchedRole === "superadmin";
        if (isAdmin) sessionStorage.setItem("wmd_admin_auth", "true");

        setUser((prev) => ({
            ...prev,
            id: data?.user?.id,
            name: data?.user?.name,
            email: data?.user?.email || prev.email,
            role: fetchedRole as any,
            referralCode: data?.user?.referralCode,
            walletBalance: data?.user?.walletBalance,
            workspace: data?.user?.workspace ?? prev.workspace,
        }));
    };

    // Full refresh from /auth/me — call this after payments, referrals, etc.
    const refreshUser = useCallback(async () => {
        const token = sessionStorage.getItem("token") || localStorage.getItem("token");
        if (!token) return;
        try {
            const data = await api.get("/auth/me");
            applyMeResponse(data);
        } catch {
            // Token expired or invalid — swallow silently
        }
    }, []);

    // Hydrate on mount
    useEffect(() => {
        const token = sessionStorage.getItem("token") || localStorage.getItem("token");
        if (!token) {
            setIsLoadingAuth(false);
            return;
        }

        api.get("/auth/me")
            .then(applyMeResponse)
            .catch(() => {
                if (token.startsWith("DEMO_")) {
                    const demoEmail = localStorage.getItem("wmd_demo_email") || sessionStorage.getItem("wmd_demo_email") || "demo@webmydrive.com";
                    applyMeResponse({
                        user: { id: 999999, email: demoEmail, name: demoEmail.split("@")[0], role: "USER", walletBalance: 0, referralCode: "DEMO123", workspace: { status: "ACTIVE", plan: { name: "Pro" } } }
                    });
                } else if (sessionStorage.getItem("wmd_user_auth") === "true" || sessionStorage.getItem("wmd_admin_auth") === "true") {
                    // Fallback to session data instead of logging out
                    const role = sessionStorage.getItem("wmd_user_role") || "user";
                    const email = sessionStorage.getItem("wmd_user_email") || "";
                    applyMeResponse({
                        user: { email, name: email.split("@")[0], role }
                    });
                } else {
                    localStorage.removeItem("token");
                    sessionStorage.removeItem("token");
                    sessionStorage.removeItem("wmd_user_auth");
                    sessionStorage.removeItem("wmd_admin_auth");
                    setUser(DEFAULT_USER);
                }
            })
            .finally(() => {
                setIsLoadingAuth(false);
            });

        // Refresh wallet/profile every 60 seconds while logged in
        const interval = setInterval(refreshUser, 60000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const updateUser = (data: Partial<UserProfile>) => {
        setUser((prev) => ({ ...prev, ...data }));
        toast.success("Profile updated successfully");
    };

    const loginAs = (data: Partial<UserProfile>) => {
        setUser((prev) => ({ ...prev, ...data }));
        if (data.email) sessionStorage.setItem("wmd_user_email", data.email);
        if (data.role) sessionStorage.setItem("wmd_user_role", data.role);
    };

    const logout = () => {
        setUser(DEFAULT_USER);
        setFiles([]);
        localStorage.removeItem("token");
        sessionStorage.removeItem("wmd_user_auth");
        sessionStorage.removeItem("wmd_user_email");
        sessionStorage.removeItem("wmd_user_role");
        sessionStorage.removeItem("wmd_admin_auth");
    };

    const addFile = (file: UserFile) => {
        setFiles((prev) => [file, ...prev]);
        toast.success(`File "${file.name}" uploaded`);
    };

    const deleteFile = (id: number) => {
        setFiles((prev) => prev.filter((f) => f.id !== id));
        toast.success("Item deleted");
    };

    const renameFile = (id: number, newName: string) => {
        setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, name: newName } : f)));
        toast.success("Item renamed");
    };

    return (
        <UserContext.Provider value={{ user, files, updateUser, loginAs, logout, refreshUser, addFile, deleteFile, renameFile, isLoadingAuth }}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error("useUser must be used within a UserProvider");
    }
    return context;
}
