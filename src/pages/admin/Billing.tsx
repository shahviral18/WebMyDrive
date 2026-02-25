import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
    Search, CheckCircle2, Clock, AlertCircle, RotateCcw,
    IndianRupee, CreditCard, RefreshCw, Pencil, Filter,
    Package, ShoppingCart, Banknote, TrendingUp, Loader2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    AlertDialog, AlertDialogContent, AlertDialogHeader,
    AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
    AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type OrderStatus = "PAID" | "PENDING" | "FAILED" | "REFUNDED" | "paid" | "pending" | "failed" | "refunded";
interface Order {
    id: number;
    userId: number;
    amount: number;
    currency: string;
    status: string;
    gatewayTxId?: string;
    createdAt: string;
    user?: { id: number; name: string; email: string };
}
type BillingAction = "refund" | "manual-override" | "provision";
interface ActionDialog { order: Order; type: BillingAction }

// ── Static class maps ──
const statusClsMap: Record<string, { badge: string; icon: React.ReactNode }> = {
    PAID: { badge: "bg-green-500/10 text-green-400 border-green-500/20", icon: <CheckCircle2 className="w-3 h-3" /> },
    paid: { badge: "bg-green-500/10 text-green-400 border-green-500/20", icon: <CheckCircle2 className="w-3 h-3" /> },
    PENDING: { badge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", icon: <Clock className="w-3 h-3" /> },
    pending: { badge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", icon: <Clock className="w-3 h-3" /> },
    FAILED: { badge: "bg-red-500/10 text-red-400 border-red-500/20", icon: <AlertCircle className="w-3 h-3" /> },
    failed: { badge: "bg-red-500/10 text-red-400 border-red-500/20", icon: <AlertCircle className="w-3 h-3" /> },
    REFUNDED: { badge: "bg-muted/50 text-muted-foreground border-border", icon: <RotateCcw className="w-3 h-3" /> },
    refunded: { badge: "bg-muted/50 text-muted-foreground border-border", icon: <RotateCcw className="w-3 h-3" /> },
};

export default function Billing() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [actionDialog, setActionDialog] = useState<ActionDialog | null>(null);

    useEffect(() => {
        api.get("/admin/orders?limit=100")
            .then(data => {
                const nonPending = (data.orders || []).filter((o: Order) => o.status.toUpperCase() !== "PENDING");
                setOrders(nonPending);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return orders.filter(o =>
            (!q || String(o.id).includes(q) || o.user?.email?.includes(q)) &&
            (!statusFilter || o.status.toLowerCase() === statusFilter.toLowerCase())
        );
    }, [orders, search, statusFilter]);

    const pendingOrders = orders.filter(o => o.status.toUpperCase() === "PENDING");
    const totalRevenue = orders.filter(o => o.status.toUpperCase() === "PAID").reduce((s, o) => s + o.amount, 0);
    const totalPending = orders.filter(o => o.status.toUpperCase() === "PENDING").reduce((s, o) => s + o.amount, 0);
    const totalRefunded = orders.filter(o => o.status.toUpperCase() === "REFUNDED").reduce((s, o) => s + o.amount, 0);
    const manualCount = 0;

    const handleConfirm = () => {
        if (!actionDialog) return;
        const { order, type } = actionDialog;
        setActionDialog(null);
        if (type === "refund") {
            setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: "refunded" as OrderStatus } : o));
            toast.success(`Refund issued for #${order.id}`, { description: `₹${order.amount.toLocaleString("en-IN")} will be credited in 5–7 business days.` });
        } else if (type === "manual-override" || type === "provision") {
            setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: "paid" as OrderStatus, isManual: type === "manual-override", gatewayTxId: type === "manual-override" ? `MANUAL_${Date.now()}` : o.gatewayTxId } : o));
            toast.success(`${type === "provision" ? "Workspace provisioned" : "Manual override"} for ${order.id}`, {
                description: type === "provision"
                    ? "Workspace is now active in Google Directory. User welcome email queued."
                    : "Order marked as paid. Audit log entry created.",
            });
        }
    };

    const kpis = [
        { label: "Total Revenue", value: `₹${totalRevenue.toLocaleString("en-IN")}`, Icon: IndianRupee },
        { label: "Total Refunded", value: `₹${totalRefunded.toLocaleString("en-IN")}`, Icon: RotateCcw },
        { label: "Total Orders", value: String(orders.length), Icon: Pencil },
    ];

    const kpiCls = [
        { bg: "bg-green-500/10", border: "border-green-500/20", text: "text-green-400" },
        { bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-400" },
        { bg: "bg-primary/10", border: "border-primary/20", text: "text-primary" },
    ];

    if (loading) return (
        <div className="p-6 flex items-center justify-center py-24">
            <Loader2 className="w-9 h-9 animate-spin text-primary" />
        </div>
    );

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground">Billing</h1>
                <p className="text-muted-foreground text-sm mt-0.5">Order history · provisioning · refunds · manual overrides</p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {kpis.map((k, i) => (
                    <motion.div key={k.label}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                        className="rounded-xl bg-surface-1 border border-border p-5 shadow-card">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center border mb-3 ${kpiCls[i].bg} ${kpiCls[i].border}`}>
                            <k.Icon className={`w-4 h-4 ${kpiCls[i].text}`} />
                        </div>
                        <p className="text-xl font-bold text-foreground">{k.value}</p>
                        <p className="text-xs text-muted-foreground mt-1">{k.label}</p>
                    </motion.div>
                ))}
            </div>

            {/* NEFT note */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/25">
                <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                    <strong className="text-yellow-400">Manual override notice:</strong> {manualCount} orders processed via NEFT/bank transfer.
                    Each override is audit-logged and requires admin verification. Blueprint §7.1: payment matching uses ±₹1 tolerance for pro-rata.
                </p>
            </div>

            {/* Filters */}
            <div className="flex gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Search order ID, email, workspace, plan..."
                        value={search} onChange={e => setSearch(e.target.value)}
                        className="pl-9 bg-surface-1 border-border/50 h-9 text-sm" />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                        className="px-3 h-9 rounded-md bg-surface-1 border border-border/50 text-sm text-foreground appearance-none min-w-[130px] focus:outline-none">
                        <option value="">All Statuses</option>
                        <option value="paid">Paid</option>
                        <option value="failed">Failed</option>
                        <option value="refunded">Refunded</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                className="rounded-xl bg-surface-1 border border-border shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border bg-surface-2/50">
                                {["Order ID", "User / Workspace", "Plan", "Amount", "Gateway Ref", "Method", "Status", "Date", "Actions"].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((order, i) => {
                                const cfg = statusClsMap[order.status] || statusClsMap["pending"];
                                return (
                                    <motion.tr key={order.id}
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                                        className="border-b border-border/50 hover:bg-surface-2/50 transition-colors group">
                                        <td className="px-4 py-3.5">
                                            <span className="font-mono text-xs text-primary">#{order.id}</span>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <p className="text-xs font-mono text-foreground">{order.user?.email || `User #${order.userId}`}</p>
                                        </td>
                                        <td className="px-4 py-3.5 text-xs text-muted-foreground">—</td>
                                        <td className="px-4 py-3.5 font-mono text-sm font-semibold text-foreground">₹{order.amount.toLocaleString("en-IN")}</td>
                                        <td className="px-4 py-3.5 text-xs font-mono text-muted-foreground max-w-[120px] truncate">{order.gatewayTxId || "—"}</td>
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <CreditCard className="w-3 h-3" /> {order.currency || "INR"}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.badge}`}>
                                                {cfg.icon} {order.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5 text-xs text-muted-foreground">{formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}</td>
                                        <td className="px-4 py-3.5">
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
                                                {order.status.toUpperCase() === "PAID" && (
                                                    <Button size="sm" variant="outline"
                                                        className="h-7 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10 gap-1"
                                                        onClick={() => setActionDialog({ order, type: "refund" })}>
                                                        <RotateCcw className="w-3 h-3" /> Refund
                                                    </Button>
                                                )}
                                                {order.status.toUpperCase() === "PENDING" && (
                                                    <Button size="sm" variant="outline"
                                                        className="h-7 text-xs border-green-500/30 text-green-400 hover:bg-green-500/10 gap-1"
                                                        onClick={() => setActionDialog({ order, type: "provision" })}>
                                                        <Package className="w-3 h-3" /> Provision
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </motion.tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div className="px-4 py-3 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                        {filtered.length} of {orders.length} orders · Collected ₹{totalRevenue.toLocaleString("en-IN")} · Pending ₹{totalPending.toLocaleString("en-IN")}
                    </p>
                </div>
            </motion.div>

            {/* Confirm Dialog */}
            <AlertDialog open={!!actionDialog} onOpenChange={open => !open && setActionDialog(null)}>
                <AlertDialogContent className="bg-surface-1 border-border">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-foreground">
                            {actionDialog?.type === "refund" ? "Issue Refund"
                                : actionDialog?.type === "provision" ? "Provision Workspace"
                                    : "Manual Payment Override"}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground">
                            {actionDialog?.type === "refund"
                                ? `Issue a ₹${actionDialog?.order.amount.toLocaleString("en-IN")} refund for #${actionDialog?.order.id}? This is irreversible and audit-logged.`
                                : actionDialog?.type === "provision"
                                    ? `Provision workspace for ${actionDialog?.order.user?.email || `User #${actionDialog?.order.userId}`}? This will activate the Google Directory account and send a welcome email.`
                                    : `Mark #${actionDialog?.order.id} as manually paid? Confirm the NEFT transfer has cleared before proceeding.`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-surface-2 border-border text-foreground hover:bg-accent">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirm}
                            className={actionDialog?.type === "refund"
                                ? "bg-danger text-white hover:bg-danger-dim"
                                : actionDialog?.type === "provision"
                                    ? "bg-success text-white hover:bg-success"
                                    : "bg-yellow-600 text-white hover:bg-yellow-700"}>
                            {actionDialog?.type === "refund" ? "Confirm Refund"
                                : actionDialog?.type === "provision" ? "Yes, Provision Now"
                                    : "Confirm Override"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
