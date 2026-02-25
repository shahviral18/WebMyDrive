import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
    Search, Gift, TrendingUp, Wallet,
    CheckCircle2, Clock, XCircle, Banknote, Filter, Loader2, Settings2, Save
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { api } from "@/lib/api";
import { toast } from "sonner";

type ReferralStatus = "pending" | "vested" | "redeemed" | "cancelled" | "PENDING" | "VESTED" | "CANCELLED" | "REDEEMED";

interface ReferralLog {
    id: number;
    referrer: string;
    referee: string;
    amount: number;
    year: number;
    status: string;
    date: string;
}

const statusConfig: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    PENDING: { label: "Pending", className: "bg-warning/10 text-warning border-warning/20", icon: <Clock className="w-3 h-3" /> },
    pending: { label: "Pending", className: "bg-warning/10 text-warning border-warning/20", icon: <Clock className="w-3 h-3" /> },
    VESTED: { label: "Vested", className: "bg-success/10 text-success border-success/20", icon: <CheckCircle2 className="w-3 h-3" /> },
    vested: { label: "Vested", className: "bg-success/10 text-success border-success/20", icon: <CheckCircle2 className="w-3 h-3" /> },
    REDEEMED: { label: "Redeemed", className: "bg-primary/10 text-primary border-primary/20", icon: <Banknote className="w-3 h-3" /> },
    redeemed: { label: "Redeemed", className: "bg-primary/10 text-primary border-primary/20", icon: <Banknote className="w-3 h-3" /> },
    CANCELLED: { label: "Cancelled", className: "bg-muted text-muted-foreground border-border", icon: <XCircle className="w-3 h-3" /> },
    cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground border-border", icon: <XCircle className="w-3 h-3" /> },
};

const DEFAULT_REF_CONFIG = {
    referralCreditRate: 0.05,
    distributorCreditRate: 0.08,
    customerDiscountRate: 0.0,
};

export default function Referrals() {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState<ReferralLog[]>([]);
    const [analytics, setAnalytics] = useState<any>(null);

    // Referral Engine Config
    const [refConfig, setRefConfig] = useState<typeof DEFAULT_REF_CONFIG>(DEFAULT_REF_CONFIG);
    const [savingConfig, setSavingConfig] = useState(false);

    useEffect(() => {
        setLoading(true);
        Promise.all([
            api.get("/admin/referral-analytics"),
            api.get("/admin/config?type=GLOBAL_PLAN_SETTINGS"),
        ])
            .then(([data, cfg]) => {
                setAnalytics(data);
                setLogs(data.recentLogs || []);
                if (cfg && typeof cfg === "object") {
                    setRefConfig({
                        referralCreditRate: cfg.referralCreditRate ?? 0.05,
                        distributorCreditRate: cfg.distributorCreditRate ?? 0.08,
                        customerDiscountRate: cfg.customerDiscountRate ?? 0.0,
                    });
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const saveRefConfig = async () => {
        setSavingConfig(true);
        try {
            // Merge referral rates back into full GLOBAL_PLAN_SETTINGS
            const current = await api.get("/admin/config?type=GLOBAL_PLAN_SETTINGS");
            const merged = { ...(current || {}), ...refConfig };
            await api.post("/admin/config", { type: "GLOBAL_PLAN_SETTINGS", data: merged });
            toast.success("Referral engine settings saved");
        } catch (e: any) {
            toast.error(e.message || "Failed to save settings");
        } finally {
            setSavingConfig(false);
        }
    };

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return logs.filter(r => {
            const matchSearch = !q || r.referrer?.includes(q) || r.referee?.includes(q);
            const matchStatus = !statusFilter || r.status.toLowerCase() === statusFilter.toLowerCase();
            return matchSearch && matchStatus;
        });
    }, [logs, search, statusFilter]);

    const statusCounts = useMemo(() => {
        const counts: Record<string, number> = { pending: 0, vested: 0, redeemed: 0, cancelled: 0 };
        logs.forEach(l => {
            const key = l.status.toLowerCase();
            if (key in counts) counts[key]++;
        });
        return counts;
    }, [logs]);

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Referrals &amp; Wallet</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Live referral ledger — configure commission rates below
                    </p>
                </div>
            </div>

            {/* Referral Engine Settings */}
            <div className="bg-surface-1 border border-border rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                            <Settings2 className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-foreground">Referral Engine Settings</h2>
                            <p className="text-xs text-muted-foreground">Controls all commission &amp; discount rates globally</p>
                        </div>
                    </div>
                    <Button
                        size="sm"
                        onClick={saveRefConfig}
                        disabled={savingConfig}
                        className="bg-primary hover:bg-primary/90 h-8 text-xs gap-1.5"
                    >
                        {savingConfig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Save Settings
                    </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">User Referral Credit (%)</label>
                        <p className="text-[11px] text-muted-foreground/70">Wallet credit % given to the referring user</p>
                        <Input
                            type="number" min={0} max={100} step={0.5}
                            value={refConfig.referralCreditRate * 100}
                            onChange={e => setRefConfig(c => ({ ...c, referralCreditRate: Number(e.target.value) / 100 }))}
                            className="h-9 bg-surface-2 border-border/60"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">Distributor Credit (%)</label>
                        <p className="text-[11px] text-muted-foreground/70">Commission % credited to distributors per sale</p>
                        <Input
                            type="number" min={0} max={100} step={0.5}
                            value={refConfig.distributorCreditRate * 100}
                            onChange={e => setRefConfig(c => ({ ...c, distributorCreditRate: Number(e.target.value) / 100 }))}
                            className="h-9 bg-surface-2 border-border/60"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">Customer Discount (%)</label>
                        <p className="text-[11px] text-muted-foreground/70">Discount given to buyer when using a referral code</p>
                        <Input
                            type="number" min={0} max={100} step={0.5}
                            value={refConfig.customerDiscountRate * 100}
                            onChange={e => setRefConfig(c => ({ ...c, customerDiscountRate: Number(e.target.value) / 100 }))}
                            className="h-9 bg-surface-2 border-border/60"
                        />
                    </div>
                </div>
            </div>

            {/* KPI row */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: "Total Commission Paid (₹)", value: `₹${(analytics?.totalCommissionPaid || 0).toLocaleString("en-IN")}`, icon: Wallet },
                            { label: "Total Referral Events", value: analytics?.totalReferrals || 0, icon: Gift },
                            { label: "Vested Credits", value: statusCounts.vested, icon: CheckCircle2 },
                            { label: "Pending Credits", value: statusCounts.pending, icon: TrendingUp },
                        ].map((kpi, i) => (
                            <motion.div
                                key={kpi.label}
                                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                                className="rounded-xl bg-surface-1 border border-border p-4 shadow-card"
                            >
                                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-3">
                                    <kpi.icon className="w-4 h-4 text-primary" />
                                </div>
                                <p className="text-xl font-bold text-foreground">{kpi.value}</p>
                                <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
                            </motion.div>
                        ))}
                    </div>

                    {/* Status chips */}
                    <div className="grid grid-cols-4 gap-3">
                        {(["pending", "vested", "redeemed", "cancelled"] as string[]).map(s => (
                            <button
                                key={s}
                                onClick={() => setStatusFilter(statusFilter === s ? "" : s)}
                                className={`p-3 rounded-xl bg-surface-1 border text-center transition-colors ${statusFilter === s ? "border-primary/40 bg-primary/5" : "border-border"}`}
                            >
                                <p className={`text-xl font-bold ${s === "pending" ? "text-warning" : s === "vested" ? "text-success" : s === "redeemed" ? "text-primary" : "text-muted-foreground"}`}>
                                    {statusCounts[s]}
                                </p>
                                <p className="text-xs text-muted-foreground capitalize">{s}</p>
                            </button>
                        ))}
                    </div>

                    {/* Filter bar */}
                    <div className="flex gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search referrer or referee email..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-9 bg-surface-1 border-border/50 h-9 text-sm"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-muted-foreground" />
                            <select
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)}
                                className="px-3 h-9 rounded-md bg-surface-1 border border-border/50 text-sm text-foreground appearance-none min-w-[140px] focus:outline-none"
                            >
                                <option value="">All Statuses</option>
                                <option value="pending">Pending</option>
                                <option value="vested">Vested</option>
                                <option value="redeemed">Redeemed</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </div>
                    </div>

                    {/* Ledger Table */}
                    <motion.div
                        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                        className="rounded-xl bg-surface-1 border border-border shadow-card overflow-hidden"
                    >
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-border bg-surface-2/50">
                                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Referrer</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Referee</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Year</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Commission (₹)</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">
                                                {logs.length === 0 ? "No referrals have been generated yet." : "No referrals match your filters."}
                                            </td>
                                        </tr>
                                    ) : (
                                        filtered.map((ref, i) => {
                                            const cfg = statusConfig[ref.status] || statusConfig["pending"];
                                            return (
                                                <motion.tr
                                                    key={ref.id}
                                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                                                    className="border-b border-border/50 hover:bg-surface-2/50 transition-colors"
                                                >
                                                    <td className="px-4 py-3.5 text-xs font-mono text-foreground">{ref.referrer}</td>
                                                    <td className="px-4 py-3.5 text-xs font-mono text-muted-foreground">{ref.referee || "—"}</td>
                                                    <td className="px-4 py-3.5 text-xs text-foreground">Year {ref.year}</td>
                                                    <td className="px-4 py-3.5 text-xs font-mono text-success">₹{Number(ref.amount).toLocaleString("en-IN")}</td>
                                                    <td className="px-4 py-3.5">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.className}`}>
                                                            {cfg.icon} {cfg.label}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3.5 text-xs text-muted-foreground">
                                                        {ref.date ? formatDistanceToNow(new Date(ref.date), { addSuffix: true }) : "—"}
                                                    </td>
                                                </motion.tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-4 py-3 border-t border-border">
                            <p className="text-xs text-muted-foreground">
                                Showing {filtered.length} of {logs.length} entries · Ledger is immutable — all entries are append-only
                            </p>
                        </div>
                    </motion.div>
                </>
            )}
        </div>
    );
}
