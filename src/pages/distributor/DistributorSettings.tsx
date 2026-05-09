import { useState, useEffect } from "react";
import { Settings, Building2, CreditCard, ShieldCheck, Loader2, Save, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import DistributorLayout from "@/components/distributor/DistributorLayout";
import { toast } from "sonner";
import { api } from "@/lib/api";

export default function DistributorSettings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [bizInfo, setBizInfo] = useState<{
        name?: string; email?: string; entityType?: string;
        panNumber?: string; gstin?: string;
    }>({});

    const [bank, setBank] = useState({
        bankAccountHolder: "", bankName: "", bankAccountNumber: "",
        bankAccountNumberConfirm: "", bankIfscCode: "", bankAccountType: "SAVINGS", upiId: "",
    });

    const [kyc, setKyc] = useState({ hasPan: false, hasAadhar: false, hasGst: false });

    useEffect(() => {
        Promise.all([
            api.get("/distributor/dashboard"),
            api.get("/distributor/settings"),
        ]).then(([dash, settings]) => {
            const d = dash?.distributor ?? {};
            setBizInfo({
                name: d.name,
                email: d.email,
                entityType: d.entityType,
                panNumber: d.panNumber,
                gstin: d.gstin,
            });
            setBank({
                bankAccountHolder: d.bankAccountHolder ?? "",
                bankName: d.bankName ?? "",
                bankAccountNumber: d.bankAccountNumber ?? "",
                bankAccountNumberConfirm: "",
                bankIfscCode: d.bankIfscCode ?? "",
                bankAccountType: d.bankAccountType ?? "SAVINGS",
                upiId: d.upiId ?? "",
            });
            setKyc(settings?.kyc ?? { hasPan: false, hasAadhar: false, hasGst: false });
        }).catch(console.error).finally(() => setLoading(false));
    }, []);

    const entityLabels: Record<string, string> = {
        INDIVIDUAL: "Individual / Freelancer",
        PROPRIETOR: "Sole Proprietor",
        PARTNERSHIP: "Partnership Firm",
        LLP: "LLP",
        PVT_LTD: "Private Limited / OPC",
    };

    async function saveBank() {
        if (bank.bankAccountNumber !== bank.bankAccountNumberConfirm) {
            toast.error("Account numbers do not match."); return;
        }
        const ifscPattern = /^[A-Z]{4}0[A-Z0-9]{6}$/;
        if (!ifscPattern.test(bank.bankIfscCode.toUpperCase())) {
            toast.error("Invalid IFSC code format."); return;
        }
        setSaving(true);
        try {
            await api.patch("/distributor/settings", {
                bankAccountHolder: bank.bankAccountHolder,
                bankName: bank.bankName,
                bankAccountNumber: bank.bankAccountNumber,
                bankIfscCode: bank.bankIfscCode.toUpperCase(),
                bankAccountType: bank.bankAccountType,
                upiId: bank.upiId || null,
            });
            toast.success("Bank details updated successfully.");
            setBank(b => ({ ...b, bankAccountNumberConfirm: "" }));
        } catch {
            toast.error("Failed to save. Please try again.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <DistributorLayout>
            <div className="space-y-8 max-w-3xl">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <Settings className="w-6 h-6 text-primary" /> Settings
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">Manage your distributor account details.</p>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                ) : (
                    <>
                        {/* Business Info (read-only) */}
                        <Card className="border-border">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Building2 className="w-4 h-4 text-primary" /> Business Info
                                </CardTitle>
                                <CardDescription>Details from your distributor onboarding application.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {[
                                        { label: "Name", value: bizInfo.name },
                                        { label: "Email", value: bizInfo.email },
                                        { label: "Entity Type", value: entityLabels[bizInfo.entityType ?? ""] ?? bizInfo.entityType },
                                        { label: "PAN Number", value: bizInfo.panNumber },
                                        { label: "GSTIN", value: bizInfo.gstin ?? "Not provided" },
                                    ].map(({ label, value }) => (
                                        <div key={label}>
                                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
                                            <p className="text-sm font-medium text-foreground">{value || "—"}</p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* KYC Status */}
                        <Card className="border-border">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <ShieldCheck className="w-4 h-4 text-primary" /> KYC Status
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-3">
                                    {[
                                        { label: "PAN", verified: kyc.hasPan },
                                        { label: "Aadhaar", verified: kyc.hasAadhar },
                                        { label: "GST Certificate", verified: kyc.hasGst },
                                    ].map(({ label, verified }) => (
                                        <div key={label} className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium ${verified ? "border-success/30 bg-success/10 text-success" : "border-border bg-surface-2 text-muted-foreground"}`}>
                                            {verified ? <CheckCircle className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border-2 border-current opacity-40" />}
                                            {label} {verified ? "✓" : "(not on file)"}
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Bank Details (editable) */}
                        <Card className="border-border">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <CreditCard className="w-4 h-4 text-primary" /> Bank Details
                                </CardTitle>
                                <CardDescription>Used for commission payouts. Update if your banking details change.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label>Account Holder Name *</Label>
                                        <Input value={bank.bankAccountHolder} onChange={e => setBank(b => ({ ...b, bankAccountHolder: e.target.value }))} className="border-border" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Bank Name *</Label>
                                        <Input value={bank.bankName} onChange={e => setBank(b => ({ ...b, bankName: e.target.value }))} className="border-border" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Account Number *</Label>
                                        <Input value={bank.bankAccountNumber} onChange={e => setBank(b => ({ ...b, bankAccountNumber: e.target.value.replace(/\D/g, "") }))} className="border-border" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Confirm Account Number *</Label>
                                        <Input value={bank.bankAccountNumberConfirm} onChange={e => setBank(b => ({ ...b, bankAccountNumberConfirm: e.target.value.replace(/\D/g, "") }))} className="border-border" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>IFSC Code *</Label>
                                        <Input value={bank.bankIfscCode} onChange={e => setBank(b => ({ ...b, bankIfscCode: e.target.value.toUpperCase() }))} maxLength={11} className="border-border uppercase" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Account Type</Label>
                                        <select
                                            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                            value={bank.bankAccountType}
                                            onChange={e => setBank(b => ({ ...b, bankAccountType: e.target.value }))}
                                        >
                                            <option value="SAVINGS">Savings Account</option>
                                            <option value="CURRENT">Current Account</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>UPI ID (optional)</Label>
                                    <Input placeholder="e.g. name@bank" value={bank.upiId} onChange={e => setBank(b => ({ ...b, upiId: e.target.value }))} className="border-border max-w-sm" />
                                </div>
                                <Button onClick={saveBank} disabled={saving} className="gap-2 bg-primary hover:bg-primary/90">
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    {saving ? "Saving…" : "Save Bank Details"}
                                </Button>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </DistributorLayout>
    );
}
