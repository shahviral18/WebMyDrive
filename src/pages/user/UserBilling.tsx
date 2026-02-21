import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, CreditCard, Download, Loader2, Plus, Zap, AlertCircle } from "lucide-react";
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
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

function parseFeatures(f: string | null): string[] {
    if (!f) return [];
    try { return JSON.parse(f); } catch { return f.split(",").map(s => s.trim()).filter(Boolean); }
}

interface Order {
    id: number;
    amount: number;
    currency: string;
    status: string;
    gatewayTxId?: string;
    createdAt: string;
}

export default function UserBilling() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);
    const [promoCode, setPromoCode] = useState("");
    const [orders, setOrders] = useState<Order[]>([]);
    const [workspace, setWorkspace] = useState<any>(null);

    useEffect(() => {
        Promise.all([
            api.get("/referral/my-orders"),
            api.get("/user/workspace")
        ]).then(([ordersData, wsData]) => {
            setOrders(ordersData.orders || []);
            setWorkspace(wsData.workspace || null);
        }).catch(() => {
            setOrders([]);
            setWorkspace(null);
        }).finally(() => {
            setPageLoading(false);
        });
    }, []);

    const handleUpgrade = () => {
        navigate("/user/plans");
    };


    return (
        <UserLayout>
            <div className="space-y-6">
                <h1 className="text-2xl font-bold text-foreground">Plan & Billing</h1>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                            ) : workspace?.plan ? (
                                <>
                                    <div className="flex items-baseline gap-1 mb-4">
                                        <span className="text-3xl font-bold text-foreground">{workspace.plan.name}</span>
                                        <span className="text-muted-foreground text-sm">/ monthly</span>
                                    </div>
                                    <ul className="space-y-2 text-sm text-muted-foreground mb-6">
                                        {parseFeatures(workspace.plan.features).map((f: string) => (
                                            <li key={f} className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success" /> {f}</li>
                                        ))}
                                    </ul>

                                    <div className="mb-4">
                                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Promo Code / Referral</label>
                                        <input
                                            type="text"
                                            value={promoCode}
                                            onChange={(e) => setPromoCode(e.target.value)}
                                            placeholder="Optional promo code"
                                            className="w-full text-sm p-3 rounded-lg border border-border bg-surface-2 focus:ring-2 focus:ring-primary/20 outline-none"
                                        />
                                    </div>

                                    <Button onClick={handleUpgrade} disabled={loading} className="w-full bg-primary text-white hover:bg-primary-dim">
                                        View All Plans
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <div className="flex items-baseline gap-1 mb-4">
                                        <span className="text-3xl font-bold text-foreground">Starter</span>
                                        <span className="text-muted-foreground text-sm">Free</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-6">Upgrade to unlock more storage and advanced features.</p>

                                    <Button onClick={handleUpgrade} className="w-full bg-primary text-white hover:bg-primary-dim">
                                        Upgrade Plan
                                    </Button>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-border shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-muted-foreground">
                                <CreditCard className="w-5 h-5" />
                                Payment Method
                            </CardTitle>
                            <CardDescription>Manage your payment details</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-4 p-4 border border-border rounded-lg bg-surface-2/50 mb-4">
                                <div className="w-10 h-6 bg-muted rounded flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                                    VISA
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-foreground">•••• 4242</p>
                                    <p className="text-xs text-muted-foreground">Expires 12/28</p>
                                </div>
                                <Badge variant="outline" className="ml-auto bg-success/10 text-success border-success/30">Default</Badge>
                            </div>
                            <Button variant="outline" className="w-full gap-2 text-muted-foreground hover:text-foreground" onClick={() => toast.info("Add New Card", { description: "Payment gateway integration coming soon. Contact support@webmydrive.com for assistance." })}>
                                <Plus className="w-4 h-4" /> Add New Card
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                <Card className="border-border shadow-sm">
                    <CardHeader>
                        <CardTitle>Invoice History</CardTitle>
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
            </div>
        </UserLayout>
    );
}
