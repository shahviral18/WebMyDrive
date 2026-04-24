import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
    User, Lock, Bell, Loader2, Save, HardDrive,
    Monitor, Phone, Shield, Briefcase,
    CheckCircle2, AlertCircle, Info, FolderOpen,
    Clock, MapPin, ShieldAlert, ShieldCheck, ExternalLink,
} from "lucide-react";
import UserLayout from "@/components/user/UserLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useUser } from "@/contexts/UserContext";
import { api } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

// ── Helpers ───────────────────────────────────────────────────────────────────

function splitName(full?: string): { firstName: string; lastName: string } {
    const parts = (full || "").trim().split(/\s+/);
    return { firstName: parts[0] || "", lastName: parts.slice(1).join(" ") };
}

function formatBytes(bytes: number): string {
    if (!bytes) return "0 B";
    const gb = bytes / (1024 ** 3);
    if (gb >= 1) return gb.toFixed(2) + " GB";
    const mb = bytes / (1024 ** 2);
    if (mb >= 1) return mb.toFixed(1) + " MB";
    return (bytes / 1024).toFixed(0) + " KB";
}

function formatDate(dt: string): string {
    try {
        return new Date(dt).toLocaleString("en-IN", {
            year: "numeric", month: "short", day: "numeric",
            hour: "2-digit", minute: "2-digit",
        });
    } catch { return dt; }
}

// ── Storage Ring ──────────────────────────────────────────────────────────────

function StorageRing({ used, limit }: { used: number; limit: number }) {
    const pct = limit > 0 ? Math.min(used / limit, 1) : 0;
    const r = 52;
    const circ = 2 * Math.PI * r;
    const dash = pct * circ;
    const color = pct > 0.9 ? "#ef4444" : pct > 0.7 ? "#f59e0b" : "#3b82f6";

    return (
        <div className="flex flex-col items-center gap-3">
            <svg width="128" height="128" className="-rotate-90">
                <circle cx="64" cy="64" r={r} fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/30" />
                <circle
                    cx="64" cy="64" r={r} fill="none"
                    stroke={color} strokeWidth="10"
                    strokeDasharray={`${dash} ${circ}`}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dasharray 0.5s ease" }}
                />
            </svg>
            <div className="text-center -mt-2">
                <p className="text-lg font-bold text-foreground">{formatBytes(used)}</p>
                <p className="text-xs text-muted-foreground">of {limit > 0 ? formatBytes(limit) : "—"}</p>
            </div>
        </div>
    );
}

// ── Password target segment ───────────────────────────────────────────────────

type PwTarget = "portal" | "google" | "both";

function TargetPicker({ value, onChange }: { value: PwTarget; onChange: (v: PwTarget) => void }) {
    const opts: { v: PwTarget; label: string; desc: string }[] = [
        { v: "portal", label: "Portal only",    desc: "WebMyDrive login password" },
        { v: "google", label: "Google only",    desc: "@webmydrive.com account" },
        { v: "both",   label: "Both (keep same)", desc: "Sync both to same password" },
    ];
    return (
        <div className="grid sm:grid-cols-3 gap-2">
            {opts.map(o => (
                <button
                    key={o.v}
                    type="button"
                    onClick={() => onChange(o.v)}
                    className={[
                        "rounded-lg border p-3 text-left transition-colors",
                        value === o.v
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border hover:border-primary/40",
                    ].join(" ")}
                >
                    <p className="text-sm font-medium text-foreground">{o.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{o.desc}</p>
                </button>
            ))}
        </div>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function UserSettings() {
    const { user, updateUser } = useUser();

    // ── Profile tab ───────────────────────────────────────────────────────────
    const [nameLoading, setNameLoading] = useState(false);
    const [contactLoading, setContactLoading] = useState(false);
    const [recoveryLoading, setRecoveryLoading] = useState(false);

    const init = splitName(user.name);
    const [firstName, setFirstName] = useState(init.firstName);
    const [lastName,  setLastName]  = useState(init.lastName);
    const [phone,     setPhone]     = useState(user.phone    || "");
    const [country,   setCountry]   = useState(user.country  || "");
    const [timezone,  setTimezone]  = useState(user.timezone || "");
    const [recoveryEmail, setRecoveryEmail] = useState(user.recoveryEmail || "");
    const [recoveryPhone, setRecoveryPhone] = useState(user.recoveryPhone || "");

    useEffect(() => {
        const n = splitName(user.name);
        setFirstName(n.firstName);
        setLastName(n.lastName);
        setPhone(user.phone    || "");
        setCountry(user.country  || "");
        setTimezone(user.timezone || "");
        setRecoveryEmail(user.recoveryEmail || "");
        setRecoveryPhone(user.recoveryPhone || "");
    }, [user.name, user.phone, user.country, user.timezone, user.recoveryEmail, user.recoveryPhone]);

    async function saveName(e: React.FormEvent) {
        e.preventDefault();
        setNameLoading(true);
        try {
            await api.put("/user/profile/name", { firstName, lastName });
            updateUser({ name: `${firstName} ${lastName}`.trim(), firstName, lastName });
            toast.success("Name updated");
        } catch (err: any) { toast.error(err.message || "Failed"); }
        finally { setNameLoading(false); }
    }

    async function saveContact(e: React.FormEvent) {
        e.preventDefault();
        setContactLoading(true);
        try {
            await api.put("/user/profile/contact", { phone, country, timezone });
            updateUser({ phone, country, timezone });
            toast.success("Contact info updated");
        } catch (err: any) { toast.error(err.message || "Failed"); }
        finally { setContactLoading(false); }
    }

    async function saveRecovery(e: React.FormEvent) {
        e.preventDefault();
        setRecoveryLoading(true);
        try {
            await api.put("/user/profile/recovery", { recoveryEmail, recoveryPhone });
            updateUser({ recoveryEmail, recoveryPhone });
            toast.success("Recovery info updated");
        } catch (err: any) { toast.error(err.message || "Failed"); }
        finally { setRecoveryLoading(false); }
    }

    // ── Security tab ──────────────────────────────────────────────────────────
    const [pwTarget, setPwTarget] = useState<PwTarget>("portal");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword,     setNewPassword]     = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordLoading, setPasswordLoading] = useState(false);

    async function handleChangePassword(e: React.FormEvent) {
        e.preventDefault();
        if (newPassword !== confirmPassword) { toast.error("Passwords do not match"); return; }
        if (newPassword.length < 8)          { toast.error("Password must be at least 8 characters"); return; }
        setPasswordLoading(true);
        try {
            const res = await api.post("/auth/change-password", {
                currentPassword,
                newPassword,
                target: pwTarget,
            });
            const parts: string[] = [];
            if (res.portalUpdated) parts.push("portal");
            if (res.googleUpdated) parts.push("Google Workspace");
            toast.success(`Password updated for: ${parts.join(" & ") || "nothing"}`);
            if (!res.googleUpdated && (pwTarget === "google" || pwTarget === "both")) {
                toast.warning("Google Workspace password could not be updated — your workspace may not be provisioned yet.");
            }
            setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
        } catch (err: any) { toast.error(err.message || "Failed"); }
        finally { setPasswordLoading(false); }
    }

    // Login history — real data from AuditLog
    const [loginHistory, setLoginHistory] = useState<{ ip: string; date: string }[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    useEffect(() => {
        setHistoryLoading(true);
        api.get("/user/login-history")
            .then(d => setLoginHistory(d.history ?? []))
            .catch(() => setLoginHistory([]))
            .finally(() => setHistoryLoading(false));
    }, []);

    // Sessions — real data from UserSession table
    const [sessions, setSessions] = useState<{
        id: number; ip: string; device: string; createdAt: string; current: boolean;
    }[]>([]);
    const [sessionsLoading, setSessionsLoading] = useState(false);

    useEffect(() => {
        setSessionsLoading(true);
        api.get("/user/sessions")
            .then(d => setSessions(d.sessions ?? []))
            .catch(() => setSessions([]))
            .finally(() => setSessionsLoading(false));
    }, []);

    async function revokeSession(id: number) {
        try {
            await api.delete(`/user/sessions/${id}`);
            setSessions(prev => prev.filter(s => s.id !== id));
            toast.success("Session revoked");
        } catch { toast.error("Could not revoke session"); }
    }

    // ── Storage tab ───────────────────────────────────────────────────────────
    const [storageLoading, setStorageLoading] = useState(false);
    const [storageData, setStorageData] = useState<{
        used: number; limit: number; source?: string;
        breakdown: { drive: number; driveTrash: number; mail: number };
    } | null>(null);

    useEffect(() => {
        setStorageLoading(true);
        api.get("/user/storage")
            .then(d => setStorageData(d))
            .catch(() => setStorageData({ used: 0, limit: 0, breakdown: { drive: 0, driveTrash: 0, mail: 0 } }))
            .finally(() => setStorageLoading(false));
    }, []);

    // ── 2FA Status ────────────────────────────────────────────────────────────
    const [twoFAEnabled, setTwoFAEnabled] = useState<boolean | null>(null);
    const [twoFAProvisioned, setTwoFAProvisioned] = useState(false);

    useEffect(() => {
        api.get("/user/workspace-security")
            .then(d => {
                setTwoFAProvisioned(d.provisioned ?? false);
                setTwoFAEnabled(d.twoFAEnabled ?? null);
            })
            .catch(() => { setTwoFAProvisioned(false); setTwoFAEnabled(null); });
    }, []);

    // ── Workspace tab ─────────────────────────────────────────────────────────
    const [drivesLoading, setDrivesLoading] = useState(false);
    const [sharedDrives, setSharedDrives] = useState<{ id: string; name: string; createdTime: string; fileCount: number; storageUsed: number }[]>([]);
    const [drivesProvisioned, setDrivesProvisioned] = useState(true);

    useEffect(() => {
        setDrivesLoading(true);
        api.get("/user/shared-drives")
            .then(d => {
                setSharedDrives(d.drives ?? []);
                setDrivesProvisioned(d.provisioned ?? false);
            })
            .catch(() => { setSharedDrives([]); setDrivesProvisioned(false); })
            .finally(() => setDrivesLoading(false));
    }, []);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <UserLayout>
            <div className="space-y-6 max-w-4xl mx-auto">
                <h1 className="text-2xl font-bold text-foreground">Account Settings</h1>

                <Tabs defaultValue="profile" className="w-full">
                    <TabsList className="mb-4 bg-surface-3 p-1 rounded-lg flex-wrap h-auto gap-1">
                        <TabsTrigger value="profile"       className="gap-1.5 px-4 py-2"><User      className="w-4 h-4" /> Profile</TabsTrigger>
                        <TabsTrigger value="security"      className="gap-1.5 px-4 py-2"><Lock      className="w-4 h-4" /> Security</TabsTrigger>
                        <TabsTrigger value="storage"       className="gap-1.5 px-4 py-2"><HardDrive className="w-4 h-4" /> Storage</TabsTrigger>
                        <TabsTrigger value="workspace"     className="gap-1.5 px-4 py-2"><Briefcase className="w-4 h-4" /> Workspace</TabsTrigger>
                        <TabsTrigger value="notifications" className="gap-1.5 px-4 py-2"><Bell      className="w-4 h-4" /> Notifications</TabsTrigger>
                    </TabsList>

                    {/* ── Profile ─────────────────────────────────────────── */}
                    <TabsContent value="profile" className="space-y-4">
                        <Card className="border-border shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><User className="w-4 h-4" /> Change Name</CardTitle>
                                <CardDescription>Update your display name.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={saveName} className="space-y-4">
                                    <div className="grid sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="firstName">First Name</Label>
                                            <Input id="firstName" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="lastName">Last Name</Label>
                                            <Input id="lastName" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" />
                                        </div>
                                    </div>
                                    <Button type="submit" size="sm" disabled={nameLoading}>
                                        {nameLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Save Name
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>

                        <Card className="border-border shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Phone className="w-4 h-4" /> Contact Info</CardTitle>
                                <CardDescription>Phone number, country, and timezone.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={saveContact} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="phone">Phone Number</Label>
                                        <Input id="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" />
                                    </div>
                                    <div className="grid sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="country">Country</Label>
                                            <Input id="country" value={country} onChange={e => setCountry(e.target.value)} placeholder="e.g. India" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="timezone">Timezone</Label>
                                            <Input id="timezone" value={timezone} onChange={e => setTimezone(e.target.value)} placeholder="e.g. Asia/Kolkata" />
                                        </div>
                                    </div>
                                    <Button type="submit" size="sm" disabled={contactLoading}>
                                        {contactLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Save Contact
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>

                        <Card className="border-border shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Shield className="w-4 h-4" /> Recovery Info</CardTitle>
                                <CardDescription>Used to recover your account if you lose access.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={saveRecovery} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="recoveryEmail">Recovery Email</Label>
                                        <Input id="recoveryEmail" type="email" value={recoveryEmail} onChange={e => setRecoveryEmail(e.target.value)} placeholder="backup@example.com" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="recoveryPhone">Recovery Phone</Label>
                                        <Input id="recoveryPhone" type="tel" value={recoveryPhone} onChange={e => setRecoveryPhone(e.target.value)} placeholder="+91 98765 43210" />
                                    </div>
                                    <Button type="submit" size="sm" disabled={recoveryLoading}>
                                        {recoveryLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Save Recovery
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ── Security ────────────────────────────────────────── */}
                    <TabsContent value="security" className="space-y-4">

                        {/* Google Account 2FA Status */}
                        {twoFAProvisioned && (
                            <Card className={twoFAEnabled === false
                                ? "border-orange-400/60 dark:border-orange-500/50 bg-orange-50/60 dark:bg-orange-950/20 shadow-sm"
                                : twoFAEnabled === true
                                    ? "border-emerald-400/50 dark:border-emerald-600/40 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm"
                                    : "border-border shadow-sm"
                            }>
                                <CardHeader className="pb-3">
                                    <CardTitle className={`flex items-center gap-2 text-sm ${twoFAEnabled === false ? "text-orange-700 dark:text-orange-400" : twoFAEnabled === true ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"}`}>
                                        {twoFAEnabled === true
                                            ? <ShieldCheck className="w-4 h-4" />
                                            : <ShieldAlert className="w-4 h-4" />
                                        }
                                        Google Account — 2-Step Verification
                                    </CardTitle>
                                    <CardDescription>
                                        {twoFAEnabled === null ? "Checking status…" : twoFAEnabled ? "Your Google Workspace account is protected with 2-Step Verification." : "Your Google Workspace account does not have 2-Step Verification enabled."}
                                    </CardDescription>
                                </CardHeader>
                                {twoFAEnabled === false && (
                                    <CardContent className="pt-0">
                                        <a
                                            href="https://myaccount.google.com/signinoptions/two-step-verification"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors"
                                        >
                                            <ShieldAlert className="w-4 h-4" /> Enable 2-Step Verification <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                    </CardContent>
                                )}
                            </Card>
                        )}

                        {/* Change Password */}
                        <Card className="border-border shadow-sm">
                            <CardHeader>
                                <CardTitle>Change Password</CardTitle>
                                <CardDescription>Choose which account(s) to update.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleChangePassword} className="space-y-5">
                                    {/* Target picker */}
                                    <div className="space-y-2">
                                        <Label>Update password for</Label>
                                        <TargetPicker value={pwTarget} onChange={setPwTarget} />
                                    </div>

                                    {/* Recommendation banner */}
                                    <div className={[
                                        "flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm",
                                        pwTarget === "both"
                                            ? "border-amber-400/40 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
                                            : "border-blue-400/30 bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300",
                                    ].join(" ")}>
                                        {pwTarget === "both"
                                            ? <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                            : <Info className="w-4 h-4 mt-0.5 shrink-0" />
                                        }
                                        <span>
                                            {pwTarget === "both"
                                                ? "Using the same password for both accounts reduces security. We recommend keeping them separate."
                                                : "Tip: Use a different password for your Portal and Google Workspace account for better security."
                                            }
                                        </span>
                                    </div>

                                    <Separator />

                                    <div className="space-y-2">
                                        <Label htmlFor="currentPassword">Current Portal Password</Label>
                                        <Input id="currentPassword" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="newPassword">New Password</Label>
                                        <Input id="newPassword" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="confirmPassword">Confirm Password</Label>
                                        <Input
                                            id="confirmPassword" type="password"
                                            value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                                            required
                                            className={confirmPassword && confirmPassword !== newPassword ? "border-red-400" : ""}
                                        />
                                        {confirmPassword && confirmPassword !== newPassword && (
                                            <p className="text-xs text-red-500 flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3" /> Passwords do not match
                                            </p>
                                        )}
                                        {confirmPassword && confirmPassword === newPassword && (
                                            <p className="text-xs text-emerald-600 flex items-center gap-1">
                                                <CheckCircle2 className="w-3 h-3" /> Passwords match
                                            </p>
                                        )}
                                    </div>
                                    <Button type="submit" size="sm" disabled={passwordLoading}>
                                        {passwordLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Lock className="w-4 h-4 mr-1" />} Change Password
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>

                        {/* Login History */}
                        <Card className="border-border shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Clock className="w-4 h-4" /> Login History
                                </CardTitle>
                                <CardDescription>Recent sign-in activity on your account.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {historyLoading ? (
                                    <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                                ) : loginHistory.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-6">No login history available.</p>
                                ) : (
                                    <div className="rounded border border-border divide-y divide-border text-sm">
                                        {loginHistory.map((row, i) => (
                                            <div key={i} className="flex items-center justify-between px-4 py-2.5">
                                                <div className="flex items-center gap-2">
                                                    <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                                    <p className="font-medium text-foreground">{row.ip}</p>
                                                </div>
                                                <p className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(row.date)}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Active Sessions */}
                        <Card className="border-border shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Monitor className="w-4 h-4" /> Active Sessions
                                </CardTitle>
                                <CardDescription>Devices signed in to your account in the last 7 days.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {sessionsLoading ? (
                                    <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                                ) : sessions.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-6">No active sessions found.</p>
                                ) : sessions.map(s => (
                                    <div key={s.id} className="flex items-center justify-between rounded border border-border px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <Monitor className="w-4 h-4 text-muted-foreground" />
                                            <div>
                                                <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                                                    {s.device}
                                                    {s.current && (
                                                        <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 px-1.5 py-0.5 rounded-full font-semibold">Current</span>
                                                    )}
                                                </p>
                                                <p className="text-xs text-muted-foreground">{s.ip} · {formatDate(s.createdAt)}</p>
                                            </div>
                                        </div>
                                        {!s.current && (
                                            <Button size="sm" variant="outline" className="text-xs h-7 px-2" onClick={() => revokeSession(s.id)}>
                                                Revoke
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ── Storage ─────────────────────────────────────────── */}
                    <TabsContent value="storage" className="space-y-4">
                        <Card className="border-border shadow-sm">
                            <CardHeader>
                                <CardTitle>Storage Usage</CardTitle>
                                <CardDescription>
                                    Current storage across your Google Workspace.
                                    {storageData?.source === "google" && (
                                        <span className="ml-2 text-emerald-600 dark:text-emerald-400 text-xs font-medium">● Live data</span>
                                    )}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {storageLoading ? (
                                    <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                                ) : (
                                    <div className="flex flex-col sm:flex-row items-center gap-10">
                                        <StorageRing used={storageData?.used ?? 0} limit={storageData?.limit ?? 0} />
                                        <div className="grid grid-cols-3 gap-4 flex-1 w-full">
                                            {[
                                                { label: "Drive Files", icon: "📁", bytes: storageData?.breakdown?.drive ?? 0 },
                                                { label: "Mail & Photos", icon: "📧", bytes: storageData?.breakdown?.mail ?? 0 },
                                                { label: "Trash",       icon: "🗑️", bytes: storageData?.breakdown?.driveTrash ?? 0 },
                                            ].map(item => (
                                                <div key={item.label} className="rounded-lg border border-border bg-surface-2 p-4 text-center">
                                                    <div className="text-2xl mb-1">{item.icon}</div>
                                                    <p className="text-xs text-muted-foreground">{item.label}</p>
                                                    <p className="text-sm font-semibold text-foreground mt-0.5">{formatBytes(item.bytes)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {!storageLoading && storageData?.source === "db" && (
                                    <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
                                        <Info className="w-3 h-3" />
                                        Live storage data not available yet — shown after your Google Workspace is fully provisioned.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ── Workspace ───────────────────────────────────────── */}
                    <TabsContent value="workspace" className="space-y-4">
                        <Card className="border-border shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <FolderOpen className="w-4 h-4" /> Shared Drives
                                </CardTitle>
                                <CardDescription>Shared drives you have access to in your Google Workspace.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {drivesLoading ? (
                                    <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                                ) : !drivesProvisioned ? (
                                    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                                        <div className="w-12 h-12 rounded-xl bg-muted/40 border border-border flex items-center justify-center text-xl">🔗</div>
                                        <p className="text-sm font-medium text-foreground">Workspace not provisioned</p>
                                        <p className="text-xs text-muted-foreground max-w-xs">Your @webmydrive.com Google account needs to be active to view shared drives.</p>
                                    </div>
                                ) : sharedDrives.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                                        <div className="w-12 h-12 rounded-xl bg-muted/40 border border-border flex items-center justify-center text-xl">📂</div>
                                        <p className="text-sm font-medium text-foreground">No shared drives yet</p>
                                        <p className="text-xs text-muted-foreground max-w-xs">Create a shared drive in Google Drive to collaborate with your team.</p>
                                    </div>
                                ) : (
                                    <div className="rounded border border-border overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-border bg-muted/30">
                                                    <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Drive Name</th>
                                                    <th className="text-right py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Files</th>
                                                    <th className="text-right py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Storage Used</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                                {sharedDrives.map(d => (
                                                    <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                                                        <td className="py-3 px-4">
                                                            <div className="flex items-center gap-2.5">
                                                                <span className="text-base shrink-0">📁</span>
                                                                <div className="min-w-0">
                                                                    <p className="font-medium text-foreground truncate">{d.name}</p>
                                                                    <p className="text-xs text-muted-foreground">Created {formatDate(d.createdTime)}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-4 text-right text-muted-foreground tabular-nums">{d.fileCount.toLocaleString()}</td>
                                                        <td className="py-3 px-4 text-right text-muted-foreground tabular-nums">{formatBytes(d.storageUsed)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ── Notifications ───────────────────────────────────── */}
                    <TabsContent value="notifications" className="space-y-4">
                        <Card className="border-border shadow-sm">
                            <CardHeader>
                                <CardTitle>Notification Preferences</CardTitle>
                                <CardDescription>Choose what updates you want to receive.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <h4 className="text-sm font-medium text-foreground">Email Notifications</h4>
                                        <p className="text-xs text-muted-foreground">Receive emails about your account activity.</p>
                                    </div>
                                    <Switch defaultChecked />
                                </div>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <h4 className="text-sm font-medium text-foreground">Marketing Emails</h4>
                                        <p className="text-xs text-muted-foreground">Receive emails about new products, features, and more.</p>
                                    </div>
                                    <Switch />
                                </div>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <h4 className="text-sm font-medium text-foreground">Security Alerts</h4>
                                        <p className="text-xs text-muted-foreground">Get notified about suspicious login attempts.</p>
                                    </div>
                                    <Switch defaultChecked disabled />
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </UserLayout>
    );
}
