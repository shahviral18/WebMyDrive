import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import AdminLogin from "./pages/admin/Login";
import ProtectedLayout from "./pages/admin/ProtectedLayout";
import Dashboard from "./pages/admin/Dashboard";
import AuditLogs from "./pages/admin/AuditLogs";
import Users from "./pages/admin/Users";
import Plans from "./pages/admin/Plans";
import Alerts from "./pages/admin/Alerts";
import Billing from "./pages/admin/Billing";
import Distributors from "./pages/admin/Distributors";
import ReferralEngine from "./pages/admin/ReferralEngine";
import Settings from "./pages/admin/Settings";
import PricingPage from "./pages/PricingPage";
import Subscribe from "./pages/Subscribe";
import SubscribeUsername from "./pages/SubscribeUsername";
import PaymentSuccess from "./pages/PaymentSuccess";
import Resell from "./pages/Resell";
import DistributorApplications from "./pages/admin/DistributorApplications";
import ChangePlan from "./pages/admin/ChangePlan";
import UserLogin from "./pages/user/UserLogin";
import UserDashboard from "./pages/user/UserDashboard";
import UserFiles from "./pages/user/UserFiles";
import UserBilling from "./pages/user/UserBilling";
import UserPlans from "./pages/user/UserPlans";
import UserReferrals from "./pages/user/UserReferrals";
import UserSettings from "./pages/user/UserSettings";
import DistributorDashboard from "./pages/distributor/DistributorDashboard";
import DistributorReferrals from "./pages/distributor/DistributorReferrals";
import DistributorEarnings from "./pages/distributor/DistributorEarnings";
import DistributorWallet from "./pages/distributor/DistributorWallet";
import DistributorCustomers from "./pages/distributor/DistributorCustomers";
import DistributorPayouts from "./pages/distributor/DistributorPayouts";
import DistributorMarketing from "./pages/distributor/DistributorMarketing";
import { UserProvider } from "@/contexts/UserContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthGuard } from "@/components/AuthGuard";
import ReferralRedirect from "./pages/ref/ReferralRedirect";
import AccountActivate from "./pages/AccountActivate";
import { GoogleOAuthProvider } from "@react-oauth/google";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center gap-3 p-8">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-border flex items-center justify-center text-2xl">🚧</div>
      <h2 className="text-xl font-bold text-foreground">{label}</h2>
      <p className="text-muted-foreground text-sm">This page is coming soon in Phase 2.</p>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner richColors position="top-right" />
      <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || "337424619711-d1c8p7gkvn2d61h72o91l24t12j6v2n7.apps.googleusercontent.com"}>
        <BrowserRouter basename="/demo1">
          <ThemeProvider>
            <UserProvider>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/pricing" element={<Navigate to="/" replace />} />
                <Route path="/features" element={<Navigate to="/" replace />} />
                <Route path="/faq" element={<Navigate to="/" replace />} />
                <Route path="/contact" element={<Navigate to="/" replace />} />
                <Route path="/subscribe/:planSlug" element={<Subscribe />} />
                <Route path="/subscribe/:planSlug/username" element={<SubscribeUsername />} />
                <Route path="/payment/success" element={<PaymentSuccess />} />
                <Route path="/resell" element={<Resell />} />
                <Route path="/activate" element={<AccountActivate />} />
                <Route path="/plans" element={<UserPlans />} />
                <Route path="/ref/:code" element={<ReferralRedirect />} />

                {/* ── Legacy / shorthand redirects ─────────────────────────────── */}
                <Route path="/dashboard" element={<Navigate to="/user/dashboard" replace />} />
                <Route path="/referrals" element={<Navigate to="/user/referrals" replace />} />
                <Route path="/billing" element={<Navigate to="/user/billing" replace />} />
                <Route path="/settings" element={<Navigate to="/user/settings" replace />} />
                <Route path="/files" element={<Navigate to="/user/files" replace />} />

                {/* ── Shared Login ─────────────────────────────────────────────── */}
                <Route path="/login" element={<UserLogin />} />
                <Route path="/user/login" element={<UserLogin />} />

                {/* ── USER Portal — auth-guarded ────────────────────────────────── */}
                <Route path="/user" element={<Navigate to="/user/dashboard" replace />} />
                <Route path="/user/dashboard" element={
                  <AuthGuard requiredRole="user" redirectTo="/login">
                    <UserDashboard />
                  </AuthGuard>
                } />
                <Route path="/user/files" element={
                  <AuthGuard requiredRole="user" redirectTo="/login">
                    <UserFiles />
                  </AuthGuard>
                } />
                <Route path="/user/plans" element={
                  <AuthGuard requiredRole="user" redirectTo="/login">
                    <UserPlans />
                  </AuthGuard>
                } />
                <Route path="/user/referrals" element={
                  <AuthGuard requiredRole="user" redirectTo="/login">
                    <UserReferrals />
                  </AuthGuard>
                } />
                <Route path="/user/billing" element={
                  <AuthGuard requiredRole="user" redirectTo="/login">
                    <UserBilling />
                  </AuthGuard>
                } />
                <Route path="/user/settings" element={
                  <AuthGuard requiredRole="user" redirectTo="/login">
                    <UserSettings />
                  </AuthGuard>
                } />
                {/* Catch-all for unknown /user/* paths */}
                <Route path="/user/*" element={<Navigate to="/login" replace />} />

                {/* ── DISTRIBUTOR Portal — auth-guarded ────────────────────────── */}
                <Route path="/distributor" element={<Navigate to="/distributor/dashboard" replace />} />
                <Route path="/distributor/dashboard" element={
                  <AuthGuard requiredRole="distributor" redirectTo="/login">
                    <DistributorDashboard />
                  </AuthGuard>
                } />
                <Route path="/distributor/referrals" element={
                  <AuthGuard requiredRole="distributor" redirectTo="/login">
                    <DistributorReferrals />
                  </AuthGuard>
                } />
                <Route path="/distributor/earnings" element={
                  <AuthGuard requiredRole="distributor" redirectTo="/login">
                    <DistributorEarnings />
                  </AuthGuard>
                } />
                <Route path="/distributor/wallet" element={
                  <AuthGuard requiredRole="distributor" redirectTo="/login">
                    <DistributorWallet />
                  </AuthGuard>
                } />
                <Route path="/distributor/customers" element={
                  <AuthGuard requiredRole="distributor" redirectTo="/login">
                    <DistributorCustomers />
                  </AuthGuard>
                } />
                <Route path="/distributor/plans" element={
                  <AuthGuard requiredRole="distributor" redirectTo="/login">
                    <UserPlans />
                  </AuthGuard>
                } />
                <Route path="/distributor/payouts" element={
                  <AuthGuard requiredRole="distributor" redirectTo="/login">
                    <DistributorPayouts />
                  </AuthGuard>
                } />
                <Route path="/distributor/marketing" element={
                  <AuthGuard requiredRole="distributor" redirectTo="/login">
                    <DistributorMarketing />
                  </AuthGuard>
                } />
                {/* Catch-all for unknown /distributor/* paths */}
                <Route path="/distributor/*" element={<Navigate to="/login" replace />} />

                {/* ── ADMIN Console — JWT-guarded via ProtectedLayout ───────────── */}
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin" element={<ProtectedLayout />}>
                  <Route index element={<Navigate to="/admin/dashboard" replace />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="users" element={<Users />} />
                  <Route path="plans" element={<Plans />} />
                  <Route path="orders" element={<Billing />} />
                  <Route path="referral-engine" element={<ReferralEngine />} />
                  <Route path="distributors" element={<Distributors />} />
                  <Route path="distributor-applications" element={<DistributorApplications />} />
                  <Route path="change-plan" element={<ChangePlan />} />
                  <Route path="audit-logs" element={<AuditLogs />} />
                  <Route path="alerts" element={<Alerts />} />
                  <Route path="settings" element={<Settings />} />
                  {/* Legacy redirects */}
                  <Route path="promo" element={<Navigate to="/admin/referral-engine" replace />} />
                  <Route path="referrals-engine" element={<Navigate to="/admin/referral-engine" replace />} />
                  <Route path="queues" element={<ComingSoon label="Queues & Jobs" />} />
                  <Route path="controls" element={<ComingSoon label="Feature Controls" />} />
                </Route>

                {/* Global catch-all */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </UserProvider>
          </ThemeProvider>
        </BrowserRouter>
      </GoogleOAuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
