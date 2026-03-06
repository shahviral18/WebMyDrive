import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Eye, EyeOff, Lock, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeSwitch } from "@/components/ui/theme-switch";
import { api } from "@/lib/api";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { isDark, toggleTheme } = useTheme();
  const handleThemeChange = (next: boolean) => {
    if (next !== isDark) toggleTheme();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    setLoading(true);
    try {
      const data = await api.post("/auth/login", { email, password });

      const role = data.user?.role;
      if (role !== "ADMIN" && role !== "SUPERADMIN") {
        throw new Error("Access denied. Admin role required.");
      }

      sessionStorage.setItem("wmd_token", data.token);
      sessionStorage.setItem("wmd_admin_auth", "true");

      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      window.location.href = `${base}/admin/dashboard`;
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden gradient-bg-mesh">
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full"
          style={{ background: "radial-gradient(circle, hsl(243 75% 59% / 0.12) 0%, transparent 70%)", top: "-10%", left: "-10%" }}
          animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full"
          style={{ background: "radial-gradient(circle, hsl(280 60% 50% / 0.08) 0%, transparent 70%)", bottom: "-10%", right: "-10%" }}
          animate={{ x: [0, -30, 0], y: [0, -40, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Grid overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{ backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "48px 48px" }}
      />

      {/* Theme toggle */}
      <div className="absolute top-4 right-4 z-50">
        <ThemeSwitch checked={isDark} onCheckedChange={handleThemeChange} size={12} ariaLabel="Toggle theme" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        <div className="glass rounded-2xl p-8 shadow-card border border-border/50">
          {/* Header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 mb-4 glow-primary"
            >
              <Shield className="w-7 h-7 text-primary" />
            </motion.div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Admin Login</h1>
            <p className="text-muted-foreground text-sm mt-1">WebMyDrive · Super-admin access</p>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 px-3 py-2 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Login form */}
          <div className="space-y-4">
            {/* Google Sign In */}
            <GoogleSignInButton
              label="Continue with Google"
              onSuccess={({ token, user }) => {
                const role = user?.role;
                if (role !== "ADMIN" && role !== "SUPERADMIN") {
                  setError("Access denied. Admin role required.");
                  return;
                }
                sessionStorage.setItem("wmd_token", token);
                sessionStorage.setItem("wmd_admin_auth", "true");
                window.location.href = "/admin/dashboard";
              }}
              onError={(msg) => setError(msg)}
            />

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border/50" />
              <span className="text-xs text-muted-foreground font-medium">or sign in with email</span>
              <div className="flex-1 h-px bg-border/50" />
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <Label htmlFor="admin-email" className="text-muted-foreground text-xs uppercase tracking-wider">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="admin@webmydrive.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="username"
                  className="pl-10 bg-surface-2 border-border/50 focus:border-primary/50 h-11"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="admin-password" className="text-muted-foreground text-xs uppercase tracking-wider">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="pl-10 pr-10 bg-surface-2 border-border/50 focus:border-primary/50 h-11"
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
              className="w-full h-11 bg-primary hover:bg-primary/90 glow-primary font-semibold mt-2"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
            </Button>
          </form>

          {/* Demo credentials */}
          <div className="mt-6 pt-4 border-t border-border/50">
            <p className="text-xs text-muted-foreground text-center mb-3 uppercase tracking-wider font-semibold">Demo Credentials</p>
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => { setEmail("admin@webmydrive.com"); setPassword("admin123"); }}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-lg bg-primary/5 hover:bg-primary/10 border border-primary/20 hover:border-primary/40 text-left transition-all group"
              >
                <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">SA</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground">Super Admin</p>
                  <p className="text-[11px] text-muted-foreground font-mono truncate">admin@webmydrive.com · admin123</p>
                </div>
                <span className="ml-auto text-[10px] text-muted-foreground group-hover:text-primary transition-colors shrink-0">Click to fill</span>
              </button>
            </div>
          </div>

          <div className="text-center mt-4">
            <a href="/login" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              Switch to Customer Portal
            </a>
          </div>
        </div>

        {/* Trust badge */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground"
        >
          <Shield className="w-3 h-3" />
          <span>Secured by WebMyDrive · 256-bit AES</span>
        </motion.div>
      </motion.div>
    </div>
  );
}
