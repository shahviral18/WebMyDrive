import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, Copy, ShieldCheck, UserPlus, Search, Filter } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import DistributorLayout from "@/components/distributor/DistributorLayout";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/utils";
import { api } from "@/lib/api";

const referralLink = `${window.location.origin}/login?ref=PRIYA-NET-2026`;

const monthlyReferrals = [
    { month: "Sep", count: 4 },
    { month: "Oct", count: 5 },
    { month: "Nov", count: 7 },
    { month: "Dec", count: 6 },
    { month: "Jan", count: 9 },
    { month: "Feb", count: 7 },
];

const statusClass = (s: string) =>
    s === "paid" ? "bg-success/10 text-success border-success/30" :
        s === "vested" ? "bg-primary/10 text-primary border-primary/30" :
            "bg-warning/10 text-warning border-warning/30";

export default function DistributorReferrals() {
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("all");
    const [referrals, setReferrals] = useState<any[]>([]);
    const [dashData, setDashData] = useState<any>(null);

    useEffect(() => {
        Promise.all([
            api.get("/distributor/dashboard"),
            api.get("/distributor/history")
        ])
            .then(([dash, hist]) => {
                setDashData(dash);
                setReferrals(hist || []);
            })
            .catch(console.error);
    }, []);

    const filtered = referrals.filter(r =>
        (r.user?.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <DistributorLayout>
            <div className="space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                            <Users className="w-6 h-6 text-primary" /> Referral Management
                        </h1>
                        <p className="text-muted-foreground text-sm mt-1">Track all your referrals, commissions, and network performance.</p>
                    </div>
                    <Button className="gap-2 bg-primary hover:bg-primary/90" onClick={() => {
                        copyToClipboard(referralLink)
                            .then(() => toast.success("Referral link copied!"))
                            .catch(() => toast.error("Failed to copy link."));
                    }}>
                        <Copy className="w-4 h-4" /> Copy My Link
                    </Button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: "Total Referrals", value: referrals.length.toString(), icon: Users, color: "text-primary", bg: "bg-primary/10" },
                        { label: "Active", value: referrals.length.toString(), icon: ShieldCheck, color: "text-success", bg: "bg-success/10" },
                        { label: "Pending", value: "0", icon: UserPlus, color: "text-warning", bg: "bg-warning/10" },
                        { label: "Total Revenue", value: `₹${dashData?.distributor?.revenueThisYear?.toLocaleString() || 0}`, icon: ShieldCheck, color: "text-indigo-400", bg: "bg-indigo-500/10" },
                    ].map((s, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                            <Card className="border-border">
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
                        </motion.div>
                    ))}
                </div>

                {/* Chart */}
                <Card className="border-border">
                    <CardHeader>
                        <CardTitle>Monthly Referral Volume</CardTitle>
                        <CardDescription>Number of successful referrals per month</CardDescription>
                    </CardHeader>
                    <CardContent className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyReferrals}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} stroke="#6b7280" />
                                <YAxis fontSize={11} tickLine={false} axisLine={false} stroke="#6b7280" />
                                <Tooltip contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#e5e7eb" }} />
                                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={28} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Table */}
                <Card className="border-border">
                    <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
                        <div>
                            <CardTitle>Referral History</CardTitle>
                            <CardDescription>All customers referred through your link</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 w-48 bg-surface-2" />
                            </div>
                            <select value={filter} onChange={e => setFilter(e.target.value)} className="h-9 px-3 rounded-md border border-border bg-surface-2 text-sm text-foreground">
                                <option value="all">All</option>
                                <option value="paid">Paid</option>
                                <option value="vested">Vested</option>
                                <option value="pending">Pending</option>
                            </select>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-surface-2 hover:bg-surface-2">
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Plan</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Commission</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map(r => (
                                    <TableRow key={r.id} className="hover:bg-surface-2">
                                        <TableCell>
                                            <div>
                                                <p className="font-medium text-foreground">{r.user}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm">₹{r.amount}</TableCell>
                                        <TableCell className="text-muted-foreground text-sm">{r.date}</TableCell>
                                        <TableCell className="font-semibold text-success">₹{r.commission}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={statusClass("paid")}>Paid</Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </DistributorLayout>
    );
}
