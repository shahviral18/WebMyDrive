import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
    Package, CheckCircle2, X, Save, GripVertical, Tag,
    Users, HardDrive, IndianRupee, Loader2
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

interface Plan {
    id: string | number;
    name: string;
    price: number;
    features: string | null;
    isActive?: boolean;
    sortOrder?: number;
    priceINR?: number;
    storageGB?: number;
    maxUsers?: number;
    googleSKU?: string;
}

const EMPTY_PLAN = {
    name: "", price: 0, features: "",
};

function PlanCard({
    plan, onEdit, onDelete, onToggle,
}: {
    plan: Plan;
    onEdit: (p: Plan) => void;
    onDelete: (p: Plan) => void;
    onToggle: (p: Plan) => void;
}) {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className={`rounded-xl border p-5 transition-all ${plan.isActive
                ? "bg-surface-1 border-border hover:border-primary/30 shadow-card hover:shadow-card-hover"
                : "bg-surface-2/30 border-border/40 opacity-60"
                }`}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <Package className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-semibold text-foreground truncate">{plan.name}</h3>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">{plan.googleSKU || "No SKU set"}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Switch
                        checked={plan.isActive}
                        onCheckedChange={() => onToggle(plan)}
                        className="data-[state=checked]:bg-primary"
                    />
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0 border-border/50" onClick={() => onEdit(plan)}>
                        <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0 border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={() => onDelete(plan)}>
                        <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
                {/* Price */}
                <div className="p-2.5 rounded-lg bg-surface-2/60 border border-border/50">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        <IndianRupee className="w-3 h-3" /> Price / mo
                    </div>
                    <p className="text-sm font-bold text-foreground">₹{(plan.priceINR ?? plan.price ?? 0).toLocaleString("en-IN")}</p>
                </div>
                {/* Users */}
                <div className="p-2.5 rounded-lg bg-surface-2/60 border border-border/50">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        <Users className="w-3 h-3" /> Max Users
                    </div>
                    <p className="text-sm font-bold text-foreground">{plan.maxUsers === 0 ? "Unlimited" : plan.maxUsers}</p>
                </div>
                {/* Storage */}
                <div className="p-2.5 rounded-lg bg-surface-2/60 border border-border/50">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        <HardDrive className="w-3 h-3" /> Storage
                    </div>
                    <p className="text-sm font-bold text-foreground">{plan.storageGB === 0 ? "—" : `${plan.storageGB} GB`}</p>
                </div>
            </div>

            {(() => {
                const featureList = plan.features
                    ? (Array.isArray(plan.features) ? plan.features : JSON.parse(plan.features || '[]'))
                    : [];
                return featureList.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                        {featureList.map((f: string) => (
                            <span key={f} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/5 border border-primary/15 text-primary">
                                <CheckCircle2 className="w-3 h-3" /> {f}
                            </span>
                        ))}
                    </div>
                );
            })()}

            {!plan.isActive && (
                <p className="mt-3 text-xs text-muted-foreground italic">Hidden from customer portal</p>
            )}
        </motion.div>
    );
}

function PlanForm({
    initial, onSave, onCancel,
}: {
    initial: Partial<Plan>;
    onSave: (p: Omit<Plan, "id" | "sortOrder">) => void;
    onCancel: () => void;
}) {
    const [form, setForm] = useState({
        name: initial.name ?? "",
        price: initial.price ?? initial.priceINR ?? 0,
        featuresRaw: (() => {
            const f = initial.features;
            if (!f) return "";
            if (Array.isArray(f)) return f.join(", ");
            if (typeof f === "string") {
                try { return JSON.parse(f).join(", "); } catch { return f; }
            }
            return "";
        })(),
        isActive: initial.isActive ?? true,
    });

    const handleSave = () => {
        if (!form.name.trim()) { toast.error("Plan name is required"); return; }
        if (form.price <= 0) { toast.error("Price must be > 0"); return; }
        onSave({
            name: form.name.trim(),
            price: form.price,
            features: form.featuresRaw,
            isActive: form.isActive,
        } as any);
    };

    const field = (label: string, key: keyof typeof form, type = "text", hint?: string) => (
        <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
            <Input
                type={type}
                value={String(form[key])}
                onChange={e => setForm(f => ({ ...f, [key]: type === "number" ? Number(e.target.value) : e.target.value }))}
                className="bg-surface-2 border-border/60 text-sm h-9"
                placeholder={hint}
            />
        </div>
    );

    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-surface-1 border border-primary/30 p-6 space-y-4 shadow-card">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">{initial.id ? "Edit Plan" : "New Plan"}</h3>
                <button onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors">
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {field("Plan Name *", "name", "text", "e.g. Business Starter")}
                {field("Price (₹/month) *", "price", "number")}
                <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Features (comma-separated)</label>
                    <Input
                        value={form.featuresRaw}
                        onChange={e => setForm(f => ({ ...f, featuresRaw: e.target.value }))}
                        className="bg-surface-2 border-border/60 text-sm h-9"
                        placeholder="e.g. Custom domain, Video meetings, 24/7 support"
                    />
                </div>
            </div>

            <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-3">
                    <Switch checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))}
                        className="data-[state=checked]:bg-primary" />
                    <span className="text-sm text-muted-foreground">
                        {form.isActive ? "Visible on portal" : "Hidden from portal"}
                    </span>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={onCancel} className="h-8 border-border/50">Cancel</Button>
                    <Button size="sm" onClick={handleSave} className="h-8 bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5">
                        <Save className="w-3.5 h-3.5" /> Save Plan
                    </Button>
                </div>
            </div>
        </motion.div>
    );
}

export default function Plans() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<Plan | null>(null);
    const [creating, setCreating] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Plan | null>(null);

    useEffect(() => {
        api.get("/admin/plans")
            .then(data => {
                // backend returns array directly OR { plans: [] }
                const arr = Array.isArray(data) ? data : (data.plans || []);
                setPlans(arr);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const handleCreate = async (data: any) => {
        try {
            const newPlan = await api.post("/admin/plans", { name: data.name, price: data.price || data.priceINR, features: data.features });
            setPlans(p => [...p, newPlan]);
            setCreating(false);
            toast.success(`Plan "${data.name}" created`);
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    const handleEdit = async (data: any) => {
        if (!editing) return;
        try {
            const updated = await api.post("/admin/plans", { id: editing.id, name: data.name, price: data.price || data.priceINR, features: data.features });
            setPlans(p => p.map(pl => String(pl.id) === String(editing.id) ? { ...pl, ...updated } : pl));
            setEditing(null);
            toast.success(`Plan "${data.name}" updated`);
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await api.delete(`/admin/plans/${deleteTarget.id}`);
            setPlans(p => p.filter(pl => String(pl.id) !== String(deleteTarget.id)));
            toast.success(`Plan "${deleteTarget.name}" deleted`);
        } catch (e: any) {
            toast.error(e.message || "Failed to delete plan");
        } finally {
            setDeleteTarget(null);
        }
    };

    const handleToggle = async (plan: Plan) => {
        try {
            const updated = await api.patch(`/admin/plans/${plan.id}/toggle`, {});
            setPlans(p => p.map(pl => String(pl.id) === String(plan.id) ? { ...pl, ...updated } : pl));
            toast.success(`"${plan.name}" ${plan.isActive ? "hidden from" : "shown on"} portal`);
        } catch (e: any) {
            toast.error(e.message || "Failed to update plan");
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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Plans</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        {plans.length} plan{plans.length !== 1 ? "s" : ""} · Manage pricing, features and Google Workspace SKUs
                    </p>
                </div>
                {!creating && !editing && (
                    <Button onClick={() => setCreating(true)} className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
                        <Plus className="w-4 h-4" /> New Plan
                    </Button>
                )}
            </div>

            {/* Brief context */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/15">
                <Tag className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                    Plans are admin-managed and appear on the customer purchase page. Price range per brief: <strong className="text-foreground">₹3,000 – ₹15,000</strong>.
                    Each plan links to a Google Workspace SKU for automated provisioning via the Admin SDK.
                </p>
            </div>

            {/* Create form */}
            <AnimatePresence>
                {creating && (
                    <PlanForm initial={EMPTY_PLAN} onSave={handleCreate} onCancel={() => setCreating(false)} />
                )}
            </AnimatePresence>

            {/* Plan grid */}
            {plans.length === 0 && !creating ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex flex-col items-center gap-4 py-24 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center">
                        <Package className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">No plans yet</p>
                        <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">
                            Create your first plan to make it available for customers to purchase on the portal.
                        </p>
                    </div>
                    <Button onClick={() => setCreating(true)} variant="outline" size="sm" className="border-primary/30 text-primary gap-2">
                        <Plus className="w-3.5 h-3.5" /> Create First Plan
                    </Button>
                </motion.div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <AnimatePresence>
                        {plans.map(plan => (
                            editing?.id === plan.id ? (
                                <motion.div key={`edit-${plan.id}`} className="md:col-span-2 xl:col-span-3">
                                    <PlanForm initial={editing} onSave={handleEdit} onCancel={() => setEditing(null)} />
                                </motion.div>
                            ) : (
                                <PlanCard key={plan.id} plan={plan} onEdit={setEditing} onDelete={setDeleteTarget} onToggle={handleToggle} />
                            )
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
                            Delete "{deleteTarget?.name}"? Existing subscriptions on this plan will be unaffected, but it will no longer be available for new purchases.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-surface-2 border-border">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-danger text-white hover:bg-danger-dim">
                            Yes, Delete Plan
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
