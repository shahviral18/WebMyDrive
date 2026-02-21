import { useState } from "react";
import { motion } from "framer-motion";
import { Megaphone, Copy, QrCode, Link, Image, FileText, Share2, CheckCheck, Palette } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DistributorLayout from "@/components/distributor/DistributorLayout";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/utils";

const REF_CODE = "PRIYA-NET-2026";
const REF_LINK = `${typeof window !== "undefined" ? window.location.origin : ""}/login?ref=${REF_CODE}`;

const templates = [
    { id: 1, name: "Cloud Storage Promo", type: "Banner", size: "1200×628", desc: "LinkedIn/Facebook ad banner", preview: "🖼️" },
    { id: 2, name: "Referral Whatsapp Post", type: "Social", size: "1080×1080", desc: "Square WhatsApp/Instagram post", preview: "📱" },
    { id: 3, name: "Email Signature Block", type: "Email", size: "HTML", desc: "Professional email signature with referral link", preview: "✉️" },
    { id: 4, name: "A4 Flyer Template", type: "Print", size: "A4 PDF", desc: "Printable partner flyer for events", preview: "🖨️" },
];

const trackingLinks = [
    { id: 1, name: "LinkedIn Campaign", url: `${REF_LINK}&utm_source=linkedin&utm_medium=social`, clicks: 142, conversions: 9 },
    { id: 2, name: "WhatsApp Blast", url: `${REF_LINK}&utm_source=whatsapp&utm_medium=chat`, clicks: 298, conversions: 18 },
    { id: 3, name: "Email Sequence", url: `${REF_LINK}&utm_source=email&utm_medium=newsletter`, clicks: 87, conversions: 5 },
];

function QRPlaceholder({ value }: { value: string }) {
    // Simple visual QR placeholder using a grid pattern (real app would use qrcode library)
    return (
        <div className="w-36 h-36 mx-auto bg-white rounded-xl p-3 flex items-center justify-center shadow-inner">
            <div className="w-full h-full grid grid-cols-7 gap-0.5">
                {Array.from({ length: 49 }).map((_, i) => (
                    <div key={i} className={`rounded-sm ${Math.random() > 0.45 ? "bg-gray-900" : "bg-white"}`} />
                ))}
            </div>
        </div>
    );
}

export default function DistributorMarketing() {
    const [copied, setCopied] = useState<string | null>(null);

    const copyLink = (url: string, label: string) => {
        copyToClipboard(url).then(() => {
            setCopied(label);
            toast.success(`${label} copied!`);
            setTimeout(() => setCopied(null), 2000);
        }).catch(() => toast.error("Failed to copy."));
    };

    return (
        <DistributorLayout>
            <div className="space-y-8">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <Megaphone className="w-6 h-6 text-primary" /> Marketing Hub
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">All the tools you need to promote WebMyDrive and grow your referral network.</p>
                </div>

                {/* My Referral Hub Card */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* QR + Link */}
                    <Card className="border-border bg-gradient-to-br from-primary/5 to-indigo-500/5">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><QrCode className="w-5 h-5 text-primary" /> My Referral Code</CardTitle>
                            <CardDescription>Share your unique QR code or link to earn commissions.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <QRPlaceholder value={REF_LINK} />
                            <div className="text-center">
                                <p className="text-xs text-muted-foreground mb-1">Your referral code</p>
                                <div className="inline-flex items-center gap-2 bg-surface-3 rounded-lg px-3 py-2">
                                    <span className="font-mono text-sm font-bold text-primary-glow tracking-widest">{REF_CODE}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Input value={REF_LINK} readOnly className="font-mono text-xs bg-surface-2 border-border text-muted-foreground" />
                                <Button size="icon" variant="outline" onClick={() => copyLink(REF_LINK, "Referral link")} className="shrink-0">
                                    {copied === "Referral link" ? <CheckCheck className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                                </Button>
                            </div>
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
                                { name: "WhatsApp", icon: "💬", color: "bg-green-600 hover:bg-green-700", msg: `Hi! I'm sharing WebMyDrive with you. Use my link: ${REF_LINK}` },
                                { name: "LinkedIn", icon: "💼", color: "bg-blue-700 hover:bg-blue-800", msg: REF_LINK },
                                { name: "Email Share", icon: "✉️", color: "bg-indigo-600 hover:bg-indigo-700", msg: `mailto:?subject=Try WebMyDrive&body=Hi! Check out WebMyDrive: ${REF_LINK}` },
                                { name: "Copy Message", icon: "📋", color: "bg-surface-3 hover:bg-muted text-foreground", msg: `🚀 Get Google Workspace storage with WebMyDrive! Use my referral link for a special discount: ${REF_LINK}` },
                            ].map((s, i) => (
                                <motion.button key={i} whileTap={{ scale: 0.97 }}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white font-medium text-sm transition-colors ${s.color}`}
                                    onClick={() => {
                                        if (s.name === "WhatsApp") window.open(`https://wa.me/?text=${encodeURIComponent(s.msg)}`, "_blank");
                                        else if (s.name === "LinkedIn") window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(REF_LINK)}`, "_blank");
                                        else if (s.name === "Email Share") window.location.href = s.msg;
                                        else { copyToClipboard(s.msg).then(() => toast.success("Message copied to clipboard!")); }
                                    }}>
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
                        {trackingLinks.map(tl => (
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
                        ))}
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
