import { useEffect, useState } from "react";
import { Loader2, FileText, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, getApiUrl } from "@/lib/api";
import { toast } from "sonner";

type AppRow = {
  id: number;
  accountEmail: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  city?: string;
  state?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
};

type AppDetail = AppRow & {
  linkedUserId?: number | null;
  whatsapp?: string;
  recoveryEmail?: string;
  panNumber?: string;
  aadharNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  area?: string;
  teamSize?: string;
  accountantName?: string;
  accountantPhone?: string;
  accountantEmail?: string;
  hasPanFile?: boolean;
  hasAadharFile?: boolean;
  reviewNotes?: string;
  updatedAt?: string;
};

const STATUS_COLORS: Record<string, string> = {
  PENDING:  "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJECTED: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function DistributorApplicationsPage() {
  const [rows, setRows] = useState<AppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"" | "PENDING" | "APPROVED" | "REJECTED">("");
  const [selected, setSelected] = useState<AppDetail | null>(null);

  async function load() {
    setLoading(true);
    try {
      const qs = filter ? `?status=${filter}` : "";
      const data = await api.get(`/admin/distributor-applications${qs}`);
      setRows(data.applications || []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  async function openDetail(id: number) {
    try {
      const data = await api.get(`/admin/distributor-applications/${id}`);
      setSelected(data.application);
    } catch (e: any) { toast.error(e.message || "Failed to load"); }
  }

  async function updateStatus(id: number, status: "APPROVED" | "REJECTED" | "PENDING", reviewNotes: string) {
    try {
      await api.patch(`/admin/distributor-applications/${id}`, { status, reviewNotes });
      toast.success(`Status set to ${status}`);
      await load();
      if (selected?.id === id) {
        const data = await api.get(`/admin/distributor-applications/${id}`);
        setSelected(data.application);
      }
    } catch (e: any) { toast.error(e.message || "Update failed"); }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Distributor Applications</h1>
          <p className="text-sm text-muted-foreground">Review Resell WebMyDrive submissions.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-9 rounded border border-border bg-background px-3 text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
          >
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-1" /> Refresh</Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium">ID</th>
              <th className="text-left px-4 py-3 font-medium">Applicant</th>
              <th className="text-left px-4 py-3 font-medium">Company</th>
              <th className="text-left px-4 py-3 font-medium">Account Email</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Submitted</th>
              <th className="text-right px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground"><Loader2 className="w-4 h-4 inline mr-2 animate-spin" />Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No applications{filter ? ` with status ${filter}` : ""}.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                <td className="px-4 py-3 font-mono text-xs">#{r.id}</td>
                <td className="px-4 py-3">{(r.firstName || "") + " " + (r.lastName || "")}</td>
                <td className="px-4 py-3">{r.companyName || "—"}</td>
                <td className="px-4 py-3 text-xs">{r.accountEmail}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full border text-xs ${STATUS_COLORS[r.status]}`}>{r.status}</span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="outline" onClick={() => openDetail(r.id)}>View</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <DetailDrawer
          app={selected}
          onClose={() => setSelected(null)}
          onUpdate={(status, notes) => updateStatus(selected.id, status, notes)}
        />
      )}
    </div>
  );
}

function DetailDrawer({
  app,
  onClose,
  onUpdate,
}: {
  app: AppDetail;
  onClose: () => void;
  onUpdate: (status: "APPROVED" | "REJECTED" | "PENDING", notes: string) => void;
}) {
  const [notes, setNotes] = useState(app.reviewNotes || "");
  const fileUrl = (type: "pan" | "aadhar") =>
    `${getApiUrl(`/admin/distributor-applications/${app.id}/files/${type}`)}&auth=header`; // auth hint only; real fetch uses headers
  // Open file via fetch-with-headers to preserve auth
  async function viewFile(type: "pan" | "aadhar") {
    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token");
      const res = await fetch(getApiUrl(`/admin/distributor-applications/${app.id}/files/${type}`), {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) { toast.error("Could not load file"); return; }
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), "_blank");
    } catch { toast.error("Could not load file"); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-end" onClick={onClose}>
      <div className="bg-card w-full max-w-2xl h-full overflow-y-auto shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold">Application #{app.id}</h2>
            <p className="text-xs text-muted-foreground mt-1">Submitted {new Date(app.createdAt).toLocaleString()}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <Field label="Status">
            <span className={`inline-block px-2 py-0.5 rounded-full border text-xs ${STATUS_COLORS[app.status]}`}>{app.status}</span>
          </Field>
          <Field label="Linked User ID" value={app.linkedUserId ? `#${app.linkedUserId}` : "—"} />
          <Field label="Name" value={`${app.firstName || ""} ${app.lastName || ""}`.trim() || "—"} />
          <Field label="Account Email" value={app.accountEmail} />
          <Field label="WhatsApp" value={app.whatsapp || "—"} />
          <Field label="Recovery Email" value={app.recoveryEmail || "—"} />
          <Field label="Company" value={app.companyName || "—"} />
          <Field label="Team Size" value={app.teamSize || "—"} />
          <Field label="PAN" value={app.panNumber || "—"} />
          <Field label="Aadhar" value={app.aadharNumber || "—"} />
          <Field label="Address" full value={[app.addressLine1, app.addressLine2, app.area, app.city, app.state].filter(Boolean).join(", ") || "—"} />
          <Field label="Accountant Name" value={app.accountantName || "—"} />
          <Field label="Accountant Phone" value={app.accountantPhone || "—"} />
          <Field label="Accountant Email" value={app.accountantEmail || "—"} full />
        </div>

        <div className="mt-6 flex gap-3">
          <Button variant="outline" size="sm" disabled={!app.hasPanFile} onClick={() => viewFile("pan")}>
            <FileText className="w-4 h-4 mr-1" /> View PAN {app.hasPanFile ? "" : "(missing)"}
          </Button>
          <Button variant="outline" size="sm" disabled={!app.hasAadharFile} onClick={() => viewFile("aadhar")}>
            <FileText className="w-4 h-4 mr-1" /> View Aadhar {app.hasAadharFile ? "" : "(missing)"}
          </Button>
        </div>

        <div className="mt-8 border-t pt-6">
          <label className="text-sm font-medium">Review Notes</label>
          <textarea
            className="mt-2 w-full min-h-[100px] rounded border border-border bg-background p-3 text-sm"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Internal notes (reason for approval/rejection, follow-up items, etc.)"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => onUpdate("APPROVED", notes)} className="bg-emerald-600 hover:bg-emerald-700"><CheckCircle2 className="w-4 h-4 mr-1" />Approve</Button>
            <Button onClick={() => onUpdate("REJECTED", notes)} variant="destructive"><XCircle className="w-4 h-4 mr-1" />Reject</Button>
            <Button onClick={() => onUpdate("PENDING", notes)} variant="outline">Mark Pending</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, full, children }: { label: string; value?: string; full?: boolean; children?: React.ReactNode }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium mt-0.5 break-words">{children ?? value}</div>
    </div>
  );
}
