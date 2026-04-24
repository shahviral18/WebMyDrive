import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, Award, ChevronUp, Loader2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import DistributorLayout from "@/components/distributor/DistributorLayout";
import { api } from "@/lib/api";

const earningsTimeline = [
    { month: "Sep", commission: 1820, bonus: 0 },
    { month: "Oct", commission: 2460, bonus: 200 },
    { month: "Nov", commission: 3100, bonus: 300 },
    { month: "Dec", commission: 3840, bonus: 400 },
    { month: "Jan", commission: 4420, bonus: 500 },
    { month: "Feb", commission: 5280, bonus: 600 },
];

export default function DistributorEarnings() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/distributor/earnings')
            .then(data => setStats(data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <DistributorLayout>
                <div className="h-full flex items-center justify-center p-20">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
            </DistributorLayout>
        );
    }

    const totalLifetime: number = stats?.totalCommission ?? 0;
    const pendingPayout: number = stats?.pendingPayout ?? 0;
    const tier: string = stats?.tier ?? "Standard";
    const transactions: any[] = stats?.salesByYear ?? [];
    const thisMonth = 0;

    const breakdown = [
        { type: "Total Lifetime Commission", amount: `₹${totalLifetime.toLocaleString()}`, count: transactions.length, share: "100%" },
        { type: "This Month Commission", amount: `₹${thisMonth.toLocaleString()}`, count: "-", share: totalLifetime > 0 ? `${Math.round((thisMonth / totalLifetime) * 100)}%` : "0%" }
    ];

    return (
        <DistributorLayout>
            <div className="space-y-8">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <DollarSign className="w-6 h-6 text-success" /> Earnings Center
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">Your full commission breakdown, tier bonuses, and earning history.</p>
                </div>

                {/* KPI Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: "Total Lifetime", value: `₹${totalLifetime.toLocaleString()}`, delta: "overall", icon: DollarSign, color: "text-success", bg: "bg-success/10" },
                        { label: "This Month", value: `₹${thisMonth.toLocaleString()}`, delta: "current month", icon: TrendingUp, color: "text-primary", bg: "bg-primary/10" },
                        { label: "Pending Payout", value: `₹${pendingPayout.toLocaleString()}`, delta: "available", icon: DollarSign, color: "text-warning", bg: "bg-warning/10" },
                        { label: "Highest Tier Achieved", value: tier, delta: "current tier", icon: Award, color: "text-yellow-400", bg: "bg-yellow-500/10" },
                    ].map((k, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                            <Card className="border-border">
                                <CardContent className="p-5">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center ${k.bg}`}>
                                            <k.icon className={`w-4 h-4 ${k.color}`} />
                                        </div>
                                        <p className="text-xs text-muted-foreground">{k.label}</p>
                                    </div>
                                    <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                        <ChevronUp className="w-3 h-3 text-success" />{k.delta}
                                    </p>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                {/* Chart */}
                <Card className="border-border">
                    <CardHeader>
                        <CardTitle>Earnings Trend</CardTitle>
                        <CardDescription>Commission + bonus earnings over 6 months</CardDescription>
                    </CardHeader>
                    <CardContent className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={earningsTimeline}>
                                <defs>
                                    <linearGradient id="gComm" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="gBonus" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                                <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
                                <YAxis fontSize={11} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `₹${(v / 1000).toFixed(1)}k`} />
                                <Tooltip cursor={{ fill: 'hsl(var(--muted)/0.5)' }} contentStyle={{ backgroundColor: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))', borderRadius: '8px', border: '1px solid hsl(var(--border))', boxShadow: 'var(--shadow-card)' }} formatter={(v: number) => [`₹${v.toLocaleString()}`, ""]} />
                                <Area type="monotone" dataKey="commission" stroke="#22c55e" strokeWidth={2} fill="url(#gComm)" name="Commission" />
                                <Area type="monotone" dataKey="bonus" stroke="#f59e0b" strokeWidth={2} fill="url(#gBonus)" name="Bonus" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Breakdown + Transactions */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="border-border">
                        <CardHeader>
                            <CardTitle>Commission Breakdown</CardTitle>
                            <CardDescription>How your earnings are composed this month</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {breakdown.map((b, i) => (
                                <div key={i} className="space-y-1.5">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-foreground font-medium">{b.type}</span>
                                        <span className="text-success font-semibold">{b.amount}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-2 bg-surface-3 rounded-full overflow-hidden">
                                            <div className="h-full bg-primary rounded-full" style={{ width: b.share }} />
                                        </div>
                                        <span className="text-xs text-muted-foreground w-8">{b.share}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{b.count} transaction{b.count > 1 ? "s" : ""}</p>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

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
                                                <p className="text-xs font-medium text-foreground">{tx.description}</p>
                                                <p className="text-[10px] text-muted-foreground">{tx.date} · {tx.id}</p>
                                            </TableCell>
                                            <TableCell className="text-right shrink-0">
                                                <span className={`text-sm font-bold ${tx.type === "debit" ? "text-danger" : "text-success"}`}>{tx.type === "debit" ? "-" : "+"}{tx.amount}</span>
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">No recent transactions</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DistributorLayout>
    );
}
