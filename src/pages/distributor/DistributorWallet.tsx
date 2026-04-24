import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Wallet, ArrowUpRight, ArrowDownLeft, Clock, ShieldCheck, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import DistributorLayout from "@/components/distributor/DistributorLayout";
import { useEffect } from "react";
import { api } from "@/lib/api";

const pendingCredits: any[] = [];

export default function DistributorWallet() {
    const [withdrawAmt, setWithdrawAmt] = useState("");
    const [withdrawing, setWithdrawing] = useState(false);
    const [walletTx, setWalletTx] = useState<any[]>([]);
    const [balance, setBalance] = useState(0);

    useEffect(() => {
        Promise.all([
            api.get("/distributor/dashboard"),
            api.get("/distributor/wallet")
        ])
            .then(([dash, wallet]) => {
                if (dash?.distributor) {
                    setBalance(dash.distributor.walletBalance);
                }
                setWalletTx(wallet?.transactions || []);
            })
            .catch(console.error);
    }, []);

    const handleWithdraw = () => {
        const amt = parseFloat(withdrawAmt);
        if (!amt || amt < 500) { toast.error("Minimum withdrawal is ₹500"); return; }
        if (amt > balance) { toast.error("Amount exceeds available balance"); return; }
        setWithdrawing(true);
        api.post("/distributor/request-payout", { amount: amt })
            .then((result: any) => {
                if (result.success) {
                    toast.success(`Withdrawal of ₹${amt.toLocaleString()} initiated.`);
                    setWithdrawAmt("");
                    setBalance(prev => prev - amt);
                    // Refresh history or push mock
                    setWalletTx([{
                        id: "NEW", desc: `Withdrawal Requested`, amount: -amt, type: "debit", date: new Date().toLocaleDateString()
                    }, ...walletTx]);
                } else {
                    toast.error(result.error || "Failed");
                }
            })
            .catch(() => toast.error("Error making request"))
            .finally(() => setWithdrawing(false));
    };

    const txIcon = (type: string) =>
        type === "debit" ? <ArrowUpRight className="w-4 h-4 text-danger" /> : <ArrowDownLeft className="w-4 h-4 text-success" />;

    return (
        <DistributorLayout>
            <div className="space-y-8">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <Wallet className="w-6 h-6 text-primary" /> My Wallet
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">Manage your commission wallet, redemptions, and payout requests.</p>
                </div>

                {/* Wallet Balance Hero */}
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    className="relative rounded-2xl bg-gradient-to-br from-emerald-700 via-green-600 to-teal-700 p-8 text-white overflow-hidden shadow-lg">
                    <div className="absolute top-0 right-0 w-56 h-56 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="relative z-10">
                        <p className="text-sm font-semibold text-green-100 mb-1">Available Balance</p>
                        <h2 className="text-5xl font-bold mb-1">₹{balance.toLocaleString()}</h2>
                        <div className="flex items-center gap-2 mt-4">
                            <ShieldCheck className="w-4 h-4 text-green-200" />
                            <span className="text-xs text-green-100">Wallet secured · All earnings are verified before release</span>
                        </div>
                    </div>
                </motion.div>

                {/* Pending Credits */}
                {pendingCredits.length > 0 && (
                    <Card className="border-warning/30 bg-warning/5">
                        <CardHeader>
                            <CardTitle className="text-warning flex items-center gap-2">
                                <Clock className="w-5 h-5" /> Pending Credits (Vesting)
                            </CardTitle>
                            <CardDescription>These credits will be released after the 30-day vesting period.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {pendingCredits.map(p => (
                                <div key={p.id} className="flex items-center justify-between py-2 border-b border-warning/20 last:border-0">
                                    <div>
                                        <p className="text-sm font-medium text-foreground">{p.source}</p>
                                        <p className="text-xs text-muted-foreground">Vests on: {p.vestDate}</p>
                                    </div>
                                    <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">{p.amount}</Badge>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Withdraw */}
                    <Card className="border-border lg:col-span-1">
                        <CardHeader>
                            <CardTitle>Request Withdrawal</CardTitle>
                            <CardDescription>Min ₹500 · Processes in 2-3 business days</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="bank">Bank Account</Label>
                                <Input id="bank" value="HDFC Bank ****4821" readOnly className="bg-surface-2 border-border text-muted-foreground" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="amt">Amount (₹)</Label>
                                <Input id="amt" type="number" min={500} max={balance} placeholder="e.g. 2000" value={withdrawAmt} onChange={e => setWithdrawAmt(e.target.value)} className="bg-surface-2 border-border" />
                                <p className="text-xs text-muted-foreground">Available: ₹{balance.toLocaleString()}</p>
                            </div>
                            <Button className="w-full bg-success hover:bg-success/90 text-white gap-2" onClick={handleWithdraw} disabled={withdrawing}>
                                {withdrawing ? <><span className="animate-spin inline-block mr-1">⏳</span> Processing...</> : <><Download className="w-4 h-4" /> Withdraw</>}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Transaction History */}
                    <Card className="border-border lg:col-span-2">
                        <CardHeader>
                            <CardTitle>Transaction History</CardTitle>
                            <CardDescription>All wallet movements</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0 max-h-80 overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-surface-2 hover:bg-surface-2">
                                        <TableHead className="w-8"></TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {walletTx.map(tx => (
                                        <TableRow key={tx.id} className="hover:bg-surface-2">
                                            <TableCell>{txIcon(tx.type)}</TableCell>
                                            <TableCell>
                                                <p className="text-sm text-foreground">{tx.desc}</p>
                                                <p className="text-[10px] text-muted-foreground">{tx.id}</p>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-xs">{tx.date}</TableCell>
                                            <TableCell className={`text-right font-semibold text-sm ${tx.type === "debit" ? "text-danger" : "text-success"}`}>
                                                {tx.amount > 0 ? `+₹${tx.amount.toLocaleString()}` : `−₹${Math.abs(tx.amount).toLocaleString()}`}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DistributorLayout>
    );
}
