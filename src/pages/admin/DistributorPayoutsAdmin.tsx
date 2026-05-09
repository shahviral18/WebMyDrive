import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Clock, FileText, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { api, getApiUrl } from "@/lib/api";

const statusCfg: Record<string, { label: string; cls: string }> = {
    PENDING:   { label: "Pending",   cls: "bg-warning/10 text-warning border-warning/30" },
    COMPLETED: { label: "Completed", cls: "bg-success/10 text-success border-success/30" },
    FAILED:    { label: "Failed",    cls: "bg-danger/10 text-danger border-danger/30" },
};

export default function DistributorPayoutsAdmin() {
    const [payouts, setPayouts] = useState<any[]>([]);
    const [statusFilter, setStatusFilter] = useState("PENDING");
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<number | null>(null);
    const [utrInputs, setUtrInputs] = useState<Record<number, string>>({});
    const [noteInputs, setNoteInputs] = useState<Record<number, string>>({});
    const [saving, setSaving] = useState<number | null>(null);

    function load(status: string) {
        setLoading(true);
        api.get(`/admin/distributor-payouts?status=${status}`)
            .then(d => setPayouts(d?.payouts ?? []))
            .catch(console.error)
            .finally(() => setLoading(false));
    }

    useEffect(() => { load(statusFilter); }, [statusFilter]);

    async function updatePayout(id: number, status: "COMPLETED" | "FAILED") {
        setSaving(id);
        try {
            await api.patch(`/admin/distributor-payouts/${id}`, {
                status,
                utrNumber: utrInputs[id] || null,
                adminNote: noteInputs[id] || null,
            });
            toast.success(`Payout ${id} marked ${status}.`);
            load(statusFilter);
            setExpanded(null);
        } catch {
            toast.error("Failed to update payout.");
        } finally {
            setSaving(null);
        }
    }

    function viewInvoice(id: number) {
        const token = localStorage.getItem("token") || "";
        window.open(`${getApiUrl(`/admin/distributor-payouts/${id}/invoice`)}?token=${token}`, "_blank");
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-foreground">Distributor Payouts</h2>
                <div className="flex gap-2">
                    {["PENDING", "COMPLETED", "FAILED"].map(s => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
                                statusFilter === s
                                    ? "bg-primary text-white border-primary"
                                    : "border-border text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            <Card className="border-border">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-surface-2 hover:bg-surface-2">
                                <TableHead>ID</TableHead>
                                <TableHead>Distributor</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Invoice</TableHead>
                                <TableHead>UTR</TableHead>
                                <TableHead>Requested</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={8} className="text-center py-10 text-sm text-muted-foreground">Loading…</TableCell></TableRow>
                            ) : payouts.length === 0 ? (
                                <TableRow><TableCell colSpan={8} className="text-center py-10 text-sm text-muted-foreground">No {statusFilter.toLowerCase()} payouts.</TableCell></TableRow>
                            ) : payouts.map(p => {
                                const cfg = statusCfg[p.status] ?? statusCfg.PENDING;
                                const isOpen = expanded === p.id;
                                return (
                                    <>
                                        <TableRow key={p.id} className="hover:bg-surface-2">
                                            <TableCell className="font-mono text-xs text-muted-foreground">#{p.id}</TableCell>
                                            <TableCell>
                                                <p className="text-sm font-medium text-foreground">{p.distributorName}</p>
                                                <p className="text-xs text-muted-foreground">{p.distributorEmail}</p>
                                            </TableCell>
                                            <TableCell className="font-semibold text-foreground">₹{Math.abs(parseFloat(p.amount)).toLocaleString()}</TableCell>
                                            <TableCell>
                                                {p.hasInvoice ? (
                                                    <Button variant="ghost" size="sm" className="gap-1.5 text-primary h-7" onClick={() => viewInvoice(p.id)}>
                                                        <FileText className="w-3.5 h-3.5" /> View
                                                    </Button>
                                                ) : <span className="text-xs text-muted-foreground">—</span>}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground">{p.utrNumber ?? "—"}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={`text-xs ${cfg.cls}`}>{cfg.label}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                {p.status === "PENDING" && (
                                                    <button onClick={() => setExpanded(isOpen ? null : p.id)} className="text-muted-foreground hover:text-primary">
                                                        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                                                    </button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                        {isOpen && (
                                            <TableRow key={`${p.id}-panel`} className="bg-surface-2/60">
                                                <TableCell colSpan={8} className="py-4 px-6">
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                                        <div className="space-y-1.5">
                                                            <Label className="text-xs">UTR / Transaction Reference</Label>
                                                            <Input
                                                                placeholder="Enter UTR number"
                                                                value={utrInputs[p.id] ?? ""}
                                                                onChange={e => setUtrInputs(u => ({ ...u, [p.id]: e.target.value }))}
                                                                className="h-9 text-sm border-border"
                                                            />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <Label className="text-xs">Admin Note (optional)</Label>
                                                            <Input
                                                                placeholder="Internal note"
                                                                value={noteInputs[p.id] ?? ""}
                                                                onChange={e => setNoteInputs(n => ({ ...n, [p.id]: e.target.value }))}
                                                                className="h-9 text-sm border-border"
                                                            />
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <Button
                                                                size="sm"
                                                                className="flex-1 bg-success hover:bg-success/90 text-white gap-1.5"
                                                                disabled={saving === p.id}
                                                                onClick={() => updatePayout(p.id, "COMPLETED")}
                                                            >
                                                                <CheckCircle className="w-3.5 h-3.5" /> Approve
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="flex-1 border-danger text-danger hover:bg-danger/10 gap-1.5"
                                                                disabled={saving === p.id}
                                                                onClick={() => updatePayout(p.id, "FAILED")}
                                                            >
                                                                <XCircle className="w-3.5 h-3.5" /> Reject
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
