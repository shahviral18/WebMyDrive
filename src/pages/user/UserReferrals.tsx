import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Users, Copy, Check, Loader2, ShieldCheck, DollarSign, TrendingUp, UserPlus, RefreshCw, AlertTriangle, Sparkles, EyeOff } from "lucide-react";
import UserLayout from "@/components/user/UserLayout";
import { Button } from "@/components/ui/button";
import { useUser } from "@/contexts/UserContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

const MAX_CHANGES = 2;

function randomCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function UserReferrals() {
    const { user } = useUser();
    const [copied, setCopied] = useState(false);
    const linkRef = useRef<HTMLInputElement>(null);

    const [referralData, setReferralData] = useState<any>(null);
    const [recentReferrals, setRecentReferrals] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    // Custom code state
    const [vibe, setVibe] = useState<"showoff" | "secret" | null>(null);
    const [customCode, setCustomCode] = useState("");
    const [previewRandom, setPreviewRandom] = useState("");
    const [savingCode, setSavingCode] = useState(false);
    const [showWarning, setShowWarning] = useState(false);

    const fetchData = async () => {
        setRefreshing(true);
        try {
            const [dash, hist] = await Promise.all([
                api.get('/referral/dashboard'),
                api.get('/referral/history')
            ]);
            setReferralData(dash);
            setRecentReferrals(hist.referrals || []);
        } catch (e: any) {
            console.error('[Referrals]', e.message);
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
        const timer = setInterval(fetchData, 30000);
        return () => clearInterval(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const referralCode: string | null = referralData?.promoCode || null;
    const changesUsed: number = referralData?.changesUsed ?? 0;
    const changesRemaining: number = referralData?.changesRemaining ?? MAX_CHANGES;

    const referralLink = referralCode
        ? `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/ref/${referralCode}`
        : "";

    const markCopied = () => {
        setCopied(true);
        toast.success("Referral link copied!");
        setTimeout(() => setCopied(false), 2500);
    };

    const fallbackCopy = () => {
        const el = linkRef.current;
        if (!el) { toast.error("Select the link manually and press Ctrl+C."); return; }
        el.removeAttribute("readonly");
        el.focus(); el.select(); el.setSelectionRange(0, 99999);
        try {
            if (document.execCommand("copy")) markCopied();
            else toast.error("Copy failed — press Ctrl+C.");
        } catch { toast.error("Copy failed — press Ctrl+C."); }
        el.setAttribute("readonly", "");
    };

    const handleCopy = () => {
        if (!referralLink) return;
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(referralLink).then(markCopied).catch(fallbackCopy);
        } else {
            fallbackCopy();
        }
    };

    const handleSaveCode = async () => {
        const code = customCode.toUpperCase().trim();
        if (!code || !/^[A-Z0-9]{6,16}$/.test(code)) {
            toast.error("Code must be 6–16 alphanumeric characters.");
            return;
        }
        if (changesRemaining <= 0) {
            toast.error("You've used all your code changes.");
            return;
        }
        setSavingCode(true);
        setShowWarning(false);
        try {
            const result = await api.patch('/user/referral-code', { code });
            toast.success(`Referral code updated to ${result.newCode}`);
            setCustomCode("");
            setVibe(null);
            setPreviewRandom("");
            await fetchData();
        } catch (e: any) {
            toast.error(e.message || "Failed to update code.");
        } finally {
            setSavingCode(false);
        }
    };

    const walletBalance = referralData?.creditBalance ?? 0;
    const totalReferrals = referralData?.totalReferrals ?? 0;

    return (
        <UserLayout>
            <div className="space-y-8 max-w-5xl mx-auto">

                {/* Page Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                            <Users className="w-6 h-6 text-primary" />
                            Referrals &amp; Rewards
                        </h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            Share your link. When someone signs in and buys a plan using your link, you earn 5% wallet credit.
                        </p>
                    </div>
                    <button
                        onClick={fetchData}
                        disabled={refreshing}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card hover:bg-accent text-sm font-medium transition-colors disabled:opacity-50 self-start sm:self-auto"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        {refreshing ? 'Refreshing…' : 'Refresh'}
                    </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        { label: "Total Wallet Credits", value: `₹${walletBalance.toFixed(2)}`, icon: DollarSign, color: "text-green-600", bg: "bg-green-100 dark:bg-green-900/30" },
                        { label: "Successful Referrals", value: `${totalReferrals}`, icon: Users, color: "text-primary", bg: "bg-primary/10" },
                        { label: "Credit Rate", value: "5%", icon: TrendingUp, color: "text-indigo-500", bg: "bg-indigo-100 dark:bg-indigo-900/30" }
                    ].map((stat, i) => (
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

                {/* Referral Code + Customize */}
                <div className="grid gap-6 md:grid-cols-2">
                    {/* My Referral Code */}
                    <Card className="border-border shadow-sm relative overflow-hidden h-full">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                            <Users className="w-32 h-32 text-primary" />
                        </div>
                        <CardHeader>
                            <CardTitle>My Referral Code</CardTitle>
                            <CardDescription>
                                Share this code with buyers — they enter it on the plans page to link to your account.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {referralCode ? (
                                <>
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="flex-1 bg-primary/5 border-2 border-primary/20 rounded-xl px-5 py-4 flex items-center justify-between group hover:border-primary/40 transition-colors">
                                            <span className="font-mono text-2xl font-extrabold tracking-widest text-primary select-all">
                                                {referralCode}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => {
                                                    navigator.clipboard?.writeText(referralCode)
                                                        .then(() => { setCopied(true); toast.success("Code copied!"); setTimeout(() => setCopied(false), 2500); })
                                                        .catch(() => { toast.info("Select & copy: " + referralCode); });
                                                }}
                                                className={`shrink-0 transition-all ${copied ? "text-green-600" : "text-muted-foreground hover:text-primary"}`}
                                                title="Copy code"
                                            >
                                                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-950/30 px-3 py-2 rounded-md border border-green-200 dark:border-green-800 w-fit mb-4">
                                        <ShieldCheck className="w-4 h-4" />
                                        <span>Active</span>
                                    </div>

                                    <div className="space-y-1">
                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Or share the full link</p>
                                        <div className="flex items-center gap-2">
                                            <input
                                                ref={linkRef}
                                                readOnly
                                                value={referralLink}
                                                onClick={e => (e.target as HTMLInputElement).select()}
                                                className="flex-1 font-mono text-[11px] text-muted-foreground bg-card border border-border/50 rounded-md px-3 h-8 focus:outline-none cursor-text truncate"
                                            />
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={handleCopy}
                                                title="Copy full link"
                                                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-primary"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 h-20 rounded-xl bg-card border border-border flex items-center justify-center text-sm text-muted-foreground">
                                    {referralData === null ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        'No referral code assigned — contact support'
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Your Referral Style */}
                    <Card className="border-border shadow-sm h-full">
                        <CardHeader>
                            <CardTitle>Your Referral Style</CardTitle>
                            <CardDescription>
                                How do you want to share your link?
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Change counter */}
                            <div className="flex items-center gap-2">
                                {Array.from({ length: MAX_CHANGES }).map((_, i) => (
                                    <div
                                        key={i}
                                        className={`h-1.5 flex-1 rounded-full ${i < changesUsed ? "bg-primary" : "bg-border"}`}
                                    />
                                ))}
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    {changesRemaining > 0
                                        ? `${changesRemaining} change${changesRemaining !== 1 ? "s" : ""} remaining`
                                        : "No changes left"}
                                </span>
                            </div>

                            {changesRemaining <= 0 ? (
                                <div className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground">
                                    <ShieldCheck className="w-8 h-8" />
                                    <p className="text-sm font-medium">Change limit reached</p>
                                    <p className="text-xs">You've used both of your code changes. Your current code is locked in.</p>
                                </div>
                            ) : (
                                <>
                                    {/* Vibe picker */}
                                    {!vibe && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                onClick={() => {
                                                    setVibe("showoff");
                                                    setCustomCode("");
                                                    setShowWarning(false);
                                                }}
                                                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-center group"
                                            >
                                                <span className="text-2xl">🎉</span>
                                                <p className="text-sm font-semibold text-foreground group-hover:text-primary">Show off your brand</p>
                                                <p className="text-xs text-muted-foreground">Let everyone know it's you</p>
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const r = randomCode();
                                                    setVibe("secret");
                                                    setPreviewRandom(r);
                                                    setCustomCode(r);
                                                    setShowWarning(false);
                                                }}
                                                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-center group"
                                            >
                                                <span className="text-2xl">🤫</span>
                                                <p className="text-sm font-semibold text-foreground group-hover:text-primary">Keep it secret</p>
                                                <p className="text-xs text-muted-foreground">Share anonymously</p>
                                            </button>
                                        </div>
                                    )}

                                    {/* Show off — custom input */}
                                    {vibe === "showoff" && (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 text-xs text-primary font-medium">
                                                <Sparkles className="w-3.5 h-3.5" />
                                                Make it yours
                                            </div>
                                            <input
                                                type="text"
                                                value={customCode}
                                                autoFocus
                                                onChange={e => {
                                                    setCustomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
                                                    setShowWarning(false);
                                                }}
                                                placeholder="E.g. VIRAL2026"
                                                maxLength={16}
                                                disabled={savingCode}
                                                className="w-full font-mono font-bold tracking-widest text-lg h-12 px-4 rounded-xl border-2 border-primary/30 bg-primary/5 text-primary focus:outline-none focus:border-primary disabled:opacity-50"
                                            />
                                            <p className="text-xs text-muted-foreground">6–16 characters, letters and numbers only.</p>
                                        </div>
                                    )}

                                    {/* Keep it secret — random preview */}
                                    {vibe === "secret" && (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                                                <EyeOff className="w-3.5 h-3.5" />
                                                Your anonymous code
                                            </div>
                                            <div className="flex items-center gap-2 p-3 rounded-xl border-2 border-border bg-muted/30">
                                                <span className="flex-1 font-mono font-bold tracking-widest text-lg text-foreground">{previewRandom}</span>
                                                <button
                                                    onClick={() => {
                                                        const r = randomCode();
                                                        setPreviewRandom(r);
                                                        setCustomCode(r);
                                                        setShowWarning(false);
                                                    }}
                                                    className="text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded"
                                                    disabled={savingCode}
                                                >
                                                    regenerate
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Warning */}
                                    {showWarning && vibe && (
                                        <div className="flex items-start gap-2 p-3 rounded-md bg-warning/10 border border-warning/30 text-xs text-foreground">
                                            <AlertTriangle className="w-4 h-4 shrink-0 text-warning mt-0.5" />
                                            <span>
                                                <strong>Heads up:</strong> Your old referral link will stop working. Anyone with the old link won't be credited. Sure?
                                            </span>
                                        </div>
                                    )}

                                    {/* Action buttons */}
                                    {vibe && !showWarning && (
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                className="flex-1"
                                                onClick={() => { setVibe(null); setCustomCode(""); setShowWarning(false); }}
                                                disabled={savingCode}
                                            >
                                                Back
                                            </Button>
                                            <Button
                                                className="flex-1 bg-primary text-white hover:bg-primary/90"
                                                onClick={() => {
                                                    const code = customCode.trim();
                                                    if (!code || !/^[A-Z0-9]{6,16}$/.test(code)) {
                                                        toast.error("Code must be 6–16 alphanumeric characters.");
                                                        return;
                                                    }
                                                    setShowWarning(true);
                                                }}
                                                disabled={savingCode}
                                            >
                                                {vibe === "secret" ? "Use This Code" : "Save Code"}
                                            </Button>
                                        </div>
                                    )}

                                    {vibe && showWarning && (
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                className="flex-1"
                                                onClick={() => setShowWarning(false)}
                                                disabled={savingCode}
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                className="flex-1 bg-primary text-white hover:bg-primary/90"
                                                onClick={handleSaveCode}
                                                disabled={savingCode}
                                            >
                                                {savingCode && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                                                Yes, Change It
                                            </Button>
                                        </div>
                                    )}
                                </>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Referral History */}
                <Card className="border-border shadow-sm">
                    <CardHeader>
                        <CardTitle>Referral History</CardTitle>
                        <CardDescription>Recent purchases made using your referral link.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {recentReferrals.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Referred User</TableHead>
                                        <TableHead>Amount</TableHead>
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
                                                <Badge
                                                    variant="outline"
                                                    className={ref.status === 'VESTED'
                                                        ? "bg-green-50 text-green-600 border-green-200 dark:bg-green-950/30"
                                                        : "bg-yellow-50 text-yellow-600 border-yellow-200 dark:bg-yellow-950/30"
                                                    }
                                                >
                                                    {ref.status}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-border rounded-lg bg-card/50">
                                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
                                    <UserPlus className="w-6 h-6" />
                                </div>
                                <h3 className="text-lg font-medium text-foreground">No Referrals Yet</h3>
                                <p className="text-muted-foreground max-w-xs mx-auto mt-1 mb-6">
                                    Share your unique referral link to start earning commissions.
                                </p>
                                <Button variant="outline" onClick={handleCopy} className="gap-2" disabled={!referralCode}>
                                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                                    {copied ? "Copied!" : "Copy My Link"}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

            </div>
        </UserLayout>
    );
}
