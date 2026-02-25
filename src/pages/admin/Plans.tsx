import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Plus, Trash2, Package, X, Save,
    Globe, IndianRupee, Loader2, Download, CheckSquare, Square
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
    AlertDialog, AlertDialogContent, AlertDialogHeader,
    AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
    AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/api";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
interface GlobalFeature {
    label: string;
    enabled: boolean;
}

interface Plan {
    id: string | number;
    name: string;
    price: number;
    features: string | null;
    isActive?: boolean;
    hasOverride?: boolean;
    sortOrder?: number;
    priceINR?: number;
    priceMonthlyINR?: number;
    priceYearlyINR?: number;
    storageGB?: number;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────
const DEFAULT_GLOBAL_FEATURES: GlobalFeature[] = [
    { label: "Google Drive", enabled: true },
    { label: "Google Photos", enabled: true },
    { label: "Google Mails Login", enabled: true },
    { label: "Self Help Portal Access", enabled: true },
    { label: "Remote Support", enabled: true },
];

// Exact prices from the website (images supplied 2026-02-24)
const WEBSITE_DEFAULTS: Omit<Plan, "id" | "sortOrder">[] = [
    { name: "Cloud Storage - Basic", price: 237.5, priceINR: 237.5, priceMonthlyINR: 237.5, storageGB: 500, isActive: true, hasOverride: true, features: null },
    { name: "Cloud Storage - Professional", price: 399, priceINR: 399, priceMonthlyINR: 399, storageGB: 5120, isActive: true, hasOverride: true, features: null },
    { name: "Cloud Storage - Premium", price: 712.5, priceINR: 712.5, priceMonthlyINR: 712.5, storageGB: 51200, isActive: true, hasOverride: true, features: null },
    { name: "Cloud Storage - Enterprise", price: 1187.5, priceINR: 1187.5, priceMonthlyINR: 1187.5, storageGB: 102400, isActive: true, hasOverride: true, features: null },
];

// ─── Global Features Card ──────────────────────────────────────────────────────
function GlobalFeaturesCard({
    features,
    onChange,
    onSave,
    saving,
}: {
    features: GlobalFeature[];
    onChange: (f: GlobalFeature[]) => void;
    onSave: () => void;
    saving: boolean;
}) {
    const toggle = (i: number) => {
        const next = features.map((f, idx) => idx === i ? { ...f, enabled: !f.enabled } : f);
        onChange(next);
    };
    const updateLabel = (i: number, label: string) => {
        onChange(features.map((f, idx) => idx === i ? { ...f, label } : f));
    };
    const addFeature = () => onChange([...features, { label: "", enabled: true }]);
    const removeFeature = (i: number) => onChange(features.filter((_, idx) => idx !== i));

    return (
        <div className="bg-surface-1 border border-border rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <Globe className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-foreground">Global Plan Features</h2>
                        <p className="text-xs text-muted-foreground">These features apply to all plans. Toggle to include or exclude.</p>
                    </div>
                </div>
                <Button
                    size="sm"
                    onClick={onSave}
                    disabled={saving}
                    className="bg-primary hover:bg-primary/90 h-8 text-xs gap-1.5"
                >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save Features
                </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {features.map((f, i) => (
                    <div
                        key={i}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all ${f.enabled
                            ? "bg-emerald-500/5 border-emerald-500/20"
                            : "bg-surface-2/40 border-border/40"
                            }`}
                    >
                        <button
                            type="button"
                            onClick={() => toggle(i)}
                            className="shrink-0 transition-colors"
                            title={f.enabled ? "Click to disable" : "Click to enable"}
                        >
                            {f.enabled
                                ? <CheckSquare className="w-4 h-4 text-emerald-500" />
                                : <Square className="w-4 h-4 text-muted-foreground/50" />
                            }
                        </button>
                        <input
                            value={f.label}
                            onChange={e => updateLabel(i, e.target.value)}
                            className="flex-1 bg-transparent text-xs font-medium text-foreground outline-none min-w-0 placeholder:text-muted-foreground/40"
                            placeholder="Feature name"
                        />
                        <button
                            type="button"
                            onClick={() => removeFeature(i)}
                            className="shrink-0 p-0.5 text-muted-foreground/30 hover:text-red-400 transition-colors"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                ))}

                {/* Add feature button */}
                <button
                    type="button"
                    onClick={addFeature}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-border/50 text-muted-foreground hover:border-primary/40 hover:text-primary transition-all text-xs font-medium"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Add Feature
                </button>
            </div>

            {/* Legend */}
            <p className="text-[11px] text-muted-foreground/60 mt-3">
                ✓ Checked features are shown on all plan cards. Uncheck to hide a feature globally.
            </p>
        </div>
    );
}

// ─── Inline Plan Card (simplified — no feature rows) ───────────────────────────
function InlinePlanCard({
    plan, onSaved, onDelete,
}: {
    plan: Plan;
    onSaved: (updated: Plan) => void;
    onDelete: (p: Plan) => void;
}) {
    const [name, setName] = useState(plan.name);
    const [yearlyPrice, setYearlyPrice] = useState(plan.priceINR ?? plan.price ?? 0);
    const [monthlyPrice, setMonthlyPrice] = useState(plan.priceMonthlyINR ?? 0);
    const [storageGB, setStorageGB] = useState(plan.storageGB ?? 0);
    const [isActive, setIsActive] = useState(plan.isActive ?? true);
    const [hasOverride, setHasOverride] = useState(plan.hasOverride ?? true);
    const [saving, setSaving] = useState(false);
    const [features, setFeatures] = useState<{ label: string, value: string }[]>([]);
    const originalFeaturesRef = useRef<string>("[]");

    useEffect(() => {
        setName(plan.name);
        setYearlyPrice(plan.priceINR ?? plan.price ?? 0);
        setMonthlyPrice(plan.priceMonthlyINR ?? 0);
        setStorageGB(plan.storageGB ?? 0);
        setIsActive(plan.isActive ?? true);
        setHasOverride(plan.hasOverride ?? true);

        let parsedFeatures: { label: string, value: string }[] = [];
        if (plan.features) {
            try {
                const parsed = JSON.parse(plan.features);
                if (Array.isArray(parsed)) {
                    parsedFeatures = parsed.map((item: any) => {
                        if (typeof item === 'string') return { label: item, value: 'Included' };
                        return { label: item.label || '', value: item.value || '' };
                    });
                }
            } catch {
                parsedFeatures = plan.features.split(",").map((s: string) => ({ label: s.trim(), value: "Included" })).filter((x: any) => x.label);
            }
        }
        setFeatures(parsedFeatures);
        originalFeaturesRef.current = JSON.stringify(parsedFeatures);
    }, [plan.id, plan.name, plan.priceMonthlyINR, plan.storageGB, plan.isActive, plan.hasOverride, plan.features]);

    const isDirty =
        name !== plan.name ||
        yearlyPrice !== (plan.priceINR ?? plan.price ?? 0) ||
        monthlyPrice !== (plan.priceMonthlyINR ?? 0) ||
        storageGB !== (plan.storageGB ?? 0) ||
        isActive !== (plan.isActive ?? true) ||
        hasOverride !== (plan.hasOverride ?? true) ||
        JSON.stringify(features) !== originalFeaturesRef.current;

    const handleSave = async () => {
        if (!name.trim()) { toast.error("Plan name is required"); return; }
        if (yearlyPrice <= 0) { toast.error("Yearly price must be > 0"); return; }
        if (monthlyPrice <= 0) { toast.error("Monthly price must be > 0"); return; }
        setSaving(true);
        try {
            const payload = {
                id: plan.id,
                name: name.trim(),
                price: yearlyPrice,
                priceINR: yearlyPrice,
                priceMonthlyINR: monthlyPrice,
                storageGB,
                features: features.length > 0 ? JSON.stringify(features) : null,
                isActive,
                hasOverride,
            };
            const updated = await api.post("/admin/plans", payload);
            onSaved({ ...plan, ...updated });
            toast.success(`"${name.trim()}" saved`);
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className={`rounded-xl border p-5 flex flex-col gap-4 transition-all ${plan.isActive
                ? "bg-surface-1 border-border shadow-card"
                : "bg-surface-2/30 border-border/40 opacity-60"
                } ${isDirty ? "border-primary/40 ring-1 ring-primary/20" : ""}`}
        >
            {/* Top: icon + name + delete */}
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4 text-primary" />
                </div>
                <Input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Plan name"
                    className="flex-1 bg-surface-2 border-border/60 text-sm font-semibold h-9"
                />
                <Button
                    size="sm" variant="ghost"
                    className="h-8 w-8 p-0 text-red-400 hover:bg-red-500/10 hover:text-red-500 shrink-0"
                    onClick={() => onDelete(plan)}
                    title="Delete plan"
                >
                    <Trash2 className="w-4 h-4" />
                </Button>
            </div>

            {/* Prices + Storage */}
            <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Monthly (₹/mo)</label>
                    <div className="relative">
                        <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                            type="number"
                            value={monthlyPrice}
                            onChange={e => setMonthlyPrice(Number(e.target.value))}
                            className="pl-7 bg-surface-2 border-border/60 text-sm h-9"
                            placeholder="Billed monthly"
                        />
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Yearly (₹/mo)</label>
                    <div className="relative">
                        <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                            type="number"
                            value={yearlyPrice}
                            onChange={e => setYearlyPrice(Number(e.target.value))}
                            className="pl-7 bg-surface-2 border-border/60 text-sm h-9"
                            placeholder="Per month, billed annually"
                        />
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Storage (GB)</label>
                    <Input
                        type="number"
                        value={storageGB}
                        onChange={e => setStorageGB(Number(e.target.value))}
                        className="bg-surface-2 border-border/60 text-sm h-9"
                        placeholder="e.g. 500, 5120"
                    />
                </div>
            </div>

            {/* Features Editor */}
            <div className="space-y-2 pt-2 border-t border-border/30">
                <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Custom Features</label>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setFeatures([...features, { label: "", value: "Included" }])}
                        className="h-6 px-2 text-xs text-primary hover:bg-primary/10"
                    >
                        <Plus className="w-3 h-3 mr-1" /> Add Feature
                    </Button>
                </div>
                {features.length > 0 ? (
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {features.map((f, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <Input
                                    value={f.label}
                                    onChange={e => setFeatures(features.map((item, idx) => idx === i ? { ...item, label: e.target.value } : item))}
                                    placeholder="Feature name"
                                    className="bg-surface-2 border-border/60 text-xs h-8 flex-1"
                                />
                                <Input
                                    value={f.value}
                                    onChange={e => setFeatures(features.map((item, idx) => idx === i ? { ...item, value: e.target.value } : item))}
                                    placeholder="Value"
                                    className="bg-surface-2 border-border/60 text-xs h-8 w-24 shrink-0"
                                />
                                <button
                                    type="button"
                                    onClick={() => setFeatures(features.filter((_, idx) => idx !== i))}
                                    className="p-1.5 text-muted-foreground hover:text-red-400"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-[11px] text-muted-foreground/50 italic">No custom features.</p>
                )}
            </div>

            {/* Toggles */}
            <div className="flex items-center gap-5 pt-1 border-t border-border/30">
                <div className="flex items-center gap-2 flex-1">
                    <Switch
                        checked={isActive}
                        onCheckedChange={setIsActive}
                        className="data-[state=checked]:bg-emerald-500 shrink-0"
                    />
                    <span className="text-xs text-muted-foreground">
                        {isActive ? <span className="text-emerald-500 font-medium">Visible</span> : "Hidden"}
                    </span>
                </div>
                <div className="flex items-center gap-2 flex-1">
                    <Switch
                        checked={hasOverride}
                        onCheckedChange={setHasOverride}
                        className="data-[state=checked]:bg-primary shrink-0"
                    />
                    <span className="text-xs text-muted-foreground">
                        {hasOverride ? <span className="text-primary font-medium">Price override</span> : "Global price"}
                    </span>
                </div>
            </div>

            {/* Footer: dirty indicator + save */}
            <div className="flex items-center justify-between">
                {isDirty
                    ? <span className="text-[11px] text-amber-500 font-medium">Unsaved changes</span>
                    : <span className="text-[11px] text-muted-foreground/40">No changes</span>
                }
                <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={saving || !isDirty}
                    className="h-8 bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 text-xs"
                >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save
                </Button>
            </div>
        </motion.div >
    );
}

// ─── New Plan Card ─────────────────────────────────────────────────────────────
function NewPlanCard({ onCreate, onCancel }: { onCreate: (data: any) => Promise<void>; onCancel: () => void }) {
    const [name, setName] = useState("");
    const [monthlyPrice, setMonthlyPrice] = useState(0);
    const [yearlyPrice, setYearlyPrice] = useState(0);
    const [storageGB, setStorageGB] = useState(0);
    const [isActive, setIsActive] = useState(true);
    const [hasOverride, setHasOverride] = useState(true);
    const [saving, setSaving] = useState(false);
    const [features, setFeatures] = useState<{ label: string, value: string }[]>([]);

    const handleCreate = async () => {
        if (!name.trim()) { toast.error("Plan name is required"); return; }
        if (yearlyPrice <= 0) { toast.error("Yearly price must be > 0"); return; }
        if (monthlyPrice <= 0) { toast.error("Monthly price must be > 0"); return; }
        setSaving(true);
        try {
            await onCreate({ name: name.trim(), price: yearlyPrice, priceINR: yearlyPrice, priceMonthlyINR: monthlyPrice, storageGB, isActive, hasOverride, features: features.length > 0 ? JSON.stringify(features) : null });
        } finally {
            setSaving(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="rounded-xl border-2 border-dashed border-primary/40 p-5 flex flex-col gap-4 bg-primary/5"
        >
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                    <Plus className="w-4 h-4 text-primary" />
                </div>
                <Input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="New plan name (e.g. Cloud Storage - Basic)"
                    className="flex-1 bg-surface-1 border-border/60 text-sm font-semibold h-9"
                    autoFocus
                />
                <button onClick={onCancel} className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-surface-2 shrink-0">
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Monthly (₹/mo)</label>
                    <div className="relative">
                        <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                            type="number"
                            value={monthlyPrice || ""}
                            onChange={e => setMonthlyPrice(Number(e.target.value))}
                            className="pl-7 bg-surface-1 border-border/60 text-sm h-9"
                            placeholder="Billed monthly"
                        />
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Yearly (₹/mo)</label>
                    <div className="relative">
                        <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                            type="number"
                            value={yearlyPrice || ""}
                            onChange={e => setYearlyPrice(Number(e.target.value))}
                            className="pl-7 bg-surface-1 border-border/60 text-sm h-9"
                            placeholder="Per month, billed annually"
                        />
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Storage (GB)</label>
                    <Input
                        type="number"
                        value={storageGB || ""}
                        onChange={e => setStorageGB(Number(e.target.value))}
                        className="bg-surface-1 border-border/60 text-sm h-9"
                        placeholder="e.g. 500, 5120"
                    />
                </div>
            </div>

            {/* Features Editor */}
            <div className="space-y-2 pt-2 border-t border-border/30">
                <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Custom Features</label>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setFeatures([...features, { label: "", value: "Included" }])}
                        className="h-6 px-2 text-xs text-primary hover:bg-primary/10"
                    >
                        <Plus className="w-3 h-3 mr-1" /> Add Feature
                    </Button>
                </div>
                {features.length > 0 ? (
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {features.map((f, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <Input
                                    value={f.label}
                                    onChange={e => setFeatures(features.map((item, idx) => idx === i ? { ...item, label: e.target.value } : item))}
                                    placeholder="Feature name"
                                    className="bg-surface-1 border-border/60 text-xs h-8 flex-1"
                                />
                                <Input
                                    value={f.value}
                                    onChange={e => setFeatures(features.map((item, idx) => idx === i ? { ...item, value: e.target.value } : item))}
                                    placeholder="Value"
                                    className="bg-surface-1 border-border/60 text-xs h-8 w-24 shrink-0"
                                />
                                <button
                                    type="button"
                                    onClick={() => setFeatures(features.filter((_, idx) => idx !== i))}
                                    className="p-1.5 text-muted-foreground hover:text-red-400"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-[11px] text-muted-foreground/50 italic">No custom features.</p>
                )}
            </div>

            <div className="flex items-center gap-5 pt-1 border-t border-border/30">
                <div className="flex items-center gap-2 flex-1">
                    <Switch checked={isActive} onCheckedChange={setIsActive} className="data-[state=checked]:bg-emerald-500 shrink-0" />
                    <span className="text-xs text-muted-foreground">{isActive ? <span className="text-emerald-500 font-medium">Visible</span> : "Hidden"}</span>
                </div>
                <div className="flex items-center gap-2 flex-1">
                    <Switch checked={hasOverride} onCheckedChange={setHasOverride} className="data-[state=checked]:bg-primary shrink-0" />
                    <span className="text-xs text-muted-foreground">{hasOverride ? <span className="text-primary font-medium">Price override</span> : "Global price"}</span>
                </div>
            </div>

            <div className="flex items-center justify-end gap-2">
                <Button variant="outline" size="sm" onClick={onCancel} className="h-8 border-border/50 text-xs">Cancel</Button>
                <Button size="sm" onClick={handleCreate} disabled={saving} className="h-8 bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 text-xs">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Create Plan
                </Button>
            </div>
        </motion.div>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function Plans() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [globalFeatures, setGlobalFeatures] = useState<GlobalFeature[]>(DEFAULT_GLOBAL_FEATURES);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Plan | null>(null);
    const [savingFeatures, setSavingFeatures] = useState(false);
    const [seedingDefaults, setSeedingDefaults] = useState(false);

    useEffect(() => {
        Promise.all([
            api.get("/admin/plans"),
            api.get("/admin/config?type=GLOBAL_PLAN_SETTINGS"),
        ])
            .then(([plansData, configData]) => {
                const arr = Array.isArray(plansData) ? plansData : (plansData.plans || []);
                setPlans(arr);
                if (configData?.globalFeatures && Array.isArray(configData.globalFeatures)) {
                    setGlobalFeatures(configData.globalFeatures);
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const saveGlobalFeatures = async () => {
        setSavingFeatures(true);
        try {
            const current = await api.get("/admin/config?type=GLOBAL_PLAN_SETTINGS");
            const merged = { ...(current || {}), globalFeatures };
            await api.post("/admin/config", { type: "GLOBAL_PLAN_SETTINGS", data: merged });
            toast.success("Global features saved — all plans updated");
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setSavingFeatures(false);
        }
    };

    const handleSeedDefaults = async () => {
        setSeedingDefaults(true);
        try {
            for (const plan of WEBSITE_DEFAULTS) {
                const existing = plans.find(p => p.name === plan.name);
                if (existing) {
                    const updated = await api.post("/admin/plans", { id: existing.id, ...plan });
                    setPlans(p => p.map(pl => String(pl.id) === String(existing.id) ? { ...pl, ...updated } : pl));
                } else {
                    const newPlan = await api.post("/admin/plans", plan);
                    setPlans(p => [...p, newPlan]);
                }
            }
            toast.success("Website plans loaded!");
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setSeedingDefaults(false);
        }
    };

    const handleCreate = async (data: any) => {
        const newPlan = await api.post("/admin/plans", data);
        setPlans(p => [...p, newPlan]);
        setCreating(false);
        toast.success(`Plan "${data.name}" created`);
    };

    const handleSaved = (updated: Plan) => {
        setPlans(p => p.map(pl => String(pl.id) === String(updated.id) ? { ...pl, ...updated } : pl));
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await api.delete(`/admin/plans/${deleteTarget.id}`);
            setPlans(p => p.filter(pl => String(pl.id) !== String(deleteTarget.id)));
            toast.success(`"${deleteTarget.name}" deleted`);
        } catch (e: any) {
            toast.error(e.message || "Failed to delete plan");
        } finally {
            setDeleteTarget(null);
        }
    };

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center py-24">
                <Loader2 className="w-9 h-9 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Plans</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        {plans.length} plan{plans.length !== 1 ? "s" : ""} · Global features apply to all plans
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline" size="sm"
                        onClick={handleSeedDefaults}
                        disabled={seedingDefaults}
                        className="border-border/60 gap-1.5 text-xs"
                    >
                        {seedingDefaults ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        Load Website Plans
                    </Button>
                    <Button
                        onClick={() => setCreating(true)}
                        disabled={creating}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                    >
                        <Plus className="w-4 h-4" /> New Plan
                    </Button>
                </div>
            </div>

            {/* Global Features Section */}
            <GlobalFeaturesCard
                features={globalFeatures}
                onChange={setGlobalFeatures}
                onSave={saveGlobalFeatures}
                saving={savingFeatures}
            />

            {/* New plan card (when creating) */}
            <AnimatePresence>
                {creating && (
                    <NewPlanCard key="new-plan" onCreate={handleCreate} onCancel={() => setCreating(false)} />
                )}
            </AnimatePresence>

            {/* Plan cards grid */}
            {plans.length === 0 && !creating ? (
                <div className="flex flex-col items-center gap-4 py-24 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center">
                        <Package className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">No plans yet</p>
                        <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">Click <strong>+ New Plan</strong> or load from the website.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => setCreating(true)} variant="outline" size="sm" className="border-primary/30 text-primary gap-2">
                            <Plus className="w-3.5 h-3.5" /> New Plan
                        </Button>
                        <Button onClick={handleSeedDefaults} disabled={seedingDefaults} size="sm" variant="outline" className="gap-2">
                            <Download className="w-3.5 h-3.5" /> Load Website Plans
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-5">
                    <AnimatePresence>
                        {plans.map(plan => (
                            <InlinePlanCard
                                key={plan.id}
                                plan={plan}
                                onSaved={handleSaved}
                                onDelete={setDeleteTarget}
                            />
                        ))}
                    </AnimatePresence>
                </div>
            )}

            {/* Delete confirm */}
            <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
                <AlertDialogContent className="bg-surface-1 border-border">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Plan</AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground">
                            Delete "{deleteTarget?.name}"? Existing subscriptions will be unaffected, but it will no longer be available for new purchases.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-surface-2 border-border">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90">
                            Yes, Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
