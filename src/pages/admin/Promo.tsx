import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    Gift, Percent, Save,
    Info, CalendarClock, RefreshCw, AlertTriangle
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { toast } from "sonner";

export interface UserReferralConfig {
    referrerCreditRate: number;
    referredDiscountRate: number;
    decaySchedule: number[];
    nudgeThreshold: number;
    upgradeFeeDiscount: number;
    allowNewReferrals: boolean;
    disableReferralsFromDate: string | null;
    existingReferralsOnDisable: "CONTINUE_DECAY" | "STOP_IMMEDIATELY";
}

export default function Promo() {
    const [cfg, setCfg] = useState<UserReferralConfig | null>(null);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get("/admin/config?type=USER_REFERRAL_SETTINGS")
            .then(data => {
                setCfg(data);
                setLoading(false);
            })
            .catch(console.error);
    }, []);

    const update = (patch: Partial<UserReferralConfig>) => {
        setCfg(c => c ? { ...c, ...patch } : null);
        setDirty(true);
    };

    const handleSave = async () => {
        if (!cfg) return;
        setSaving(true);
        try {
            await api.post("/admin/config", { type: "USER_REFERRAL_SETTINGS", data: cfg });
            setDirty(false);
            toast.success("Promo settings saved", {
                description: "Changes are now live on the customer portal.",
            });
        } catch (e: any) {
            toast.error("Failed to save", { description: e.message });
        } finally {
            setSaving(false);
        }
    };

    if (loading || !cfg) {
        return <div className="p-6 flex justify-center py-24"><RefreshCw className="w-6 h-6 animate-spin text-primary" /></div>;
    }

    return (
        <div className="p-6 space-y-8 max-w-[1400px] mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">User Referral Settings</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Configure discounts and wallet credits for the user-to-user referral program
                    </p>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={!dirty || saving}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 self-start"
                >
                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? "Saving…" : "Save Changes"}
                </Button>
            </div>

            {/* ── Enable / Disable ── */}
            <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <div className="rounded-xl bg-surface-1 border border-border p-5 shadow-card">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                                <Gift className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <p className="font-semibold text-foreground">Allow New Referrals</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    When enabled, users get a personal code to share. Disabling stops new codes from working.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            <span className={`text-xs font-semibold ${cfg.allowNewReferrals ? "text-green-400" : "text-muted-foreground"}`}>
                                {cfg.allowNewReferrals ? "ENABLED" : "DISABLED"}
                            </span>
                            <Switch
                                checked={cfg.allowNewReferrals}
                                onCheckedChange={v => update({ allowNewReferrals: v })}
                                className="data-[state=checked]:bg-primary"
                            />
                        </div>
                    </div>
                </div>
            </motion.section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ── Rates Configuration ── */}
                <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                    <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Percent className="w-4 h-4 text-primary" /> Program Rates
                    </h2>
                    <div className="rounded-xl bg-surface-1 border border-border p-5 shadow-card space-y-6">

                        {/* New User Discount */}
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <p className="text-sm font-medium text-foreground">
                                    Referred Discount Rate
                                </p>
                                <span className="font-mono text-sm text-primary font-semibold">
                                    {(cfg.referredDiscountRate * 100).toFixed(1)}%
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground mb-4">
                                Applied to the new user's first invoice
                            </p>
                            <Slider
                                min={0} max={20} step={0.5}
                                value={[cfg.referredDiscountRate * 100]}
                                onValueChange={([v]) => update({ referredDiscountRate: v / 100 })}
                            />
                        </div>

                        {/* Referrer Credit Rate */}
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <p className="text-sm font-medium text-foreground">
                                    Referrer Credit Rate (Year 1)
                                </p>
                                <span className="font-mono text-sm text-primary font-semibold">
                                    {(cfg.referrerCreditRate * 100).toFixed(1)}%
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground mb-4">
                                Credit applied to the referrer's wallet upon first sale
                            </p>
                            <Slider
                                min={0} max={25} step={0.5}
                                value={[cfg.referrerCreditRate * 100]}
                                onValueChange={([v]) => update({ referrerCreditRate: v / 100 })}
                            />
                        </div>

                        <div className="p-3 rounded-lg bg-primary/5 border border-primary/15 flex items-start gap-2 mt-4">
                            <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                            <p className="text-xs text-muted-foreground">
                                Default PRD rates: <strong className="text-foreground">2.5%</strong> discount to the new user and <strong className="text-foreground">5%</strong> credit to the referrer's wallet. Total acquisition cost: <strong className="text-foreground">7.5%</strong>.
                            </p>
                        </div>
                    </div>
                </motion.section>

                {/* ── Multi-Year Decay & Upsell ── */}
                <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
                    <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                        <CalendarClock className="w-4 h-4 text-amber-500" /> Decay & Upgrades
                    </h2>
                    <div className="rounded-xl bg-surface-1 border border-border p-5 shadow-card space-y-6">

                        {/* Decay Array */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <p className="text-sm font-medium text-foreground">
                                    Multi-Year Renewal Decay Schedule
                                </p>
                            </div>
                            <p className="text-xs text-muted-foreground mb-4">
                                Comma-separated percentages earned by referrer when referred user renews in subsequent years (Year 1, Year 2, Year 3...)
                            </p>
                            <Input
                                value={cfg.decaySchedule.map(x => x * 100).join(", ")}
                                onChange={e => {
                                    try {
                                        const vals = e.target.value.split(",").map(v => Number(v.trim()) / 100);
                                        if (vals.every(v => !isNaN(v))) update({ decaySchedule: vals });
                                    } catch { }
                                }}
                                placeholder="5, 4, 3, 2, 1, 0"
                                className="font-mono text-sm"
                            />
                        </div>

                        {/* Nudge threshold */}
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <p className="text-sm font-medium text-foreground">
                                    Distributor Nudge Threshold
                                </p>
                                <span className="font-mono text-sm text-foreground font-semibold">
                                    {cfg.nudgeThreshold} referrals
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground mb-4">
                                Shown active nudge to become a cash distributor after X referrals.
                            </p>
                            <Slider
                                min={1} max={20} step={1}
                                value={[cfg.nudgeThreshold]}
                                onValueChange={([v]) => update({ nudgeThreshold: v })}
                            />
                        </div>
                    </div>
                </motion.section>
            </div>

            {/* ── Sunset Controls ── */}
            <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <h2 className="text-sm font-semibold text-danger uppercase tracking-wider mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-danger" /> Program Sunsetting
                </h2>
                <div className="rounded-xl bg-danger/5 border border-danger/20 p-5 shadow-card grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                        <p className="text-sm font-medium text-foreground mb-1">Disable Referrals From Date</p>
                        <p className="text-xs text-muted-foreground mb-3">Hard stop date for all new referrals</p>
                        <Input
                            type="date"
                            className="bg-surface-1 w-full max-w-[200px]"
                            value={cfg.disableReferralsFromDate || ""}
                            onChange={e => update({ disableReferralsFromDate: e.target.value || null })}
                        />
                    </div>

                    <div>
                        <p className="text-sm font-medium text-foreground mb-1">Existing Referrals on Disable</p>
                        <p className="text-xs text-muted-foreground mb-3">What happens to active renewals?</p>
                        <div className="flex flex-col gap-2">
                            <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-surface-2 p-2 rounded-lg border">
                                <input
                                    type="radio"
                                    name="sunsetAction"
                                    checked={cfg.existingReferralsOnDisable === "CONTINUE_DECAY"}
                                    onChange={() => update({ existingReferralsOnDisable: "CONTINUE_DECAY" })}
                                />
                                Continue established decay curve until 0%
                            </label>
                            <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-surface-2 p-2 rounded-lg border">
                                <input
                                    type="radio"
                                    name="sunsetAction"
                                    checked={cfg.existingReferralsOnDisable === "STOP_IMMEDIATELY"}
                                    onChange={() => update({ existingReferralsOnDisable: "STOP_IMMEDIATELY" })}
                                />
                                Stop immediately (forfeit future credits)
                            </label>
                        </div>
                    </div>
                </div>
            </motion.section>

        </div>
    );
}
