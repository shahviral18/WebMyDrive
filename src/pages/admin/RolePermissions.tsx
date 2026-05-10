import { useEffect, useState } from "react";
import { Lock, Save, Loader2, ShieldCheck, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { usePermissions, PermLevel, ModuleKey } from "@/contexts/PermissionsContext";
import { cn } from "@/lib/utils";

const MODULES: { key: ModuleKey; label: string; description: string }[] = [
  { key: "dashboard",               label: "Dashboard",                description: "Overview stats and KPIs" },
  { key: "users",                   label: "Accounts (Portal Users)",  description: "View, create, edit, delete user accounts" },
  { key: "googleUsers",             label: "Google Workspace Users",   description: "View, suspend, delete Google org users" },
  { key: "plans",                   label: "Plans",                    description: "Manage subscription plans" },
  { key: "orders",                  label: "Orders",                   description: "View billing and order history" },
  { key: "referralEngine",          label: "Referral Engine",          description: "Configure referral rewards and rules" },
  { key: "vouchers",                label: "Vouchers",                 description: "Create and manage discount vouchers" },
  { key: "distributors",            label: "Distributors",             description: "View and manage distributor partners" },
  { key: "distributorApplications", label: "Distributor Applications", description: "Review and approve distributor sign-ups" },
  { key: "distributorPayouts",      label: "Distributor Payouts",      description: "Manage payout requests and approvals" },
  { key: "importUsers",             label: "Import Users",             description: "Bulk import user accounts" },
  { key: "assignDistributor",       label: "Assign Distributor",       description: "Link users to distributor partners" },
  { key: "auditLogs",               label: "Audit Logs",               description: "View system activity logs" },
  { key: "settings",                label: "Settings",                 description: "Global admin configuration" },
  { key: "changePlan",              label: "Change Plan",              description: "Manually change a user's subscription plan" },
];

const LEVEL_META: Record<PermLevel, { label: string; color: string; description: string }> = {
  full:    { label: "Full",      color: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", description: "View + create + edit + delete" },
  limited: { label: "Limited",   color: "bg-amber-500/15 text-amber-600 border-amber-500/30",       description: "View + create + edit (no delete)" },
  read:    { label: "Read Only", color: "bg-blue-500/15 text-blue-600 border-blue-500/30",           description: "View only" },
  none:    { label: "None",      color: "bg-muted text-muted-foreground border-border",              description: "Hidden — no access" },
};

type AdminPerms = Record<ModuleKey, PermLevel>;

const DEFAULT_ADMIN: AdminPerms = {
  dashboard: "full", users: "limited", googleUsers: "limited",
  plans: "read", orders: "read", referralEngine: "read",
  vouchers: "full", distributors: "limited", distributorApplications: "full",
  distributorPayouts: "full", importUsers: "limited", assignDistributor: "full",
  auditLogs: "read", settings: "none", changePlan: "none",
};

export default function RolePermissions() {
  const { reload } = usePermissions();
  const [adminPerms, setAdminPerms] = useState<AdminPerms>(DEFAULT_ADMIN);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/admin/config?type=ROLE_PERMISSIONS")
      .then((data: any) => {
        const perms = data?.ADMIN ?? data;
        if (perms && typeof perms === "object") {
          setAdminPerms({ ...DEFAULT_ADMIN, ...perms });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post("/admin/config", { type: "ROLE_PERMISSIONS", data: { ADMIN: adminPerms } });
      toast.success("Role permissions saved");
      reload();
    } catch {
      toast.error("Failed to save permissions");
    } finally {
      setSaving(false);
    }
  };

  const LevelBadge = ({ level }: { level: PermLevel }) => {
    const meta = LEVEL_META[level];
    return (
      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold", meta.color)}>
        {meta.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Role Permissions</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Configure what each admin role can access. SUPERADMIN always has full access.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="shrink-0">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Save Permissions
        </Button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 p-3 rounded-lg bg-muted/40 border border-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider self-center">Legend:</span>
        {(Object.entries(LEVEL_META) as [PermLevel, typeof LEVEL_META[PermLevel]][]).map(([level, meta]) => (
          <div key={level} className="flex items-center gap-1.5">
            <LevelBadge level={level} />
            <span className="text-xs text-muted-foreground">{meta.description}</span>
          </div>
        ))}
      </div>

      {/* Matrix Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[1fr_160px_220px] bg-muted/60 border-b border-border">
          <div className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Module</div>
          <div className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">
            Super Admin
          </div>
          <div className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">
            Admin / Support
          </div>
        </div>

        {/* Rows */}
        {MODULES.map((mod, i) => (
          <div
            key={mod.key}
            className={cn(
              "grid grid-cols-[1fr_160px_220px] items-center border-b border-border last:border-0",
              i % 2 === 0 ? "bg-card" : "bg-muted/20"
            )}
          >
            {/* Module name + description */}
            <div className="px-4 py-3.5">
              <p className="text-sm font-medium text-foreground">{mod.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{mod.description}</p>
            </div>

            {/* SUPERADMIN — always Full, locked */}
            <div className="px-4 py-3.5 flex justify-center">
              <div className="flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-muted-foreground/60" />
                <LevelBadge level="full" />
              </div>
            </div>

            {/* ADMIN — configurable */}
            <div className="px-4 py-3.5 flex justify-center">
              <Select
                value={adminPerms[mod.key]}
                onValueChange={(val) =>
                  setAdminPerms(prev => ({ ...prev, [mod.key]: val as PermLevel }))
                }
              >
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["full", "limited", "read", "none"] as PermLevel[]).map(level => (
                    <SelectItem key={level} value={level} className="text-xs">
                      <div className="flex items-center gap-2">
                        <LevelBadge level={level} />
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
      </div>

      {/* Info note */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground p-3 rounded-lg bg-muted/30 border border-border">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          Changes take effect immediately for newly loaded sessions. Existing admin sessions will reflect updates on next page load.
          SUPERADMIN permissions cannot be restricted.
        </span>
      </div>
    </div>
  );
}
