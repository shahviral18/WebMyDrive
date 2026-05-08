import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Zap, AlertCircle, CalendarClock, ShieldCheck, CheckCircle2, Clock } from "lucide-react";
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

export default function UserBilling() {
    const navigate = useNavigate();
    const [pageLoading, setPageLoading] = useState(true);
    const [orders, setOrders] = useState<Order[]>([]);
    const [currentPlan, setCurrentPlan] = useState<CurrentPlan | null>(null);
    const [autoRenewal, setAutoRenewal] = useState<AutoRenewalStatus | null>(null);

    useEffect(() => {
        Promise.all([
            api.get("/referral/my-orders"),
            api.get("/user/current-plan"),
            api.get("/user/autorenewal-status").catch(() => null),
        ]).then(([ordersData, planData, arData]) => {
            setOrders(ordersData.orders || []);
            setCurrentPlan(planData);
            setAutoRenewal(arData);
        }).catch(() => {
            setOrders([]);
            setCurrentPlan({ hasPlan: false });
        }).finally(() => {
            setPageLoading(false);
        });
    }, []);

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

                {/* Invoice History */}
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
