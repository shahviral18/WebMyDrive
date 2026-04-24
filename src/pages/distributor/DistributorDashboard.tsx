import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
    DollarSign, Copy, Zap, MessageSquare, Tag,
    Users, TrendingUp, ArrowRight, CheckCircle
} from "lucide-react";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import DistributorLayout from "@/components/distributor/DistributorLayout";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/utils";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { PanelSwitcher } from "@/components/PanelSwitcher";

export default function DistributorDashboard() {
    const [data, setData] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        Promise.all([
            api.get("/distributor/dashboard"),
            api.get("/distributor/history")
        ])
            .then(([dashData, histData]) => {
                setData(dashData);
                // Persist user token for panel switching (works for existing sessions too)
                if (dashData?.userToken) {
                    localStorage.setItem("wmd_user_token", dashData.userToken);
                    if (!localStorage.getItem("wmd_dist_token")) {
                        localStorage.setItem("wmd_dist_token", localStorage.getItem("token") || "");
                    }
                }
                const hist = histData?.history ?? histData ?? [];
                setHistory(Array.isArray(hist) ? hist : []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const requestPayout = async () => {
        if (!data) return;
        const available = data.distributor.walletBalance - 2000;
        if (available < 5000) {
            toast.error("Minimum payout is Rs 5,000 above the Rs 2,000 threshold.");
            return;
        }
        try {
            const result = await api.post("/distributor/request-payout", { amount: available });
            if (result.success) {
                toast.success(`Payout of Rs ${result.amountPaid} requested!`);
                setData({ ...data, distributor: { ...data.distributor, walletBalance: data.distributor.walletBalance - available } });
            } else {
                toast.error(result.error || "Failed payout");
            }
        } catch {
            toast.error("Error connecting to server");
        }
    };

    // Build monthly commission trend from history (last 6 months)
    const monthlyTrend = useMemo(() => {
        const counts: Record<string, number> = {};
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = d.toLocaleString("default", { month: "short", year: "2-digit" });
            counts[key] = 0;
        }
        history.forEach((s: any) => {
            if (!s.date) return;
            const d = new Date(s.date);
            const key = d.toLocaleString("default", { month: "short", year: "2-digit" });
            if (key in counts) counts[key] = (counts[key] || 0) + (s.commission || 0);
        });
        return Object.entries(counts).map(([month, commission]) => ({ month, commission }));
    }, [history]);

    if (loading) return <DistributorLayout><div className="p-8 text-muted-foreground">Loading…</div></DistributorLayout>;

    if (!data?.distributor) return (
        <DistributorLayout>
            <div className="p-8">Distributor account not found. Please contact support.</div>
        </DistributorLayout>
    );

    const dist = data.distributor;
    const nextTier = data.nextTier;
    const promoCode: string | null = data.promoCode ?? null;
    const promoDiscounts: Record<string, number> = data.promoDiscounts ?? {};
    const availablePayout = Math.max(0, dist.walletBalance - 2000);
    const refCode: string = data.referralCode || (dist as any).referralCode || `DIST${dist.id}`;
    const refLink = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/ref/${refCode}`;
    const progressValue = nextTier ? Math.min(100, (dist.revenueThisYear / nextTier.threshold) * 100) : 100;
    const recentActivity = history.slice(0, 5);

    return (
        <DistributorLayout>
            <div className="space-y-6">

                {/* Panel Switcher */}
                <div className="flex justify-end">
                    <PanelSwitcher currentPanel="distributor" />
                </div>

                {/* Welcome Banner */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                    className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-900 via-blue-900 to-indigo-800 p-6 text-white shadow-lg"
                >
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Zap className="w-5 h-5 text-yellow-300" />
                                <span className="text-xs font-semibold uppercase tracking-widest text-blue-100">Distributor Partner</span>
                            </div>
                            <h1 className="text-2xl font-bold">Welcome, {dist.name || dist.email}!</h1>
                            <p className="text-blue-100 text-sm mt-1">Tier: <strong>{dist.tier}</strong></p>
                        </div>
                        <Button size="sm" variant="secondary" className="gap-2 text-primary shrink-0"
                            onClick={() => copyToClipboard(refLink).then(() => toast.success("Referral link copied!"))}>
                            <Copy className="w-4 h-4" /> Copy Referral Link
                        </Button>
                    </div>
                </motion.div>

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
                                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                                        Customer discounts when using this code:
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(promoDiscounts).map(([plan, pct]) => (
                                            <Badge key={plan} variant={pct > 0 ? "default" : "secondary"}
                                                className="text-xs font-medium gap-1">
                                                {plan}: {pct}% off
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                                <Tag className="w-5 h-5 text-amber-600 shrink-0" />
                                <p className="text-sm text-amber-700 dark:text-amber-400">
                                    No promo code assigned yet. Contact your account manager to get one set up.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Button variant="outline" className="h-12 gap-2 justify-start"
                        disabled={!promoCode}
                        onClick={() => promoCode && copyToClipboard(promoCode).then(() => toast.success("Promo code copied!"))}>
                        <Copy className="w-4 h-4 text-primary" />
                        Copy Promo Code
                    </Button>
                    <Button variant="outline" className="h-12 gap-2 justify-start" asChild>
                        <Link to="/distributor/customers">
                            <Users className="w-4 h-4 text-primary" />
                            View Customers
                        </Link>
                    </Button>
                    <Button variant="outline" className="h-12 gap-2 justify-start" asChild>
                        <Link to="/distributor/payouts">
                            <DollarSign className="w-4 h-4 text-primary" />
                            Request Payout
                        </Link>
                    </Button>
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="border-border shadow-sm">
                        <CardContent className="p-5">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Wallet Balance</p>
                            <p className="text-2xl font-bold text-foreground mt-2">Rs {dist.walletBalance.toLocaleString()}</p>
                        </CardContent>
                    </Card>
                    <Card className="border-border shadow-sm">
                        <CardContent className="p-5 relative">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Available Payout</p>
                            <p className="text-2xl font-bold text-green-600 mt-2">Rs {availablePayout.toLocaleString()}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">(Rs 2,000 minimum held)</p>
                            {availablePayout >= 5000 && (
                                <Button size="sm" onClick={requestPayout} className="mt-2 w-full">Request</Button>
                            )}
                        </CardContent>
                    </Card>
                    <Card className="border-border shadow-sm">
                        <CardContent className="p-5">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Customers</p>
                            <p className="text-2xl font-bold text-foreground mt-2">{dist.totalCustomers ?? 0}</p>
                        </CardContent>
                    </Card>
                    <Card className="border-border shadow-sm">
                        <CardContent className="p-5">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Commission</p>
                            <p className="text-2xl font-bold text-foreground mt-2">Rs {(dist.totalCommission ?? 0).toLocaleString()}</p>
                        </CardContent>
                    </Card>
                    <Card className="border-border shadow-sm col-span-2 md:col-span-4">
                        <CardContent className="p-5">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                                Tier Progress (This Year's Revenue)
                            </p>
                            <div className="flex justify-between text-sm font-bold mb-2">
                                <span>Rs {dist.revenueThisYear.toLocaleString()}</span>
                                {nextTier
                                    ? <span className="text-muted-foreground">Rs {nextTier.threshold.toLocaleString()} to {nextTier.name}</span>
                                    : <span className="text-green-600">Max Tier Reached</span>}
                            </div>
                            <Progress value={progressValue} className="h-2.5" />
                        </CardContent>
                    </Card>
                </div>

                {/* Ongoing Inquiries Placeholder */}
                <Card className="border-dashed border-border">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-muted-foreground" />
                            <CardTitle className="text-base text-muted-foreground">Ongoing Inquiries</CardTitle>
                        </div>
                        <CardDescription>Track customer inquiries and follow-ups here.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="py-8 text-center text-sm text-muted-foreground">
                            Inquiry tracking is coming soon. This section will show open tickets from your customers.
                        </div>
                    </CardContent>
                </Card>

                {/* Monthly Commission Trend */}
                <Card className="border-border">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-primary" />
                            <CardTitle className="text-base">Monthly Commission Trend</CardTitle>
                        </div>
                        <CardDescription>Your earned commissions over the last 6 months.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={180}>
                            <AreaChart data={monthlyTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="commGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} width={50} tickFormatter={(v) => `₹${v}`} />
                                <Tooltip formatter={(v: number) => [`₹${v.toLocaleString()}`, "Commission"]} />
                                <Area type="monotone" dataKey="commission" stroke="hsl(var(--primary))"
                                    fill="url(#commGrad)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Recent Customer Activity */}
                {recentActivity.length > 0 && (
                    <Card className="border-border">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-base">Recent Customer Activity</CardTitle>
                                <CardDescription>Last 5 sales through your promo / referral code.</CardDescription>
                            </div>
                            <Link to="/distributor/referrals"
                                className="text-xs text-primary flex items-center gap-1 hover:underline">
                                View all <ArrowRight className="w-3 h-3" />
                            </Link>
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
                                            <p className="text-sm font-semibold text-green-600">
                                                +₹{(sale.commission || 0).toLocaleString()}
                                            </p>
                                            <p className="text-xs text-muted-foreground">Rs {(sale.amount || 0).toLocaleString()}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>
                )}

                {/* Full Sales History */}
                <Card className="border-border">
                    <CardHeader>
                        <CardTitle>Sales History</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {history.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-muted-foreground">
                                            <th className="font-semibold p-3 pb-2">Customer</th>
                                            <th className="font-semibold p-3 pb-2">Date</th>
                                            <th className="font-semibold p-3 pb-2 text-right">Order Amount</th>
                                            <th className="font-semibold p-3 pb-2 text-right">Commission</th>
                                            <th className="font-semibold p-3 pb-2 text-right">Rate</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                        {history.map((sale: any, i: number) => (
                                            <tr key={sale.id ?? i} className="hover:bg-muted/30 transition-colors">
                                                <td className="p-3 font-medium">{sale.user}</td>
                                                <td className="p-3 text-muted-foreground">{sale.date}</td>
                                                <td className="p-3 text-right">Rs {(sale.amount || 0).toLocaleString()}</td>
                                                <td className="p-3 text-right text-green-600 font-semibold">
                                                    ₹{(sale.commission || 0).toLocaleString()}
                                                </td>
                                                <td className="p-3 text-right text-muted-foreground">{sale.rate}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-8 text-center text-sm text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
                                No sales recorded yet. Your earned commissions will appear here.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DistributorLayout>
    );
}
