import { useState, useEffect, useCallback } from "react";
import {
  Download, CheckCircle2, Loader2, Copy, AlertCircle,
  Users, RefreshCw, ChevronDown, ChevronUp,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

interface ImportResult {
  id: number;
  success: boolean;
  email?: string;
  plainPassword?: string;
  alreadyExists?: boolean;
  error?: string;
}

type Tab = "pending" | "imported";

// ── Password reveal row ────────────────────────────────────────────────────────

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

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ImportUsersPage() {
  const [tab, setTab] = useState<Tab>("pending");
  const [pending, setPending] = useState<ExistingUser[]>([]);
  const [imported, setImported] = useState<ExistingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState<Set<number>>(new Set());
  const [bulkImporting, setBulkImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get("/admin/existing-users")
      .then(res => {
        setPending(res.pending ?? []);
        setImported(res.imported ?? []);
      })
      .catch(() => toast.error("Failed to load existing users"))
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

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filteredPending.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredPending.map(u => u.id)));
    }
  };

  const importOne = async (user: ExistingUser) => {
    setImporting(prev => new Set(prev).add(user.id));
    try {
      const res = await api.post(`/admin/existing-users/${user.id}/import`, {});
      const result: ImportResult = {
        id: user.id,
        success: true,
        email: res.email,
        plainPassword: res.plainPassword,
        alreadyExists: res.alreadyExists,
      };
      setResults(prev => [result, ...prev]);
      setShowResults(true);
      setPending(prev => prev.filter(u => u.id !== user.id));
      toast.success(`${user.username} imported`);
    } catch (e: any) {
      toast.error(e?.message ?? "Import failed");
    } finally {
      setImporting(prev => { const next = new Set(prev); next.delete(user.id); return next; });
    }
  };

  const bulkImport = async () => {
    if (selected.size === 0) return;
    setBulkImporting(true);
    try {
      const res = await api.post("/admin/existing-users/bulk-import", { ids: Array.from(selected) });
      const newResults: ImportResult[] = res.results ?? [];
      setResults(prev => [...newResults, ...prev]);
      setShowResults(true);
      const successIds = new Set(newResults.filter(r => r.success).map(r => r.id));
      setPending(prev => prev.filter(u => !successIds.has(u.id)));
      setSelected(new Set());
      const ok = newResults.filter(r => r.success).length;
      const fail = newResults.filter(r => !r.success).length;
      toast.success(`${ok} imported${fail > 0 ? `, ${fail} failed` : ""}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Bulk import failed");
    } finally {
      setBulkImporting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
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
        {tab === "pending" && selected.size > 0 && (
          <Button
            onClick={bulkImport}
            disabled={bulkImporting}
            className="gap-2 ml-auto"
          >
            {bulkImporting
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Download className="w-4 h-4" />}
            Import Selected ({selected.size})
          </Button>
        )}
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
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={selected.size === filteredPending.length && filteredPending.length > 0}
                      onChange={toggleAll}
                      className="rounded"
                    />
                  </th>
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
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(u.id)}
                        onChange={() => toggleSelect(u.id)}
                        className="rounded"
                      />
                    </td>
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
                        disabled={importing.has(u.id)}
                        onClick={() => importOne(u)}
                        className="gap-1.5 h-7 text-xs"
                      >
                        {importing.has(u.id)
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Download className="w-3 h-3" />}
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
