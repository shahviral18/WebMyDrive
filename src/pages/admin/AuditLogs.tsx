import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Download, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Filter, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";

const severityConfig: Record<string, string> = {
  critical: "bg-danger/10 text-danger border-danger/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  info: "bg-primary/10 text-primary border-primary/20",
};

const EVENT_MAP: Record<string, string> = {
  "PAYMENT_VERIFIED": "Payment successful",
  "CHECKOUT_PROMO_CODE": "Promo code applied at checkout",
  "REFERRAL_COMMISSION_CREDITED": "Referral commission credited",
  "REFERRAL_RENEWAL_COMMISSION_CREDITED": "Renewal referral commission credited",
  "DISTRIBUTOR_COMMISSION_CREDITED": "Distributor commission credited",
  "WEBMYDRIVE_ACCOUNT_CREATED": "WebMyDrive account created",
};

const formatEventName = (name: string) => EVENT_MAP[name] || name;

const formatPayload = (log: any) => {
  if (!log.payloadJson) return "(no payload)";
  try {
    const payload = JSON.parse(log.payloadJson);
    if (typeof payload !== "object" || payload === null) return String(payload);

    const email = payload.userEmail || payload.email || payload.buyerEmail;
    const plan = payload.planName || payload.plan;
    const amount = payload.amount ?? payload.amountPaid ?? payload.total;
    const commission = payload.commission ?? payload.amountCredited ?? payload.commissionEarned ?? payload.creditAmount;

    const details = [];
    if (email) details.push(`User email: ${email}`);
    if (plan) details.push(`Plan name: ${plan}`);
    if (amount !== undefined) details.push(`Amount paid: ${amount}`);
    if (commission !== undefined) details.push(`Commission credited: ${commission}`);

    if (details.length > 0) {
      return details.join("\n");
    }
    return JSON.stringify(payload, null, 2);
  } catch {
    return "(invalid payload)";
  }
};

const PAGE_SIZE = 15;

export default function AuditLogs() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/admin/audit-logs?page=${page}&limit=200`)
      .then(data => setLogs(data.logs || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const actionTypes = useMemo(() => Array.from(new Set(logs.map(l => l.actionName))).sort(), [logs]);

  const filtered = useMemo(() => {
    return logs.filter(l => {
      const q = search.toLowerCase();
      const matchesSearch = !q || l.actionName?.toLowerCase().includes(q) || String(l.actorId)?.includes(q) || l.ipAddress?.includes(q);
      const matchesAction = !actionFilter || l.actionName === actionFilter;
      return matchesSearch && matchesAction;
    });
  }, [logs, search, actionFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleExport = () => {
    const csv = [
      ["ID", "ActorId", "Action", "IP", "Timestamp", "Payload"].join(","),
      ...filtered.map(l => [l.id, l.actorId, l.actionName, l.ipAddress, l.createdAt, JSON.stringify(l.payloadJson || "")].join(","))
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    toast.success("Audit log exported", { description: `${filtered.length} entries downloaded.` });
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Audit Logs</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Immutable record of all admin actions · {filtered.length} entries
          </p>
        </div>
        <Button onClick={handleExport} variant="outline" className="border-border text-muted-foreground hover:text-foreground gap-2">
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search actor, action, target, IP..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 bg-surface-1 border-border/50 h-9 text-sm"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <select
            value={actionFilter}
            onChange={e => { setActionFilter(e.target.value); setPage(1); }}
            className="pl-9 pr-4 h-9 rounded-md bg-surface-1 border border-border/50 text-sm text-foreground appearance-none min-w-[200px] focus:outline-none focus:border-primary/50"
          >
            <option value="">All Actions</option>
            {actionTypes.map(a => <option key={a} value={a}>{formatEventName(a)}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl bg-surface-1 border border-border shadow-card overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-surface-2/50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actor ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">IP</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Timestamp</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Payload</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground text-sm">
                      {logs.length === 0 ? "No audit events recorded yet." : "No log entries match your filters."}
                    </td>
                  </tr>
                ) : (
                  paginated.map((log, i) => (
                    <>
                      <motion.tr
                        key={log.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.02 }}
                        className="border-b border-border/30 hover:bg-surface-2/40 transition-colors cursor-pointer"
                        onClick={() => setExpandedId(expandedId === String(log.id) ? null : String(log.id))}
                      >
                        <td className="px-4 py-3 text-sm text-foreground font-mono text-xs">{log.actorId ?? "system"}</td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-foreground">{formatEventName(log.actionName)}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{log.ipAddress || "—"}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {(() => {
                            try { return format(new Date(log.createdAt), "MMM dd, HH:mm:ss"); }
                            catch { return "Invalid Date"; }
                          })()}
                        </td>
                        <td className="px-4 py-3">
                          <button className="text-xs text-primary hover:text-primary/80 flex items-center gap-1">
                            {expandedId === String(log.id) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            {expandedId === String(log.id) ? "Hide" : "View"}
                          </button>
                        </td>
                      </motion.tr>
                      {expandedId === String(log.id) && (
                        <motion.tr key={`${log.id}-payload`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          <td colSpan={5} className="px-4 py-3 bg-surface-2/30 border-b border-border/30">
                            <pre className="font-mono-data text-xs text-muted-foreground p-3 rounded-lg bg-surface-2 border border-border overflow-x-auto whitespace-pre-wrap">
                              {formatPayload(log)}
                            </pre>
                          </td>
                        </motion.tr>
                      )}
                    </>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} entries
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:pointer-events-none transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i;
                if (p < 1 || p > totalPages) return null;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-md text-xs font-medium transition-colors ${p === page ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}>
                    {p}
                  </button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:pointer-events-none transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
