import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Users, Copy, Check, Lock, Save, Loader2, ShieldCheck, DollarSign, TrendingUp, UserPlus } from "lucide-react";
import UserLayout from "@/components/user/UserLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useUser } from "@/contexts/UserContext";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

export default function UserReferrals() {
    const { user } = useUser();
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [referralPassword, setReferralPassword] = useState("");
    const linkRef = useRef<HTMLInputElement>(null);

    const [referralData, setReferralData] = useState<any>(null);
    const [recentReferrals, setRecentReferrals] = useState<any[]>([]);

    useEffect(() => {
        api.get('/referral/dashboard')
            .then(data => setReferralData(data))
            .catch(console.error);

        api.get('/referral/history')
            .then(data => setRecentReferrals(data.referrals))
            .catch(console.error);
    }, []);

    const referralCode = referralData?.promoCode || (user.email
        ? user.email.split("@")[0].toUpperCase().replace(/[^A-Z0-9]/g, "") +
        new Date().getFullYear()
        : "");

    const referralLink = referralCode
        ? `${window.location.origin}/login?ref=${referralCode}`
        : "";

    const markCopied = () => {
        setCopied(true);
        toast.success("Referral code copied!");
        setTimeout(() => setCopied(false), 2500);
    };

    const fallbackCopy = () => {
        const el = linkRef.current;
        if (!el) { toast.error("Select the code manually and press Ctrl+C."); return; }
        el.removeAttribute("readonly");
        el.focus();
        el.select();
        el.setSelectionRange(0, 99999);
        try {
            const ok = document.execCommand("copy");
            if (ok) markCopied();
            else toast.error("Copy failed — press Ctrl+C after selecting the code.");
        } catch {
            toast.error("Copy failed — press Ctrl+C after selecting the code.");
        }
        el.setAttribute("readonly", "");
    };

    const handleCopy = () => {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(referralLink)
                .then(markCopied)
                .catch(fallbackCopy);
            return;
        }
        fallbackCopy();
    };

    const handleUpdatePassword = () => {
        if (!referralPassword) { toast.error("Please enter a new password"); return; }
        setLoading(true);
        setTimeout(() => { setLoading(false); setReferralPassword(""); toast.success("Referral password updated"); }, 1000);
    };

    const referralStats = [
        { label: "Total Wallet Credits", value: `Rs ${referralData?.creditBalance?.toLocaleString() || 0}`, icon: DollarSign, color: "text-green-600", bg: "bg-green-100 dark:bg-green-900/30" },
        { label: "Successful Referrals", value: `${referralData?.totalReferrals || 0}`, icon: Users, color: "text-primary", bg: "bg-primary/10" },
        { label: "Credit Rate", value: "5% (Decaying)", icon: TrendingUp, color: "text-indigo-500", bg: "bg-indigo-100 dark:bg-indigo-900/30" },
    ];

    return (
        <UserLayout>
            <div className="space-y-8 max-w-5xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                            <Users className="w-6 h-6 text-primary" />
                            Referrals & Rewards
                        </h1>
                        <p className="text-muted-foreground mt-1">Share your code and earn 5% Wallet Credit on their first purchase, with continuing (but decaying) credits for 5 years of renewals!</p>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {referralStats.map((stat, i) => (
                        <Card key={i} className="border-border shadow-sm">
                            <CardContent className="p-6 flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${stat.bg}`}>
                                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    {/* Referral Link Card */}
                    <Card className="border-border shadow-sm relative overflow-hidden h-full">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                            <Users className="w-32 h-32 text-primary" />
                        </div>
                        <CardHeader>
                            <CardTitle>My Referral Code</CardTitle>
                            <CardDescription>Share this code with friends to earn rewards.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2 mb-4">
                                {referralCode ? (
                                    <input
                                        ref={linkRef}
                                        readOnly
                                        value={referralLink}
                                        onClick={e => (e.target as HTMLInputElement).select()}
                                        className="flex-1 font-mono text-sm tracking-wide text-primary bg-surface-2 border border-border rounded-md px-3 h-10 focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-text truncate"
                                    />
                                ) : (
                                    <div className="flex-1 h-10 rounded-md bg-surface-2 border border-border px-3 flex items-center text-sm text-muted-foreground">
                                        Log in to generate your referral link
                                    </div>
                                )}
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={handleCopy}
                                    title="Copy referral code"
                                    className={
                                        copied
                                            ? "shrink-0 text-green-600 border-green-400 bg-green-50 dark:bg-green-950/30 transition-all"
                                            : "shrink-0 text-muted-foreground hover:text-primary transition-all"
                                    }
                                >
                                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                </Button>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-950/30 px-3 py-2 rounded-md border border-green-200 dark:border-green-800 w-fit">
                                <ShieldCheck className="w-4 h-4" />
                                <span>Active Status</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Referral Password */}
                    <Card className="border-border shadow-sm h-full">
                        <CardHeader>
                            <CardTitle>Referral Security</CardTitle>
                            <CardDescription>Update the password for your referral code.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="ref-pass">New Referral Password</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        id="ref-pass"
                                        type="password"
                                        value={referralPassword}
                                        onChange={e => setReferralPassword(e.target.value)}
                                        placeholder="Enter new password"
                                        className="w-full pl-9 pr-3 h-10 rounded-md border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    />
                                </div>
                            </div>
                            <Button
                                onClick={handleUpdatePassword}
                                className="w-full bg-primary hover:bg-primary/90 text-white"
                                disabled={loading}
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                Update Password
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* History */}
                <Card className="border-border shadow-sm">
                    <CardHeader>
                        <CardTitle>Referral History</CardTitle>
                        <CardDescription>Recent purchases made using your referral code.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {recentReferrals.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Referred User</TableHead>
                                        <TableHead>Plan</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Commission</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {recentReferrals.map((ref, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="font-medium text-foreground">{ref.user}</TableCell>
                                            <TableCell>{ref.plan}</TableCell>
                                            <TableCell className="text-muted-foreground">{ref.date}</TableCell>
                                            <TableCell className="font-semibold text-green-600">{ref.commission}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={ref.status === "Paid" ? "bg-green-50 text-green-600 border-green-200" : "bg-yellow-50 text-yellow-600 border-yellow-200"}>
                                                    {ref.status}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-border rounded-lg bg-surface-2/50">
                                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
                                    <UserPlus className="w-6 h-6" />
                                </div>
                                <h3 className="text-lg font-medium text-foreground">No Referrals Yet</h3>
                                <p className="text-muted-foreground max-w-xs mx-auto mt-1 mb-6">Share your unique referral code to start earning commissions.</p>
                                <Button variant="outline" onClick={handleCopy} className="gap-2">
                                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                                    {copied ? "Copied!" : "Copy My Code"}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </UserLayout>
    );
}
