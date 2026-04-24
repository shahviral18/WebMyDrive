import { useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Mail, HardDrive, Image, ExternalLink, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeSwitch } from "@/components/ui/theme-switch";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const { isDark, toggleTheme } = useTheme();
  const [ready, setReady] = useState(false);

  // Zoho appends reference_number to the redirect URL
  const ref = params.get("reference_number") || params.get("ref") || "";

  // Customer info: passed via query params (from success_url) or fallback to sessionStorage
  const stored = (() => { try { return JSON.parse(sessionStorage.getItem("wmd_pending_payment") || "{}"); } catch { return {}; } })();
  const email   = params.get("email")  || stored.email   || "";
  const name    = params.get("name")   || stored.firstName || "there";
  const wsEmail = params.get("ws")     || stored.wsEmail  || "";

  useEffect(() => {
    if (!ref) { setReady(true); return; }
    sessionStorage.removeItem("wmd_pending_payment");
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const data = await api.get(`/payment/status?ref=${encodeURIComponent(ref)}`);
        if (data.status === "COMPLETED" || data.status === "FAILED") {
          clearInterval(interval);
          setReady(true);
        }
      } catch { /* keep polling */ }
      if (attempts >= 30) { clearInterval(interval); setReady(true); }
    }, 2000);
    return () => clearInterval(interval);
  }, [ref]);

  const services = [
    { label: "Gmail",         href: "https://mail.google.com",    icon: Mail,      color: "text-red-500" },
    { label: "Google Drive",  href: "https://drive.google.com",   icon: HardDrive, color: "text-blue-500" },
    { label: "Google Photos", href: "https://photos.google.com",  icon: Image,     color: "text-green-500" },
  ];

  if (!ready) return (
    <div className={cn("min-h-screen bg-[#f8fbff] flex flex-col items-center justify-center gap-4", isDark && "bg-slate-950")}>
      <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
      <p className="text-slate-500 text-sm font-medium">Setting up your account…</p>
      <p className="text-slate-400 text-xs">This usually takes just a few seconds</p>
    </div>
  );

  return (
    <div className={cn("min-h-screen bg-[#f8fbff] flex flex-col items-center justify-center px-4 pb-20", isDark && "bg-slate-950")}>
      <div className="fixed top-4 right-4 z-50">
        <ThemeSwitch checked={isDark} onCheckedChange={toggleTheme} size={12} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg w-full"
      >
        {/* Success header */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center mb-6">
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Congratulations, {name}! 🎉
          </h1>
          <p className="text-slate-600 text-sm leading-relaxed">
            Your WebMyDrive account has been successfully created.
            {wsEmail && (
              <> Your login email is <span className="font-semibold text-slate-800">{wsEmail}</span>.</>
            )}
          </p>
        </div>

        {/* Access links */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
            Access your services
          </h2>
          <div className="space-y-3">
            {services.map(({ label, href, icon: Icon, color }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <Icon className={cn("w-5 h-5", color)} />
                  <span className="text-slate-700 font-medium text-sm">{label}</span>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors" />
              </a>
            ))}
          </div>
        </div>

        {/* Temporary password notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800 mb-1">Check your email for your temporary password</p>
              <p className="text-xs text-amber-700 leading-relaxed">
                We sent your temporary password to <span className="font-medium">{email || "your registered email"}</span>.
                If you don't see it, check your <span className="font-medium">Spam / Junk</span> folder.
              </p>
              <p className="text-xs text-amber-700 mt-2">
                You will be asked to set a new password when you first log in.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <Button
          onClick={() => window.location.href = "/demo1/user/dashboard"}
          className="w-full h-12 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl shadow-md shadow-blue-500/10"
        >
          Go to Dashboard
        </Button>

        <p className="text-center text-[11px] text-slate-400 mt-4 italic">Powered by WebMyDrive Platform</p>
      </motion.div>
    </div>
  );
}
