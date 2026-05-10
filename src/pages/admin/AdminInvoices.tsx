import { useState, useRef } from "react";
import { Loader2, Plus, Pencil, Trash2, FileText, Download, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, getApiUrl } from "@/lib/api";
import { format } from "date-fns";

interface Invoice {
    id: number;
    userId: number;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate?: string;
    paymentDate?: string;
    expiryDate?: string;
    renewalDate?: string;
    planName?: string;
    itemDetails?: string;
    baseAmount?: number;
    gstAmount?: number;
    totalAmount?: number;
    currency: string;
    status: string;
    source: string;
    notes?: string;
    hasPdf: number;
    createdAt: string;
}

interface UserResult {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
}

const emptyForm = {
    invoiceNumber: "",
    invoiceDate: "",
    dueDate: "",
    paymentDate: "",
    expiryDate: "",
    renewalDate: "",
    planName: "",
    itemDetails: "",
    baseAmount: "",
    gstAmount: "",
    totalAmount: "",
    currency: "INR",
    status: "PAID",
    notes: "",
};

export default function AdminInvoices() {
    const [searchEmail, setSearchEmail] = useState("");
    const [searching, setSearching] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserResult | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loadingInvoices, setLoadingInvoices] = useState(false);

    const [modalOpen, setModalOpen] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
    const [form, setForm] = useState({ ...emptyForm });
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [downloadingId, setDownloadingId] = useState<number | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const searchUser = async () => {
        const q = searchEmail.trim();
        if (!q) return;
        setSearching(true);
        try {
            const data = await api.get("/admin/users", { search: q, limit: 5 });
            const users: UserResult[] = data.users || [];
            if (users.length === 0) {
                toast.error("No user found with that email");
                return;
            }
            // Auto-select if exact match, otherwise pick first
            const exact = users.find(u => u.email.toLowerCase() === q.toLowerCase()) || users[0];
            await selectUser(exact);
        } catch {
            toast.error("Search failed");
        } finally {
            setSearching(false);
        }
    };

    const selectUser = async (user: UserResult) => {
        setSelectedUser(user);
        setLoadingInvoices(true);
        try {
            const data = await api.get(`/admin/invoices/user/${user.id}`);
            setInvoices(data.invoices || []);
        } catch {
            toast.error("Failed to load invoices");
        } finally {
            setLoadingInvoices(false);
        }
    };

    const openCreate = () => {
        setEditingInvoice(null);
        setForm({ ...emptyForm });
        setPdfFile(null);
        setModalOpen(true);
    };

    const openEdit = (inv: Invoice) => {
        setEditingInvoice(inv);
        setForm({
            invoiceNumber: inv.invoiceNumber,
            invoiceDate: inv.invoiceDate?.slice(0, 10) || "",
            dueDate: inv.dueDate?.slice(0, 10) || "",
            paymentDate: inv.paymentDate?.slice(0, 10) || "",
            expiryDate: inv.expiryDate?.slice(0, 10) || "",
            renewalDate: inv.renewalDate?.slice(0, 10) || "",
            planName: inv.planName || "",
            itemDetails: inv.itemDetails || "",
            baseAmount: inv.baseAmount != null ? String(inv.baseAmount) : "",
            gstAmount: inv.gstAmount != null ? String(inv.gstAmount) : "",
            totalAmount: inv.totalAmount != null ? String(inv.totalAmount) : "",
            currency: inv.currency || "INR",
            status: inv.status || "PAID",
            notes: inv.notes || "",
        });
        setPdfFile(null);
        setModalOpen(true);
    };

    const handleSave = async () => {
        if (!selectedUser) return;
        if (!form.invoiceNumber.trim()) return toast.error("Invoice number is required");
        if (!form.invoiceDate) return toast.error("Invoice date is required");

        setSaving(true);
        const token = localStorage.getItem("token") || "";

        try {
            const fd = new FormData();
            fd.append("userId", String(selectedUser.id));
            fd.append("invoiceNumber", form.invoiceNumber.trim());
            fd.append("invoiceDate", form.invoiceDate);
            if (form.dueDate)     fd.append("dueDate", form.dueDate);
            if (form.paymentDate) fd.append("paymentDate", form.paymentDate);
            if (form.expiryDate)  fd.append("expiryDate", form.expiryDate);
            if (form.renewalDate) fd.append("renewalDate", form.renewalDate);
            if (form.planName)    fd.append("planName", form.planName);
            if (form.itemDetails) fd.append("itemDetails", form.itemDetails);
            if (form.baseAmount)  fd.append("baseAmount", form.baseAmount);
            if (form.gstAmount)   fd.append("gstAmount", form.gstAmount);
            if (form.totalAmount) fd.append("totalAmount", form.totalAmount);
            fd.append("currency", form.currency);
            fd.append("status", form.status);
            if (form.notes) fd.append("notes", form.notes);
            if (pdfFile)    fd.append("pdfFile", pdfFile);

            let res: Response;
            if (editingInvoice) {
                res = await fetch(getApiUrl(`/admin/invoices/${editingInvoice.id}`), {
                    method: "PUT",
                    headers: { Authorization: `Bearer ${token}` },
                    body: fd,
                });
            } else {
                res = await fetch(getApiUrl("/admin/invoices"), {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                    body: fd,
                });
            }

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || "Save failed");

            toast.success(editingInvoice ? "Invoice updated" : "Invoice created");
            setModalOpen(false);
            await selectUser(selectedUser);
        } catch (e: any) {
            toast.error(e?.message || "Failed to save invoice");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (inv: Invoice) => {
        if (!confirm(`Delete invoice ${inv.invoiceNumber}? This cannot be undone.`)) return;
        setDeletingId(inv.id);
        try {
            await api.delete(`/admin/invoices/${inv.id}`);
            toast.success("Invoice deleted");
            setInvoices(prev => prev.filter(i => i.id !== inv.id));
        } catch {
            toast.error("Failed to delete invoice");
        } finally {
            setDeletingId(null);
        }
    };

    const handleDownload = async (inv: Invoice) => {
        setDownloadingId(inv.id);
        try {
            const token = localStorage.getItem("token") || "";
            const res = await fetch(getApiUrl(`/invoices/download/${inv.id}`), {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error("Download failed");
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Invoice_${inv.invoiceNumber}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch {
            toast.error("Could not download PDF");
        } finally {
            setDownloadingId(null);
        }
    };

    const f = (key: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm(prev => ({ ...prev, [key]: e.target.value }));

    return (
        <div className="space-y-6 p-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Invoice Management</h1>
                    <p className="text-muted-foreground text-sm mt-1">Attach historical invoices to user accounts</p>
                </div>

                {/* User search */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Find User</CardTitle>
                        <CardDescription>Search by email address</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-2 max-w-lg">
                            <Input
                                placeholder="user@example.com"
                                value={searchEmail}
                                onChange={e => setSearchEmail(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && searchUser()}
                            />
                            <Button onClick={searchUser} disabled={searching} className="shrink-0">
                                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-1" />}
                                Search
                            </Button>
                        </div>

                        {selectedUser && (
                            <div className="mt-4 flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20 max-w-lg">
                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
                                    {selectedUser.firstName?.[0]?.toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-foreground text-sm">{selectedUser.firstName} {selectedUser.lastName}</p>
                                    <p className="text-xs text-muted-foreground truncate">{selectedUser.email}</p>
                                </div>
                                <button onClick={() => { setSelectedUser(null); setInvoices([]); }} className="text-muted-foreground hover:text-foreground">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Invoice list */}
                {selectedUser && (
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <FileText className="w-4 h-4 text-primary" />
                                    Invoices for {selectedUser.firstName} {selectedUser.lastName}
                                </CardTitle>
                                <CardDescription>{invoices.length} invoice{invoices.length !== 1 ? "s" : ""}</CardDescription>
                            </div>
                            <Button onClick={openCreate} size="sm" className="gap-1">
                                <Plus className="w-4 h-4" />
                                Add Invoice
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {loadingInvoices ? (
                                <div className="flex justify-center py-10">
                                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : invoices.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 py-10 text-center">
                                    <FileText className="w-8 h-8 text-muted-foreground" />
                                    <p className="text-sm text-muted-foreground">No invoices yet. Click "Add Invoice" to attach one.</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Invoice #</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Plan</TableHead>
                                            <TableHead>Total</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {invoices.map(inv => (
                                            <TableRow key={inv.id}>
                                                <TableCell className="font-mono text-sm">{inv.invoiceNumber}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    {inv.invoiceDate ? format(new Date(inv.invoiceDate), "dd MMM yyyy") : "—"}
                                                </TableCell>
                                                <TableCell className="text-xs max-w-[120px] truncate">{inv.planName || "—"}</TableCell>
                                                <TableCell className="font-semibold text-sm">
                                                    {inv.totalAmount != null ? `₹${Number(inv.totalAmount).toLocaleString("en-IN")}` : "—"}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className={
                                                        inv.status === "PAID" ? "bg-success/10 text-success" :
                                                        inv.status === "CANCELLED" ? "bg-destructive/10 text-destructive" :
                                                        "bg-muted text-muted-foreground"
                                                    }>
                                                        {inv.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs">
                                                        {inv.source}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {inv.hasPdf ? (
                                                            <Button size="icon" variant="ghost" className="w-7 h-7" disabled={downloadingId === inv.id} onClick={() => handleDownload(inv)}>
                                                                {downloadingId === inv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                                                            </Button>
                                                        ) : null}
                                                        <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => openEdit(inv)}>
                                                            <Pencil className="w-3 h-3" />
                                                        </Button>
                                                        <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive hover:text-destructive" disabled={deletingId === inv.id} onClick={() => handleDelete(inv)}>
                                                            {deletingId === inv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                )}
            {/* Create / Edit modal */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingInvoice ? "Edit Invoice" : "Add Invoice"}</DialogTitle>
                    </DialogHeader>

                    <div className="grid grid-cols-2 gap-4 mt-2">
                        <div className="space-y-1">
                            <Label>Invoice Number <span className="text-destructive">*</span></Label>
                            <Input placeholder="WMD-2021-001" value={form.invoiceNumber} onChange={f("invoiceNumber")} />
                        </div>
                        <div className="space-y-1">
                            <Label>Invoice Date <span className="text-destructive">*</span></Label>
                            <Input type="date" value={form.invoiceDate} onChange={f("invoiceDate")} />
                        </div>
                        <div className="space-y-1">
                            <Label>Payment Date</Label>
                            <Input type="date" value={form.paymentDate} onChange={f("paymentDate")} />
                        </div>
                        <div className="space-y-1">
                            <Label>Due Date</Label>
                            <Input type="date" value={form.dueDate} onChange={f("dueDate")} />
                        </div>
                        <div className="space-y-1">
                            <Label>Plan Expiry Date</Label>
                            <Input type="date" value={form.expiryDate} onChange={f("expiryDate")} />
                        </div>
                        <div className="space-y-1">
                            <Label>Renewal Date</Label>
                            <Input type="date" value={form.renewalDate} onChange={f("renewalDate")} />
                        </div>
                        <div className="col-span-2 space-y-1">
                            <Label>Plan Name</Label>
                            <Input placeholder="Google Workspace Business Starter" value={form.planName} onChange={f("planName")} />
                        </div>
                        <div className="col-span-2 space-y-1">
                            <Label>Item Details</Label>
                            <Textarea placeholder="Describe the items / services billed" rows={3} value={form.itemDetails} onChange={f("itemDetails")} />
                        </div>
                        <div className="space-y-1">
                            <Label>Base Amount (₹)</Label>
                            <Input type="number" min="0" step="0.01" placeholder="0.00" value={form.baseAmount} onChange={f("baseAmount")} />
                        </div>
                        <div className="space-y-1">
                            <Label>GST Amount (₹)</Label>
                            <Input type="number" min="0" step="0.01" placeholder="0.00" value={form.gstAmount} onChange={f("gstAmount")} />
                        </div>
                        <div className="space-y-1">
                            <Label>Total Amount (₹)</Label>
                            <Input type="number" min="0" step="0.01" placeholder="0.00" value={form.totalAmount} onChange={f("totalAmount")} />
                        </div>
                        <div className="space-y-1">
                            <Label>Status</Label>
                            <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PAID">PAID</SelectItem>
                                    <SelectItem value="PENDING">PENDING</SelectItem>
                                    <SelectItem value="CANCELLED">CANCELLED</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="col-span-2 space-y-1">
                            <Label>Internal Notes</Label>
                            <Textarea placeholder="Optional admin notes (not visible to customer)" rows={2} value={form.notes} onChange={f("notes")} />
                        </div>
                        <div className="col-span-2 space-y-1">
                            <Label>PDF Invoice {editingInvoice ? "(leave blank to keep existing)" : ""}</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="application/pdf"
                                    className="cursor-pointer"
                                    onChange={e => setPdfFile(e.target.files?.[0] || null)}
                                />
                                {pdfFile && (
                                    <button onClick={() => { setPdfFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="text-muted-foreground hover:text-foreground shrink-0">
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">PDF only, max 10 MB</p>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            {editingInvoice ? "Save Changes" : "Create Invoice"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
