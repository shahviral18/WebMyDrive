import { useState, useEffect } from "react";
import { Loader2, Plus, Trash2, Tag, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { format } from "date-fns";

interface Voucher {
    id: number;
    code: string;
    value: number;
    status: "ACTIVE" | "USED" | "INACTIVE";
    description: string;
    expires_at: string | null;
    createdAt: string;
    usedByName?: string;
    usedByEmail?: string;
    used_at?: string;
    createdByName?: string;
}

export default function AdminVouchers() {
    const [vouchers, setVouchers] = useState<Voucher[]>([]);
    const [loading, setLoading] = useState(true);
    const [createOpen, setCreateOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    const [form, setForm] = useState({
        value: "",
        count: "1",
        description: "",
        expiresAt: "",
    });

    const fetchVouchers = async () => {
        try {
            const data = await api.get("/admin/vouchers");
            setVouchers(data.vouchers || []);
        } catch { /* non-fatal */ }
        setLoading(false);
    };

    useEffect(() => { fetchVouchers(); }, []);

    const handleCreate = async () => {
        if (!form.value || isNaN(Number(form.value)) || Number(form.value) <= 0) {
            return toast.error("Enter a valid value > 0");
        }
        setCreating(true);
        try {
            const res = await api.post("/admin/vouchers", {
                value: Number(form.value),
                count: Number(form.count) || 1,
                description: form.description,
                expiresAt: form.expiresAt || null,
            });
            toast.success(`${res.count} voucher(s) created`);
            setCreateOpen(false);
            setForm({ value: "", count: "1", description: "", expiresAt: "" });
            await fetchVouchers();
        } catch (e: any) {
            toast.error(e?.message || "Failed to create vouchers");
        } finally {
            setCreating(false);
        }
    };

    const handleDeactivate = async (id: number, code: string) => {
        if (!confirm(`Deactivate voucher ${code}?`)) return;
        try {
            await api.delete(`/admin/vouchers/${id}`);
            toast.success("Voucher deactivated");
            await fetchVouchers();
        } catch (e: any) {
            toast.error(e?.message || "Failed");
        }
    };

    const copyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    const statusColor: Record<string, string> = {
        ACTIVE: "bg-success/10 text-success",
        USED: "bg-muted text-muted-foreground",
        INACTIVE: "bg-destructive/10 text-destructive",
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Vouchers</h1>
                    <p className="text-sm text-muted-foreground mt-1">Generate and manage campaign voucher codes</p>
                </div>
                <Button onClick={() => setCreateOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Vouchers
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Tag className="w-4 h-4" />
                        All Vouchers
                    </CardTitle>
                    <CardDescription>
                        {vouchers.filter(v => v.status === "ACTIVE").length} active ·{" "}
                        {vouchers.filter(v => v.status === "USED").length} redeemed
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : vouchers.length === 0 ? (
                        <p className="text-center text-muted-foreground py-10 text-sm">No vouchers yet.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Code</TableHead>
                                    <TableHead>Value</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Expires</TableHead>
                                    <TableHead>Redeemed By</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {vouchers.map(v => (
                                    <TableRow key={v.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-sm font-semibold text-foreground">{v.code}</span>
                                                <button
                                                    onClick={() => copyCode(v.code)}
                                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                                >
                                                    {copiedCode === v.code ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                                                </button>
                                            </div>
                                            {v.description && <p className="text-xs text-muted-foreground mt-0.5">{v.description}</p>}
                                        </TableCell>
                                        <TableCell className="font-semibold text-foreground">₹{Number(v.value).toLocaleString("en-IN")}</TableCell>
                                        <TableCell>
                                            <Badge className={statusColor[v.status] || ""}>{v.status}</Badge>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {v.expires_at ? format(new Date(v.expires_at), "dd MMM yyyy") : "—"}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {v.usedByName || v.usedByEmail || "—"}
                                            {v.used_at && <span className="block text-muted-foreground/70">{format(new Date(v.used_at), "dd MMM yy")}</span>}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {v.createdAt ? format(new Date(v.createdAt), "dd MMM yyyy") : "—"}
                                        </TableCell>
                                        <TableCell>
                                            {v.status === "ACTIVE" && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDeactivate(v.id, v.code)}
                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Create Dialog */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create Vouchers</DialogTitle>
                        <DialogDescription>Generate one or more voucher codes for campaigns, lucky draws, or giveaways.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>Value (₹)</Label>
                                <Input
                                    type="number"
                                    placeholder="e.g. 500"
                                    value={form.value}
                                    onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Quantity</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={500}
                                    placeholder="1"
                                    value={form.count}
                                    onChange={e => setForm(f => ({ ...f, count: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Description (optional)</Label>
                            <Input
                                placeholder="e.g. Diwali Lucky Draw 2025"
                                value={form.description}
                                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Expiry Date (optional)</Label>
                            <Input
                                type="date"
                                value={form.expiresAt}
                                onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                            <Button onClick={handleCreate} disabled={creating}>
                                {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                Generate
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
