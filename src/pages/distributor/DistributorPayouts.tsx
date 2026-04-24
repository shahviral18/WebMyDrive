import { useState } from "react";
import { motion } from "framer-motion";
import { CreditCard, CheckCircle, Clock, XCircle, Download, Building, Banknote } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import DistributorLayout from "@/components/distributor/DistributorLayout";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useEffect } from "react";

const statusConfig = {
    completed: { label: "Completed", icon: CheckCircle, cls: "text-success", bg: "bg-success/10 text-success border-success/30" },
    pending: { label: "Pending", icon: Clock, cls: "text-warning", bg: "bg-warning/10 text-warning border-warning/30" },
    failed: { label: "Failed", icon: XCircle, cls: "text-danger", bg: "bg-danger/10 text-danger border-danger/30" },
};

export default function DistributorPayouts() {
    const [showForm, setShowForm] = useState(false);
    const [amount, setAmount] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [payouts, setPayouts] = useState<any[]>([]);
    const [availableBalance, setAvailableBalance] = useState(0);

    useEffect(() => {
        Promise.all([
            api.get("/distributor/dashboard"),
            api.get("/distributor/payouts")
        ])
            .then(([dash, payData]) => {
                if (dash?.distributor) {
                    setAvailableBalance(dash.distributor.walletBalance);
                }
                setPayouts(payData?.payouts ?? []);
            })
            .catch(console.error);
    }, []);

    const handleRequest = async () => {
        const amt = parseFloat(amount);
        if (!amt || amt < 5000) { toast.error("Minimum payout is ₹5,000"); return; }
        if (amt > availableBalance) { toast.error(`Exceeds available balance of ₹${availableBalance.toLocaleString()}`); return; }

        setSubmitting(true);
        try {
            const result = await api.post("/distributor/request-payout", {
                amount: amt
            });
            if (result.success) {
                toast.success(`Payout request for ₹${amt.toLocaleString()} submitted successfully!`);
                setShowForm(false);
                setAmount("");
                setAvailableBalance(prev => prev - amt);
                setPayouts([{
                    id: `PAY-REQ-NEW`, date: new Date().toLocaleDateString(),
                    amount: `₹${amt.toLocaleString()}`, method: "Bank Transfer",
                    status: "pending", txRef: "—"
                }, ...payouts]);
            } else {
                toast.error(result.error || "Payout failed");
            }
        } catch (e) {
            toast.error("Error submitting request");
        } finally {
            setSubmitting(false);
        }
    };

    const totalPaid = payouts.filter(p => p.status === "completed").reduce((s, p) => s + parseInt(p.amount.replace(/[^0-9]/g, "")), 0);

    return (
        <DistributorLayout>
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                            <CreditCard className="w-6 h-6 text-primary" /> Payouts
                        </h1>
                        <p className="text-muted-foreground text-sm mt-1">Your payout history and withdrawal requests.</p>
                    </div>
                    <Button className="bg-primary hover:bg-primary/90 gap-2" onClick={() => setShowForm(v => !v)}>
                        <Banknote className="w-4 h-4" /> Request Payout
                    </Button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                        { label: "Total Paid Out", value: `₹${totalPaid.toLocaleString()}`, icon: CheckCircle, color: "text-success", bg: "bg-success/10" },
                        { label: "Available to Request", value: `₹${availableBalance.toLocaleString()}`, icon: Clock, color: "text-warning", bg: "bg-warning/10" },
                        { label: "Next Scheduled", value: "Available anytime over ₹5,000", icon: CreditCard, color: "text-primary", bg: "bg-primary/10" },
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

                {/* Request Form (collapsible) */}
                {showForm && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                        <Card className="border-primary/30 bg-primary/5">
                            <CardHeader>
                                <CardTitle>New Payout Request</CardTitle>
                                <CardDescription>Minimum ₹500 · Processes within 2–3 business days to your registered bank account.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Bank Account</Label>
                                    <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-border bg-surface-2 text-sm text-muted-foreground">
                                        <Building className="w-4 h-4" /> HDFC Bank ****4821
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="payamt">Amount (₹)</Label>
                                    <Input id="payamt" type="number" min={5000} max={availableBalance} placeholder="e.g. 5000" value={amount} onChange={e => setAmount(e.target.value)} className="bg-surface-2 border-border" />
                                    <p className="text-xs text-muted-foreground">Available: ₹{availableBalance.toLocaleString()}</p>
                                </div>
                                <div className="flex items-end gap-2">
                                    <Button className="flex-1 bg-success hover:bg-success/90 text-white" onClick={handleRequest} disabled={submitting}>
                                        {submitting ? "Submitting..." : "Confirm Request"}
                                    </Button>
                                    <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {/* Payout History */}
                <Card className="border-border">
                    <CardHeader>
                        <CardTitle>Payout History</CardTitle>
                        <CardDescription>All previous payout transactions</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-surface-2 hover:bg-surface-2">
                                    <TableHead>Payout ID</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Method</TableHead>
                                    <TableHead>UTR / Ref</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {payouts.map(p => {
                                    const cfg = statusConfig[p.status as keyof typeof statusConfig];
                                    return (
                                        <TableRow key={p.id} className="hover:bg-surface-2">
                                            <TableCell className="font-mono text-xs text-muted-foreground">{p.id}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{p.date}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{p.method}</TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground">{p.txRef}</TableCell>
                                            <TableCell className="font-semibold text-foreground">{p.amount}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={cfg.bg}>{cfg.label}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                {p.status === "completed" && (
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => {
                                                        const text = `WebMyDrive Payout Receipt\n\nID: ${p.id}\nDate: ${p.date}\nAmount: ${p.amount}\nMethod: ${p.method}\nReference (UTR): ${p.txRef}\nStatus: ${p.status.toUpperCase()}`;
                                                        const blob = new Blob([text], { type: "text/plain" });
                                                        const url = URL.createObjectURL(blob);
                                                        const a = document.createElement("a");
                                                        a.href = url;
                                                        a.download = `${p.id}-Receipt.txt`;
                                                        document.body.appendChild(a);
                                                        a.click();
                                                        document.body.removeChild(a);
                                                        URL.revokeObjectURL(url);
                                                        toast.success(`Receipt ${p.id} downloaded`);
                                                    }}>
                                                        <Download className="w-3.5 h-3.5" />
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </DistributorLayout>
    );
}
