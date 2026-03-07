import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Cloud, Eye, EyeOff, Lock, Mail, Loader2, Tag, ArrowLeft, KeyRound } from "lucide-react";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUser } from "@/contexts/UserContext";
import { useTheme } from "@/contexts/ThemeContext";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { ThemeSwitch } from "@/components/ui/theme-switch";

export default function Login() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { loginAs } = useUser();
    const { isDark, toggleTheme } = useTheme();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [shake, setShake] = useState(false);
    const [error, setError] = useState("");
    const [pendingRef, setPendingRef] = useState<string | null>(null);

    const [mode, setMode] = useState<"login" | "forgot" | "force_change">("login");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [pendingLoginData, setPendingLoginData] = useState<any>(null);
    const [isFirstLogin, setIsFirstLogin] = useState(false);

    useEffect(() => {
        const refFromUrl = searchParams.get("ref");
        if (refFromUrl) {
            const code = refFromUrl.toUpperCase();
            navigate(`/ref/${code}`, { replace: true });
            return;
        } else {
            const saved = localStorage.getItem("wmd_pending_ref");
            if (saved) setPendingRef(saved);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleThemeChange = (next: boolean) => {
        if (next !== isDark) toggleTheme();
    };

    const triggerShake = () => {
        setShake(true);
        setTimeout(() => setShake(false), 600);
    };

    const finishLoginProcessing = (token: string, user: any, role: string) => {
        // ── Admin / SuperAdmin: redirect to admin console immediately ──
        if (role === "ADMIN" || role === "SUPERADMIN") {
            sessionStorage.setItem("wmd_token", token);
            sessionStorage.setItem("wmd_admin_auth", "true");
            // Do NOT set wmd_user_auth or call loginAs — keep portals independent
            const base = import.meta.env.BASE_URL.replace(/\/$/, "");
            window.location.href = `${base}/admin/dashboard`;
            return;
        }

        localStorage.setItem("wmd_token", token);
        sessionStorage.setItem("wmd_user_auth", "true");
        sessionStorage.setItem("wmd_user_email", user.email);
        sessionStorage.setItem("wmd_user_role", role.toLowerCase());

        loginAs({
            id: user.id,
            name: user.name,
            email: user.email,
            role: role.toLowerCase() as "user" | "distributor",
            referralCode: user.referralCode,
            walletBalance: user.walletBalance,
        });

        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });

        if (role === "DISTRIBUTOR") {
            navigate("/distributor/dashboard");
        } else {
            const ref = pendingRef || localStorage.getItem("wmd_pending_ref");
            if (ref) {
                // Use public /plans route to avoid UserLayout's sessionStorage guard
                navigate(`/plans?ref=${encodeURIComponent(ref)}`);
            } else {
                navigate("/user/dashboard");
            }
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (!email || !password) {
            setError("Please fill in all fields.");
            triggerShake();
            return;
        }

        setLoading(true);
        try {
            const response = await api.post("/auth/login", { email, password });

            if (response.requiresPasswordChange) {
                setPendingLoginData(response);
                setIsFirstLogin(!!response.first_login); // Use server-sent first_login flag
                setMode("force_change");
                setNewPassword("");
                setConfirmPassword("");
                return;
            }

            const { token, user } = response;
            const role: string = user?.role || "";
            finishLoginProcessing(token, user, role);
        } catch (err: any) {
            const msg = err.message || "Invalid credentials";
            setError(msg);
            triggerShake();
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordAction = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (mode === "forgot" && !email) {
            setError("Please enter your email.");
            triggerShake();
            return;
        }

        if (newPassword.length < 8) {
            setError("Password must be at least 8 characters.");
            triggerShake();
            return;
        }

        if (newPassword !== confirmPassword) {
            setError("Passwords do not match.");
            triggerShake();
            return;
        }

        setLoading(true);
        try {
            // For force_change (first login or password reset required), use forgot-password
            // which doesn't need the current password and correctly clears first_login
            await api.post("/auth/forgot-password", {
                email: mode === "forgot" ? email : pendingLoginData?.user?.email,
                newPassword
            });

            if (mode === "force_change") {
                toast.success(isFirstLogin ? "Welcome! Password set. Logging you in…" : "Password updated successfully!");
                setIsFirstLogin(false);
                const { token, user } = pendingLoginData;
                finishLoginProcessing(token, user, user.role);
            } else {
                toast.success("Password updated successfully! Please login with your new password.");
                setMode("login");
                setPassword("");
            }
        } catch (err: any) {
            setError(err.message || "Failed to update password.");
            triggerShake();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center overflow-hidden gradient-bg-mesh">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-200/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-200/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
            </div>

            <div className="absolute top-6 right-6 z-50 flex items-center gap-3 px-4 py-2 rounded-full bg-background/40 backdrop-blur-md border border-border/50 shadow-sm">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Theme</span>
                <ThemeSwitch checked={isDark} onCheckedChange={handleThemeChange} size={12} ariaLabel="Toggle theme" />
            </div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className={`relative z-10 w-full max-w-md mx-4 ${shake ? "animate-shake" : ""}`}>
                <div className="bg-background/80 backdrop-blur-md rounded-2xl p-8 shadow-xl border border-border/50">

                    {mode === "login" && pendingRef && (
                        <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400">
                            <Tag className="w-5 h-5 shrink-0" />
                            <div>
                                <p className="text-sm font-semibold">Referral activated!</p>
                                <p className="text-xs opacity-80">Code <span className="font-mono font-bold">{pendingRef}</span> is queued — sign in to activate it.</p>
                            </div>
                        </div>
                    )}

                    <div className="text-center mb-8">
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1, type: "spring" }} className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary shadow-lg mb-4">
                            {mode === "login" ? <Cloud className="w-7 h-7 text-primary-foreground" /> : <KeyRound className="w-7 h-7 text-primary-foreground" />}
                        </motion.div>
                        <h1 className="text-2xl font-bold text-foreground tracking-tight">
                            {mode === "login" ? "WebMyDrive" : (mode === "force_change" ? (isFirstLogin ? "Welcome aboard! 🎉" : "Password Reset Required") : "Reset Password")}
                        </h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            {mode === "login" ? "Sign in to your account" : (mode === "force_change" ? (isFirstLogin ? "Set a secure password for your new @webmydrive.com account." : "Please set a new secure password to continue.") : "Enter your email and a new password")}
                        </p>
                    </div>

                    <AnimatePresence>
                        {error && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-4 px-3 py-2 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm font-medium">
                                {error}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {mode === "login" ? (
                        <form onSubmit={handleLogin} className="space-y-4">

                            <div className="text-center pb-2">
                                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Secure Access</span>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="email" className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Email</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input id="email" type="email" placeholder="you@webmydrive.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" className="pl-10 bg-card border-border focus:border-primary h-11" />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password" className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Password</Label>
                                    <button type="button" onClick={() => setMode("forgot")} className="text-xs text-primary font-semibold hover:underline">
                                        Forgot Password?
                                    </button>
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" className="pl-10 pr-10 bg-card border-border focus:border-primary h-11" />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold mt-2 shadow-lg transition-all hover:scale-[1.01]" disabled={loading}>
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
                            </Button>
                        </form>
                    ) : (
                        <form onSubmit={handlePasswordAction} className="space-y-4">
                            {mode === "forgot" && (
                                <div className="space-y-1.5">
                                    <Label htmlFor="reset-email" className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Email</Label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input id="reset-email" type="email" placeholder="you@webmydrive.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" className="pl-10 bg-card border-border focus:border-primary h-11" />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <Label htmlFor="new-password" className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">New Password</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input id="new-password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={newPassword} onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" className="pl-10 pr-10 bg-card border-border focus:border-primary h-11" />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="confirm-password" className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Confirm Password</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input id="confirm-password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" className="pl-10 pr-10 bg-card border-border focus:border-primary h-11" />
                                </div>
                            </div>

                            <div className="pt-2 flex flex-col gap-3">
                                <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold shadow-lg transition-all hover:scale-[1.01]" disabled={loading}>
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (mode === "force_change" ? "Save & Continue" : "Reset Password")}
                                </Button>
                                <Button type="button" variant="ghost" onClick={() => setMode("login")} className="w-full text-sm flex items-center gap-2 text-muted-foreground" disabled={loading}>
                                    <ArrowLeft className="w-4 h-4" /> Back to Login
                                </Button>
                            </div>
                        </form>
                    )}
                </div>

                <p className="text-center mt-6 text-xs text-muted-foreground">© 2026 WebMyDrive. All rights reserved.</p>
            </motion.div>
        </div>
    );
}
