import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Megaphone, Copy, QrCode, Link, FileText, Share2, CheckCheck, Palette, Loader2, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DistributorLayout from "@/components/distributor/DistributorLayout";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/utils";
import { api } from "@/lib/api";

const templates = [
    { id: 1, name: "Cloud Storage Promo", type: "Banner", size: "1200×628", desc: "LinkedIn/Facebook ad banner", preview: "🖼️" },
    { id: 2, name: "Referral WhatsApp Post", type: "Social", size: "1080×1080", desc: "Square WhatsApp/Instagram post", preview: "📱" },
    { id: 3, name: "Email Signature Block", type: "Email", size: "HTML", desc: "Professional email signature with referral link", preview: "✉️" },
    { id: 4, name: "A4 Flyer Template", type: "Print", size: "A4 PDF", desc: "Printable partner flyer for events", preview: "🖨️" },
];

/** Simple deterministic visual QR placeholder — same pattern every render */
function QRPlaceholder({ code }: { code: string }) {
    const seed = code.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return (
        <div className="w-36 h-36 mx-auto bg-surface-1 rounded-xl p-3 flex items-center justify-center shadow-inner">
            <div className="w-full h-full grid grid-cols-7 gap-0.5">
                {Array.from({ length: 49 }).map((_, i) => {
                    // corner finder patterns (top-left, top-right, bottom-left)
                    const row = Math.floor(i / 7);
                    const col = i % 7;
                    const isCorner =
                        (row < 2 && col < 2) || (row < 2 && col > 4) || (row > 4 && col < 2);
                    const filled = isCorner || ((seed * (i + 1) * 2654435761) >>> 0) % 3 !== 0;
                    return (
                        <div key={i} className={`rounded-sm ${filled ? "bg-foreground" : "bg-surface-1"}`} />
                    );
                })}
            </div>
        </div>
    );
}

export default function DistributorMarketing() {
    const [copied, setCopied] = useState<string | null>(null);
    const [refCode, setRefCode] = useState<string | null>(null);
    const [promoCode, setPromoCode] = useState<string | null>(null);
    const [promoDiscounts, setPromoDiscounts] = useState<Record<string, number>>({});
    const [distName, setDistName] = useState("Distributor");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get("/distributor/dashboard")
            .then((data: any) => {
                const code =
                    data?.referralCode ||
                    (data?.distributor as any)?.referralCode ||
                    null;
                setRefCode(code);
                setPromoCode(data?.promoCode ?? null);
                setPromoDiscounts(data?.promoDiscounts ?? {});
                setDistName(data?.distributor?.name || "Distributor");
            })
            .catch(() => toast.error("Failed to load marketing data"))
            .finally(() => setLoading(false));
    }, []);

    const refLink = refCode
        ? `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/plans?ref=${refCode}`
        : "";

    const copyLink = (url: string, label: string) => {
        if (!url) { toast.error("Referral code not loaded yet."); return; }
        copyToClipboard(url).then(() => {
            setCopied(label);
            toast.success(`${label} copied!`);
            setTimeout(() => setCopied(null), 2000);
        }).catch(() => toast.error("Failed to copy."));
    };

    const trackingLinks = refLink
        ? [
            { id: 1, name: "LinkedIn Campaign", url: `${refLink}&utm_source=linkedin&utm_medium=social`, clicks: 0, conversions: 0 },
            { id: 2, name: "WhatsApp Blast", url: `${refLink}&utm_source=whatsapp&utm_medium=chat`, clicks: 0, conversions: 0 },
            { id: 3, name: "Email Sequence", url: `${refLink}&utm_source=email&utm_medium=newsletter`, clicks: 0, conversions: 0 },
        ]
        : [];

    return (
        <DistributorLayout>
            <div className="space-y-8">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <Megaphone className="w-6 h-6 text-primary" /> Marketing Hub
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Hi <span className="font-semibold text-foreground">{distName}</span> — all the tools you need to promote WebMyDrive and grow your network.
                    </p>
                </div>

                {/* Promo Code Card */}
                <Card className="border-border shadow-sm">
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                            <Tag className="w-5 h-5 text-primary" />
                            <CardTitle className="text-base">Promo Code</CardTitle>
                        </div>
                        <CardDescription>
                            Share this code — customers enter it at checkout for a plan discount and you earn commission.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {loading ? (
                            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                        ) : (() => {
                            const displayCode = promoCode ?? refCode;
                            if (!displayCode) return (
                                <div className="py-6 text-center text-sm text-muted-foreground">
                                    Code not loaded — contact support.
                                </div>
                            );
                            return (
                                <>
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 bg-muted rounded-lg px-5 py-3 font-mono text-2xl font-bold tracking-widest text-foreground border border-border select-all">
                                            {displayCode}
                                        </div>
                                        <Button variant="outline" size="icon" className="h-12 w-12 shrink-0"
                                            onClick={() => copyLink(displayCode, "Promo code")}
                                            title="Copy promo code">
                                            {copied === "Promo code" ? <CheckCheck className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                                        </Button>
                                    </div>
                                    {Object.keys(promoDiscounts).length > 0 && (
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                                                Customer discounts by plan:
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {Object.entries(promoDiscounts).map(([plan, pct]) => (
                                                    <span key={plan}
                                                        className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-medium bg-muted">
                                                        <span className="text-foreground">{plan}</span>
                                                        <span className="text-primary font-bold">{pct}% off</span>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                    </CardContent>
                </Card>

                {/* My Referral Hub Card */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* QR + Code */}
                    <Card className="border-border bg-gradient-to-br from-primary/5 to-indigo-500/5">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <QrCode className="w-5 h-5 text-primary" /> Referral Link
                            </CardTitle>
                            <CardDescription>Share this URL — customers who click it are tracked as your referrals and you earn commission.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            {loading ? (
                                <div className="flex justify-center py-10">
                                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : refCode ? (
                                <>
                                    <QRPlaceholder code={refCode} />

                                    {/* Big code badge */}
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 bg-primary/5 border-2 border-primary/20 rounded-xl px-5 py-4 flex items-center justify-between hover:border-primary/40 transition-colors">
                                            <span className="font-mono text-2xl font-extrabold tracking-widest text-primary select-all">
                                                {refCode}
                                            </span>
                                            <Button
                                                variant="ghost" size="icon"
                                                onClick={() => copyLink(refCode, "Referral code")}
                                                className={copied === "Referral code" ? "text-green-600" : "text-muted-foreground hover:text-primary"}
                                                title="Copy code"
                                            >
                                                {copied === "Referral code" ? <CheckCheck className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Full link (secondary) */}
                                    <div className="space-y-1">
                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Or share the full link</p>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                value={refLink} readOnly
                                                className="font-mono text-xs bg-surface-2 border-border text-muted-foreground h-8"
                                            />
                                            <Button size="icon" variant="outline" onClick={() => copyLink(refLink, "Referral link")} className="shrink-0 h-8 w-8">
                                                {copied === "Referral link" ? <CheckCheck className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                                            </Button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="py-10 text-center text-sm text-muted-foreground">
                                    No referral code assigned — contact support.
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Share Quick Actions */}
                    <Card className="border-border">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Share2 className="w-5 h-5 text-primary" /> Quick Share</CardTitle>
                            <CardDescription>Share directly to your favourite channels.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {[
                                { name: "WhatsApp", icon: "💬", color: "bg-green-600 hover:bg-green-700" },
                                { name: "LinkedIn", icon: "💼", color: "bg-blue-700 hover:bg-blue-800" },
                                { name: "Email Share", icon: "✉️", color: "bg-indigo-600 hover:bg-indigo-700" },
                                { name: "Copy Message", icon: "📋", color: "bg-surface-3 hover:bg-muted border border-border text-foreground" },
                            ].map((s, i) => (
                                <motion.button key={i} whileTap={{ scale: 0.97 }}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white font-medium text-sm transition-colors ${s.color}`}
                                    disabled={!refLink}
                                    onClick={() => {
                                        if (!refLink) { toast.error("Code not loaded yet."); return; }
                                        const waMsg = `Hi! I'm sharing WebMyDrive with you. Use my referral code *${refCode}* or link: ${refLink}`;
                                        const copyMsg = `🚀 Get Google Workspace storage with WebMyDrive! Use my referral code *${refCode}* for tracking: ${refLink}`;
                                        if (s.name === "WhatsApp") window.open(`https://wa.me/?text=${encodeURIComponent(waMsg)}`, "_blank");
                                        else if (s.name === "LinkedIn") window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(refLink)}`, "_blank");
                                        else if (s.name === "Email Share") window.location.href = `mailto:?subject=Try WebMyDrive&body=${encodeURIComponent(`Hi! Check out WebMyDrive: ${refLink}`)}`;
                                        else copyToClipboard(copyMsg).then(() => toast.success("Message copied to clipboard!"));
                                    }}
                                >
                                    <span className="text-lg">{s.icon}</span> Share on {s.name}
                                </motion.button>
                            ))}
                        </CardContent>
                    </Card>
                </div>

                {/* UTM Tracking Links */}
                <Card className="border-border">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Link className="w-5 h-5 text-primary" /> Campaign Tracking Links</CardTitle>
                        <CardDescription>Track your referral link performance across different marketing channels.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {trackingLinks.length === 0 ? (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                                {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Tracking links will appear once your referral code loads."}
                            </div>
                        ) : (
                            trackingLinks.map(tl => (
                                <div key={tl.id} className="flex items-center gap-4 p-4 rounded-xl bg-surface-2 border border-border">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="text-sm font-semibold text-foreground">{tl.name}</p>
                                            <Badge variant="outline" className="text-[10px] text-success border-success/30 bg-success/10">{tl.conversions} converted</Badge>
                                        </div>
                                        <p className="font-mono text-xs text-muted-foreground truncate">{tl.url}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-sm font-bold text-foreground">{tl.clicks}</p>
                                        <p className="text-xs text-muted-foreground">clicks</p>
                                    </div>
                                    <Button size="icon" variant="outline" onClick={() => copyLink(tl.url, tl.name)} className="shrink-0 text-muted-foreground hover:text-primary">
                                        {copied === tl.name ? <CheckCheck className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                                    </Button>
                                </div>
                            ))
                        )}
                        <Button variant="outline" className="w-full gap-2 border-dashed border-border text-muted-foreground hover:text-primary">
                            <Link className="w-4 h-4" /> Create New Tracking Link
                        </Button>
                    </CardContent>
                </Card>

                {/* Marketing Assets */}
                <Card className="border-border">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Palette className="w-5 h-5 text-primary" /> Marketing Assets</CardTitle>
                        <CardDescription>Ready-to-use banners, posts, and flyers pre-loaded with your referral code.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {templates.map(t => (
                            <div key={t.id} className="flex items-center gap-4 p-4 rounded-xl bg-surface-2 border border-border hover:border-primary/30 transition-colors group">
                                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-2xl shrink-0">{t.preview}</div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                                    <p className="text-xs text-muted-foreground">{t.desc}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">{t.type} · {t.size}</p>
                                </div>
                                <Button size="sm" variant="outline" className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity gap-1.5">
                                    <FileText className="w-3.5 h-3.5" /> Download
                                </Button>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </DistributorLayout>
    );
}
