import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeftRight, Search, User, Calendar, CreditCard, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserRow {
  id: number;
  name: string | null;
  email: string;
  phone: string | null;
  recoveryEmail: string | null;
  recoveryPhone: string | null;
  planId: number | null;
  planName: string | null;
  billingPeriod: "monthly" | "yearly" | null;
  renewalDate: string | null;
  workspaceStatus: string | null;
}

interface Plan {
  id: number;
  name: string;
  priceMonthlyINR: number | null;
  priceINR: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysRemaining(date: string | null): number | null {
  if (!date) return null;
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

function fmtDate(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function planShortName(name: string): string {
  return name.replace(/^Cloud Storage\s*[-–]\s*/i, "");
}

// ─── Change Plan Drawer ───────────────────────────────────────────────────────

function ChangePlanDrawer({
  user,
  plans,
  onClose,
  onSuccess,
}: {
  user: UserRow;
  plans: Plan[];
  onClose: () => void;
  onSuccess: (userId: number, planId: number, planName: string, billingPeriod: string, renewalDate: string) => void;
}) {
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("yearly");
  const [paymentMethod, setPaymentMethod] = useState<string>("NEFT");
  const [paymentRef, setPaymentRef] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const days = daysRemaining(user.renewalDate);

  const isValid =
    selectedPlanId !== "" &&
    paymentRef.trim() !== "" &&
    !(selectedPlanId === String(user.planId) && billingPeriod === user.billingPeriod);

  async function handleSubmit() {
    setError("");
    setSaving(true);
    try {
      await api.post(`/admin/users/${user.id}/change-plan`, {
        planId: Number(selectedPlanId),
        billingPeriod,
        paymentMethod,
        paymentRef: paymentRef.trim(),
        note: note.trim(),
      });
      const plan = plans.find(p => p.id === Number(selectedPlanId));
      const renewal = new Date(billingPeriod === "yearly" ? Date.now() + 365 * 86400000 : Date.now() + 30 * 86400000)
        .toISOString();
      toast.success("Plan updated successfully. Emails sent.");
      onSuccess(user.id, Number(selectedPlanId), plan?.name ?? "", billingPeriod, renewal);
      onClose();
    } catch (e: any) {
      setError(e.message || "Failed to update plan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open onOpenChange={open => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-primary" />
            Change Plan
          </SheetTitle>
          <SheetDescription>Manual plan assignment (offline payment)</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 pb-6">
          {/* ── User info ── */}
          <div className="rounded-lg border border-border bg-surface-2 p-4 space-y-2 text-sm">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">User Info</p>
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="font-medium text-foreground">{user.email}</span>
            </div>
            {user.name && <p className="text-muted-foreground pl-5">{user.name}</p>}
            {user.phone && <p className="text-muted-foreground pl-5">📞 {user.phone}</p>}
            {user.recoveryEmail && (
              <p className="text-muted-foreground pl-5">Recovery email: <span className="text-foreground">{user.recoveryEmail}</span></p>
            )}
            {user.recoveryPhone && (
              <p className="text-muted-foreground pl-5">Recovery phone: <span className="text-foreground">{user.recoveryPhone}</span></p>
            )}
          </div>

          {/* ── Current plan ── */}
          <div className="rounded-lg border border-border bg-surface-2 p-4 space-y-1.5 text-sm">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Current Plan</p>
            {user.planName ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-foreground font-medium">{planShortName(user.planName)}</span>
                  <Badge variant="outline" className="capitalize text-xs">{user.billingPeriod ?? "—"}</Badge>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  <span>Renews {fmtDate(user.renewalDate)}</span>
                  {days !== null && (
                    <span className={days < 15 ? "text-amber-500 font-medium" : ""}>
                      ({days > 0 ? `${days}d left` : "Expired"})
                    </span>
                  )}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">No active plan</p>
            )}
          </div>

          {/* ── Change plan form ── */}
          <div className="space-y-3.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Change Plan</p>

            {/* New plan */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">New Plan</label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a plan…" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {planShortName(p.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Billing period */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Billing Period</label>
              <div className="flex gap-3">
                {(["monthly", "yearly"] as const).map(bp => (
                  <button
                    key={bp}
                    onClick={() => setBillingPeriod(bp)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      billingPeriod === bp
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-surface-2 text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {bp.charAt(0).toUpperCase() + bp.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment method */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Payment Method</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["NEFT", "Cash", "Cheque", "Other"].map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Payment reference */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Payment Reference <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="UTR / cheque no. / receipt no."
                value={paymentRef}
                onChange={e => setPaymentRef(e.target.value)}
              />
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Note (optional)</label>
              <Input
                placeholder="Any additional context…"
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button
            className="w-full"
            disabled={!isValid || saving}
            onClick={handleSubmit}
          >
            {saving ? (
              <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Updating…</>
            ) : (
              <><CreditCard className="w-4 h-4 mr-2" /> Confirm Change Plan</>
            )}
          </Button>

          <p className="text-[11px] text-muted-foreground text-center">
            Confirmation emails will be sent to the user and support@technodoc.in
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ChangePlan() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  useEffect(() => {
    Promise.all([
      api.get("/admin/users-with-plans"),
      api.get("/admin/plans"),
    ])
      .then(([u, p]) => {
        setUsers(Array.isArray(u) ? u : []);
        const raw: any[] = Array.isArray(p) ? p : (p?.plans ?? []);
        setPlans(raw.filter((x: any) => x.isActive !== 0 && x.isActive !== false));
      })
      .catch(() => toast.error("Failed to load data"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return users;
    return users.filter(u =>
      u.email.toLowerCase().includes(q) || (u.name ?? "").toLowerCase().includes(q)
    );
  }, [users, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleSuccess(userId: number, planId: number, planName: string, billingPeriod: string, renewalDate: string) {
    setUsers(prev => prev.map(u =>
      u.id === userId
        ? { ...u, planId, planName, billingPeriod: billingPeriod as any, renewalDate, workspaceStatus: "ACTIVE" }
        : u
    ));
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <ArrowLeftRight className="w-5 h-5 text-primary" />
          Change Plan
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manually assign or change a user's plan for offline payments (NEFT / cash / cheque).
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by email or name…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading users…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            No users found
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">User</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current Plan</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Billing</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Renewal</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {pageRows.map((u, i) => {
                  const days = daysRemaining(u.renewalDate);
                  return (
                    <motion.tr
                      key={u.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="border-b border-border/50 last:border-0 hover:bg-surface-2 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                            {(u.name?.[0] ?? u.email[0]).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate max-w-[200px]">{u.email}</p>
                            {u.name && <p className="text-xs text-muted-foreground truncate">{u.name}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {u.planName ? (
                          <span className="font-medium text-foreground">{planShortName(u.planName)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {u.billingPeriod ? (
                          <Badge variant="outline" className="capitalize text-xs">{u.billingPeriod}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {u.renewalDate ? (
                          <span className={days !== null && days < 15 ? "text-amber-500 font-medium" : ""}>
                            {fmtDate(u.renewalDate)}
                            {days !== null && <span className="text-xs ml-1">({days > 0 ? `${days}d` : "exp"})</span>}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => setSelectedUser(u)}
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                          Change
                        </Button>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm text-muted-foreground">
                <span>{filtered.length} users</span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
                  <span>{page} / {totalPages}</span>
                  <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Drawer */}
      {selectedUser && (
        <ChangePlanDrawer
          user={selectedUser}
          plans={plans}
          onClose={() => setSelectedUser(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
