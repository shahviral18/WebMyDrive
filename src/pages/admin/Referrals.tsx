import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
    Search, Users, Gift, TrendingUp, Wallet,
    CheckCircle2, Clock, XCircle, Banknote, Filter, Loader2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow, format } from "date-fns";
import { api } from "@/lib/api";

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

export default function Referrals() {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState<ReferralLog[]>([]);
    const [analytics, setAnalytics] = useState<any>(null);

    useEffect(() => {
        setLoading(true);
        api.get("/admin/referral-analytics")
            .then(data => {
                setAnalytics(data);
                setLogs(data.recentLogs || []);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

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
            <div>
                <h1 className="text-2xl font-bold text-foreground">Referrals & Wallet</h1>
                <p className="text-muted-foreground text-sm mt-0.5">
                    Live referral ledger · 5% wallet credit to referrer · Decaying over 5 years
                </p>
            </div>

            {/* Programme summary */}
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                <p className="text-sm font-semibold text-primary mb-1 flex items-center gap-2">
                    <Gift className="w-4 h-4" /> Referral & Commission System
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                    When a referred user makes their first payment, the referrer earns a <strong className="text-foreground">5% wallet credit</strong> of the order value.
                    Credits decay over years 1–5: <strong className="text-foreground">5% → 4% → 3% → 2% → 1% → 0%</strong>.
                    Annual soft reset applies to distributor tiers. Wallet minimum balance protects against forfeit on lapse.
                </p>
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
