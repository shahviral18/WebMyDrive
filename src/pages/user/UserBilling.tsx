import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Zap, AlertCircle, CalendarClock, ShieldCheck, CheckCircle2, Clock, Wallet, Tag, TrendingUp, TrendingDown, ArrowRightLeft, FileText, Download } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import UserLayout from "@/components/user/UserLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatDistanceToNow, format } from "date-fns";

function parseFeatures(f: string | null): string[] {
    if (!f) return [];
    try { return JSON.parse(f); } catch { return f.split(",").map(s => s.trim()).filter(Boolean); }
}

interface CurrentPlan {
    hasPlan: boolean;
    planName?: string;
    billingPeriod?: string;
    renewalDate?: string;
    daysRemaining?: number;
    baseAmountPaid?: number;
    features?: string;
}

interface AutoRenewalStatus {
    autoRenew: boolean;
    mandateStatus: "none" | "pending" | "active";
}

interface Order {
    id: number;
    amount: number;
    currency: string;
    status: string;
    gatewayTxId?: string;
    createdAt: string;
}

interface Invoice {
    id: number;
    invoiceNumber: string;
    invoiceDate: string;
    paymentDate?: string;
    expiryDate?: string;
    renewalDate?: string;
    planName?: string;
    itemDetails?: string;
    baseAmount?: number;
    gstAmount?: number;
    totalAmount?: number;
    currency: string;
    status: string;
    source: string;
    hasPdf: number;
    createdAt: string;
}

export default function UserBilling() {
    const navigate = useNavigate();

    const isAlsoDistributor = !!localStorage.getItem("wmd_dist_token");

    const switchToDistributor = (destination: string) => {
        const distToken = localStorage.getItem("wmd_dist_token");
        if (!distToken) return;
        localStorage.setItem("wmd_user_token", localStorage.getItem("token") || "");
        localStorage.setItem("token", distToken);
        sessionStorage.setItem("wmd_user_role", "distributor");
        window.location.href = import.meta.env.BASE_URL.replace(/\/$/, "") + destination;
    };
    const [pageLoading, setPageLoading] = useState(true);
    const [orders, setOrders] = useState<Order[]>([]);
    const [currentPlan, setCurrentPlan] = useState<CurrentPlan | null>(null);
    const [autoRenewal, setAutoRenewal] = useState<AutoRenewalStatus | null>(null);
    const [walletBalance, setWalletBalance] = useState<number>(0);
    const [walletTxs, setWalletTxs] = useState<any[]>([]);
    const [voucherCode, setVoucherCode] = useState("");
    const [redeemingVoucher, setRedeemingVoucher] = useState(false);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [downloadingId, setDownloadingId] = useState<number | null>(null);

    const fetchWallet = async () => {
        try {
            const data = await api.get("/user/wallet-transactions");
            setWalletBalance(data.walletBalance ?? 0);
            setWalletTxs(data.transactions ?? []);
        } catch { /* non-fatal */ }
    };

    useEffect(() => {
        Promise.all([
            api.get("/referral/my-orders"),
            api.get("/user/current-plan"),
            api.get("/user/autorenewal-status").catch(() => null),
            api.get("/user/wallet-transactions").catch(() => null),
            api.get("/invoices/my").catch(() => null),
        ]).then(([ordersData, planData, arData, walletData, invoiceData]) => {
            setOrders(ordersData.orders || []);
            setCurrentPlan(planData);
            setAutoRenewal(arData);
            if (walletData) {
                setWalletBalance(walletData.walletBalance ?? 0);
                setWalletTxs(walletData.transactions ?? []);
            }
            if (invoiceData) setInvoices(invoiceData.invoices || []);
        }).catch(() => {
            setOrders([]);
            setCurrentPlan({ hasPlan: false });
        }).finally(() => {
            setPageLoading(false);
        });
    }, []);

    const handleDownloadInvoice = async (invoice: Invoice) => {
        setDownloadingId(invoice.id);
        try {
            const token = localStorage.getItem("token") || "";
            const base = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
            const res = await fetch(`${base}/invoices/download/${invoice.id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error("Download failed");
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Invoice_${invoice.invoiceNumber}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch {
            toast.error("Could not download the invoice PDF");
        } finally {
            setDownloadingId(null);
        }
    };

    const handleRedeemVoucher = async () => {
        if (!voucherCode.trim()) return toast.error("Enter a voucher code");
        setRedeemingVoucher(true);
        try {
            const res = await api.post("/user/redeem-voucher", { code: voucherCode.trim().toUpperCase() });
            toast.success(`₹${res.credited?.toLocaleString("en-IN")} credited to your wallet!`);
            setVoucherCode("");
            await fetchWallet();
        } catch (e: any) {
            toast.error(e?.message || "Invalid or expired voucher code");
        } finally {
            setRedeemingVoucher(false);
        }
    };

    return (
        <UserLayout>
            <div className="space-y-6">
                <h1 className="text-2xl font-bold text-foreground">Plan & Billing</h1>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Current Plan */}
                    <Card className="border-border shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Zap className="w-24 h-24 text-primary" />
                        </div>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-primary">
                                <Zap className="w-5 h-5 fill-current" />
                                Current Plan
                            </CardTitle>
                            <CardDescription>Your active subscription details</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {pageLoading ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : currentPlan?.hasPlan ? (
                                <>
                                    <div className="flex items-baseline gap-1 mb-1">
                                        <span className="text-3xl font-bold text-foreground">{currentPlan.planName}</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-4 capitalize">
                                        {currentPlan.billingPeriod} billing
                                        {currentPlan.daysRemaining != null ? ` · ${currentPlan.daysRemaining} days remaining` : ""}
                                    </p>
                                    <Button onClick={() => navigate("/user/plans")} className="w-full bg-primary text-white hover:bg-primary-dim">
                                        View All Plans
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <div className="flex items-baseline gap-1 mb-4">
                                        <span className="text-3xl font-bold text-foreground">Starter</span>
                                        <span className="text-muted-foreground text-sm ml-1">Free</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-6">Upgrade to unlock more storage and advanced features.</p>
                                    <Button onClick={() => navigate("/user/plans")} className="w-full bg-primary text-white hover:bg-primary-dim">
                                        Upgrade Plan
                                    </Button>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Auto-Renewal / Payment Info */}
                    <Card className="border-border shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-muted-foreground">
                                <CalendarClock className="w-5 h-5" />
                                Auto-Renewal
                            </CardTitle>
                            <CardDescription>Your subscription renewal details</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {pageLoading ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : currentPlan?.hasPlan && currentPlan.renewalDate ? (
                                <>
                                    <div className="p-4 rounded-lg border border-border bg-surface-2/50 space-y-1">
                                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Next Renewal</p>
                                        <p className="text-lg font-semibold text-foreground">
                                            {format(new Date(currentPlan.renewalDate), "dd MMM yyyy")}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {formatDistanceToNow(new Date(currentPlan.renewalDate), { addSuffix: true })}
                                        </p>
                                    </div>
                                    {autoRenewal && (
                                        <div className={`flex items-center gap-3 p-3 rounded-lg border ${
                                            autoRenewal.mandateStatus === "active"
                                                ? "bg-success/5 border-success/20"
                                                : autoRenewal.mandateStatus === "pending"
                                                ? "bg-warning/5 border-warning/20"
                                                : "bg-muted/30 border-border"
                                        }`}>
                                            {autoRenewal.mandateStatus === "active" ? (
                                                <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                                            ) : autoRenewal.mandateStatus === "pending" ? (
                                                <Clock className="w-4 h-4 text-warning shrink-0" />
                                            ) : (
                                                <CalendarClock className="w-4 h-4 text-muted-foreground shrink-0" />
                                            )}
                                            <p className="text-xs text-muted-foreground">
                                                Auto-renewal:{" "}
                                                <span className="font-semibold text-foreground">
                                                    {autoRenewal.mandateStatus === "active" ? "Enabled" : autoRenewal.mandateStatus === "pending" ? "Pending setup" : "Not set up"}
                                                </span>
                                            </p>
                                        </div>
                                    )}
                                    <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-2/50 border border-border">
                                        <ShieldCheck className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                                        <p className="text-xs text-muted-foreground">
                                            Payments are processed securely by <span className="font-semibold text-foreground">Zoho Payments</span>. We never store your card details.
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center gap-2 py-8 text-center">
                                    <CalendarClock className="w-8 h-8 text-muted-foreground" />
                                    <p className="text-sm text-muted-foreground">No active subscription.</p>
                                    <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-2/50 border border-border mt-2 text-left">
                                        <ShieldCheck className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                                        <p className="text-xs text-muted-foreground">
                                            Payments are processed securely by <span className="font-semibold text-foreground">Zoho Payments</span>. We never store your card details.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Wallet Credits */}
                <Card className="border-border shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Wallet className="w-5 h-5 text-primary" />
                            Wallet Credits
                        </CardTitle>
                        <CardDescription>Your referral & voucher credits usable on renewals and plan purchases</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {isAlsoDistributor ? (
                            <div className="flex flex-col items-center text-center gap-4 py-6">
                                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                                    <Wallet className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <p className="font-semibold text-foreground">Your earnings wallet is in the Distributor panel</p>
                                    <p className="text-sm text-muted-foreground mt-1">Commission credits and withdrawals are managed there.</p>
                                </div>
                                <Button onClick={() => switchToDistributor("/distributor/wallet")} className="gap-2">
                                    <ArrowRightLeft className="w-4 h-4" />
                                    Switch to Distributor Panel
                                </Button>
                            </div>
                        ) : (
                        <><div className="flex items-center justify-between p-4 rounded-lg bg-primary/5 border border-primary/20">
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Available Balance</p>
                                <p className="text-3xl font-bold text-primary">₹{walletBalance.toLocaleString("en-IN")}</p>
                            </div>
                        </div>

                        {/* Redeem voucher */}
                        <div className="flex gap-2">
                            <Input
                                placeholder="Enter voucher code (e.g. WMDABCD1234)"
                                value={voucherCode}
                                onChange={e => setVoucherCode(e.target.value.toUpperCase())}
                                className="font-mono uppercase"
                                onKeyDown={e => e.key === "Enter" && handleRedeemVoucher()}
                            />
                            <Button onClick={handleRedeemVoucher} disabled={redeemingVoucher} className="shrink-0">
                                {redeemingVoucher ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Tag className="w-4 h-4 mr-1" />Redeem</>}
                            </Button>
                        </div>

                        {/* Transaction history */}
                        {walletTxs.length > 0 && (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Expires</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {walletTxs.slice(0, 10).map((tx: any) => (
                                        <TableRow key={tx.id}>
                                            <TableCell className="text-xs text-muted-foreground">{tx.createdAt ? format(new Date(tx.createdAt), "dd MMM yy") : "—"}</TableCell>
                                            <TableCell className="text-xs text-foreground max-w-[200px] truncate">{tx.description || tx.source}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{tx.expires_at ? format(new Date(tx.expires_at), "dd MMM yy") : "—"}</TableCell>
                                            <TableCell className="text-right font-semibold text-sm">
                                                <span className={tx.type === "CREDIT" ? "text-success" : "text-destructive"}>
                                                    {tx.type === "CREDIT" ? <TrendingUp className="inline w-3 h-3 mr-1" /> : <TrendingDown className="inline w-3 h-3 mr-1" />}
                                                    {tx.type === "CREDIT" ? "+" : "−"}₹{Number(tx.amount).toLocaleString("en-IN")}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                        </>
                        )}
                    </CardContent>
                </Card>

                {/* Order History */}
                <Card className="border-border shadow-sm">
                    <CardHeader>
                        <CardTitle>Order History</CardTitle>
                        <CardDescription>Your past orders and payments</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {pageLoading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : orders.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 py-10 text-center">
                                <AlertCircle className="w-8 h-8 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">No orders yet.</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[100px]">Order</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Ref</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {orders.map((order) => (
                                        <TableRow key={order.id}>
                                            <TableCell className="font-medium text-foreground font-mono">#{order.id}</TableCell>
                                            <TableCell className="text-muted-foreground text-xs">{formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}</TableCell>
                                            <TableCell className="text-foreground font-semibold">₹{order.amount.toLocaleString("en-IN")}</TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className={order.status === "PAID" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
                                                    {order.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right text-xs font-mono text-muted-foreground truncate max-w-[100px]">{order.gatewayTxId || "—"}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>

                {/* Invoice History */}
                <Card className="border-border shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-primary" />
                            Invoice History
                        </CardTitle>
                        <CardDescription>Download your GST invoices — including historical records</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {pageLoading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : invoices.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 py-10 text-center">
                                <FileText className="w-8 h-8 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">No invoices yet.</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Invoice #</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Plan</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">PDF</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {invoices.map((inv) => (
                                        <TableRow key={inv.id}>
                                            <TableCell className="font-mono text-sm text-foreground">
                                                {inv.invoiceNumber}
                                                {inv.source === "MANUAL" && (
                                                    <Badge variant="secondary" className="ml-2 text-[10px] py-0 px-1.5 bg-muted text-muted-foreground">Historical</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {inv.invoiceDate ? format(new Date(inv.invoiceDate), "dd MMM yyyy") : "—"}
                                            </TableCell>
                                            <TableCell className="text-xs text-foreground max-w-[140px] truncate">
                                                {inv.planName || "—"}
                                            </TableCell>
                                            <TableCell className="font-semibold text-sm">
                                                {inv.totalAmount != null
                                                    ? `₹${Number(inv.totalAmount).toLocaleString("en-IN")}`
                                                    : "—"}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className={
                                                    inv.status === "PAID" ? "bg-success/10 text-success" :
                                                    inv.status === "CANCELLED" ? "bg-destructive/10 text-destructive" :
                                                    "bg-muted text-muted-foreground"
                                                }>
                                                    {inv.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {inv.hasPdf ? (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="gap-1"
                                                        disabled={downloadingId === inv.id}
                                                        onClick={() => handleDownloadInvoice(inv)}
                                                    >
                                                        {downloadingId === inv.id
                                                            ? <Loader2 className="w-3 h-3 animate-spin" />
                                                            : <Download className="w-3 h-3" />}
                                                        PDF
                                                    </Button>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </UserLayout>
    );
}
