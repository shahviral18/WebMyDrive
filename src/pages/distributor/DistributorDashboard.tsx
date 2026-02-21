import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    Users, TrendingUp, DollarSign, Wallet, ArrowUpRight,
    UserPlus, Copy, ChevronRight, Activity, Zap, Star
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import DistributorLayout from "@/components/distributor/DistributorLayout";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/utils";
import { Link } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";

export default function DistributorDashboard() {
    const [data, setData] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            api.get("/distributor/dashboard"),
            api.get("/distributor/history")
        ])
            .then(([dashData, histData]) => {
                setData(dashData);
                setHistory(histData || []);
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
            const result = await api.post("/distributor/request-payout", {
                amount: available
            });
            if (result.success) {
                toast.success(`Payout of Rs ${result.amountPaid} requested!`);
                setData({ ...data, distributor: { ...data.distributor, walletBalance: data.distributor.walletBalance - available } });
            } else {
                toast.error(result.error || "Failed payout");
            }
        } catch (e) {
            toast.error("Error connecting to server");
        }
    };

    if (loading) return <DistributorLayout><div className="p-8">Loading...</div></DistributorLayout>;

    if (!data?.distributor) return (
        <DistributorLayout>
            <div className="p-8">
                Distributor account not found (ID: 1). Please onboard first via QA tools.
            </div>
        </DistributorLayout>
    );

    const dist = data.distributor;
    const nextTier = data.nextTier;
    const availablePayout = Math.max(0, dist.walletBalance - 2000);
    const refCode = `DIST-${dist.id}-2026`;
    const refLink = `${window.location.origin}?ref=${refCode}`;

    const progressValue = nextTier ? (dist.revenueThisYear / nextTier.threshold) * 100 : 100;

    return (
        <DistributorLayout>
            <div className="space-y-8">
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
                            <h1 className="text-2xl font-bold">Current Tier: {dist.tier}</h1>
                            <p className="text-blue-100 mt-1 text-sm">
                                Year resets: {new Date(dist.resetDate).toLocaleDateString()}
                            </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                            <Button size="sm" variant="secondary" className="gap-2 text-primary" onClick={() => {
                                copyToClipboard(refLink).then(() => toast.success("Copied!"));
                            }}>
                                <Copy className="w-4 h-4" /> Copy Link
                            </Button>
                        </div>
                    </div>
                </motion.div>

                {/* KPI Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="border border-blue-100 shadow-sm">
                        <CardContent className="p-5">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Wallet Balance</p>
                            <p className="text-2xl font-bold text-gray-900 mt-2">Rs {dist.walletBalance.toLocaleString()}</p>
                        </CardContent>
                    </Card>
                    <Card className="border border-green-100 shadow-sm">
                        <CardContent className="p-5 relative">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Available Payout</p>
                            <p className="text-2xl font-bold text-green-600 mt-2">Rs {availablePayout.toLocaleString()}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">(Rs 2,000 minimum held)</p>
                            {availablePayout >= 5000 && (
                                <Button size="sm" onClick={requestPayout} className="absolute right-4 top-1/2 -translate-y-1/2">
                                    Request
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                    <Card className="border border-indigo-100 shadow-sm col-span-2">
                        <CardContent className="p-5">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Tier Progress (This Year's Revenue)</p>
                            <div className="flex justify-between text-sm font-bold mb-2">
                                <span>Rs {dist.revenueThisYear.toLocaleString()}</span>
                                {nextTier ? <span>Rs {nextTier.threshold.toLocaleString()} to {nextTier.name}</span> : <span>Max Tier Reached</span>}
                            </div>
                            <Progress value={progressValue} className="h-3" />
                        </CardContent>
                    </Card>
                </div>

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
                                            <th className="font-semibold p-3 pb-2 text-right">Commission Earned</th>
                                            <th className="font-semibold p-3 pb-2 text-right">Rate</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                        {history.map((sale: any) => (
                                            <tr key={sale.id} className="hover:bg-muted/30 transition-colors">
                                                <td className="p-3 font-medium">{sale.user}</td>
                                                <td className="p-3 text-muted-foreground">{sale.date}</td>
                                                <td className="p-3 text-right">Rs {sale.amount.toLocaleString()}</td>
                                                <td className="p-3 text-right text-success font-semibold flex justify-end gap-1 items-center">
                                                    <DollarSign className="w-3 h-3" />
                                                    {sale.commission.toLocaleString()}
                                                </td>
                                                <td className="p-3 text-right text-muted-foreground">{sale.rate}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-8 text-center text-sm text-muted-foreground bg-surface-2 rounded-lg border border-dashed">
                                No sales recorded yet. Your earned commissions will appear here.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DistributorLayout>
    );
}
