import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, Info, Zap, CheckCheck, X, Bell, BellOff, Search, Filter,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";

type AlertSeverity = "critical" | "warning" | "info";
type AlertStatus = "active" | "acknowledged" | "dismissed";
interface Alert {
  id: string;
  severity: AlertSeverity;
  status: AlertStatus;
  message: string;
  category: string;
  timestamp: string;
}

// Design tokens per severity
const severityConfig: Record<AlertSeverity, {
  label: string;
  badgeClass: string;
  rowClass: string;
  icon: React.ReactNode;
  borderClass: string;
}> = {
  critical: {
    label: "Critical",
    badgeClass: "bg-danger/10 text-danger border-danger/30",
    rowClass: "border-l-2 border-l-danger",
    icon: <Zap className="w-3.5 h-3.5" />,
    borderClass: "border-danger/20",
  },
  warning: {
    label: "Warning",
    badgeClass: "bg-warning/10 text-warning border-warning/30",
    rowClass: "border-l-2 border-l-warning",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    borderClass: "border-warning/20",
  },
  info: {
    label: "Info",
    badgeClass: "bg-primary/10 text-primary border-primary/20",
    rowClass: "border-l-2 border-l-primary",
    icon: <Info className="w-3.5 h-3.5" />,
    borderClass: "border-primary/20",
  },
};

const statusConfig: Record<AlertStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-surface-2 text-foreground border-border" },
  acknowledged: { label: "Acknowledged", className: "bg-success/10 text-success border-success/20" },
  dismissed: { label: "Dismissed", className: "bg-muted text-muted-foreground border-border" },
};

// Alert card
function AlertCard({
  alert,
  onAcknowledge,
  onDismiss,
}: {
  alert: Alert;
  onAcknowledge: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const sev = severityConfig[alert.severity];
  const status = statusConfig[alert.status];
  const isDone = alert.status !== "active";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: isDone ? 0.55 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.18 } }}
      className={`
        relative flex flex-col sm:flex-row sm:items-start gap-4
        rounded-xl bg-surface-1 border ${sev.borderClass} ${sev.rowClass}
        p-4 shadow-card transition-all
        ${isDone ? "grayscale-[30%]" : ""}
      `}
    >
      {/* Severity icon */}
      <div className={`shrink-0 mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center border ${sev.badgeClass}`}>
        {sev.icon}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Severity badge */}
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${sev.badgeClass}`}>
            {sev.icon}
            {sev.label}
          </span>
          {/* Category */}
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-surface-2 text-muted-foreground border border-border">
            {alert.category}
          </span>
          {/* Status */}
          {alert.status !== "active" && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${status.className}`}>
              {status.label}
            </span>
          )}
        </div>

        <p className={`text-sm font-medium leading-snug ${isDone ? "text-muted-foreground" : "text-foreground"}`}>
          {alert.message}
        </p>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span title={format(new Date(alert.timestamp), "PPpp")}>
            {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
          </span>
        </div>
      </div>

      {/* Actions */}
      {!isDone && (
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-success/30 text-success hover:bg-success/10 hover:border-success/50 gap-1.5"
            onClick={() => onAcknowledge(alert.id)}
          >
            <CheckCheck className="w-3 h-3" />
            Acknowledge
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-border text-muted-foreground hover:text-foreground hover:bg-accent gap-1.5"
            onClick={() => onDismiss(alert.id)}
          >
            <X className="w-3 h-3" />
            Dismiss
          </Button>
        </div>
      )}
    </motion.div>
  );
}

// Page
export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | "">("");
  const [statusFilter, setStatusFilter] = useState<AlertStatus | "">("");
  // Map audit logs to alert objects
  const loadAlerts = useCallback(async () => {
    try {
      const token = localStorage.getItem("wmd_token") || sessionStorage.getItem("wmd_token");
      const res = await fetch("/api/admin/audit-logs?limit=50", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      const data = await res.json();
      const logs = data.logs || [];
      const mapped: Alert[] = logs.map((log: any) => {
        let severity: AlertSeverity = "info";
        let message = log.actionName;
        let category = "System";
        try {
          const payload = log.payloadJson ? JSON.parse(log.payloadJson) : {};
          if (log.actionName === "PLAN_PURCHASE_REQUEST") {
            severity = "warning";
            message = `New purchase request: "${payload.planName}" - INR ${payload.amount?.toLocaleString("en-IN")} (Order #${payload.orderId})`;
            category = "Purchase";
          } else if (log.actionName?.includes("DELETE")) {
            severity = "critical";
            category = "Admin";
          } else if (log.actionName?.includes("CREATE") || log.actionName?.includes("UPDATE")) {
            severity = "info";
            category = "Admin";
          }
        } catch {
          // Ignore invalid payload in audit log row.
        }
        return {
          id: String(log.id),
          severity,
          status: "active" as AlertStatus,
          message,
          category,
          timestamp: log.createdAt,
        };
      });
      setAlerts(prev => {
        // Merge keeping any local acknowledge/dismiss state
        const stateMap = new Map(prev.map(a => [a.id, a.status]));
        return mapped.map(a => ({ ...a, status: stateMap.get(a.id) ?? a.status }));
      });
    } catch (_) {
      // Ignore transient fetch errors; polling will retry.
    }
  }, []);

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 30_000); // poll every 30s
    return () => clearInterval(interval);
  }, [loadAlerts]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return alerts.filter(a => {
      const matchSearch = !q || a.message.toLowerCase().includes(q) || a.category.toLowerCase().includes(q);
      const matchSeverity = !severityFilter || a.severity === severityFilter;
      const matchStatus = !statusFilter || a.status === statusFilter;
      return matchSearch && matchSeverity && matchStatus;
    });
  }, [alerts, search, severityFilter, statusFilter]);

  const counts = {
    active: alerts.filter(a => a.status === "active").length,
    critical: alerts.filter(a => a.severity === "critical" && a.status === "active").length,
    acknowledged: alerts.filter(a => a.status === "acknowledged").length,
    dismissed: alerts.filter(a => a.status === "dismissed").length,
  };

  const handleAcknowledge = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: "acknowledged" as AlertStatus } : a));
    toast.success("Alert acknowledged", { description: "This alert has been marked as reviewed." });
  };

  const handleDismiss = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: "dismissed" as AlertStatus } : a));
    toast.info("Alert dismissed", { description: "Alert removed from active queue." });
  };

  const handleAcknowledgeAll = () => {
    const activeIds = alerts.filter(a => a.status === "active").map(a => a.id);
    if (!activeIds.length) return;
    setAlerts(prev => prev.map(a => activeIds.includes(a.id) ? { ...a, status: "acknowledged" as AlertStatus } : a));
    toast.success(`${activeIds.length} alerts acknowledged`, { description: "All active alerts marked as reviewed." });
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell className="w-6 h-6 text-primary" />
            Alerts
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {counts.active} active | {counts.acknowledged} acknowledged | {counts.dismissed} dismissed
          </p>
        </div>
        {counts.active > 0 && (
          <Button
            variant="outline"
            className="border-success/30 text-success hover:bg-success/10 hover:border-success/50 gap-2"
            onClick={handleAcknowledgeAll}
          >
            <CheckCheck className="w-4 h-4" />
            Acknowledge All ({counts.active})
          </Button>
        )}
      </div>

      {/* Stat chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Active", value: counts.active, colorClass: "text-foreground" },
          { label: "Critical", value: counts.critical, colorClass: "text-danger" },
          { label: "Acknowledged", value: counts.acknowledged, colorClass: "text-success" },
          { label: "Dismissed", value: counts.dismissed, colorClass: "text-muted-foreground" },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="p-3 rounded-xl bg-surface-1 border border-border text-center"
          >
            <p className={`text-2xl font-bold ${s.colorClass}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search message, distributor, category..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-surface-1 border-border/50 h-9 text-sm"
          />
        </div>
        <select
          value={severityFilter}
          onChange={e => setSeverityFilter(e.target.value as AlertSeverity | "")}
          className="px-3 h-9 rounded-md bg-surface-1 border border-border/50 text-sm text-foreground appearance-none min-w-[150px] focus:outline-none focus:border-primary/50"
        >
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as AlertStatus | "")}
          className="px-3 h-9 rounded-md bg-surface-1 border border-border/50 text-sm text-foreground appearance-none min-w-[150px] focus:outline-none focus:border-primary/50"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="dismissed">Dismissed</option>
        </select>
      </div>

      {/* Alert list */}
      <motion.div layout className="space-y-3">
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20 gap-3 text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-surface-1 border border-border flex items-center justify-center">
                <BellOff className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-foreground font-medium">No alerts match your filters</p>
              <p className="text-muted-foreground text-sm">Try adjusting your search or filter criteria.</p>
            </motion.div>
          ) : (
            filtered.map(alert => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onAcknowledge={handleAcknowledge}
                onDismiss={handleDismiss}
              />
            ))
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
