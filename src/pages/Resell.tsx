import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Lock, Upload, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ThemeSwitch } from "@/components/ui/theme-switch";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { getApiUrl } from "@/lib/api";

type Eligibility =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "ok"; planName?: string; storage?: number }
  | { status: "blocked"; reason: "no_account" | "no_plan" | "plan_too_small" | "invalid_email"; planName?: string };

export default function ResellPage() {
  const { isDark, toggleTheme } = useTheme();
  const [submitted, setSubmitted] = useState(false);

  const [accountEmail, setAccountEmail] = useState("");
  const [elig, setElig] = useState<Eligibility>({ status: "idle" });
  const [f, setF] = useState({
    firstName: "", lastName: "", whatsapp: "", recoveryEmail: "", companyName: "",
    entityType: "INDIVIDUAL",
    gstin: "",
    panNumber: "", aadharNumber: "",
    addressLine1: "", addressLine2: "", area: "", city: "", state: "",
    teamSize: "1-5",
    accountantName: "", accountantPhone: "", accountantEmail: "",
    bankAccountHolder: "", bankName: "", bankAccountNumber: "", bankAccountNumberConfirm: "",
    bankIfscCode: "", bankAccountType: "SAVINGS", upiId: "",
  });
  const [isGstRegistered, setIsGstRegistered] = useState(false);
  const [panFile, setPanFile] = useState<File | null>(null);
  const [aadharFile, setAadharFile] = useState<File | null>(null);
  const [gstFile, setGstFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function checkEligibility() {
    const email = accountEmail.trim().toLowerCase();
    if (!email) return;
    setElig({ status: "checking" });
    try {
      const res = await fetch(getApiUrl(`/distributor/check-eligibility?email=${encodeURIComponent(email)}`));
      const data = await res.json();
      if (data.eligible) setElig({ status: "ok", planName: data.planName, storage: data.storage });
      else setElig({ status: "blocked", reason: data.reason, planName: data.planName });
    } catch {
      setElig({ status: "blocked", reason: "no_account" });
    }
  }

  const gateOk = elig.status === "ok";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!gateOk) { toast.error("Please verify your WebMyDrive account first."); return; }
    if (!panFile || !aadharFile) { toast.error("PAN and Aadhar document uploads are required."); return; }
    if (panFile.size > 5 * 1024 * 1024 || aadharFile.size > 5 * 1024 * 1024) {
      toast.error("Each document must be 5 MB or less."); return;
    }
    if (isGstRegistered) {
      const gstin = f.gstin.trim().toUpperCase();
      if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) {
        toast.error("Please enter a valid GSTIN (e.g. 27AAPFU0939F1ZV)."); return;
      }
      if (!gstFile) { toast.error("GST certificate upload is required when GST registered."); return; }
      if (gstFile.size > 5 * 1024 * 1024) { toast.error("GST certificate must be 5 MB or less."); return; }
    }
    if (f.bankAccountNumber !== f.bankAccountNumberConfirm) {
      toast.error("Account numbers do not match."); return;
    }
    const ifscPattern = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscPattern.test(f.bankIfscCode.toUpperCase())) {
      toast.error("Please enter a valid IFSC code (e.g. HDFC0001234)."); return;
    }
    setIsSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("accountEmail", accountEmail.trim().toLowerCase());
      Object.entries(f).forEach(([k, v]) => {
        if (k === "bankAccountNumberConfirm") return; // UI-only field
        if (k === "bankIfscCode") { fd.append(k, v.toUpperCase()); return; }
        if (k === "gstin") { fd.append(k, isGstRegistered ? v.trim().toUpperCase() : ""); return; }
        fd.append(k, v);
      });
      fd.append("panFile", panFile);
      fd.append("aadharFile", aadharFile);
      if (isGstRegistered && gstFile) fd.append("gstFile", gstFile);
      const res = await fetch(getApiUrl("/distributor/apply"), { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Submission failed");
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message || "Submission failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center p-6", isDark ? "bg-slate-950" : "bg-[#f8fbff]")}>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl p-10 max-w-lg w-full text-center shadow-lg">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Application received</h2>
          <p className="text-slate-600 mb-6">
            Thanks for applying to become a WebMyDrive distributor. Your application is under review — our team will get in touch within <strong>72 hours</strong>.
          </p>
          <Button onClick={() => (window.location.href = "/")} className="h-11 px-6 bg-blue-500 hover:bg-blue-600">Back to home</Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen pb-20 font-sans", isDark ? "bg-slate-950" : "bg-[#f8fbff]")}>
      <div className="fixed top-4 right-4 z-50">
        <ThemeSwitch checked={isDark} onCheckedChange={toggleTheme} size={12} />
      </div>

      <div className="max-w-3xl mx-auto pt-12 px-4">
        <div className="mb-10 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">Become a WebMyDrive Distributor</h1>
          <p className="text-slate-600 max-w-xl mx-auto">
            Resell WebMyDrive plans to your customers. A 50 TB+ account is required to qualify.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* GATE */}
          <Card title="1. Your WebMyDrive account">
            <div className="flex gap-2">
              <Input
                type="email" placeholder="you@webmydrive.com"
                value={accountEmail}
                onChange={(e) => { setAccountEmail(e.target.value); setElig({ status: "idle" }); }}
                onBlur={checkEligibility}
                className="h-11 border-slate-200 rounded" required
              />
              <Button type="button" variant="outline" onClick={checkEligibility} className="h-11 shrink-0">Verify</Button>
            </div>
            <EligibilityBanner elig={elig} />
          </Card>

          {/* The rest only matters once gate is OK; but we render always and rely on submit gating. */}
          <fieldset disabled={!gateOk} className={cn(!gateOk && "opacity-60 pointer-events-none select-none")}>
            <div className="space-y-8">
              <Card title="2. Your details">
                <Grid2>
                  <Input required placeholder="First Name" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} className="h-11 border-slate-200 rounded" />
                  <Input required placeholder="Last Name" value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} className="h-11 border-slate-200 rounded" />
                  <Phone label="WhatsApp Number*" value={f.whatsapp} onChange={(v) => setF({ ...f, whatsapp: v })} required />
                  <Input type="email" placeholder="Recovery Email" value={f.recoveryEmail} onChange={(e) => setF({ ...f, recoveryEmail: e.target.value })} className="h-11 border-slate-200 rounded" />
                </Grid2>
              </Card>

              <Card title="3. Company">
                <div className="space-y-6">
                  <Grid2>
                    <Input required placeholder="Company Name" value={f.companyName} onChange={(e) => setF({ ...f, companyName: e.target.value })} className="h-11 border-slate-200 rounded" />
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">Entity Type *</label>
                      <select
                        required
                        className="flex h-11 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={f.entityType}
                        onChange={(e) => setF({ ...f, entityType: e.target.value })}
                      >
                        <option value="INDIVIDUAL">Individual / Freelancer</option>
                        <option value="PROPRIETOR">Sole Proprietor</option>
                        <option value="PARTNERSHIP">Partnership Firm</option>
                        <option value="LLP">LLP</option>
                        <option value="PVT_LTD">Private Limited / OPC</option>
                      </select>
                    </div>
                  </Grid2>
                  <Grid2>
                    <Input required placeholder="PAN Number" value={f.panNumber} onChange={(e) => setF({ ...f, panNumber: e.target.value.toUpperCase() })} className="h-11 border-slate-200 rounded uppercase" />
                    <Input required placeholder="Aadhar Number" value={f.aadharNumber} onChange={(e) => setF({ ...f, aadharNumber: e.target.value })} className="h-11 border-slate-200 rounded" />
                  </Grid2>
                  <Grid2>
                    <FileInput label="PAN Document (PDF/JPG/PNG, ≤ 5 MB)" file={panFile} onChange={setPanFile} />
                    <FileInput label="Aadhar Document (PDF/JPG/PNG, ≤ 5 MB)" file={aadharFile} onChange={setAadharFile} />
                  </Grid2>
                  {/* GST Section */}
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isGstRegistered}
                        onChange={(e) => setIsGstRegistered(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-500 focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-700 font-medium">I am GST registered</span>
                    </label>
                    {isGstRegistered && (
                      <Grid2>
                        <Input
                          placeholder="GSTIN (e.g. 27AAPFU0939F1ZV)"
                          value={f.gstin}
                          onChange={(e) => setF({ ...f, gstin: e.target.value.toUpperCase() })}
                          maxLength={15}
                          className="h-11 border-slate-200 rounded uppercase"
                        />
                        <FileInput label="GST Certificate (PDF/JPG/PNG, ≤ 5 MB)" file={gstFile} onChange={setGstFile} />
                      </Grid2>
                    )}
                  </div>
                </div>
              </Card>

              <Card title="4. Company address">
                <div className="space-y-6">
                  <Input required placeholder="Address Line 1" value={f.addressLine1} onChange={(e) => setF({ ...f, addressLine1: e.target.value })} className="h-11 border-slate-200 rounded" />
                  <Input placeholder="Address Line 2" value={f.addressLine2} onChange={(e) => setF({ ...f, addressLine2: e.target.value })} className="h-11 border-slate-200 rounded" />
                  <Grid2>
                    <Input placeholder="Area / Locality" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} className="h-11 border-slate-200 rounded" />
                    <Input required placeholder="City" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} className="h-11 border-slate-200 rounded" />
                  </Grid2>
                  <Input required placeholder="State" value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} className="h-11 border-slate-200 rounded" />
                </div>
              </Card>

              <Card title="5. Team">
                <select
                  className="flex h-11 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={f.teamSize}
                  onChange={(e) => setF({ ...f, teamSize: e.target.value })}
                >
                  <option value="1-5">1–5 people</option>
                  <option value="6-20">6–20 people</option>
                  <option value="21-50">21–50 people</option>
                  <option value="50+">50+ people</option>
                </select>
              </Card>

              <Card title="6. Accountant details">
                <Grid2>
                  <Input placeholder="Accountant Name" value={f.accountantName} onChange={(e) => setF({ ...f, accountantName: e.target.value })} className="h-11 border-slate-200 rounded" />
                  <Phone value={f.accountantPhone} onChange={(v) => setF({ ...f, accountantPhone: v })} label="Accountant Phone" />
                  <Input type="email" placeholder="Accountant Email" value={f.accountantEmail} onChange={(e) => setF({ ...f, accountantEmail: e.target.value })} className="h-11 border-slate-200 rounded md:col-span-2" />
                </Grid2>
              </Card>

              <Card title="7. Bank details">
                <p className="text-sm text-slate-500 mb-6">Used for commission payouts. All details are stored securely and reviewed manually.</p>
                <div className="space-y-6">
                  <Grid2>
                    <Input required placeholder="Account Holder Name" value={f.bankAccountHolder} onChange={(e) => setF({ ...f, bankAccountHolder: e.target.value })} className="h-11 border-slate-200 rounded" />
                    <Input required placeholder="Bank Name" value={f.bankName} onChange={(e) => setF({ ...f, bankName: e.target.value })} className="h-11 border-slate-200 rounded" />
                    <Input required placeholder="Account Number" value={f.bankAccountNumber} onChange={(e) => setF({ ...f, bankAccountNumber: e.target.value.replace(/\D/g, "") })} className="h-11 border-slate-200 rounded" />
                    <Input required placeholder="Confirm Account Number" value={f.bankAccountNumberConfirm} onChange={(e) => setF({ ...f, bankAccountNumberConfirm: e.target.value.replace(/\D/g, "") })} className="h-11 border-slate-200 rounded" />
                    <Input required placeholder="IFSC Code (e.g. HDFC0001234)" value={f.bankIfscCode} onChange={(e) => setF({ ...f, bankIfscCode: e.target.value.toUpperCase() })} maxLength={11} className="h-11 border-slate-200 rounded uppercase" />
                    <select
                      className="flex h-11 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={f.bankAccountType}
                      onChange={(e) => setF({ ...f, bankAccountType: e.target.value })}
                    >
                      <option value="SAVINGS">Savings Account</option>
                      <option value="CURRENT">Current Account</option>
                    </select>
                  </Grid2>
                  <Input placeholder="UPI ID (optional, e.g. name@bank)" value={f.upiId} onChange={(e) => setF({ ...f, upiId: e.target.value })} className="h-11 border-slate-200 rounded" />
                </div>
              </Card>
            </div>
          </fieldset>

          <div className="flex flex-col items-center gap-4 pt-4">
            <Button
              type="submit"
              disabled={!gateOk || isSubmitting}
              className="w-full md:w-72 h-12 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-md disabled:opacity-50"
            >
              {isSubmitting ? "Submitting…" : "Submit Application"}
            </Button>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Lock className="w-3 h-3" /> Your documents are stored securely and reviewed manually.
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
      <h2 className="text-lg font-bold text-slate-800 mb-6">{title}</h2>
      {children}
    </div>
  );
}
function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{children}</div>;
}
function Phone({ label, value, onChange, required }: { label?: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div className="flex gap-2">
      <div className="w-24 shrink-0">
        <select className="flex h-11 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option>+91</option>
        </select>
      </div>
      <Input
        placeholder={label ?? "Phone"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="h-11 border-slate-200 rounded w-full"
      />
    </div>
  );
}
function FileInput({ label, file, onChange }: { label: string; file: File | null; onChange: (f: File | null) => void }) {
  return (
    <label className="flex h-11 items-center gap-2 rounded border border-dashed border-slate-300 px-3 text-sm text-slate-600 cursor-pointer hover:border-blue-400 hover:text-blue-600 transition-colors">
      <Upload className="w-4 h-4 shrink-0" />
      <span className="truncate">{file ? file.name : label}</span>
      <input
        type="file" accept=".pdf,image/jpeg,image/png" className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}
function EligibilityBanner({ elig }: { elig: Eligibility }) {
  if (elig.status === "idle") return null;
  if (elig.status === "checking") return <div className="mt-3 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</div>;
  if (elig.status === "ok") return (
    <div className="mt-3 flex items-center gap-2 text-sm text-emerald-600">
      <CheckCircle2 className="w-4 h-4" /> Eligible — {elig.planName ? <span className="ml-1">on {elig.planName}.</span> : "plan qualifies."}
    </div>
  );
  const msg = {
    invalid_email: "Please enter a valid email address.",
    no_account:    "No WebMyDrive account found for this email.",
    no_plan:       "This account doesn't have an active plan.",
    plan_too_small: `This account's plan is too small. You need 50 TB or more${elig.planName ? ` (currently on ${elig.planName})` : ""}.`,
  }[elig.reason] ?? "Not eligible.";
  return (
    <div className="mt-3 rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
      <div className="flex items-start gap-2">
        <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
        <div className="flex-1">
          <div className="font-medium">{msg}</div>
          <div className="mt-2">
            <a
              href={`${import.meta.env.BASE_URL}subscribe/cloud-storage-premium`}
              target="_blank"
              rel="noopener"
              className="inline-block text-blue-600 hover:underline text-sm font-medium"
            >
              Subscribe to Cloud Storage – Premium (50 TB) →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
