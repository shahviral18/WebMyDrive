import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Save, Gift, Wallet, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { usePermissions } from "@/contexts/PermissionsContext";

// ─── Defaults ────────────────────────────────────────────────────────────────
const DEFAULT_USER_CONFIG = {
    allowNewReferrals: true,
    nudgeThreshold: 5,
    disableReferralsFromDate: null as string | null,
    existingReferralsOnDisable: "CONTINUE_DECAY" as "CONTINUE_DECAY" | "STOP_IMMEDIATELY",
};

const DEFAULT_DIST_CONFIG = {
    allowNewSignups: true,
    tiers: [
        { name: "Starter",  newOrdersThreshold: 0,      renewalThreshold: 0,      rate: 0 },
        { name: "Silver",   newOrdersThreshold: 50000,   renewalThreshold: 30000,  rate: 0.10 },
        { name: "Gold",     newOrdersThreshold: 100000,  renewalThreshold: 75000,  rate: 0.15 },
        { name: "Platinum", newOrdersThreshold: 200000,  renewalThreshold: 150000, rate: 0.20 },
    ],
    disableProgramFromDate: null as string | null,
    existingOnDisable: "CONTINUE" as "CONTINUE" | "FREEZE" | "TERMINATE",
};

const DEFAULT_WALLET_CONFIG = {
    distributorMinBalance: 2000,
    payoutThreshold: 5000,
    deactivationWalletForfeit: true,
};

// ─── Reusable field components ────────────────────────────────────────────────
function SectionCard({ title, description, icon, children }: any) {
    return (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden mb-6">
            <div className="flex items-start gap-3 p-5 border-b border-border">
                <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary">
                    {icon}
                </div>
                <div>
                    <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                </div>
            </div>
            <div className="p-5">{children}</div>
        </div>
    );
}

function ConfigRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between py-3 border-b border-border last:border-0 gap-4">
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{label}</p>
                {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
            </div>
            <div className="shrink-0">{children}</div>
        </div>
    );
}

function NumberField({ value, onChange, suffix = "", min = 0, step = 1, width = "w-32" }: any) {
    return (
        <div className={`relative ${width} flex items-center gap-2`}>
            <Input
                type="number"
                min={min}
                step={step}
                value={value ?? ""}
                onChange={e => onChange(parseFloat(e.target.value) || 0)}
                className={cn("text-right font-semibold text-sm h-9", suffix ? "pr-8" : "px-3")}
            />
            {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none">{suffix}</span>}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ReferralEnginePage() {
    const { can } = usePermissions();
    const [userConfig, setUserConfig] = useState<typeof DEFAULT_USER_CONFIG>(DEFAULT_USER_CONFIG);
    const [distConfig, setDistConfig] = useState<typeof DEFAULT_DIST_CONFIG>(DEFAULT_DIST_CONFIG);
    const [walletConfig, setWalletConfig] = useState<typeof DEFAULT_WALLET_CONFIG>(DEFAULT_WALLET_CONFIG);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get("/admin/config")
            .then(data => {
                if (data.USER_REFERRAL_SETTINGS) {
                    const u = data.USER_REFERRAL_SETTINGS;
                    setUserConfig({
                        ...DEFAULT_USER_CONFIG,
                        ...u,
                        disableReferralsFromDate: u.disableReferralsFromDate ?? null,
                        existingReferralsOnDisable: u.existingReferralsOnDisable ?? "CONTINUE_DECAY",
                    });
                }
                if (data.DISTRIBUTOR_SETTINGS) {
                    const d = data.DISTRIBUTOR_SETTINGS;
                    setDistConfig({
                        ...DEFAULT_DIST_CONFIG,
                        ...d,
                        tiers: Array.isArray(d.tiers) ? d.tiers : DEFAULT_DIST_CONFIG.tiers,
                        disableProgramFromDate: d.disableProgramFromDate ?? null,
                        existingOnDisable: d.existingOnDisable ?? "CONTINUE",
                    });
                }
                if (data.WALLET_SETTINGS) {
                    setWalletConfig({ ...DEFAULT_WALLET_CONFIG, ...data.WALLET_SETTINGS });
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const saveConfigs = async () => {
        setSaving(true);
        try {
            await Promise.all([
                api.post("/admin/config", { type: "USER_REFERRAL_SETTINGS", data: userConfig }),
                api.post("/admin/config", { type: "DISTRIBUTOR_SETTINGS", data: distConfig }),
                api.post("/admin/config", { type: "WALLET_SETTINGS", data: walletConfig }),
            ]);
            setDirty(false);
            toast.success("Referral engine settings saved.");
        } catch (e: any) {
            toast.error(e.message || "Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    const setU = (k: string, v: any) => { setUserConfig(p => ({ ...p, [k]: v })); setDirty(true); };
    const setD = (k: string, v: any) => { setDistConfig(p => ({ ...p, [k]: v })); setDirty(true); };
    const setW = (k: string, v: any) => { setWalletConfig(p => ({ ...p, [k]: v })); setDirty(true); };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-32">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="p-6 max-w-[900px] mx-auto pb-20"
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Commission &amp; Referral System</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">Manage user referrals and the distributor partner program</p>
                </div>
                {can("referralEngine", "edit") && (
                  <Button
                      onClick={saveConfigs}
                      disabled={!dirty || saving}
                      className={cn("gap-2 min-w-[130px]", dirty ? "bg-primary hover:bg-primary/90" : "bg-muted text-muted-foreground")}
                  >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {saving ? "Saving…" : "Save Changes"}
                  </Button>
                )}
            </div>

            {/* ── User Referral Program ───────────────────────────────────── */}
            <SectionCard
                title="User Referral Program"
                description="Per-plan discounts for buyers, wallet credits for referrers."
                icon={<Gift className="w-4 h-4" />}
            >
                <ConfigRow label="Program Enabled" hint="Allow new referral codes to be used">
                    <Switch checked={userConfig.allowNewReferrals} onCheckedChange={v => setU("allowNewReferrals", v)} />
                </ConfigRow>

                <ConfigRow label="Distributor Upgrade Nudge" hint="Show upgrade notice to user after reaching this many successful referrals">
                    <NumberField value={userConfig.nudgeThreshold} onChange={(v: number) => setU("nudgeThreshold", v)} width="w-24" />
                </ConfigRow>

            </SectionCard>

            {/* ── Distributor Program ─────────────────────────────────────── */}
            <SectionCard
                title="Distributor Program"
                description="Dual-threshold tier model — flat commission rate, no decay, annual revenue reset"
                icon={<Users className="w-4 h-4" />}
            >
                <ConfigRow label="Program Enabled" hint="Allow new distributor signups">
                    <Switch checked={distConfig.allowNewSignups} onCheckedChange={v => setD("allowNewSignups", v)} />
                </ConfigRow>

                {/* Tier Table */}
                <div className="py-4 border-b border-border">
                    <p className="text-sm font-semibold mb-3 text-foreground">Tier Configuration</p>
                    <div className="grid grid-cols-4 gap-2 mb-2 text-xs text-muted-foreground font-medium px-1">
                        <span>Tier Name</span>
                        <span>New Orders (₹/yr)</span>
                        <span>Renewals (₹/yr)</span>
                        <span>Commission Rate</span>
                    </div>
                    {distConfig.tiers.map((t: any, idx: number) => (
                        <div key={idx} className="grid grid-cols-4 gap-2 mb-2">
                            <Input
                                value={t.name}
                                onChange={e => {
                                    const tiers = [...distConfig.tiers];
                                    tiers[idx] = { ...tiers[idx], name: e.target.value };
                                    setD("tiers", tiers);
                                }}
                                placeholder="Tier name"
                                className="h-9 text-sm"
                            />
                            <Input
                                type="number"
                                value={t.newOrdersThreshold}
                                onChange={e => {
                                    const tiers = [...distConfig.tiers];
                                    tiers[idx] = { ...tiers[idx], newOrdersThreshold: parseFloat(e.target.value) || 0 };
                                    setD("tiers", tiers);
                                }}
                                placeholder="e.g. 50000"
                                className="h-9 text-sm"
                                disabled={idx === 0}
                            />
                            <Input
                                type="number"
                                value={t.renewalThreshold}
                                onChange={e => {
                                    const tiers = [...distConfig.tiers];
                                    tiers[idx] = { ...tiers[idx], renewalThreshold: parseFloat(e.target.value) || 0 };
                                    setD("tiers", tiers);
                                }}
                                placeholder="e.g. 30000"
                                className="h-9 text-sm"
                                disabled={idx === 0}
                            />
                            <div className="relative">
                                <Input
                                    type="number"
                                    value={+(t.rate * 100).toFixed(1)}
                                    onChange={e => {
                                        const tiers = [...distConfig.tiers];
                                        tiers[idx] = { ...tiers[idx], rate: (parseFloat(e.target.value) || 0) / 100 };
                                        setD("tiers", tiers);
                                    }}
                                    placeholder="Rate"
                                    className="h-9 text-sm pr-7"
                                    step={0.5}
                                    disabled={idx === 0}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">%</span>
                            </div>
                        </div>
                    ))}
                    <p className="text-[11px] text-muted-foreground/60 mt-1">
                        Starter tier always earns 0% commission. A distributor upgrades when BOTH new-orders AND renewal thresholds are met mid-year. At year-end, tier resets to the highest qualifying tier based on annual revenue.
                    </p>
                </div>

            </SectionCard>

            {/* ── Wallet & Payout ─────────────────────────────────────────── */}
            <SectionCard
                title="Wallet &amp; Payout Settings"
                description="Distributor wallet rules — minimum balance Rs 2,000, payout threshold Rs 5,000"
                icon={<Wallet className="w-4 h-4" />}
            >
                <ConfigRow label="Minimum Wallet Balance" hint="Distributors must always keep this amount in their wallet (cannot be paid out). Default: Rs 2,000">
                    <NumberField value={walletConfig.distributorMinBalance} onChange={(v: number) => setW("distributorMinBalance", v)} suffix="₹" width="w-36" />
                </ConfigRow>

                <ConfigRow label="Payout Threshold" hint="Available balance above the minimum must reach this amount before a payout can be requested. Default: Rs 5,000">
                    <NumberField value={walletConfig.payoutThreshold} onChange={(v: number) => setW("payoutThreshold", v)} suffix="₹" width="w-36" />
                </ConfigRow>

                <ConfigRow label="Forfeit Wallet on Deactivation" hint="When a distributor is permanently deactivated, their minimum wallet balance (Rs 2,000) is forfeited to WebMyDrive">
                    <Switch checked={walletConfig.deactivationWalletForfeit} onCheckedChange={v => setW("deactivationWalletForfeit", v)} />
                </ConfigRow>

                {/* Payout example */}
                <div className="mt-3 p-3 rounded-lg bg-surface-2/40 border border-border/40">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Example with current settings:</p>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                        <p>• Distributor wallet: <span className="text-foreground font-medium">₹{(walletConfig.distributorMinBalance + walletConfig.payoutThreshold + 3000).toLocaleString("en-IN")}</span></p>
                        <p>• Minimum held: <span className="text-foreground font-medium">₹{walletConfig.distributorMinBalance.toLocaleString("en-IN")}</span></p>
                        <p>• Available for payout: <span className="text-emerald-500 font-medium">₹{(walletConfig.payoutThreshold + 3000).toLocaleString("en-IN")}</span></p>
                        <p>• Payout request: <span className="text-primary font-medium">✓ Allowed (available ≥ ₹{walletConfig.payoutThreshold.toLocaleString("en-IN")} threshold)</span></p>
                    </div>
                </div>
            </SectionCard>
        </motion.div>
    );
}
