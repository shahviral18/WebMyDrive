import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";

interface AuthGuardProps {
    children: ReactNode;
    requiredRole: "USER" | "ADMIN" | "SUPERADMIN" | "DISTRIBUTOR" | "user" | "distributor";
    redirectTo?: string;
}

/**
 * AuthGuard — validates JWT token server-side via UserContext.
 * Uses centralized hydration to prevent flash of content.
 */
export function AuthGuard({ children, requiredRole, redirectTo = "/login" }: AuthGuardProps) {
    const { user, isLoadingAuth } = useUser();

    if (isLoadingAuth) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-muted-foreground">Verifying session…</p>
                </div>
            </div>
        );
    }

    const token = sessionStorage.getItem("wmd_token") || localStorage.getItem("wmd_token");
    if (!token) {
        return <Navigate to={redirectTo} replace />;
    }

    const normalizedRole = (user.role || "").toLowerCase();
    const normalizedRequired = requiredRole.toLowerCase();

    // Check permissions strictly synchronously since auth is hydrated
    let isForbidden = true;
    if (normalizedRequired === "admin" || normalizedRequired === "superadmin") {
        if (normalizedRole === "admin" || normalizedRole === "superadmin") {
            isForbidden = false;
        }
    } else if (normalizedRole === normalizedRequired) {
        isForbidden = false;
    }

    if (isForbidden) {
        // If the user is an admin trying to access a user/distributor route,
        // redirect them to the admin dashboard instead of showing a confusing 403.
        if (normalizedRole === "admin" || normalizedRole === "superadmin") {
            return <Navigate to="/admin/dashboard" replace />;
        }

        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-background text-center gap-4 p-6">
                <div className="w-20 h-20 rounded-2xl bg-destructive/10 border border-destructive/30 flex items-center justify-center text-4xl">🚫</div>
                <h1 className="text-2xl font-bold text-foreground">403 — Access Forbidden</h1>
                <p className="text-muted-foreground max-w-sm">You do not have permission to access this page.</p>
                <a href="/login" className="mt-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
                    Return to Login
                </a>
            </div>
        );
    }

    return <>{children}</>;
}
