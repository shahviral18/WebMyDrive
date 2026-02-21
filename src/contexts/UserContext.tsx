import { createContext, useContext, useState, useEffect, ReactNode } from "react";
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
    name?: string;          // display name from backend
    firstName?: string;
    lastName?: string;
    email: string;
    plan: string;
    role: "user" | "distributor";
    referralCode?: string;
    walletBalance?: number;
}

interface UserContextType {
    user: UserProfile;
    files: UserFile[];
    updateUser: (data: Partial<UserProfile>) => void;
    loginAs: (data: Partial<UserProfile>) => void;
    logout: () => void;
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

    // Hydrate auth strictly on load
    useEffect(() => {
        const token = sessionStorage.getItem("wmd_token") || localStorage.getItem("wmd_token");
        if (!token) {
            setIsLoadingAuth(false);
            return;
        }

        api.get("/auth/me")
            .then((data: any) => {
                const fetchedRole = (data?.user?.role || "user").toLowerCase();
                const isAdmin = fetchedRole === "admin" || fetchedRole === "superadmin";

                if (isAdmin) {
                    sessionStorage.setItem("wmd_admin_auth", "true");
                }

                setUser((prev) => ({
                    ...prev,
                    id: data?.user?.id,
                    name: data?.user?.name,
                    email: data?.user?.email || prev.email,
                    role: fetchedRole as any,
                    referralCode: data?.user?.referralCode,
                    walletBalance: data?.user?.walletBalance,
                }));
            })
            .catch(() => {
                // Invalid token
                localStorage.removeItem("wmd_token");
                sessionStorage.removeItem("wmd_token");
                sessionStorage.removeItem("wmd_user_auth");
                sessionStorage.removeItem("wmd_admin_auth");
                setUser(DEFAULT_USER);
            })
            .finally(() => {
                setIsLoadingAuth(false);
            });
    }, []);

    const updateUser = (data: Partial<UserProfile>) => {
        setUser((prev) => ({ ...prev, ...data }));
        toast.success("Profile updated successfully");
    };

    // Silent update — no toast (used during login)
    const loginAs = (data: Partial<UserProfile>) => {
        setUser((prev) => ({ ...prev, ...data }));
        // Persist to session
        if (data.email) sessionStorage.setItem("wmd_user_email", data.email);
        if (data.role) sessionStorage.setItem("wmd_user_role", data.role);
    };

    const logout = () => {
        setUser(DEFAULT_USER);
        setFiles([]);
        localStorage.removeItem("wmd_token");
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
        <UserContext.Provider value={{ user, files, updateUser, loginAs, logout, addFile, deleteFile, renameFile, isLoadingAuth }}>
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
