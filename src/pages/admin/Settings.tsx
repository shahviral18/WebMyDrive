import { useState } from "react";
import { motion } from "framer-motion";
import { Save, Globe, Shield, CreditCard, Cpu, Mail, Server, Palette } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ThemeSwitch } from "@/components/ui/theme-switch";
import { useTheme } from "@/contexts/ThemeContext";


const DEFAULT_FEATURES: Record<string, { enabled: boolean; description: string }> = {
    REFERRAL_SYSTEM: { enabled: true, description: "User referral rewards and tracking" },
    DISTRIBUTOR_PORTAL: { enabled: true, description: "Partner distributor access and commissions" },
    WALLET_PAYOUTS: { enabled: false, description: "Allow users to withdraw wallet balance" },
    GOOGLE_PROVISIONING: { enabled: true, description: "Auto-provision Google Workspace on purchase" },
    MAINTENANCE_MODE: { enabled: false, description: "Put site in read-only maintenance mode" },
};

export default function Settings() {
    const { isDark, toggleTheme } = useTheme();
    const handleThemeChange = (next: boolean) => {
        if (next !== isDark) toggleTheme();
    };
    const [loading, setLoading] = useState(false);

    const [general, setGeneral] = useState({
        siteName: "WebMyDrive",
        supportEmail: "support@webmydrive.com",
        locale: "en-IN",
        currency: "INR"
    });

    const [features, setFeatures] = useState(DEFAULT_FEATURES);
    const [gateways, setGateways] = useState({
        activeGateway: "primary", primary: "Zoho Payments", primaryStatus: "online",
        backup: "Razorpay", backupStatus: "online"
    });
    const [limits, setLimits] = useState({
        sleepInterval: 500, burstLimit: 300, syncConcurrency: 1, availabilityCheckLimit: 5
    });


    const handleSave = () => {
        setLoading(true);
        // Simulate API call
        setTimeout(() => {
            setLoading(false);
            toast.success("Settings saved successfully", {
                description: "Your changes have been applied to the system."
            });
        }, 800);
    };

    const toggleFeature = (key: string) => {
        setFeatures(prev => ({
            ...prev,
            [key]: { ...prev[key], enabled: !prev[key].enabled }
        }));
    };

    return (
        <div className="p-6 max-w-[1200px] mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Settings</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Manage global configuration, feature flags, and system parameters
                    </p>
                </div>
                <Button onClick={handleSave} disabled={loading} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
                    <Save className="w-4 h-4" />
                    {loading ? "Saving..." : "Save Changes"}
                </Button>
            </div>

            <Tabs defaultValue="general" className="w-full">
                <TabsList className="w-full justify-start h-auto p-1 bg-muted/50 border border-border rounded-lg mb-6 flex flex-wrap gap-1">
                    <TabsTrigger value="general" className="gap-2 px-4 py-2 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">
                        <Globe className="w-4 h-4" /> General
                    </TabsTrigger>
                    <TabsTrigger value="features" className="gap-2 px-4 py-2 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">
                        <Cpu className="w-4 h-4" /> Features
                    </TabsTrigger>
                    <TabsTrigger value="billing" className="gap-2 px-4 py-2 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">
                        <CreditCard className="w-4 h-4" /> Billing &amp; Gateways
                    </TabsTrigger>
                    <TabsTrigger value="system" className="gap-2 px-4 py-2 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">
                        <Server className="w-4 h-4" /> System &amp; Limits
                    </TabsTrigger>
                    <TabsTrigger value="appearance" className="gap-2 px-4 py-2 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">
                        <Palette className="w-4 h-4" /> Appearance
                    </TabsTrigger>
                </TabsList>


                {/* ── General ───────────────────────────────────────────────────────── */}
                <TabsContent value="general">
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                        <Card className="bg-surface-1 border-border">
                            <CardHeader>
                                <CardTitle>Platform Identity</CardTitle>
                                <CardDescription>Basic information visible to users and in emails.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="siteName">Site Name</Label>
                                    <Input
                                        id="siteName"
                                        value={general.siteName}
                                        onChange={e => setGeneral(prev => ({ ...prev, siteName: e.target.value }))}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="supportEmail">Support Email</Label>
                                    <Input
                                        id="supportEmail"
                                        type="email"
                                        value={general.supportEmail}
                                        onChange={e => setGeneral(prev => ({ ...prev, supportEmail: e.target.value }))}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-surface-1 border-border">
                            <CardHeader>
                                <CardTitle>Localization</CardTitle>
                                <CardDescription>Regional settings for currency and dates.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Default Currency</Label>
                                        <Select value={general.currency} onValueChange={v => setGeneral(prev => ({ ...prev, currency: v }))}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="INR">INR (₹)</SelectItem>
                                                <SelectItem value="USD">USD ($)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Locale</Label>
                                        <Select value={general.locale} onValueChange={v => setGeneral(prev => ({ ...prev, locale: v }))}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="en-IN">English (India)</SelectItem>
                                                <SelectItem value="en-US">English (US)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                </TabsContent>

                {/* ── Features ──────────────────────────────────────────────────────── */}
                <TabsContent value="features">
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid gap-6">
                        <Card className="bg-surface-1 border-border">
                            <CardHeader>
                                <CardTitle>Feature Flags</CardTitle>
                                <CardDescription>Toggle system capabilities in real-time. Use with caution.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-6">
                                {Object.entries(features).map(([key, toggle]) => (
                                    <div key={key} className="flex items-center justify-between space-x-4">
                                        <div className="flex-1 space-y-1">
                                            <p className="text-sm font-medium leading-none text-foreground">{key.replace(/_/g, " ")}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {toggle.description}
                                            </p>
                                        </div>
                                        <Switch
                                            checked={toggle.enabled}
                                            onCheckedChange={() => toggleFeature(key)}
                                        />
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </motion.div>
                </TabsContent>

                {/* ── Billing ───────────────────────────────────────────────────────── */}
                <TabsContent value="billing">
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                        <Card className="bg-surface-1 border-border">
                            <CardHeader>
                                <CardTitle>Payment Gateways</CardTitle>
                                <CardDescription>Configure primary and backup payment processors.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Active Gateway Selector */}
                                <div className="space-y-2">
                                    <Label>Active Gateway Route</Label>
                                    <Select
                                        value={gateways.activeGateway}
                                        onValueChange={v => setGateways(prev => ({ ...prev, activeGateway: v as "primary" | "backup" }))}
                                    >
                                        <SelectTrigger className="w-full md:w-[300px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="primary">Primary (Zoho Payments)</SelectItem>
                                            <SelectItem value="backup">Backup (Razorpay)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        Currently routing all traffic to {gateways.activeGateway === "primary" ? gateways.primary : gateways.backup}.
                                    </p>
                                </div>

                                <Separator />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Primary */}
                                    <div className="space-y-3 rounded-lg border border-border p-4 bg-surface-2/30">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-semibold text-sm">Primary: {gateways.primary}</h4>
                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${gateways.primaryStatus === "online" ? "bg-success/10 text-success border-success/20" : "bg-danger/10 text-danger border-danger/20"
                                                }`}>
                                                {gateways.primaryStatus}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Handlers: UPI, Credit Card, NetBanking. Low transaction fees.
                                        </p>
                                    </div>

                                    {/* Backup */}
                                    <div className="space-y-3 rounded-lg border border-border p-4 bg-surface-2/30">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-semibold text-sm">Backup: {gateways.backup}</h4>
                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${gateways.backupStatus === "online" ? "bg-success/10 text-success border-success/20" : "bg-danger/10 text-danger border-danger/20"
                                                }`}>
                                                {gateways.backupStatus}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Handlers: All methods. Higher success rate, slightly higher fees.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                </TabsContent>

                {/* ── System ────────────────────────────────────────────────────────── */}
                <TabsContent value="system">
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                        <Card className="bg-surface-1 border-border">
                            <CardHeader>
                                <CardTitle>Rate Limiting & Throttling</CardTitle>
                                <CardDescription>Control backend load and API consumption.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label>Google API Sleep Interval (ms)</Label>
                                        <Input
                                            type="number"
                                            value={limits.sleepInterval}
                                            onChange={e => setLimits(prev => ({ ...prev, sleepInterval: parseInt(e.target.value) || 0 }))}
                                        />
                                        <p className="text-xs text-muted-foreground">Delay between Google Workspace Directory API calls.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Burst Limit</Label>
                                        <Input
                                            type="number"
                                            value={limits.burstLimit}
                                            onChange={e => setLimits(prev => ({ ...prev, burstLimit: parseInt(e.target.value) || 0 }))}
                                        />
                                        <p className="text-xs text-muted-foreground">Max concurrent requests before queuing.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Sync Concurrency</Label>
                                        <Select value={String(limits.syncConcurrency)} onValueChange={v => setLimits(prev => ({ ...prev, syncConcurrency: parseInt(v) }))}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="1">1 (Safest)</SelectItem>
                                                <SelectItem value="3">3 (Balanced)</SelectItem>
                                                <SelectItem value="5">5 (High Load)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Availability Check Limit</Label>
                                        <Input
                                            type="number"
                                            value={limits.availabilityCheckLimit}
                                            onChange={e => setLimits(prev => ({ ...prev, availabilityCheckLimit: parseInt(e.target.value) || 0 }))}
                                        />
                                        <p className="text-xs text-muted-foreground">Max user lookups per minute per IP.</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-surface-1 border-border">
                            <CardHeader>
                                <CardTitle className="text-danger">Danger Zone</CardTitle>
                                <CardDescription>Irreversible system actions.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between p-4 border border-danger/30 rounded-lg bg-danger/5">
                                    <div>
                                        <h4 className="font-semibold text-danger">Flush Cache</h4>
                                        <p className="text-xs text-danger/80">Clear all Redis keys and local memory caches.</p>
                                    </div>
                                    <Button variant="destructive" size="sm">Flush Cache</Button>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                </TabsContent>

                {/* ── Appearance ──────────────────────────────────────────────────────── */}
                <TabsContent value="appearance">
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                        <Card className="bg-surface-1 border-border">
                            <CardHeader>
                                <CardTitle>Interface Appearance</CardTitle>
                                <CardDescription>Manage how the system looks for all users.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-surface-2">
                                        <div>
                                            <h4 className="font-semibold text-foreground">Dark Mode</h4>
                                            <p className="text-sm text-muted-foreground mr-4">Toggle between light and dark themes.</p>
                                        </div>
                                        <div className="shrink-0">
                                            <ThemeSwitch checked={isDark} onCheckedChange={handleThemeChange} size={11} ariaLabel="Toggle theme" />
                                        </div>
                                    </div>
                                    <div className="text-xs text-muted-foreground pt-2">
                                        <Shield className="w-3 h-3 inline-block mr-1 mb-0.5 text-primary" />
                                        Theme preference is saved locally and applies globally across all portals.
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
