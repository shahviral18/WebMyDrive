import { useState, useEffect, useCallback } from "react";
import {
  Download, CheckCircle2, Loader2, Copy,
  Users, RefreshCw, ChevronDown, ChevronUp, X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExistingUser {
  id: number;
  username: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  status: string;
  activePlanId: number | null;
  planName: string | null;
  ou: string | null;
  recoveryEmail: string | null;
  recoveryPhone: string | null;
  lastSignIn: string | null;
  googleCreatedAt: string | null;
  linkedUserId: number | null;
  linkedUserEmail?: string | null;
  importedAt?: string | null;
  notes: string | null;
}

interface Plan {
  id: number;
  name: string;
}

interface ImportResult {
  id: number;
  success: boolean;
  email?: string;
  plainPassword?: string;
  alreadyExists?: boolean;
  error?: string;
}

interface ImportFormData {
  planId: string;
  activationDate: string;
  lastPaymentDate: string;
  lastPaymentAmount: string;
  renewalDate: string;
  notes: string;
}

type Tab = "pending" | "imported";

// ── Helpers ───────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addOneYear(date: string): string {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

// ── Password reveal row ───────────────────────────────────────────────────────

function PasswordRow({ result }: { result: ImportResult }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(result.plainPassword ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex items-center gap-2 text-sm py-1">
      <span className="text-muted-foreground w-48 truncate">{result.email}</span>
      {result.alreadyExists ? (
        <Badge variant="outline" className="text-xs text-blue-500 border-blue-300">Already existed — linked</Badge>
      ) : (
        <>
          <span className="font-mono font-medium text-foreground">{result.plainPassword}</span>
          <button onClick={copy} className="text-muted-foreground hover:text-foreground">
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </>
      )}
    </div>
  );
}

// ── Import Details Modal ──────────────────────────────────────────────────────

function ImportModal({
  user,
  plans,
  onClose,
  onDone,
}: {
  user: ExistingUser;
  plans: Plan[];
  onClose: () => void;
  onDone: (result: ImportResult) => void;
}) {
  const defaultPaymentDate = user.googleCreatedAt
    ? user.googleCreatedAt.slice(0, 10)
    : today();

  const [form, setForm] = useState<ImportFormData>({
    planId: user.activePlanId ? String(user.activePlanId) : "",
    activationDate: user.googleCreatedAt ? user.googleCreatedAt.slice(0, 10) : today(),
    lastPaymentDate: defaultPaymentDate,
    lastPaymentAmount: "",
    renewalDate: addOneYear(defaultPaymentDate),
    notes: user.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof ImportFormData, v: string) => {
    setForm(prev => {
      const next = { ...prev, [k]: v };
      // Auto-update renewal date when last payment date changes
      if (k === "lastPaymentDate" && v) {
        next.renewalDate = addOneYear(v);
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.activationDate || !form.lastPaymentDate || !form.renewalDate) {
      toast.error("Please fill in all required dates.");
      return;
    }
    setSaving(true);
    try {
      const res = await api.post(`/admin/existing-users/${user.id}/import`, {
        planId: form.planId ? parseInt(form.planId) : null,
        activationDate: form.activationDate,
        lastPaymentDate: form.lastPaymentDate,
        lastPaymentAmount: form.lastPaymentAmount ? parseFloat(form.lastPaymentAmount) : 0,
        renewalDate: form.renewalDate,
        notes: form.notes,
      });
      onDone({
        id: user.id,
        success: true,
        email: res.email,
        plainPassword: res.plainPassword,
        alreadyExists: res.alreadyExists,
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Import failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import: {user.username}</DialogTitle>
          <DialogDescription>
            Fill in the billing details for <strong>{user.fullName || user.username}</strong> before importing to the portal.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Plan */}
          <div className="space-y-1.5">
            <Label>Plan</Label>
            <select
              value={form.planId}
              onChange={e => set("planId", e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— No plan selected —</option>
              {plans.map(p => (
                <option key={p.id} value={String(p.id)}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Dates row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Activation Date <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={form.activationDate}
                onChange={e => set("activationDate", e.target.value)}
                className="h-9 text-sm"
                required
              />
              <p className="text-xs text-muted-foreground">When they first joined</p>
            </div>
            <div className="space-y-1.5">
              <Label>Renewal Date <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={form.renewalDate}
                onChange={e => set("renewalDate", e.target.value)}
                className="h-9 text-sm"
                required
              />
              <p className="text-xs text-muted-foreground">Next billing due date</p>
            </div>
          </div>

          {/* Last payment */}
          <div className="bg-surface-2/50 rounded-lg p-3 space-y-3 border border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Last Payment Received</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={form.lastPaymentDate}
                  onChange={e => set("lastPaymentDate", e.target.value)}
                  className="h-9 text-sm"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Amount (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 1500"
                  value={form.lastPaymentAmount}
                  onChange={e => set("lastPaymentAmount", e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <textarea
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
              placeholder="Any additional info about this account…"
              rows={2}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving} className="gap-2 min-w-36">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Import User
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ImportUsersPage() {
  const [tab, setTab] = useState<Tab>("pending");
  const [pending, setPending] = useState<ExistingUser[]>([]);
  const [imported, setImported] = useState<ExistingUser[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalUser, setModalUser] = useState<ExistingUser | null>(null);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get("/admin/existing-users"),
      api.get("/admin/plans"),
    ]).then(([euRes, planRes]) => {
      setPending(euRes.pending ?? []);
      setImported(euRes.imported ?? []);
      setPlans(planRes.plans ?? planRes ?? []);
    }).catch(() => toast.error("Failed to load data"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredPending = pending.filter(u =>
    !search ||
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.fullName.toLowerCase().includes(search.toLowerCase())
  );

  const filteredImported = imported.filter(u =>
    !search ||
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.fullName.toLowerCase().includes(search.toLowerCase())
  );

  const handleImportDone = (result: ImportResult) => {
    setResults(prev => [result, ...prev]);
    setShowResults(true);
    setPending(prev => prev.filter(u => u.id !== result.id));
    setModalUser(null);
    toast.success(`${result.email} imported successfully`);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Import details modal */}
      {modalUser && (
        <ImportModal
          user={modalUser}
          plans={plans}
          onClose={() => setModalUser(null)}
          onDone={handleImportDone}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Download className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Import Existing Users</h1>
            <p className="text-sm text-muted-foreground">
              {pending.length} pending · {imported.length} already imported
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Results accordion */}
      {results.length > 0 && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowResults(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-400"
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {results.length} import result{results.length !== 1 ? "s" : ""} — copy passwords before closing
            </span>
            {showResults ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showResults && (
            <div className="px-5 pb-4 space-y-1 border-t border-emerald-200 dark:border-emerald-800 pt-3 max-h-64 overflow-y-auto">
              {results.map(r => (
                <PasswordRow key={`${r.id}-${r.email}`} result={r} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tabs + search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex gap-1 bg-surface-2 p-1 rounded-xl w-fit">
          {(["pending", "imported"] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                tab === t
                  ? "bg-card shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "pending" ? `Pending (${pending.length})` : `Imported (${imported.length})`}
            </button>
          ))}
        </div>
        <Input
          placeholder="Search name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-9 text-sm sm:max-w-xs"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : tab === "pending" ? (
        filteredPending.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            <p className="text-muted-foreground text-sm">
              {search ? "No matches found." : "All existing users have been imported!"}
            </p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-2/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Plan</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">OU</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Last Sign In</th>
                  <th className="px-4 py-3 w-28"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredPending.map(u => (
                  <tr key={u.id} className="hover:bg-surface-2/30 transition-colors">
                    <td className="px-4 py-3 text-foreground font-medium truncate max-w-[200px]">
                      {u.username}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground truncate max-w-[160px]">
                      {u.fullName || <span className="italic text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          u.status === "ACTIVE"
                            ? "text-emerald-600 border-emerald-400/40 bg-emerald-500/10"
                            : "text-red-500 border-red-400/40 bg-red-500/10"
                        )}
                      >
                        {u.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs truncate max-w-[120px]">
                      {u.planName ?? <span className="italic">—</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs truncate max-w-[120px]">
                      {u.ou ?? <span className="italic">—</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {u.lastSignIn
                        ? formatDistanceToNow(new Date(u.lastSignIn), { addSuffix: true })
                        : <span className="italic">Never</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setModalUser(u)}
                        className="gap-1.5 h-7 text-xs"
                      >
                        <Download className="w-3 h-3" />
                        Import
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* Imported tab */
        filteredImported.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Users className="w-10 h-10 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">No imported users yet.</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-2/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Original Email</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">GWS Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Plan</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Portal Account</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Imported</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredImported.map(u => (
                  <tr key={u.id} className="hover:bg-surface-2/30 transition-colors">
                    <td className="px-4 py-3 text-foreground font-medium truncate max-w-[200px]">
                      {u.username}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground truncate max-w-[160px]">
                      {u.fullName || <span className="italic text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          u.status === "ACTIVE"
                            ? "text-emerald-600 border-emerald-400/40 bg-emerald-500/10"
                            : "text-red-500 border-red-400/40 bg-red-500/10"
                        )}
                      >
                        {u.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {u.planName ?? <span className="italic">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {u.linkedUserEmail ?? `User #${u.linkedUserId}`}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {u.importedAt
                        ? formatDistanceToNow(new Date(u.importedAt), { addSuffix: true })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
