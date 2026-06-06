import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Users, TrendingUp, Wallet, CheckCircle2, Clock, XCircle,
    MoreHorizontal, Copy, ExternalLink, UserPlus, Search,
    ChevronRight, BarChart3, ArrowUpRight, ChevronLeft, Loader2,
    Tag, Plus, X, Link, Eye, Lock, Unlock, ShieldAlert,
    DollarSign, Award, ChevronUp, ArrowDownLeft, CreditCard, Zap,
    MessageSquare, Building, Download, LayoutDashboard
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip as RechartTooltip,
    ResponsiveContainer, CartesianGrid, AreaChart, Area,
} from "recharts";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { cn, copyToClipboard } from "@/lib/utils";

// ── Inline types (matching backend) ──────────────────────────────────────────
type DistributorStatus = "active" | "pending" | "suspended";
interface Distributor {
    id: string;
    name: string;
    email: string;
    phone?: string;
    status: DistributorStatus;
    referralCode: string;
    promoCode?: string;
    tier: string;
    commissionPct: number;
    totalCustomers: number;
    activeCustomers: number;
    revenueGeneratedINR: number;
    commissionEarnedINR: number;
    walletBalanceINR: number;
    pendingWithdrawalINR: number;
    revenueThisYearINR: number;
    joinedAt: string;
    lastActiveAt: string;
    monthlyBreakdown: { month: string; earned: number }[];
}


// ── Status config ─────────────────────────────────────────────────────────────
const statusCfg: Record<DistributorStatus, { label: string; cls: string; icon: React.ReactNode }> = {
    active: {
        label: "Active",
        cls: "bg-success/15 text-success border-success/30",
        icon: <CheckCircle2 className="w-3 h-3" />,
    },
    pending: {
        label: "Pending Approval",
        cls: "bg-warning/15 text-warning border-warning/30",
        icon: <Clock className="w-3 h-3" />,
    },
    suspended: {
        label: "Suspended",
        cls: "bg-danger/15 text-danger border-danger/30",
        icon: <XCircle className="w-3 h-3" />,
    },
};

const fmt = (n: number) =>
    "₹" + n.toLocaleString("en-IN");

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, colorClass }: {
    label: string; value: string; sub?: string;
    icon: React.ReactNode; colorClass: string;
}) {
    return (
        <div className="bg-surface-1 rounded-xl border border-border p-5 flex items-start gap-4 shadow-card">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", colorClass)}>
                {icon}
            </div>
            <div>
                <p className="text-xs text-muted-foreground font-medium">{label}</p>
                <p className="text-xl font-bold text-foreground mt-0.5">{value}</p>
                {sub && <p className="text-xs text-muted-foreground/70 mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

// ── Promo Code Assignment Dialog ──────────────────────────────────────────────
function PromoCodeDialog({ dist, open, onClose, onAssigned }: {
    dist: Distributor;
    open: boolean;
    onClose: () => void;
    onAssigned: (code: string) => void;
}) {
    const [history, setHistory] = useState<any[]>([]);
    const [customCode, setCustomCode] = useState<string>("");
    const [isFestive, setIsFestive] = useState(false);
    const [note, setNote] = useState("");
    const [assigning, setAssigning] = useState(false);
    const [revoking, setRevoking] = useState<number | null>(null);
    const [loadingData, setLoadingData] = useState(false);

    useEffect(() => {
        if (!open) return;
        setLoadingData(true);
        api.get(`/admin/distributors/${dist.id}/promo-codes`)
            .then((hist) => setHistory(Array.isArray(hist) ? hist : []))
            .catch(() => toast.error("Failed to load promo code history"))
            .finally(() => setLoadingData(false));
    }, [open, dist.id]);

    const handleAssign = async () => {
        const code = customCode.trim().toUpperCase();
        if (!code) { toast.error("Enter a promo code"); return; }
        setAssigning(true);
        try {
            await api.post(`/admin/distributors/${dist.id}/promo-code`, {
                code,
                isFestive,
                note,
            });
            toast.success(`Promo code ${code} assigned to ${dist.name}`);
            onAssigned(code);
            const hist = await api.get(`/admin/distributors/${dist.id}/promo-codes`);
            setHistory(Array.isArray(hist) ? hist : []);
            setCustomCode(""); setNote(""); setIsFestive(false);
        } catch {
            toast.error("Failed to assign promo code");
        } finally {
            setAssigning(false);
        }
    };

    const handleRevoke = async (dpcId: number) => {
        setRevoking(dpcId);
        try {
            await api.delete(`/admin/distributors/${dist.id}/promo-code/${dpcId}`);
            toast.success("Promo code revoked");
            setHistory(prev => prev.map(h => h.id === dpcId ? { ...h, isActive: 0, revokedAt: new Date().toISOString() } : h));
        } catch {
            toast.error("Failed to revoke");
        } finally {
            setRevoking(null);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Tag className="w-5 h-5 text-primary" /> Manage Promo Code
                    </DialogTitle>
                    <DialogDescription>
                        Assign or replace the promo code for <strong>{dist.name}</strong>.
                        Only one code is active at a time.
                    </DialogDescription>
                </DialogHeader>

                {loadingData ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                ) : (
                    <div className="space-y-5">
                        {/* Assign form */}
                        <div className="space-y-3 p-4 rounded-lg bg-muted/40 border border-border">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Assign Promo Code</p>
                            <input
                                className="w-full font-mono uppercase text-sm rounded-md border border-input bg-background px-3 py-2 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring tracking-widest"
                                placeholder="Type code e.g. VIRAL50"
                                value={customCode}
                                onChange={e => setCustomCode(e.target.value.toUpperCase())}
                                onKeyDown={e => e.key === "Enter" && handleAssign()}
                            />
                            <p className="text-[11px] text-muted-foreground -mt-1">
                                Type any code — it will be created automatically if it doesn't exist yet.
                            </p>
                            <input
                                className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                placeholder="Note (optional)"
                                value={note}
                                onChange={e => setNote(e.target.value)}
                            />
                            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                                <input type="checkbox" checked={isFestive} onChange={e => setIsFestive(e.target.checked)}
                                    className="rounded border-border" />
                                Mark as festive / temporary assignment
                            </label>
                            <Button className="w-full" onClick={handleAssign} disabled={assigning || !customCode.trim()}>
                                {assigning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                                Assign Code
                            </Button>
                        </div>

                        {/* History */}
                        {history.length > 0 && (
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Code History</p>
                                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                    {history.map((h: any) => (
                                        <div key={h.id}
                                            className={cn(
                                                "flex items-center justify-between px-3 py-2 rounded-lg border text-sm",
                                                h.isActive ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-border text-muted-foreground"
                                            )}>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-bold">{h.code}</span>
                                                {h.isActive ? <Badge className="text-[10px] h-4">Active</Badge>
                                                    : <span className="text-[11px]">revoked</span>}
                                                {h.isFestive ? <Badge variant="secondary" className="text-[10px] h-4">Festive</Badge> : null}
                                            </div>
                                            {h.isActive && (
                                                <button
                                                    onClick={() => handleRevoke(h.id)}
                                                    disabled={revoking === h.id}
                                                    className="text-danger hover:text-danger/80 ml-2">
                                                    {revoking === h.id
                                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        : <X className="w-3.5 h-3.5" />}
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

// ── Add Distributor Modal (inline simplified) ─────────────────────────────────
function AddDistributorModal({ open, onClose, onAdd }: {
    open: boolean;
    onClose: () => void;
    onAdd: (d: Partial<Distributor>) => void;
}) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");

    if (!open) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !email) { toast.error("Name and email are required."); return; }
        onAdd({ name, email, phone, status: "pending", commissionPct: 10 });
        setName(""); setEmail(""); setPhone("");
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-surface-1 rounded-2xl shadow-xl border border-border w-full max-w-md mx-4 p-6"
            >
                <h2 className="text-lg font-bold text-foreground mb-1">Add Distributor</h2>
                <p className="text-sm text-muted-foreground mb-5">New distributor will be pending until you approve them.</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Full Name</label>
                        <Input value={name} onChange={e => setName(e.target.value)}
                            placeholder="e.g. Priya Networks" className="mt-1" />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</label>
                        <Input type="email" value={email} onChange={e => setEmail(e.target.value)}
                            placeholder="contact@company.com" className="mt-1" />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Phone (optional)</label>
                        <Input value={phone} onChange={e => setPhone(e.target.value)}
                            placeholder="+91 98765 43210" className="mt-1" />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
                        <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground">
                            Create & Send Invite
                        </Button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}

// ── Distributor Portal Drawer (exact replica of distributor portal) ───────────

type PortalPage = "dashboard" | "customers" | "earnings" | "wallet" | "payouts";

function DistributorPortalDrawer({ dist, onClose }: { dist: Distributor; onClose: () => void }) {
    const [page, setPage] = useState<PortalPage>("dashboard");
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [showEditConfirm, setShowEditConfirm] = useState(false);

    useEffect(() => {
        setLoading(true);
        setData(null);
        api.get(`/admin/distributors/${dist.id}/portal?page=${page}`)
            .then(setData)
            .catch(() => setData({}))
            .finally(() => setLoading(false));
    }, [dist.id, page]);

    const navItems: { key: PortalPage; label: string; icon: React.ReactNode }[] = [
        { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
        { key: "customers", label: "Customers",  icon: <Users className="w-4 h-4" /> },
        { key: "earnings",  label: "Earnings",   icon: <TrendingUp className="w-4 h-4" /> },
        { key: "wallet",    label: "Wallet",     icon: <Wallet className="w-4 h-4" /> },
        { key: "payouts",   label: "Payouts",    icon: <CreditCard className="w-4 h-4" /> },
    ];

    return (
        <div className="fixed inset-0 z-[60] flex justify-end">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <motion.aside
                initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
                transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                className="relative w-full max-w-4xl bg-surface-1 shadow-2xl border-l border-border flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-3 flex-shrink-0 bg-gradient-to-r from-indigo-900/60 via-blue-900/40 to-transparent">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <Zap className="w-5 h-5 text-yellow-300" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <p className="text-sm font-bold text-foreground">{dist.name}</p>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 font-semibold uppercase tracking-wide">Viewing as Distributor</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{dist.email} · {dist.tier} · ID #{dist.id}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {!editMode ? (
                            <button onClick={() => setShowEditConfirm(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors">
                                <Lock className="w-3.5 h-3.5" /> Read-only
                            </button>
                        ) : (
                            <button onClick={() => setEditMode(false)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-amber-400/40 text-amber-500 hover:bg-amber-500/10 transition-colors">
                                <Unlock className="w-3.5 h-3.5" /> Editing On
                            </button>
                        )}
                        <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-surface-2">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Edit confirm modal */}
                {showEditConfirm && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                        <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl space-y-4">
                            <div className="flex items-start gap-3">
                                <ShieldAlert className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-semibold text-foreground text-sm">Enable Editing?</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Changes to <span className="font-medium text-foreground">{dist.name}</span> will take effect immediately.
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" className="flex-1" onClick={() => setShowEditConfirm(false)}>Cancel</Button>
                                <Button className="flex-1 bg-amber-500 hover:bg-amber-600 text-white" onClick={() => { setEditMode(true); setShowEditConfirm(false); }}>
                                    Yes, Enable Editing
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Body: left nav + content */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Left mini-nav */}
                    <nav className="w-36 flex-shrink-0 border-r border-border bg-surface-2/50 flex flex-col py-4 gap-1 px-2">
                        {navItems.map(n => (
                            <button key={n.key} onClick={() => setPage(n.key)}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors text-left",
                                    page === n.key
                                        ? "bg-primary/15 text-primary"
                                        : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
                                )}>
                                {n.icon}
                                {n.label}
                            </button>
                        ))}
                    </nav>

                    {/* Main content area */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {loading ? (
                            <div className="flex items-center justify-center py-24">
                                <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <>
                                {/* ── DASHBOARD ── */}
                                {page === "dashboard" && <PortalDashboard data={data} dist={dist} />}
                                {/* ── CUSTOMERS ── */}
                                {page === "customers" && <PortalCustomers data={data} />}
                                {/* ── EARNINGS ── */}
                                {page === "earnings" && <PortalEarnings data={data} />}
                                {/* ── WALLET ── */}
                                {page === "wallet" && <PortalWallet data={data} />}
                                {/* ── PAYOUTS ── */}
                                {page === "payouts" && <PortalPayouts data={data} />}
                            </>
                        )}
                    </div>
                </div>
            </motion.aside>
        </div>
    );
}

// ── Portal sub-page components ────────────────────────────────────────────────

function PortalDashboard({ data, dist }: { data: any; dist: Distributor }) {
    const d = data?.distributor ?? {};
    const history: any[] = data?.history ?? [];
    const promoCode: string | null = data?.promoCode ?? null;
    const promoDiscounts: Record<string, number> = data?.promoDiscounts ?? {};
    const nextTier = data?.nextTier;
    const availablePayout = Math.max(0, (d.walletBalance ?? 0) - 2000);
    const progressValue = nextTier ? Math.min(100, ((d.revenueThisYear ?? 0) / nextTier.threshold) * 100) : 100;

    // Monthly commission trend from history
    const monthlyTrend = (() => {
        const counts: Record<string, number> = {};
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = date.toLocaleString("default", { month: "short", year: "2-digit" });
            counts[key] = 0;
        }
        history.forEach((s: any) => {
            if (!s.date) return;
            const key = new Date(s.date).toLocaleString("default", { month: "short", year: "2-digit" });
            if (key in counts) counts[key] = (counts[key] || 0) + (s.commission || 0);
        });
        return Object.entries(counts).map(([month, commission]) => ({ month, commission }));
    })();

    const recentActivity = history.slice(0, 5);

    return (
        <div className="space-y-6">
            {/* Welcome Banner */}
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-900 via-blue-900 to-indigo-800 p-6 text-white shadow-lg">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Zap className="w-5 h-5 text-yellow-300" />
                            <span className="text-xs font-semibold uppercase tracking-widest text-blue-100">Distributor Partner</span>
                        </div>
                        <h1 className="text-2xl font-bold">Welcome, {d.name || d.email || dist.name}!</h1>
                        <p className="text-blue-100 text-sm mt-1">Tier: <strong>{d.tier ?? dist.tier}</strong></p>
                    </div>
                </div>
            </div>

            {/* Promo Code Card */}
            <Card className="border-border shadow-sm">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Tag className="w-5 h-5 text-primary" />
                        <CardTitle className="text-base">Your Promo Code</CardTitle>
                    </div>
                    <CardDescription>Share this code with customers — they enter it at checkout for a plan discount.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {promoCode ? (
                        <>
                            <div className="flex items-center gap-3">
                                <div className="flex-1 bg-muted rounded-lg px-5 py-3 font-mono text-2xl font-bold tracking-widest text-foreground border border-border">
                                    {promoCode}
                                </div>
                                <Button variant="outline" size="icon" className="h-12 w-12 shrink-0"
                                    onClick={() => copyToClipboard(promoCode).then(() => toast.success("Promo code copied!"))}>
                                    <Copy className="w-4 h-4" />
                                </Button>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Customer discounts when using this code:</p>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(promoDiscounts).map(([plan, pct]) => (
                                        <Badge key={plan} variant={pct > 0 ? "default" : "secondary"} className="text-xs font-medium gap-1">
                                            {plan}: {pct}% off
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                            <Tag className="w-5 h-5 text-amber-600 shrink-0" />
                            <p className="text-sm text-amber-700 dark:text-amber-400">No promo code assigned yet.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* KPI Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: "Wallet Balance", value: `₹${(d.walletBalance ?? 0).toLocaleString()}` },
                    { label: "Available Payout", value: `₹${availablePayout.toLocaleString()}`, sub: "(₹2,000 held)", green: true },
                    { label: "Total Customers", value: String(d.totalCustomers ?? 0) },
                    { label: "Total Commission", value: `₹${(d.totalCommission ?? 0).toLocaleString()}` },
                ].map((k, i) => (
                    <Card key={i} className="border-border shadow-sm">
                        <CardContent className="p-5">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{k.label}</p>
                            <p className={cn("text-2xl font-bold mt-2", k.green ? "text-green-600" : "text-foreground")}>{k.value}</p>
                            {k.sub && <p className="text-[10px] text-muted-foreground mt-1">{k.sub}</p>}
                        </CardContent>
                    </Card>
                ))}
                <Card className="border-border shadow-sm col-span-2 md:col-span-4">
                    <CardContent className="p-5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Tier Progress (This Year's Revenue)</p>
                        <div className="flex justify-between text-sm font-bold mb-2">
                            <span>₹{(d.revenueThisYear ?? 0).toLocaleString()}</span>
                            {nextTier
                                ? <span className="text-muted-foreground">₹{nextTier.threshold.toLocaleString()} to {nextTier.name}</span>
                                : <span className="text-green-600">Max Tier Reached</span>}
                        </div>
                        <Progress value={progressValue} className="h-2.5" />
                    </CardContent>
                </Card>
            </div>

            {/* Monthly Commission Trend */}
            <Card className="border-border">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-primary" />
                        <CardTitle className="text-base">Monthly Commission Trend</CardTitle>
                    </div>
                    <CardDescription>Earned commissions over the last 6 months.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={180}>
                        <AreaChart data={monthlyTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="commGradP" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} width={50} tickFormatter={(v) => `₹${v}`} />
                            <RechartTooltip formatter={(v: number) => [`₹${v.toLocaleString()}`, "Commission"]} />
                            <Area type="monotone" dataKey="commission" stroke="hsl(var(--primary))" fill="url(#commGradP)" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Recent Activity */}
            {recentActivity.length > 0 && (
                <Card className="border-border">
                    <CardHeader>
                        <CardTitle className="text-base">Recent Customer Activity</CardTitle>
                        <CardDescription>Last 5 sales through your promo / referral code.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ul className="divide-y divide-border/50">
                            {recentActivity.map((sale: any, i: number) => (
                                <li key={sale.id ?? i} className="flex items-center justify-between px-5 py-3 hover:bg-muted/30">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                            {(sale.user || "?")[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">{sale.user || "Customer"}</p>
                                            <p className="text-xs text-muted-foreground">{sale.date || "—"}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-semibold text-green-600">+₹{(sale.commission || 0).toLocaleString()}</p>
                                        <p className="text-xs text-muted-foreground">₹{(sale.amount || 0).toLocaleString()}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            )}

            {/* Full Sales History */}
            <Card className="border-border">
                <CardHeader><CardTitle className="text-base">Sales History</CardTitle></CardHeader>
                <CardContent>
                    {history.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-left text-muted-foreground">
                                        <th className="font-semibold p-3 pb-2">Customer</th>
                                        <th className="font-semibold p-3 pb-2">Date</th>
                                        <th className="font-semibold p-3 pb-2 text-right">Order</th>
                                        <th className="font-semibold p-3 pb-2 text-right">Commission</th>
                                        <th className="font-semibold p-3 pb-2 text-right">Rate</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {history.map((sale: any, i: number) => (
                                        <tr key={sale.id ?? i} className="hover:bg-muted/30 transition-colors">
                                            <td className="p-3 font-medium">{sale.user}</td>
                                            <td className="p-3 text-muted-foreground">{sale.date}</td>
                                            <td className="p-3 text-right">₹{(sale.amount || 0).toLocaleString()}</td>
                                            <td className="p-3 text-right text-green-600 font-semibold">₹{(sale.commission || 0).toLocaleString()}</td>
                                            <td className="p-3 text-right text-muted-foreground">{sale.rate}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="p-8 text-center text-sm text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
                            No sales recorded yet.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function PortalCustomers({ data }: { data: any }) {
    const customers: any[] = data?.customers ?? [];
    const stats = data?.stats ?? {};
    const [search, setSearch] = useState("");
    const filtered = customers.filter((c: any) =>
        !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                    <Users className="w-6 h-6 text-primary" /> My Customers
                </h1>
                <p className="text-muted-foreground text-sm mt-1">All users who signed up through your promo or referral code.</p>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: "Total Customers", value: stats.total ?? customers.length },
                    { label: "Direct (L1)", value: stats.directL1 ?? customers.length },
                    { label: "L2 Customers", value: stats.l2 ?? 0 },
                    { label: "Active Plans", value: stats.active ?? customers.filter((c: any) => c.status === "active").length },
                ].map((s, i) => (
                    <Card key={i} className="border-border">
                        <CardContent className="p-5">
                            <p className="text-xs text-muted-foreground">{s.label}</p>
                            <p className="text-2xl font-bold text-foreground mt-1">{s.value}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Search + Table */}
            <Card className="border-border">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Search className="w-4 h-4 text-muted-foreground" />
                        <input
                            value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search by name or email…"
                            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-surface-2 hover:bg-surface-2">
                                <TableHead>Customer</TableHead>
                                <TableHead>Plan</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Joined</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">No customers yet</TableCell>
                                </TableRow>
                            ) : filtered.map((c: any) => (
                                <TableRow key={c.id} className="hover:bg-surface-2">
                                    <TableCell>
                                        <p className="text-sm font-medium text-foreground">{c.name ?? c.email}</p>
                                        <p className="text-xs text-muted-foreground">{c.email}</p>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{c.plan}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn("text-xs", c.status === "active" ? "text-success border-success/30 bg-success/10" : "text-muted-foreground")}>
                                            {c.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{c.joinedAt?.slice(0, 10)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

function PortalEarnings({ data }: { data: any }) {
    const totalLifetime: number = data?.totalCommission ?? 0;
    const pendingPayout: number = data?.pendingPayout ?? 0;
    const tier: string = data?.tier ?? "Standard";
    const transactions: any[] = data?.transactions ?? [];
    const monthlyTrend: any[] = data?.monthlyTrend ?? [];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                    <DollarSign className="w-6 h-6 text-success" /> Earnings Center
                </h1>
                <p className="text-muted-foreground text-sm mt-1">Commission breakdown, tier bonuses, and earning history.</p>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: "Total Lifetime", value: `₹${totalLifetime.toLocaleString()}`, icon: DollarSign, color: "text-success", bg: "bg-success/10" },
                    { label: "This Month", value: "₹0", icon: TrendingUp, color: "text-primary", bg: "bg-primary/10" },
                    { label: "Pending Payout", value: `₹${pendingPayout.toLocaleString()}`, icon: DollarSign, color: "text-warning", bg: "bg-warning/10" },
                    { label: "Current Tier", value: tier, icon: Award, color: "text-yellow-400", bg: "bg-yellow-500/10" },
                ].map((k, i) => (
                    <Card key={i} className="border-border">
                        <CardContent className="p-5">
                            <div className="flex items-center gap-3 mb-3">
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${k.bg}`}>
                                    <k.icon className={`w-4 h-4 ${k.color}`} />
                                </div>
                                <p className="text-xs text-muted-foreground">{k.label}</p>
                            </div>
                            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <ChevronUp className="w-3 h-3 text-success" /> overall
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Chart */}
            {monthlyTrend.length > 0 && (
                <Card className="border-border">
                    <CardHeader>
                        <CardTitle>Earnings Trend</CardTitle>
                        <CardDescription>Commission earnings over recent months</CardDescription>
                    </CardHeader>
                    <CardContent className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={monthlyTrend}>
                                <defs>
                                    <linearGradient id="gCommE" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                                <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
                                <YAxis fontSize={11} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `₹${(v / 1000).toFixed(1)}k`} />
                                <RechartTooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }} formatter={(v: number) => [`₹${v.toLocaleString()}`, ""]} />
                                <Area type="monotone" dataKey="commission" stroke="#22c55e" strokeWidth={2} fill="url(#gCommE)" name="Commission" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            {/* Transaction Log */}
            <Card className="border-border">
                <CardHeader>
                    <CardTitle>Transaction Log</CardTitle>
                    <CardDescription>All credit and debit entries</CardDescription>
                </CardHeader>
                <CardContent className="p-0 max-h-72 overflow-y-auto">
                    <Table>
                        <TableBody>
                            {transactions.length > 0 ? transactions.map((tx: any) => (
                                <TableRow key={tx.id} className="hover:bg-surface-2">
                                    <TableCell>
                                        <p className="text-xs font-medium text-foreground">{tx.description ?? tx.desc}</p>
                                        <p className="text-[10px] text-muted-foreground">{tx.date ?? tx.createdAt?.slice(0, 10)}</p>
                                    </TableCell>
                                    <TableCell className="text-right shrink-0">
                                        <span className={`text-sm font-bold ${tx.type === "debit" || tx.type === "DEBIT" ? "text-danger" : "text-success"}`}>
                                            {tx.type === "debit" || tx.type === "DEBIT" ? "−" : "+"}₹{Math.abs(tx.amount).toLocaleString()}
                                        </span>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">No transactions yet</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

function PortalWallet({ data }: { data: any }) {
    const balance: number = data?.walletBalance ?? 0;
    const walletTx: any[] = data?.transactions ?? [];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                    <Wallet className="w-6 h-6 text-primary" /> My Wallet
                </h1>
                <p className="text-muted-foreground text-sm mt-1">Commission wallet, redemptions, and payout requests.</p>
            </div>

            {/* Balance Hero */}
            <div className="relative rounded-2xl bg-gradient-to-br from-emerald-700 via-green-600 to-teal-700 p-8 text-white overflow-hidden shadow-lg">
                <div className="absolute top-0 right-0 w-56 h-56 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="relative z-10">
                    <p className="text-sm font-semibold text-green-100 mb-1">Available Balance</p>
                    <h2 className="text-5xl font-bold mb-1">₹{balance.toLocaleString()}</h2>
                </div>
            </div>

            {/* Transaction History */}
            <Card className="border-border">
                <CardHeader>
                    <CardTitle>Transaction History</CardTitle>
                    <CardDescription>All wallet movements</CardDescription>
                </CardHeader>
                <CardContent className="p-0 max-h-80 overflow-y-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-surface-2 hover:bg-surface-2">
                                <TableHead className="w-8"></TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {walletTx.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No wallet transactions yet</TableCell>
                                </TableRow>
                            ) : walletTx.map((tx: any) => (
                                <TableRow key={tx.id} className="hover:bg-surface-2">
                                    <TableCell>
                                        {tx.type === "debit" || tx.type === "DEBIT"
                                            ? <ArrowDownLeft className="w-4 h-4 text-danger" />
                                            : <ArrowDownLeft className="w-4 h-4 text-success rotate-180" />}
                                    </TableCell>
                                    <TableCell>
                                        <p className="text-sm text-foreground">{tx.desc ?? tx.description}</p>
                                        <p className="text-[10px] text-muted-foreground">{tx.id}</p>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-xs">{tx.date ?? tx.createdAt?.slice(0, 10)}</TableCell>
                                    <TableCell className={`text-right font-semibold text-sm ${tx.type === "debit" || tx.type === "DEBIT" ? "text-danger" : "text-success"}`}>
                                        {tx.amount > 0 ? `+₹${tx.amount.toLocaleString()}` : `−₹${Math.abs(tx.amount).toLocaleString()}`}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

const payoutStatusCfg: Record<string, { label: string; bg: string }> = {
    completed: { label: "Completed", bg: "bg-success/10 text-success border-success/30" },
    pending:   { label: "Pending",   bg: "bg-warning/10 text-warning border-warning/30" },
    failed:    { label: "Failed",    bg: "bg-danger/10 text-danger border-danger/30" },
};

function PortalPayouts({ data }: { data: any }) {
    const payouts: any[] = data?.payouts ?? [];
    const availableBalance: number = data?.walletBalance ?? 0;
    const payoutConfig = data?.payoutConfig ?? { tdsEnabled: false, tdsRate: 10, minPayoutAmount: 5000 };
    const bankInfo = data?.bankInfo ?? null;
    const totalPaid = payouts.filter(p => p.status === "completed").reduce((s: number, p: any) => s + parseInt(String(p.amount).replace(/[^0-9]/g, "")), 0);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                    <CreditCard className="w-6 h-6 text-primary" /> Payouts
                </h1>
                <p className="text-muted-foreground text-sm mt-1">Payout history and withdrawal requests.</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { label: "Total Paid Out", value: `₹${totalPaid.toLocaleString()}`, icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
                    { label: "Available to Request", value: `₹${availableBalance.toLocaleString()}`, icon: Clock, color: "text-warning", bg: "bg-warning/10" },
                    { label: "Min Payout", value: `₹${(payoutConfig.minPayoutAmount ?? 5000).toLocaleString()}`, icon: CreditCard, color: "text-primary", bg: "bg-primary/10" },
                ].map((s, i) => (
                    <Card key={i} className="border-border">
                        <CardContent className="p-5 flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${s.bg}`}>
                                <s.icon className={`w-5 h-5 ${s.color}`} />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">{s.label}</p>
                                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {bankInfo && (
                <Card className="border-border">
                    <CardContent className="p-4 flex items-center gap-3">
                        <Building className="w-5 h-5 text-muted-foreground" />
                        <div>
                            <p className="text-sm font-medium text-foreground">{bankInfo.bankName ?? "Bank"} ****{(bankInfo.bankAccountNumber ?? "").slice(-4)}</p>
                            <p className="text-xs text-muted-foreground">{bankInfo.bankAccountType ?? "Account"}{bankInfo.upiId ? ` · UPI: ${bankInfo.upiId}` : ""}</p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Payout History Table */}
            <Card className="border-border">
                <CardHeader>
                    <CardTitle>Payout History</CardTitle>
                    <CardDescription>All previous payout transactions</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-surface-2 hover:bg-surface-2">
                                <TableHead>Payout ID</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>UTR / Ref</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {payouts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No payouts yet</TableCell>
                                </TableRow>
                            ) : payouts.map((p: any) => {
                                const cfg = payoutStatusCfg[p.status] ?? { label: p.status, bg: "" };
                                return (
                                    <TableRow key={p.id} className="hover:bg-surface-2">
                                        <TableCell className="font-mono text-xs text-muted-foreground">{p.id}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{p.date}</TableCell>
                                        <TableCell className="font-semibold text-foreground">{p.amount}</TableCell>
                                        <TableCell className="font-mono text-xs text-muted-foreground">{p.utrNumber ?? p.txRef ?? "—"}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={cfg.bg}>{cfg.label}</Badge>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

function DistributorDrawer({ dist, onClose, onUpdate }: {
    dist: Distributor;
    onClose: () => void;
    onUpdate: (id: string, patch: Partial<Distributor>) => void;
}) {
    const sc = statusCfg[dist.status];
    const [showPromoDialog, setShowPromoDialog] = useState(false);
    const [currentPromoCode, setCurrentPromoCode] = useState<string | undefined>(dist.promoCode);
    const [showPortal, setShowPortal] = useState(false);

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-background/80" onClick={onClose} />
            <motion.aside
                initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
                transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                className="relative w-full max-w-md bg-surface-1 shadow-2xl border-l border-border flex flex-col overflow-y-auto"
            >
                {/* Header */}
                <div className="p-6 border-b border-border">
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-foreground">{dist.name}</h2>
                            <p className="text-sm text-muted-foreground">{dist.email}</p>
                        </div>
                        <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-surface-2">✕</button>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                        <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border", sc.cls)}>
                            {sc.icon} {sc.label}
                        </span>
                        <span className="text-xs text-muted-foreground">Joined {formatDistanceToNow(new Date(dist.joinedAt), { addSuffix: true })}</span>
                    </div>
                </div>

                {/* Stats */}
                <div className="p-6 grid grid-cols-2 gap-4 border-b border-border">
                    {[
                        { label: "Total Customers", value: String(dist.totalCustomers) },
                        { label: "Active Customers", value: String(dist.activeCustomers) },
                        { label: "Revenue Generated", value: fmt(dist.revenueGeneratedINR) },
                        { label: "Commission Earned", value: fmt(dist.commissionEarnedINR) },
                        { label: "Wallet Balance", value: fmt(dist.walletBalanceINR) },
                        { label: "Pending Withdrawal", value: fmt(dist.pendingWithdrawalINR) },
                    ].map(s => (
                        <div key={s.label} className="bg-surface-2 rounded-lg p-3 border border-border/50">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
                            <p className="text-base font-bold text-foreground mt-0.5">{s.value}</p>
                        </div>
                    ))}
                </div>

                {/* Promo / Referral Code — unified */}
                <div className="p-6 border-b border-border">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Promo / Referral Code</p>
                        <button onClick={() => setShowPromoDialog(true)}
                            className="text-xs text-primary hover:underline flex items-center gap-1">
                            <Tag className="w-3 h-3" /> Manage
                        </button>
                    </div>
                    <div className={`flex items-center gap-2 rounded-lg px-3 py-2 border ${currentPromoCode ? "bg-primary/5 border-primary/20" : "bg-muted/40 border-border"}`}>
                        {currentPromoCode ? (
                            <span className="font-mono text-primary font-bold flex-1 text-lg tracking-widest">
                                {currentPromoCode}
                            </span>
                        ) : (
                            <span className="text-muted-foreground text-sm italic flex-1">
                                Not assigned
                            </span>
                        )}
                        {currentPromoCode && (
                            <button
                                onClick={() => copyToClipboard(currentPromoCode).then(() => toast.success("Promo code copied!"))}
                                className="text-primary hover:text-primary/80 transition-colors" title="Copy promo code">
                                <Copy className="w-4 h-4" />
                            </button>
                        )}
                        <button
                            onClick={() => copyToClipboard(`https://webmydrive.com/?ref=${dist.referralCode}`).then(() => toast.success("Referral link copied!"))}
                            className="text-primary hover:text-primary/80 transition-colors" title="Copy referral link">
                            <Link className="w-4 h-4" />
                        </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                        {currentPromoCode
                            ? "Customers type this at checkout for a discount · distributor earns commission"
                            : "No promo code assigned — click Manage to assign one"}
                    </p>
                    {showPromoDialog && (
                        <PromoCodeDialog
                            dist={dist}
                            open={showPromoDialog}
                            onClose={() => setShowPromoDialog(false)}
                            onAssigned={(code) => {
                                setCurrentPromoCode(code);
                                onUpdate(dist.id, { promoCode: code });
                            }}
                        />
                    )}
                </div>

                {/* Tier & Revenue target */}
                <div className="p-6 border-b border-border">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Program Tier Status</p>
                    <div className="flex justify-between items-end mb-2">
                        <div>
                            <p className="font-bold text-foreground">{dist.tier} Tier</p>
                            <p className="text-xs text-muted-foreground">{dist.commissionPct}% Commission Rate</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm font-semibold text-foreground">{fmt(dist.revenueThisYearINR)}</p>
                            <p className="text-xs text-muted-foreground">This Year's Revenue</p>
                        </div>
                    </div>

                    {/* Progress Bar Mock */}
                    {dist.tier !== "Gold" && (
                        <>
                            <div className="h-2 w-full bg-surface-2 rounded-full overflow-hidden mb-2">
                                <div
                                    className="h-full bg-primary rounded-full"
                                    style={{ width: `${Math.min(100, (dist.revenueThisYearINR / (dist.tier === 'Starter' ? 100000 : 300000)) * 100)}%` }}
                                />
                            </div>
                            <p className="text-[11px] text-muted-foreground text-right">
                                {fmt((dist.tier === 'Starter' ? 100000 : 300000) - dist.revenueThisYearINR)} needed for {dist.tier === 'Starter' ? 'Silver' : 'Gold'}
                            </p>
                        </>
                    )}
                </div>

                {/* Monthly chart */}
                <div className="p-6 border-b border-border">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Monthly Earnings</p>
                    <ResponsiveContainer width="100%" height={100}>
                        <BarChart data={dist.monthlyBreakdown} barSize={16}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                            <YAxis hide />
                            <RechartTooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                                formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Earned"]} />
                            <Bar dataKey="earned" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Actions */}
                <div className="p-6 flex flex-col gap-2">
                    <Button variant="outline" className="gap-2" onClick={() => setShowPortal(true)}>
                        <Eye className="w-4 h-4" /> View Portal
                    </Button>
                    {dist.status === "pending" && (
                        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { onUpdate(dist.id, { status: "active" }); toast.success(`${dist.name} approved`); onClose(); }}>
                            <CheckCircle2 className="w-4 h-4 mr-2" /> Approve Distributor
                        </Button>
                    )}
                    {dist.status === "active" && (
                        <Button variant="outline" className="border-danger/20 text-danger hover:bg-danger/5" onClick={() => { onUpdate(dist.id, { status: "suspended" }); toast.error(`${dist.name} suspended`); onClose(); }}>
                            <XCircle className="w-4 h-4 mr-2" /> Suspend Distributor
                        </Button>
                    )}
                    {dist.status === "suspended" && (
                        <Button className="bg-primary hover:bg-primary/90 text-white" onClick={() => { onUpdate(dist.id, { status: "active" }); toast.success(`${dist.name} reactivated`); onClose(); }}>
                            <CheckCircle2 className="w-4 h-4 mr-2" /> Reactivate
                        </Button>
                    )}
                </div>
            </motion.aside>

            {/* Portal drawer — renders on top */}
            <AnimatePresence>
                {showPortal && (
                    <DistributorPortalDrawer dist={dist} onClose={() => setShowPortal(false)} />
                )}
            </AnimatePresence>
        </div>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DistributorsPage() {
    const [distributors, setDistributors] = useState<Distributor[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState<DistributorStatus | "">("");
    const [showAdd, setShowAdd] = useState(false);
    const [selected, setSelected] = useState<Distributor | null>(null);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 20;

    useEffect(() => {
        api.get("/admin/distributors")
            .then(data => {
                // Map backend shape → component shape
                const mapped = (data.distributors || []).map((d: any) => ({
                    id: String(d.id),
                    name: d.name ?? d.email,
                    email: d.email,
                    phone: d.phone ?? "",
                    status: (d.status?.toLowerCase() as DistributorStatus) || "pending",
                    referralCode: d.referralCode ?? "",
                    promoCode: d.promoCode ?? undefined,
                    tier: d.tier ?? "Starter",
                    commissionPct: d.commissionPct ?? 10,
                    totalCustomers: d.totalCustomers ?? 0,
                    activeCustomers: d.activeCustomers ?? 0,
                    revenueGeneratedINR: d.revenueGeneratedINR ?? 0,
                    commissionEarnedINR: d.commissionEarnedINR ?? 0,
                    walletBalanceINR: d.walletBalanceINR ?? 0,
                    pendingWithdrawalINR: d.pendingWithdrawalINR ?? 0,
                    revenueThisYearINR: d.revenueThisYearINR ?? 0,
                    joinedAt: d.createdAt ?? new Date().toISOString(),
                    lastActiveAt: d.updatedAt ?? new Date().toISOString(),
                    monthlyBreakdown: d.monthlyBreakdown ?? [],
                }));
                setDistributors(mapped);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) return (
        <div className="p-6 flex justify-center items-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
    );

    const filtered = distributors.filter(d =>
        (!search || d.name.toLowerCase().includes(search.toLowerCase()) || d.email.toLowerCase().includes(search.toLowerCase())) &&
        (!filterStatus || d.status === filterStatus)
    );

    const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const handleAdd = async (data: Partial<Distributor>) => {
        try {
            const res = await api.post("/admin/distributors", data);
            const d = res.distributor;
            const newDist: Distributor = {
                id: String(d.id),
                name: d.name ?? d.email,
                email: d.email,
                phone: d.phone ?? "",
                status: (d.status?.toLowerCase() as DistributorStatus) || "active",
                referralCode: d.referralCode ?? "",
                tier: d.tier ?? "Starter",
                commissionPct: d.commissionPct ?? 10,
                totalCustomers: 0,
                activeCustomers: 0,
                revenueGeneratedINR: 0,
                commissionEarnedINR: 0,
                walletBalanceINR: d.walletBalance ?? 0,
                pendingWithdrawalINR: 0,
                revenueThisYearINR: d.revenueThisYear ?? 0,
                joinedAt: d.createdAt ?? new Date().toISOString(),
                lastActiveAt: d.updatedAt ?? new Date().toISOString(),
                monthlyBreakdown: [],
            };
            setDistributors((prev) => [newDist, ...prev]);
            toast.success(res.message || `${newDist.name} added successfully`);
        } catch (e: any) {
            toast.error(e.message || "Failed to create distributor");
        }
    };

    const handleUpdate = (id: string, patch: Partial<Distributor>) => {
        setDistributors(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d));
        if (selected?.id === id) setSelected(prev => prev ? { ...prev, ...patch } : null);
    };

    const totals = {
        active: distributors.filter(d => d.status === "active").length,
        pending: distributors.filter(d => d.status === "pending").length,
        revenue: distributors.reduce((s, d) => s + d.revenueGeneratedINR, 0),
        commission: distributors.reduce((s, d) => s + d.commissionEarnedINR, 0),
    };

    return (
        <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Distributors</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">Manage your reseller partner network</p>
                </div>
                <Button onClick={() => setShowAdd(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 self-start">
                    <UserPlus className="w-4 h-4" /> Add Distributor
                </Button>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Active Distributors" value={String(totals.active)} sub={`${totals.pending} pending approval`}
                    icon={<Users className="w-5 h-5 text-primary" />} colorClass="bg-blue-500/10 text-primary" />
                <StatCard label="Total Revenue Via Partners" value={`₹${(totals.revenue / 1000).toFixed(0)}K`}
                    sub="All time" icon={<TrendingUp className="w-5 h-5 text-emerald-500" />} colorClass="bg-emerald-500/10 text-emerald-500" />
                <StatCard label="Commission Paid Out" value={`₹${(totals.commission / 1000).toFixed(1)}K`}
                    sub="Earned commissions" icon={<Wallet className="w-5 h-5 text-amber-500" />} colorClass="bg-amber-500/10 text-amber-500" />
                <StatCard label="Total Customers Onboarded" value={String(distributors.reduce((s, d) => s + d.totalCustomers, 0))}
                    sub="Via distributor channel" icon={<BarChart3 className="w-5 h-5 text-indigo-400" />} colorClass="bg-purple-500/10 text-indigo-400" />
            </div>

            {/* Filter row */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Search by name or email…"
                        value={search} onChange={e => setSearch(e.target.value)}
                        className="pl-9 bg-surface-1 border-border h-9 text-sm" />
                </div>
                <div className="flex gap-1 p-0.5 bg-surface-2 rounded-lg border border-border">
                    {(["", "active", "pending", "suspended"] as const).map(s => (
                        <button key={s} onClick={() => setFilterStatus(s as DistributorStatus | "")}
                            className={cn("px-3 py-1 rounded-md text-xs font-medium transition-all",
                                filterStatus === s ? "bg-surface-1 text-primary shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"
                            )}>
                            {s === "" ? "All" : statusCfg[s as DistributorStatus].label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className="bg-surface-1 rounded-xl border border-border shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border bg-surface-2/50">
                                {["Distributor", "Tier", "Customers", "Revenue", "Commission", "Wallet", "Status", "Last Active", ""].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {paginated.length === 0 ? (
                                <tr><td colSpan={9} className="py-16 text-center text-muted-foreground text-sm">No distributors found</td></tr>
                            ) : paginated.map((d, i) => {
                                const sc = statusCfg[d.status];
                                return (
                                    <motion.tr key={d.id}
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                                        className="border-b border-border/40 hover:bg-surface-2/40 transition-colors cursor-pointer group"
                                        onClick={() => setSelected(d)}
                                    >
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                                                    {d.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-foreground">{d.name}</p>
                                                    <p className="text-xs text-muted-foreground">{d.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground bg-primary/10 text-primary px-2.5 py-1 rounded-md">
                                                {d.tier} ({d.commissionPct}%)
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-1 text-sm text-foreground">
                                                <span className="font-semibold">{d.activeCustomers}</span>
                                                <span className="text-muted-foreground">/ {d.totalCustomers}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5 text-sm font-medium text-foreground">{fmt(d.revenueGeneratedINR)}</td>
                                        <td className="px-4 py-3.5 text-sm font-medium text-success">{fmt(d.commissionEarnedINR)}</td>
                                        <td className="px-4 py-3.5 text-sm text-foreground">{fmt(d.walletBalanceINR)}</td>
                                        <td className="px-4 py-3.5">
                                            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border", sc.cls)}>
                                                {sc.icon} {sc.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                                            {formatDistanceToNow(new Date(d.lastActiveAt), { addSuffix: true })}
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                        </td>
                                    </motion.tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {filtered.length > PAGE_SIZE && (
                    <div className="px-4 py-3 border-t border-border flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                        </p>
                        <div className="flex items-center gap-1">
                            <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="h-7 w-7 p-0 bg-surface-1">
                                <ChevronLeft className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="h-7 w-7 p-0 bg-surface-1">
                                <ChevronRight className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    </div>
                )}
            </motion.div>

            {/* Modals */}
            <AddDistributorModal open={showAdd} onClose={() => setShowAdd(false)} onAdd={handleAdd} />
            {selected && (
                <DistributorDrawer dist={selected} onClose={() => setSelected(null)} onUpdate={handleUpdate} />
            )}
        </div>
    );
}
