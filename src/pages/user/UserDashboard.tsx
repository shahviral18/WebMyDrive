import { useState, useEffect, useRef } from "react";
import {
    Copy,
    AtSign,
    CheckCircle2,
    XCircle,
    Loader2,
    RefreshCw,
    HardDrive,
    ExternalLink,
    Star,
    FolderOpen,
    Clock,
    Users2,
    Trash2,
    Mail,
    Video,
    AlertCircle,
    ShieldAlert,
    ShieldCheck,
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import UserLayout from "@/components/user/UserLayout";
import { useUser } from "@/contexts/UserContext";
import { api } from "@/lib/api";
import { toast } from "sonner";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
    if (!bytes) return "0 B";
    const gb = bytes / (1024 ** 3);
    if (gb >= 1) return gb.toFixed(2) + " GB";
    const mb = bytes / (1024 ** 2);
    if (mb >= 1) return mb.toFixed(1) + " MB";
    return (bytes / 1024).toFixed(0) + " KB";
}

function refLink(code: string): string {
    const base = import.meta.env.BASE_URL.replace(/\/$/, ""); // e.g. "/demo1"
    return `${window.location.origin}${base}/ref/${code}`;
}

// ── Google Drive shortcut rows ────────────────────────────────────────────────

const DRIVE_SHORTCUTS = [
    { label: "Recent Files",    icon: Clock,    href: "https://drive.google.com/drive/recent" },
    { label: "Shared with Me",  icon: Users2,   href: "https://drive.google.com/drive/shared-with-me" },
    { label: "Starred",         icon: Star,     href: "https://drive.google.com/drive/starred" },
    { label: "Trash",           icon: Trash2,   href: "https://drive.google.com/drive/trash" },
];

const APP_SHORTCUTS = [
    { label: "Google Drive",    icon: FolderOpen, href: "https://drive.google.com/drive/home",   color: "text-primary" },
    { label: "Gmail",           icon: Mail,       href: "https://mail.google.com/mail/",         color: "text-red-500" },
    { label: "Google Meet",     icon: Video,      href: "https://meet.google.com/",              color: "text-green-600" },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function UserDashboard() {
    const { user } = useUser();

    const rawName = user.name || (user.email ? user.email.split("@")[0] : "User");
    const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    const currentPlanName = user.workspace?.plan?.name ?? "";
    const isHighestPlan = currentPlanName.toLowerCase().includes("enterprise plus");

    // ── WMD ID setup dialog ───────────────────────────────────────────────────
    type IdCheckStatus = "idle" | "checking" | "available" | "taken";
    const [wmdIdInput, setWmdIdInput] = useState("");
    const [idCheckStatus, setIdCheckStatus] = useState<IdCheckStatus>("idle");
    const [idSuggestions, setIdSuggestions] = useState<string[]>([]);
    const [chosenWmdEmail, setChosenWmdEmail] = useState("");
    const [submittingId, setSubmittingId] = useState(false);
    const idCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const needsWmdId = user.workspace?.status === "ACTIVE" && user.email && !user.email.endsWith("@webmydrive.com");

    const normalizeIdInput = (raw: string) =>
        raw.includes("@") ? raw.split("@")[0].toLowerCase().trim() : raw.toLowerCase().trim();

    const checkIdAvailability = async (username: string) => {
        if (!username) { setIdCheckStatus("idle"); setIdSuggestions([]); return; }
        setIdCheckStatus("checking");
        setIdSuggestions([]);
        try {
            const res = await api.get(`/user/check-username?u=${encodeURIComponent(username)}`);
            if (res.available) {
                setIdCheckStatus("available");
                setChosenWmdEmail(res.email);
                setIdSuggestions([]);
            } else {
                setIdCheckStatus("taken");
                setChosenWmdEmail("");
                setIdSuggestions(res.suggestions || []);
            }
        } catch {
            setIdCheckStatus("idle");
        }
    };

    const handleWmdIdChange = (value: string) => {
        const local = normalizeIdInput(value);
        setWmdIdInput(local);
        setIdCheckStatus("idle");
        setChosenWmdEmail("");
        setIdSuggestions([]);
        if (idCheckTimerRef.current) clearTimeout(idCheckTimerRef.current);
        if (!local) return;
        idCheckTimerRef.current = setTimeout(() => checkIdAvailability(local), 600);
    };

    const handleSuggestionSelect = (suggestedEmail: string) => {
        const local = suggestedEmail.split("@")[0];
        setWmdIdInput(local);
        setIdCheckStatus("available");
        setChosenWmdEmail(suggestedEmail);
        setIdSuggestions([]);
    };

    const handleConfirmWmdId = async () => {
        if (!chosenWmdEmail || idCheckStatus !== "available") return;
        setSubmittingId(true);
        try {
            const username = chosenWmdEmail.split("@")[0];
            await api.post("/auth/setup-webmydrive-id", { username });
            toast.success("ID created! Please log in with your new email and password 'Test_1123'.");
            localStorage.removeItem("token");
            sessionStorage.removeItem("token");
            sessionStorage.removeItem("wmd_user_auth");
            sessionStorage.removeItem("wmd_user_email");
            setTimeout(() => { window.location.href = `${import.meta.env.BASE_URL}login`; }, 2000);
        } catch (e: any) {
            toast.error(e.message || "Failed to set up ID");
            setSubmittingId(false);
        }
    };

    // ── Storage ───────────────────────────────────────────────────────────────
    type StorageData = { used: number; limit: number; source?: string; breakdown?: { drive: number; driveTrash: number; mail: number } };
    const [storageData, setStorageData] = useState<StorageData | null>(null);
    const [storageLoading, setStorageLoading] = useState(true);

    // ── Refresh ───────────────────────────────────────────────────────────────
    const REFRESH_LIMIT = 3;
    const [refreshCount, setRefreshCount] = useState<number | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    // ── 2FA Status ────────────────────────────────────────────────────────────
    const [twoFAEnabled, setTwoFAEnabled] = useState<boolean | null>(null);
    const [twoFAProvisioned, setTwoFAProvisioned] = useState(false);

    useEffect(() => {
        // Load storage + 2FA status in parallel
        Promise.all([
            api.get("/user/storage"),
            api.get("/user/workspace-security"),
        ]).then(([storage, security]) => {
            setStorageData(storage);
            setTwoFAProvisioned(security.provisioned ?? false);
            setTwoFAEnabled(security.twoFAEnabled ?? null);
        }).catch(() => {
            setStorageData({ used: 0, limit: 0 });
        }).finally(() => {
            setStorageLoading(false);
        });

        // Load cached refresh count from sessionStorage (reset each page session is fine; full count shown after first refresh)
        const cached = sessionStorage.getItem("wmd_refresh_count");
        if (cached !== null) setRefreshCount(parseInt(cached, 10));
        else setRefreshCount(0);
    }, []);

    async function handleRefresh() {
        if (refreshing) return;
        setRefreshing(true);
        try {
            const res = await api.post("/user/refresh-workspace-data", {});
            setRefreshCount(res.refreshCount);
            sessionStorage.setItem("wmd_refresh_count", String(res.refreshCount));
            if (res.storage) {
                setStorageData(prev => ({ ...prev, ...res.storage }));
                toast.success("Storage data refreshed from Google.");
            } else {
                toast.info("Workspace data refreshed (storage not available yet).");
            }
        } catch (err: any) {
            if (err.status === 429 || err.message?.includes("limit")) {
                setRefreshCount(REFRESH_LIMIT);
                sessionStorage.setItem("wmd_refresh_count", String(REFRESH_LIMIT));
                toast.error("Refresh limit reached (3/day). Try again tomorrow.");
            } else {
                toast.error(err.message || "Refresh failed");
            }
        } finally {
            setRefreshing(false);
        }
    }

    const refreshUsed = refreshCount ?? 0;
    const refreshDisabled = refreshUsed >= REFRESH_LIMIT || refreshing;

    // ── Referral ──────────────────────────────────────────────────────────────
    const [referralData, setReferralData] = useState<any>(null);

    useEffect(() => {
        api.get("/referral/dashboard")
            .then(data => setReferralData(data))
            .catch(console.error);
    }, []);

    // Storage display
    const usedBytes  = storageData?.used  ?? 0;
    const limitBytes = storageData?.limit ?? 0;
    const pct = limitBytes > 0 ? Math.min((usedBytes / limitBytes) * 100, 100) : 0;

    return (
        <>
            <UserLayout>
                <div className="space-y-6">

                    {/* Welcome Banner */}
                    <div className="bg-primary rounded-xl p-6 text-white shadow-lg">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold mb-2">Welcome back, {displayName}!</h1>
                                <p className="text-blue-100 mb-6 max-w-lg">
                                    Your WebMyDrive workspace is ready. Manage your files and plan below.
                                </p>
                                <div className="flex gap-3 flex-wrap">
                                    {!isHighestPlan && (
                                    <Link to="/user/plans" className="bg-card text-primary px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-50 transition-colors">
                                        Upgrade Plan
                                    </Link>
                                    )}
                                    <a
                                        href="https://drive.google.com/drive/home"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-800 transition-colors border border-blue-500 flex items-center gap-1.5"
                                    >
                                        Open Google Drive <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                </div>
                            </div>
                            {/* Refresh button */}
                            <div className="shrink-0 flex flex-col items-end gap-1">
                                <button
                                    onClick={handleRefresh}
                                    disabled={refreshDisabled}
                                    title={refreshDisabled && !refreshing ? "Daily refresh limit reached" : "Refresh workspace data from Google"}
                                    className={[
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                                        refreshDisabled && !refreshing
                                            ? "bg-blue-800/50 border-blue-600/40 text-blue-300 cursor-not-allowed"
                                            : "bg-blue-800 border-blue-600 text-white hover:bg-blue-900",
                                    ].join(" ")}
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                                    {refreshing ? "Refreshing…" : `Refresh (${refreshUsed}/${REFRESH_LIMIT})`}
                                </button>
                                {refreshUsed >= REFRESH_LIMIT && (
                                    <p className="text-[10px] text-blue-300">Resets in 24 hrs</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Storage Used — real data */}
                        <Card className="border-border shadow-sm hover:shadow-md transition-shadow">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Storage Used</CardTitle>
                                <HardDrive className="h-4 w-4 text-indigo-400" />
                            </CardHeader>
                            <CardContent>
                                {storageLoading ? (
                                    <div className="h-8 flex items-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                                ) : (
                                    <>
                                        <div className="text-2xl font-bold text-foreground">{formatBytes(usedBytes)}</div>
                                        <Progress value={pct} className="h-2 mt-3 bg-surface-3 [&>div]:bg-purple-500" />
                                        <div className="flex items-center justify-between mt-2">
                                            <p className="text-xs text-muted-foreground">of {limitBytes > 0 ? formatBytes(limitBytes) : "—"}</p>
                                            <a
                                                href="https://drive.google.com/drive/quota"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-primary flex items-center gap-0.5 hover:underline"
                                            >
                                                View in Drive <ExternalLink className="w-3 h-3" />
                                            </a>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        {/* 2FA Security card */}
                        {!twoFAProvisioned ? null : twoFAEnabled === false ? (
                            <a href="https://myaccount.google.com/signinoptions/two-step-verification" target="_blank" rel="noopener noreferrer" className="block group">
                                <Card className="border-orange-400/60 dark:border-orange-500/50 shadow-sm hover:shadow-md transition-shadow h-full cursor-pointer bg-orange-50/60 dark:bg-orange-950/20">
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-400">2-Step Verification</CardTitle>
                                        <ShieldAlert className="h-4 w-4 text-orange-500" />
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm font-bold text-orange-700 dark:text-orange-400 flex items-center gap-1">
                                            Not Enabled <ExternalLink className="w-3.5 h-3.5" />
                                        </p>
                                        <p className="text-xs text-orange-600/80 dark:text-orange-400/70 mt-1">Your Google account is at risk. Tap to enable 2FA →</p>
                                    </CardContent>
                                </Card>
                            </a>
                        ) : twoFAEnabled === true ? (
                            <Card className="border-emerald-400/50 dark:border-emerald-600/40 shadow-sm h-full bg-emerald-50/50 dark:bg-emerald-950/20">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-400">2-Step Verification</CardTitle>
                                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Enabled</p>
                                    <p className="text-xs text-emerald-600/70 dark:text-emerald-400/60 mt-1">Your Google account is protected</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <Card className="border-border shadow-sm h-full">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">2-Step Verification</CardTitle>
                                    <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground">Checking status…</p>
                                </CardContent>
                            </Card>
                        )}

                        {/* Starred shortcut */}
                        <a href="https://drive.google.com/drive/starred" target="_blank" rel="noopener noreferrer" className="block group">
                            <Card className="border-border shadow-sm hover:shadow-md transition-shadow h-full cursor-pointer group-hover:border-yellow-400/60">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">Starred</CardTitle>
                                    <Star className="h-4 w-4 text-yellow-500" />
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm font-semibold text-foreground group-hover:text-yellow-600 transition-colors flex items-center gap-1">
                                        Starred Files <ExternalLink className="w-3.5 h-3.5" />
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">Your pinned &amp; quick-access files</p>
                                </CardContent>
                            </Card>
                        </a>
                    </div>

                    {/* Drive Quick Access + Google Apps */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Drive shortcuts */}
                        <Card className="border-border shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <FolderOpen className="w-4 h-4 text-primary" /> Drive Quick Access
                                </CardTitle>
                                <CardDescription>Jump directly to sections of your Google Drive</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y divide-border">
                                    {DRIVE_SHORTCUTS.map(item => (
                                        <a
                                            key={item.label}
                                            href={item.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-4 px-6 py-3.5 hover:bg-surface-2 transition-colors group"
                                        >
                                            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                                <item.icon className="w-4 h-4 text-primary" />
                                            </div>
                                            <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors flex-1">
                                                {item.label}
                                            </p>
                                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </a>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Google Apps shortcuts */}
                        <Card className="border-border shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-lg">Google Workspace Apps</CardTitle>
                                <CardDescription>Access your Google Workspace applications</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y divide-border">
                                    {APP_SHORTCUTS.map(item => (
                                        <a
                                            key={item.label}
                                            href={item.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-4 px-6 py-3.5 hover:bg-surface-2 transition-colors group"
                                        >
                                            <div className="w-9 h-9 rounded-lg bg-muted/40 flex items-center justify-center shrink-0">
                                                <item.icon className={`w-4 h-4 ${item.color}`} />
                                            </div>
                                            <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors flex-1">
                                                {item.label}
                                            </p>
                                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </a>
                                    ))}
                                </div>
                                <div className="px-6 py-3 border-t border-border">
                                    <a
                                        href="https://workspace.google.com/dashboard"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                                    >
                                        All Workspace Apps <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Referral Section */}
                    <Card className="border-border shadow-sm mt-2">
                        <CardHeader>
                            <CardTitle className="text-xl text-foreground flex items-center gap-2">
                                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                                My Referrals
                            </CardTitle>
                            <CardDescription>Earn credits towards your renewal for every friend you refer</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="mb-4">
                                <p className="text-sm font-medium text-foreground mb-2">Your Referral Link:</p>
                                <div className="flex items-center gap-2 bg-surface-2 border border-border rounded-md py-2 px-3">
                                    <span className="text-sm font-mono text-muted-foreground flex-1 truncate">
                                        {user?.referralCode ? refLink(user.referralCode) : "—"}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 py-0 px-2 text-muted-foreground hover:text-foreground hover:bg-surface-3"
                                        onClick={() => {
                                            if (!user?.referralCode) return;
                                            navigator.clipboard.writeText(refLink(user.referralCode!));
                                            toast.success("Referral link copied to clipboard!");
                                        }}
                                    >
                                        <Copy className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>

                            {referralData && referralData.totalReferrals > 0 ? (
                                <div className="py-4 flex gap-6 text-foreground border-t border-border">
                                    <div>
                                        <div className="text-xl font-bold">{referralData.totalReferrals}</div>
                                        <div className="text-xs text-muted-foreground">Total Referrals</div>
                                    </div>
                                    <div>
                                        <div className="text-xl font-bold text-green-600">₹{referralData.creditBalance?.toLocaleString() || 0}</div>
                                        <div className="text-xs text-muted-foreground">Wallet Balance</div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-sm text-muted-foreground py-4 border-t border-border">
                                    No referrals yet. Share your code with friends to start earning!
                                </div>
                            )}

                            <div className="flex justify-end gap-3 mt-2 border-t border-border pt-4">
                                <Link to="/user/referrals">
                                    <Button variant="outline" className="border-border text-foreground hover:bg-surface-2">
                                        View Referral History
                                    </Button>
                                </Link>
                                <Button
                                    className="bg-primary hover:bg-blue-700 gap-2"
                                    onClick={() => {
                                        if (!user?.referralCode) return;
                                        navigator.clipboard.writeText(refLink(user.referralCode!));
                                        toast.success("Referral link copied! Share it with a friend.");
                                    }}
                                >
                                    <Copy className="w-4 h-4" /> Copy Link
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* WMD ID setup dialog */}
                <Dialog open={!!needsWmdId} onOpenChange={() => {}}>
                    <DialogContent className="sm:max-w-sm bg-white text-gray-900 border-gray-200 shadow-xl [&>button]:hidden">
                        <DialogHeader>
                            <div className="w-12 h-12 rounded-2xl bg-[#1fb6ff] flex items-center justify-center mb-2 mx-auto">
                                <AtSign className="w-6 h-6 text-white" />
                            </div>
                            <DialogTitle className="text-center text-xl text-gray-900">
                                Choose your @webmydrive.com ID
                            </DialogTitle>
                            <DialogDescription className="text-center text-gray-500">
                                Pick your unique WebMyDrive account ID.
                                <br />
                                <span className="text-xs mt-2 block text-gray-400">
                                    This will be your <code className="text-[#1fb6ff]">username@webmydrive.com</code> address.
                                </span>
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex flex-col gap-4 py-4 w-full">
                            <div className="flex rounded-lg border border-gray-300 overflow-hidden focus-within:ring-2 focus-within:ring-[#1fb6ff]/50 focus-within:border-[#1fb6ff] transition-all">
                                <input
                                    autoFocus
                                    value={wmdIdInput}
                                    onChange={(e) => handleWmdIdChange(e.target.value)}
                                    placeholder="yourname"
                                    className="flex-1 min-w-0 h-11 px-3 py-2 outline-none text-gray-900 placeholder:text-gray-400 border-none bg-transparent"
                                />
                                <div className="flex items-center px-3 bg-gray-50 text-gray-500 text-sm border-l border-gray-200">
                                    @webmydrive.com
                                </div>
                                <div className="flex items-center pr-3 bg-gray-50">
                                    {idCheckStatus === "checking"  && <Loader2      className="w-4 h-4 animate-spin text-gray-400" />}
                                    {idCheckStatus === "available" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                                    {idCheckStatus === "taken"     && <XCircle      className="w-4 h-4 text-red-500" />}
                                </div>
                            </div>

                            {idCheckStatus === "available" && (
                                <p className="text-emerald-600 text-xs flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <strong className="font-semibold">{chosenWmdEmail}</strong> is available!
                                </p>
                            )}
                            {idCheckStatus === "taken" && (
                                <div className="space-y-2">
                                    <p className="text-red-500 text-xs flex items-center gap-1">
                                        <XCircle className="w-3.5 h-3.5" />
                                        <strong className="font-semibold">{wmdIdInput}@webmydrive.com</strong> is taken.
                                    </p>
                                    {idSuggestions.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                            {idSuggestions.map((s) => (
                                                <button
                                                    key={s}
                                                    onClick={() => handleSuggestionSelect(s)}
                                                    className="text-[11px] px-2.5 py-1 rounded-full bg-blue-50 text-[#1fb6ff] hover:bg-blue-100 transition-colors border border-blue-100 font-medium"
                                                >
                                                    {s.split("@")[0]}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            <Button
                                onClick={handleConfirmWmdId}
                                disabled={idCheckStatus !== "available" || submittingId}
                                className="w-full bg-[#1fb6ff] hover:bg-[#1fa0df] text-white shadow-sm mt-2"
                            >
                                {submittingId ? (
                                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Creating ID...</>
                                ) : (
                                    "Confirm ID & Continue"
                                )}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </UserLayout>
        </>
    );
}
