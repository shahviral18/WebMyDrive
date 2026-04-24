import { useState, useEffect } from "react";
import { Users, Search, Mail, Phone, ShieldCheck, TrendingUp, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import DistributorLayout from "@/components/distributor/DistributorLayout";
import { api } from "@/lib/api";

const statusClass = (s: string) =>
    s === "active" ? "bg-success/10 text-success border-success/30" :
        s === "trial" ? "bg-primary/10 text-primary border-primary/30" :
            "bg-danger/10 text-danger border-danger/30";

export default function DistributorCustomers() {
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("all");
    const [customers, setCustomers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/distributor/customers')
            .then(data => {
                const rows = (data?.customers ?? []).map((c: any) => ({
                    ...c,
                    plan: c.planName ?? "—",
                    joined: c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-IN") : "—",
                    status: (c.wsStatus ?? "active").toLowerCase(),
                    level: "Direct",
                    commission: "—",
                    phone: "—",
                }));
                setCustomers(rows);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const filtered = customers.filter(c =>
        (filter === "all" || c.status === filter || (c.level ?? "").toLowerCase() === filter) &&
        ((c.name ?? "").toLowerCase().includes(search.toLowerCase()) || (c.email ?? "").toLowerCase().includes(search.toLowerCase()))
    );

    const active = customers.filter(c => c.status === "active").length;
    const direct = customers.length;
    const l2 = 0;

    return (
        <DistributorLayout>
            <div className="space-y-8">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <Users className="w-6 h-6 text-primary" /> My Customers
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">All customers in your referral network — direct and downline.</p>
                </div>

                {/* Totals */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                        { label: "Total Customers", value: customers.length, display: customers.length, icon: Users, color: "text-foreground", bg: "bg-surface-3" },
                        { label: "Direct", value: direct, display: direct, icon: Users, color: "text-primary", bg: "bg-primary/10" },
                        { label: "L2 Network", value: l2, display: l2, icon: Users, color: "text-indigo-400", bg: "bg-indigo-500/10" },
                        { label: "Active", value: active, display: active, icon: ShieldCheck, color: "text-success", bg: "bg-success/10" },
                        {
                            label: "Total Commission",
                            display: `₹${customers.reduce((s: number, c: any) => {
                                const v = typeof c.commission === "string"
                                    ? parseFloat(c.commission.replace(/[^\d.]/g, "")) || 0
                                    : (c.commission || 0);
                                return s + v;
                            }, 0).toLocaleString("en-IN")}`,
                            value: 0, icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10"
                        },
                    ].map((s, i) => (
                        <Card key={i} className="border-border">
                            <CardContent className="p-5 flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${s.bg}`}>
                                    <s.icon className={`w-5 h-5 ${s.color}`} />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">{s.label}</p>
                                    <p className={`text-2xl font-bold ${s.color}`}>{s.display ?? s.value}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Table */}
                <Card className="border-border">
                    <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap pb-4">
                        <div>
                            <CardTitle>Customer Directory</CardTitle>
                            <CardDescription>All customers referred through your network</CardDescription>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 w-48 bg-surface-2 border-border" />
                            </div>
                            <select value={filter} onChange={e => setFilter(e.target.value)} className="h-9 px-3 rounded-md border border-border bg-surface-2 text-sm text-foreground">
                                <option value="all">All</option>
                                <option value="active">Active</option>
                                <option value="suspended">Suspended</option>
                                <option value="direct">Direct Only</option>
                                <option value="l2 chain">L2 Only</option>
                            </select>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="py-12 flex justify-center">
                                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-surface-2 hover:bg-surface-2">
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Contact</TableHead>
                                        <TableHead>Plan</TableHead>
                                        <TableHead>Joined</TableHead>
                                        <TableHead>Level</TableHead>
                                        <TableHead>Commission</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.map(c => (
                                        <TableRow key={c.id} className="hover:bg-surface-2">
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                                                        {c.name[0]?.toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-foreground">{c.name}</p>
                                                        <p className="text-[10px] text-muted-foreground">{c.id}</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-xs text-muted-foreground space-y-0.5">
                                                    <p className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</p>
                                                    <p className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{c.plan}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{c.joined}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={c.level === "Direct" ? "border-primary/30 text-primary" : "border-indigo-400/30 text-indigo-400"}>
                                                    {c.level}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-semibold text-sm text-success">{c.commission}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={statusClass(c.status)}>{c.status}</Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                        {!loading && filtered.length === 0 && (
                            <div className="py-12 text-center text-muted-foreground">
                                <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">No customers match your search or filter.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DistributorLayout>
    );
}
