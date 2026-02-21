import { useState } from "react";
import { motion } from "framer-motion";
import { Save, Gift, Wallet, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Default config shapes ─────────────────────────────────────────────────────
const DEFAULT_USER_CONFIG = {
    allowNewReferrals: false,
    referrerCreditRate: 0.05,
    referredDiscountRate: 0.05,
    decaySchedule: [1, 0.75, 0.5],
    nudgeThreshold: 10,
    upgradeFeeDiscount: 0.5,
};

const DEFAULT_DIST_CONFIG = {
    allowNewSignups: false,
    annualFee: 0,
    feeRefundTier: "Gold",
    tiersDroppedPerYear: 1,
    tiers: [
        { name: "Starter", threshold: 0, rate: 0.08 },
        { name: "Silver", threshold: 50000, rate: 0.10 },
        { name: "Gold", threshold: 200000, rate: 0.12 },
    ],
    decayMultipliers: [1, 0.9, 0.8],
};

const DEFAULT_WALLET_CONFIG = {
    distributorMinBalance: 0,
    payoutThreshold: 500,
    lapseWalletForfeit: false,
};

// ── Reusable components ───────────────────────────────────────────────────────
function SectionCard({ title, description, icon, children }: any) {
    return (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden mb-6">
            <div className="flex items-start gap-3 p-5 border-b border-border">
                <div className="w-9 h-9 rounded-lg bg-primary/10 border border-blue-100 flex items-center justify-center shrink-0 text-primary">
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

function ConfigField({ label, hint, value, onChange, type = "number", suffix = "" }: any) {
    return (
        <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
            <div className="flex-1 min-w-0 pr-4">
                <p className="text-sm font-medium text-foreground">{label}</p>
                {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
            </div>
            <div className="relative shrink-0 flex items-center gap-2">
                {type === "boolean" ? (
                    <Switch checked={value} onCheckedChange={onChange} />
                ) : (
                    <div className="relative w-32">
                        <Input
                            type={type}
                            value={value ?? ""}
                            onChange={e => onChange(type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)}
                            className={cn("text-right font-semibold text-sm h-9", suffix ? "pr-8" : "px-3")}
                        />
                        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">{suffix}</span>}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ReferralEnginePage() {
    const [userConfig, setUserConfig] = useState<any>(DEFAULT_USER_CONFIG);
    const [distConfig, setDistConfig] = useState<any>(DEFAULT_DIST_CONFIG);
    const [walletConfig, setWalletConfig] = useState<any>(DEFAULT_WALLET_CONFIG);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);

    const saveConfigs = async () => {
        setSaving(true);
        try {
            // When the backend is ready, wire these fetch() calls:
            // await Promise.all([
            //   fetch("/api/admin/config", { method: "POST", ... body: userConfig }),
            //   fetch("/api/admin/config", { method: "POST", ... body: distConfig }),
            //   fetch("/api/admin/config", { method: "POST", ... body: walletConfig }),
            // ]);
            await new Promise(r => setTimeout(r, 600)); // simulate save
            setDirty(false);
            toast.success("Settings saved successfully.");
        } catch {
            toast.error("Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    const updateU = (k: string, v: any) => { setUserConfig((p: any) => ({ ...p, [k]: v })); setDirty(true); };
    const updateD = (k: string, v: any) => { setDistConfig((p: any) => ({ ...p, [k]: v })); setDirty(true); };
    const updateW = (k: string, v: any) => { setWalletConfig((p: any) => ({ ...p, [k]: v })); setDirty(true); };

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="p-6 space-y-6 max-w-[1000px] mx-auto pb-20"
        >
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Commission & Referral System</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">Manage user referrals and the distributor partner program</p>
                </div>
                <Button
                    onClick={saveConfigs}
                    disabled={!dirty || saving}
                    className={cn("gap-2", dirty ? "bg-primary" : "bg-muted")}
                >
                    <Save className="w-4 h-4" />
                    {saving ? "Saving…" : "Save Changes"}
                </Button>
            </div>

            {/* User Referral Section */}
            <SectionCard title="User Referral Program" description="Settings for direct customer referrals" icon={<Gift className="w-4 h-4" />}>
                <ConfigField label="Program Enabled" hint="Allow new referrals" type="boolean"
                    value={userConfig.allowNewReferrals}
                    onChange={(v: boolean) => updateU("allowNewReferrals", v)} />
                <ConfigField label="Credit Rate" hint="Reward % for referrer"
                    value={+(userConfig.referrerCreditRate * 100).toFixed(2)}
                    onChange={(v: number) => updateU("referrerCreditRate", v / 100)} suffix="%" />
                <ConfigField label="Discount Rate" hint="Discount % for referred user"
                    value={+(userConfig.referredDiscountRate * 100).toFixed(2)}
                    onChange={(v: number) => updateU("referredDiscountRate", v / 100)} suffix="%" />
                <ConfigField label="Decay Schedule" hint="Comma-separated % values for year 1, 2, 3…" type="text"
                    value={userConfig.decaySchedule.map((x: number) => +(x * 100).toFixed(0)).join(", ")}
                    onChange={(v: string) => updateU("decaySchedule", v.split(",").map((s: string) => parseFloat(s.trim()) / 100 || 0))} />
                <ConfigField label="Distributor Nudge Threshold" hint="Show upgrade notice after X referrals"
                    value={userConfig.nudgeThreshold}
                    onChange={(v: number) => updateU("nudgeThreshold", v)} />
                <ConfigField label="Upgrade Discount"
                    value={+(userConfig.upgradeFeeDiscount * 100).toFixed(2)}
                    onChange={(v: number) => updateU("upgradeFeeDiscount", v / 100)} suffix="%" />
            </SectionCard>

            {/* Distributor Section */}
            <SectionCard title="Distributor Program" description="Settings for the tiered partner program" icon={<Users className="w-4 h-4" />}>
                <ConfigField label="Program Enabled" type="boolean"
                    value={distConfig.allowNewSignups}
                    onChange={(v: boolean) => updateD("allowNewSignups", v)} />
                <ConfigField label="Annual Fee"
                    value={distConfig.annualFee}
                    onChange={(v: number) => updateD("annualFee", v)} suffix="₹" />
                <ConfigField label="Fee Refund Tier" type="text"
                    value={distConfig.feeRefundTier}
                    onChange={(v: string) => updateD("feeRefundTier", v)} />
                <ConfigField label="Tier Drops per Year (Soft Reset)"
                    value={distConfig.tiersDroppedPerYear}
                    onChange={(v: number) => updateD("tiersDroppedPerYear", v)} />

                <div className="py-4 border-b border-border">
                    <p className="text-sm font-medium mb-3">Tier Configuration</p>
                    <div className="grid grid-cols-3 gap-2 mb-2 text-xs text-muted-foreground font-medium px-1">
                        <span>Name</span><span>Revenue Threshold (₹)</span><span>Commission %</span>
                    </div>
                    {distConfig.tiers.map((t: any, idx: number) => (
                        <div key={idx} className="grid grid-cols-3 gap-2 mb-2">
                            <Input value={t.name} onChange={e => {
                                const tiers = [...distConfig.tiers];
                                tiers[idx] = { ...tiers[idx], name: e.target.value };
                                updateD("tiers", tiers);
                            }} placeholder="Tier name" />
                            <Input type="number" value={t.threshold} onChange={e => {
                                const tiers = [...distConfig.tiers];
                                tiers[idx] = { ...tiers[idx], threshold: parseFloat(e.target.value) || 0 };
                                updateD("tiers", tiers);
                            }} placeholder="Threshold" />
                            <Input type="number" value={+(t.rate * 100).toFixed(1)} onChange={e => {
                                const tiers = [...distConfig.tiers];
                                tiers[idx] = { ...tiers[idx], rate: (parseFloat(e.target.value) || 0) / 100 };
                                updateD("tiers", tiers);
                            }} placeholder="Rate %" />
                        </div>
                    ))}
                </div>

                <ConfigField label="Renewal Decay Multipliers" hint="Multipliers for years 1, 2, 3…" type="text"
                    value={distConfig.decayMultipliers.map((x: number) => +(x * 100).toFixed(0)).join(", ")}
                    onChange={(v: string) => updateD("decayMultipliers", v.split(",").map((s: string) => parseFloat(s.trim()) / 100 || 0))} />
            </SectionCard>

            {/* Wallet Section */}
            <SectionCard title="Wallet & Payout Settings" description="Rules for cash payouts and balances" icon={<Wallet className="w-4 h-4" />}>
                <ConfigField label="Minimum Balance" hint="Distributor must keep this amount in wallet"
                    value={walletConfig.distributorMinBalance}
                    onChange={(v: number) => updateW("distributorMinBalance", v)} suffix="₹" />
                <ConfigField label="Payout Threshold" hint="Available amount above min balance to trigger payout"
                    value={walletConfig.payoutThreshold}
                    onChange={(v: number) => updateW("payoutThreshold", v)} suffix="₹" />
                <ConfigField label="Lapse Wallet Forfeit" hint="Forfeit wallet balance if distributor does not renew on time"
                    type="boolean"
                    value={walletConfig.lapseWalletForfeit}
                    onChange={(v: boolean) => updateW("lapseWalletForfeit", v)} />
            </SectionCard>
        </motion.div>
    );
}
