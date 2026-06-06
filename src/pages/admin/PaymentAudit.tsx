import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, Clock, RefreshCw, Send, Loader2, FileText, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AuditRow {
  orderId: number;
  userId: number;
  userName: string | null;
  userEmail: string;
  planName: string;
  amount: number;
  paidAt: string;
  paymentId: string | null;
  invoiceNumber: string | null;
  workspaceStatus: string | null;
  googleEmail: string | null;
  googleStatus: "provisioned" | "pending" | "unknown";
}

const googleBadge = {
  provisioned: { label: "Provisioned", cls: "bg-success/10 text-success border-success/30", icon: CheckCircle2 },
  pending:     { label: "Pending",     cls: "bg-warning/10 text-warning border-warning/30", icon: Clock },
  unknown:     { label: "Not Provisioned", cls: "bg-danger/10 text-danger border-danger/30", icon: XCircle },
};

export default function PaymentAuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [retrying, setRetrying] = useState<number | null>(null);
  const [resending, setResending] = useState<number | null>(null);

  useEffect(() => {
    api.get("/admin/payment-audit")
      .then(data => setRows(Array.isArray(data) ? data : []))
      .catch(() => toast.error("Failed to load payment audit"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = rows.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.userEmail.toLowerCase().includes(q) ||
      (r.userName ?? "").toLowerCase().includes(q) ||
      r.planName.toLowerCase().includes(q) ||
      String(r.orderId).includes(q) ||
      (r.invoiceNumber ?? "").toLowerCase().includes(q)
    );
  });

  const handleRetryGoogle = async (row: AuditRow) => {
    setRetrying(row.orderId);
    try {
      await api.post(`/admin/users/${row.userId}/provision-google-account`, {});
      toast.success(`Google account provisioned for ${row.userEmail}`);
      setRows(prev => prev.map(r =>
        r.orderId === row.orderId ? { ...r, googleStatus: "provisioned" } : r
      ));
    } catch (e: any) {
      toast.error(e?.message ?? "Provisioning failed");
    } finally {
      setRetrying(null);
    }
  };

  const handleResendInvoice = async (row: AuditRow) => {
    setResending(row.orderId);
    try {
      const res = await api.post(`/admin/orders/${row.orderId}/send-bill`, {});
      toast.success(`Invoice ${res.invoiceNumber ?? ""} sent to ${row.userEmail}`);
      setRows(prev => prev.map(r =>
        r.orderId === row.orderId ? { ...r, invoiceNumber: res.invoiceNumber ?? r.invoiceNumber } : r
      ));
    } catch (e: any) {
      toast.error(e?.message ?? "Invoice send failed");
    } finally {
      setResending(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Payment Audit</h1>
          <p className="text-sm text-muted-foreground">Last 100 paid orders — Google provisioning status + Zoho invoice</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9 h-9 text-sm"
          placeholder="Search by user, plan, order ID, invoice…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Summary badges */}
      <div className="flex gap-3 flex-wrap text-sm">
        <span className="px-3 py-1 rounded-full bg-surface-2 border border-border text-muted-foreground">
          {rows.length} orders
        </span>
        <span className="px-3 py-1 rounded-full bg-success/10 border border-success/20 text-success">
          {rows.filter(r => r.googleStatus === "provisioned").length} Google ✓
        </span>
        <span className="px-3 py-1 rounded-full bg-danger/10 border border-danger/20 text-danger">
          {rows.filter(r => r.googleStatus === "unknown").length} not provisioned
        </span>
        <span className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary">
          {rows.filter(r => r.invoiceNumber).length} invoices generated
        </span>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-2 border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Order</th>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Plan</th>
                <th className="px-4 py-3 font-semibold text-right">Amount</th>
                <th className="px-4 py-3 font-semibold">Paid At</th>
                <th className="px-4 py-3 font-semibold">Google</th>
                <th className="px-4 py-3 font-semibold">Invoice #</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">No matching orders</td>
                </tr>
              ) : filtered.map(row => {
                const gCfg = googleBadge[row.googleStatus];
                const GIcon = gCfg.icon;
                const isRetrying = retrying === row.orderId;
                const isResending = resending === row.orderId;

                return (
                  <tr key={row.orderId} className="hover:bg-surface-2/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-muted-foreground">WMD-{String(row.orderId).padStart(4, "0")}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground truncate max-w-[140px]">{row.userName ?? row.userEmail}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[140px]">{row.userEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-foreground">{row.planName}</td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">
                      ₹{row.amount.toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {row.paidAt?.slice(0, 16).replace("T", " ")}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={cn("gap-1 text-xs", gCfg.cls)}>
                        <GIcon className="w-3 h-3" />
                        {gCfg.label}
                      </Badge>
                      {row.googleEmail && row.googleEmail !== "PENDING" && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[130px]">{row.googleEmail}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.invoiceNumber ? (
                        <span className="font-mono text-xs text-foreground">{row.invoiceNumber}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {row.googleStatus !== "provisioned" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs gap-1"
                            disabled={isRetrying}
                            onClick={() => handleRetryGoogle(row)}
                          >
                            {isRetrying
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <RefreshCw className="w-3 h-3" />}
                            Google
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs gap-1"
                          disabled={isResending}
                          onClick={() => handleResendInvoice(row)}
                        >
                          {isResending
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Send className="w-3 h-3" />}
                          Invoice
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
