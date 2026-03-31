import { Navigate } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { useUser } from "@/contexts/UserContext";

/**
 * ProtectedLayout — guards all /admin/* routes.
 * Relies on UserContext for centralized auth hydration.
 * Only ADMIN and SUPERADMIN roles may access.
 */
export default function ProtectedLayout() {
  const { user, isLoadingAuth } = useUser();

  if (isLoadingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Verifying admin session…</p>
        </div>
      </div>
    );
  }

  const token = sessionStorage.getItem("token") || localStorage.getItem("token");
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const role = (user.role || "").toUpperCase();
  const isForbidden = role !== "ADMIN" && role !== "SUPERADMIN";

  if (isForbidden) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-center gap-4 p-6">
        <div className="w-20 h-20 rounded-2xl bg-destructive/10 border border-destructive/30 flex items-center justify-center text-4xl">🚫</div>
        <h1 className="text-2xl font-bold text-foreground">403 — Access Forbidden</h1>
        <p className="text-muted-foreground max-w-sm">This area is restricted to Admin and SuperAdmin accounts only.</p>
        <a href="/login" className="mt-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
          Return to Login
        </a>
      </div>
    );
  }

  return <AdminLayout />;
}

export function setAdminAuthenticated() {
  sessionStorage.setItem("wmd_admin_auth", "true");
}

export function clearAdminAuthenticated() {
  sessionStorage.removeItem("wmd_admin_auth");
  sessionStorage.removeItem("token");
}
