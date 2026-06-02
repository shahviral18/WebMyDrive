import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    Users, TrendingUp, Wallet, CheckCircle2, Clock, XCircle,
    MoreHorizontal, Copy, ExternalLink, UserPlus, Search,
    ChevronRight, BarChart3, ArrowUpRight, ChevronLeft, Loader2,
    Tag, Plus, X, Link
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
    ResponsiveContainer, CartesianGrid,
} from "recharts";
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

// ── Distributor detail drawer ─────────────────────────────────────────────────
function DistributorDrawer({ dist, onClose, onUpdate }: {
    dist: Distributor;
    onClose: () => void;
    onUpdate: (id: string, patch: Partial<Distributor>) => void;
}) {
    const sc = statusCfg[dist.status];
    const [showPromoDialog, setShowPromoDialog] = useState(false);
    const [currentPromoCode, setCurrentPromoCode] = useState<string | undefined>(dist.promoCode);

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
