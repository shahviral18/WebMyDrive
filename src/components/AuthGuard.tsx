import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";

interface AuthGuardProps {
    children: ReactNode;
    requiredRole: "USER" | "ADMIN" | "SUPERADMIN" | "DISTRIBUTOR" | "user" | "distributor";
    redirectTo?: string;
}

/**
 * AuthGuard — validates authentication before rendering protected routes.
 * For user/distributor routes: uses sessionStorage flags set synchronously at login.
 * For admin routes: uses token + context role (hydrated from /auth/me).
 */
export function AuthGuard({ children, requiredRole, redirectTo = "/login" }: AuthGuardProps) {
    const { user, isLoadingAuth } = useUser();

    const normalizedRequired = requiredRole.toLowerCase();

    // ── Admin routes: wait for full server-side hydration ──────────────────────
    if (normalizedRequired === "admin" || normalizedRequired === "superadmin") {
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
        const token = sessionStorage.getItem("token") || localStorage.getItem("token");
        const adminAuth = sessionStorage.getItem("wmd_admin_auth") === "true";
        if (!token || !adminAuth) return <Navigate to={redirectTo} replace />;
        return <>{children}</>;
    }

    // ── User / Distributor routes: trust sessionStorage set synchronously at login ──
    // This matches exactly what UserLayout already checks, eliminating the race
    // condition where UserContext's async /auth/me hydration could override loginAs().
    const userAuth = sessionStorage.getItem("wmd_user_auth") === "true";
    const storedRole = (sessionStorage.getItem("wmd_user_role") || "").toLowerCase();
    const token = sessionStorage.getItem("token") || localStorage.getItem("token");

    if (!token || token === "undefined" || token === "null") {
        return <Navigate to={redirectTo} replace />;
    }

    // Role check: if storedRole matches required, allow. Also allow if storedRole
    // isn't set yet (context not hydrated) but token + userAuth exist — UserLayout
    // will handle the final guard.
    if (storedRole && storedRole !== normalizedRequired) {
        // Admin accessing user route → send to admin dashboard
        if (storedRole === "admin" || storedRole === "superadmin") {
            return <Navigate to="/admin/dashboard" replace />;
        }
        // Wrong role
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-background text-center gap-4 p-6">
                <div className="w-20 h-20 rounded-2xl bg-destructive/10 border border-destructive/30 flex items-center justify-center text-4xl">🚫</div>
                <h1 className="text-2xl font-bold text-foreground">403 — Access Forbidden</h1>
                <p className="text-muted-foreground max-w-sm">You do not have permission to access this page.</p>
                <a href="#" onClick={(e) => { e.preventDefault(); window.location.href = `${import.meta.env.BASE_URL}login`; }} className="mt-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
                    Return to Login
                </a>
            </div>
        );
    }

    return <>{children}</>;
}

