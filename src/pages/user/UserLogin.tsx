import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Cloud, Eye, EyeOff, Lock, Mail, Loader2, Sun, Moon } from "lucide-react";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUser } from "@/contexts/UserContext";
import { api } from "@/lib/api";

export default function Login() {
    const navigate = useNavigate();
    const { loginAs } = useUser();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [shake, setShake] = useState(false);
    const [error, setError] = useState("");
    const [isDark, setIsDark] = useState(true);

    useEffect(() => {
        setIsDark(document.documentElement.classList.contains("dark"));
    }, []);

    const toggleTheme = () => {
        const next = !isDark;
        setIsDark(next);
        document.documentElement.classList.toggle("dark", next);
    };

    const triggerShake = () => {
        setShake(true);
        setTimeout(() => setShake(false), 600);
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
            const { token, user } = response;

            const role: string = user?.role || "";

            if (role === "ADMIN" || role === "SUPERADMIN") {
                // Admin path — store in sessionStorage
                sessionStorage.setItem("wmd_token", token);
                sessionStorage.setItem("wmd_admin_auth", "true");
                navigate("/admin/dashboard");
                return;
            }

            // User / Distributor path — store in localStorage
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
                navigate("/user/dashboard");
            }
        } catch (err: any) {
            setError(err.message || "Invalid credentials. Please try again.");
            triggerShake();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center overflow-hidden gradient-bg-mesh">
            {/* Background blobs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-200/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-200/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
            </div>

            {/* Theme toggle */}
            <div className="absolute top-4 right-4 z-50">
                <Button
                    variant="outline" size="icon"
                    onClick={toggleTheme}
                    className="bg-card/50 backdrop-blur border-border/50 text-foreground hover:bg-muted"
                >
                    {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </Button>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className={`relative z-10 w-full max-w-md mx-4 ${shake ? "animate-shake" : ""}`}
            >
                <div className="bg-background/80 backdrop-blur-md rounded-2xl p-8 shadow-xl border border-border/50">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.1, type: "spring" }}
                            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary shadow-lg mb-4"
                        >
                            <Cloud className="w-7 h-7 text-primary-foreground" />
                        </motion.div>
                        <h1 className="text-2xl font-bold text-foreground tracking-tight">WebMyDrive</h1>
                        <p className="text-muted-foreground text-sm mt-1">Sign in to your account</p>
                    </div>

                    {/* Error */}
                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mb-4 px-3 py-2 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm font-medium"
                            >
                                {error}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="email" className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                                Email
                            </Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="you@webmydrive.com"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    autoComplete="username"
                                    className="pl-10 bg-card border-border focus:border-primary h-11"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="password" className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                                Password
                            </Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    autoComplete="current-password"
                                    className="pl-10 pr-10 bg-card border-border focus:border-primary h-11"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold mt-2 shadow-lg transition-all hover:scale-[1.01]"
                            disabled={loading}
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
                        </Button>
                    </form>
                </div>

                <p className="text-center mt-6 text-xs text-muted-foreground">
                    © 2026 WebMyDrive. All rights reserved.
                </p>
            </motion.div>
        </div>
    );
}
