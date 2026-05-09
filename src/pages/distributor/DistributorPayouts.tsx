import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { CreditCard, CheckCircle, Clock, XCircle, Download, Building, Banknote, Upload, FileText, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import DistributorLayout from "@/components/distributor/DistributorLayout";
import { toast } from "sonner";
import { api, getApiUrl } from "@/lib/api";

const statusConfig = {
    completed: { label: "Completed", icon: CheckCircle, cls: "text-success", bg: "bg-success/10 text-success border-success/30" },
    pending: { label: "Pending", icon: Clock, cls: "text-warning", bg: "bg-warning/10 text-warning border-warning/30" },
    failed: { label: "Failed", icon: XCircle, cls: "text-danger", bg: "bg-danger/10 text-danger border-danger/30" },
};

export default function DistributorPayouts() {
    const [showForm, setShowForm] = useState(false);
    const [amount, setAmount] = useState("");
    const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [payouts, setPayouts] = useState<any[]>([]);
    const [availableBalance, setAvailableBalance] = useState(0);
    const [payoutConfig, setPayoutConfig] = useState<{ tdsEnabled: boolean; tdsRate: number; minPayoutAmount: number }>(
        { tdsEnabled: false, tdsRate: 10, minPayoutAmount: 5000 }
    );
    const [bankInfo, setBankInfo] = useState<{
        bankName?: string; bankAccountNumber?: string; bankAccountType?: string; upiId?: string;
    } | null>(null);
    const invoiceInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        Promise.all([
            api.get("/distributor/dashboard"),
            api.get("/distributor/payouts")
        ])
            .then(([dash, payData]) => {
                if (dash?.distributor) {
                    setAvailableBalance(dash.distributor.walletBalance);
                    const d = dash.distributor;
                    if (d.bankName || d.bankAccountNumber) {
                        setBankInfo({
                            bankName: d.bankName,
                            bankAccountNumber: d.bankAccountNumber,
                            bankAccountType: d.bankAccountType,
                            upiId: d.upiId,
                        });
                    }
                }
                if (dash?.payoutConfig) setPayoutConfig(dash.payoutConfig);
                setPayouts(payData?.payouts ?? []);
            })
            .catch(console.error);
    }, []);

    const minPayout = payoutConfig.minPayoutAmount ?? 5000;

    const handleRequest = async () => {
        const amt = parseFloat(amount);
        if (!amt || amt < minPayout) { toast.error(`Minimum payout is ₹${minPayout.toLocaleString()}`); return; }
        if (amt > availableBalance) { toast.error(`Exceeds available balance of ₹${availableBalance.toLocaleString()}`); return; }
        if (!invoiceFile) { toast.error("Please upload your invoice PDF."); return; }
        if (invoiceFile.size > 5 * 1024 * 1024) { toast.error("Invoice must be 5 MB or less."); return; }

        setSubmitting(true);
        try {
            const fd = new FormData();
            fd.append("amount", String(amt));
            fd.append("invoiceFile", invoiceFile);
            const token = localStorage.getItem("token") || "";
            const res = await fetch(getApiUrl("/distributor/request-payout"), {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: fd,
            });
            const result = await res.json();
            if (result.success) {
                toast.success(`Payout request for ₹${amt.toLocaleString()} submitted!`);
                setShowForm(false);
                setAmount("");
                setInvoiceFile(null);
                setAvailableBalance(prev => prev - amt);
                setPayouts(prev => [{ id: `PAY-NEW`, date: new Date().toLocaleDateString(), amount: `₹${amt.toLocaleString()}`, method: "Bank Transfer", status: "pending", utrNumber: null }, ...prev]);
            } else {
                toast.error(result.error || "Payout failed");
            }
        } catch {
            toast.error("Error submitting request");
        } finally {
            setSubmitting(false);
        }
    };

    const tdsAmount = payoutConfig.tdsEnabled ? Math.round(parseFloat(amount || "0") * payoutConfig.tdsRate / 100) : 0;
    const netAmount = parseFloat(amount || "0") - tdsAmount;

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
                                <CardDescription>Minimum ₹{minPayout.toLocaleString()} · Processes within 2–3 business days to your registered bank account.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label>Bank Account</Label>
                                        <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-border bg-surface-2 text-sm text-muted-foreground">
                                            <Building className="w-4 h-4" />
                                            {bankInfo
                                                ? `${bankInfo.bankName ?? "Bank"} ****${(bankInfo.bankAccountNumber ?? "").slice(-4)}`
                                                : "No bank account on file"}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="payamt">Amount (₹)</Label>
                                        <Input id="payamt" type="number" min={minPayout} max={availableBalance} placeholder={`e.g. ${minPayout}`} value={amount} onChange={e => setAmount(e.target.value)} className="bg-surface-2 border-border" />
                                        <p className="text-xs text-muted-foreground">Available: ₹{availableBalance.toLocaleString()}</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Invoice (PDF, required)</Label>
                                        <label className="flex h-10 items-center gap-2 rounded-md border border-dashed border-border px-3 text-sm text-muted-foreground cursor-pointer hover:border-primary hover:text-primary transition-colors bg-surface-2">
                                            {invoiceFile ? <FileText className="w-4 h-4 shrink-0 text-primary" /> : <Upload className="w-4 h-4 shrink-0" />}
                                            <span className="truncate">{invoiceFile ? invoiceFile.name : "Upload invoice PDF"}</span>
                                            <input ref={invoiceInputRef} type="file" accept="application/pdf" className="hidden" onChange={e => setInvoiceFile(e.target.files?.[0] ?? null)} />
                                        </label>
                                    </div>
                                </div>
                                {/* TDS Breakdown */}
                                {payoutConfig.tdsEnabled && parseFloat(amount) > 0 && (
                                    <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30 text-sm">
                                        <Info className="w-4 h-4 text-warning mt-0.5 shrink-0" />
                                        <div className="space-y-1">
                                            <p className="font-semibold text-foreground">TDS Deduction (Sec 194J — {payoutConfig.tdsRate}%)</p>
                                            <p className="text-muted-foreground">Gross: ₹{parseFloat(amount).toLocaleString()} &nbsp;–&nbsp; TDS: ₹{tdsAmount.toLocaleString()} &nbsp;=&nbsp; <span className="font-bold text-foreground">Net: ₹{netAmount.toLocaleString()}</span></p>
                                        </div>
                                    </div>
                                )}
                                <div className="flex gap-2 justify-end">
                                    <Button variant="outline" onClick={() => { setShowForm(false); setInvoiceFile(null); }}>Cancel</Button>
                                    <Button className="bg-success hover:bg-success/90 text-white gap-2" onClick={handleRequest} disabled={submitting}>
                                        {submitting ? "Submitting..." : "Confirm Request"}
                                    </Button>
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
                                            <TableCell className="font-mono text-xs text-muted-foreground">{p.utrNumber ?? p.txRef ?? "—"}</TableCell>
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
