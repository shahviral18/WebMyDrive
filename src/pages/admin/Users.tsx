import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Wallet, UserX, UserCheck, ShieldAlert,
  LogOut, Trash2, MoreHorizontal, UserCircle2, ChevronLeft,
  ChevronRight, Filter, UserPlus, X, Loader2, Download,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface User {
  id: number;
  name: string | null;
  email: string;
  role: string;
  walletBalance: number;
  referralCode: string | null;
  createdAt: string;
  source?: string;
  plan?: string;
  planMismatch?: boolean;
  distributorId?: number | null;
}

type Action = "suspend" | "activate" | "reset-password" | "force-logout" | "delete";
interface Confirm { user: User; action: Action }
type PlatformUserRole = "distributor" | "customer";

// ── Static maps ──────────────────────────────────────────────────────────────
const sourceBadge: Record<string, string> = {
  "Direct": "bg-surface-3 border-border text-muted-foreground",
  "User Referral": "bg-primary/20 text-primary border-blue-200",
  "Distributor": "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
};

const statChips: { label: string; filter: string; cls: string }[] = [
  { label: "All Accounts", filter: "", cls: "border-border text-muted-foreground hover:border-blue-300" },
  { label: "Distributor", filter: "Distributor", cls: "border-yellow-500/30 text-yellow-600 bg-yellow-500/10" },
  { label: "Direct", filter: "Direct", cls: "border-surface-3 text-muted-foreground bg-surface-2" },
  { label: "User Referral", filter: "User Referral", cls: "border-blue-200 text-primary bg-primary/10" },
];

const PAGE = 20;

// -- Password Reveal Dialog --
function PasswordRevealDialog({ info, onClose }: {
  info: { email: string; password: string; label: string } | null;
  onClose: () => void;
}) {
  if (!info) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-card rounded-2xl shadow-xl border border-border w-full max-w-sm mx-4 p-6 space-y-4">
        <div className="w-12 h-12 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center mx-auto">
          <UserCheck className="w-6 h-6 text-success" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-bold text-foreground">{info.label}</h2>
          <p className="text-sm text-muted-foreground mt-1">Save this password - it won't be shown again.</p>
        </div>
        <div className="bg-surface-3 rounded-lg p-4 space-y-2">
          <p className="text-xs text-muted-foreground">Email</p>
          <p className="font-mono text-sm font-semibold text-foreground break-all">{info.email}</p>
          <p className="text-xs text-muted-foreground mt-2">Password</p>
          <p className="font-mono text-xl font-bold text-primary tracking-wider">{info.password}</p>
        </div>
        <Button className="w-full" onClick={() => { navigator.clipboard?.writeText(info.password); onClose(); }}>
          Copy Password and Close
        </Button>
      </motion.div>
    </div>
  );
}

// -- Add User Modal --
function AddUserModal({ open, onClose, onCreated }: {
  open: boolean;
  onClose: () => void;
  onCreated: (user: User, password: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [platformRole, setPlatformRole] = useState<PlatformUserRole>("customer");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error("Email is required."); return; }
    setSaving(true);
    try {
      const endpoint = platformRole === "distributor" ? "/admin/distributors" : "/admin/users";
      const res = await api.post(endpoint, {
        name, email, password: password || undefined,
        role: platformRole === "distributor" ? undefined : "USER"
      });
      const created: User = res.user || {
        id: res.distributor?.id ?? Date.now(), name: name || email, email,
        role: platformRole === "distributor" ? "DISTRIBUTOR" : "USER",
        walletBalance: 0, referralCode: null, createdAt: new Date().toISOString(),
      };
      onCreated(created, res.plainPassword);
      setName(""); setEmail(""); setPassword(""); setPlatformRole("customer");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to create account");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-card rounded-2xl shadow-xl border border-border w-full max-w-md mx-4 p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-foreground">Add User</h2>
            <p className="text-sm text-muted-foreground">Manually create a Distributor or Customer</p>
          </div>
          <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-surface-3">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-2 mb-5 p-1 bg-surface-3 rounded-lg">
          {(["customer", "distributor"] as const).map(r => (
            <button key={r} onClick={() => setPlatformRole(r)}
              className={`flex-1 py-1.5 rounded-md text-sm font-semibold transition-all ${platformRole === r
                ? "bg-card text-primary shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
                }`}>
              {r === "customer" ? "Customer" : "Distributor"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Full Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@company.com" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Password (Optional)</Label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Leave blank to auto-generate" className="mt-1" autoComplete="new-password" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className="flex-1 bg-primary hover:bg-primary/90 text-white">
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</> : "Create Account"}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <tr>
      <td colSpan={6} className="py-20">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <UserCircle2 className="w-7 h-7 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            {filtered ? "No accounts match your filters" : "No accounts yet"}
          </p>
          <p className="text-xs text-muted-foreground max-w-xs">
            {filtered ? "Try adjusting your search or filter criteria." : "Accounts appear here once they sign up."}
          </p>
        </div>
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [passwordReveal, setPasswordReveal] = useState<{ email: string; password: string; label: string } | null>(null);
  const [pendingImports, setPendingImports] = useState<number>(0);

  useEffect(() => {
    api.get("/admin/users?limit=500&skip=0")
      .then(data => setUsers(data.users || []))
      .catch(() => {})
      .finally(() => setLoading(false));
    // Check for unimported legacy users
    api.get("/admin/existing-users")
      .then(data => setPendingImports(data.pendingCount ?? 0))
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter(u =>
      (!q || u.email.includes(q) || (u.name ?? "").toLowerCase().includes(q)) &&
      (!roleFilter || u.source === roleFilter)
    );
  }, [users, search, roleFilter]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const paginated = filtered.slice((page - 1) * PAGE, page * PAGE);

  const handleCreated = (user: User, password: string) => {
    setUsers(prev => [user, ...prev]);
    setPasswordReveal({ email: user.email, password, label: user.role === "DISTRIBUTOR" ? "Distributor" : "User" });
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    const { user, action } = confirm;
    setConfirm(null);
    try {
      if (action === "reset-password") {
        let actualId = user.id;
        let endpoint = `/admin/users/${actualId}/reset-password`;
        if (user.role === "DISTRIBUTOR") {
          actualId -= 1000000;
          endpoint = `/admin/distributors/${actualId}/reset-password`;
        }
        const res = await api.post(endpoint, {});
        setPasswordReveal({ email: user.email, password: res.plainPassword, label: "Password Reset" });
      } else if (action === "delete") {
        let actualId = user.id;
        let endpoint = `/admin/users/${actualId}`;
        if (user.role === "DISTRIBUTOR") {
          actualId -= 1000000;
          endpoint = `/admin/distributors/${actualId}`;
        }
        await api.delete(endpoint);
        setUsers(prev => prev.filter(u => u.id !== user.id));
        toast.success(`${user.email} deleted`);
      } else {
        toast.info(`Action "${action}" recorded`);
      }
    } catch (e: any) {
      toast.error(e.message || "Action failed");
    }
  };

  const handleAction = (user: User, action: Action) => {
    if (["suspend", "force-logout", "delete", "reset-password"].includes(action)) {
      setConfirm({ user, action });
    } else {
      toast.info(`Action "${action}" noted`);
    }
  };

  const counts = statChips.reduce<Record<string, number>>((acc, chip) => {
    acc[chip.filter] = chip.filter === "" ? users.length : users.filter(u => u.source === chip.filter).length;
    return acc;
  }, {});

  const confirmConfig: Record<Action, { title: string; desc: string; btnCls: string; btnLabel: string }> = {
    "suspend": { title: "Suspend User", desc: `Suspend ${confirm?.user.email}?`, btnCls: "bg-danger hover:bg-danger/90 text-white", btnLabel: "Yes, Suspend" },
    "activate": { title: "Activate User", desc: `Re-activate ${confirm?.user.email}?`, btnCls: "bg-success hover:bg-success/90 text-white", btnLabel: "Yes, Activate" },
    "force-logout": { title: "Force Logout", desc: `Revoke all sessions for ${confirm?.user.email}?`, btnCls: "bg-danger hover:bg-danger/90 text-white", btnLabel: "Yes, Force Logout" },
    "delete": { title: "Delete User", desc: `Permanently delete ${confirm?.user.email}?`, btnCls: "bg-red-700 text-white", btnLabel: "Yes, Delete" },
    "reset-password": { title: "Reset Password", desc: `Send reset link to ${confirm?.user.email}?`, btnCls: "bg-primary text-white", btnLabel: "Send Reset Email" },
  };
  const cc = confirm ? confirmConfig[confirm.action] : null;

  if (loading) return (
    <div className="p-6 flex items-center justify-center py-24">
      <Loader2 className="w-9 h-9 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="p-6 space-y-5">
      {/* Legacy import banner */}
      {pendingImports > 0 && (
        <button
          onClick={() => navigate("/admin/import-users")}
          className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-xl text-left hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Download className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
              {pendingImports} legacy Google Workspace {pendingImports === 1 ? "account has" : "accounts have"} not been imported to the portal yet.
            </span>
          </div>
          <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold shrink-0 ml-4">Import now →</span>
        </button>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Accounts</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{users.length} total accounts</p>
        </div>
        <Button onClick={() => setShowAddUser(true)} className="bg-primary hover:bg-primary/90 text-white gap-2 self-start">
          <UserPlus className="w-4 h-4" /> Add User
        </Button>
      </div>

      {/* Status chips */}
      <div className="flex flex-wrap gap-2">
        {statChips.map(chip => (
          <button key={chip.filter}
            onClick={() => { setRoleFilter(chip.filter); setPage(1); }}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${chip.cls} ${roleFilter === chip.filter ? "ring-1 ring-primary" : ""}`}>
            {chip.label} · {counts[chip.filter] ?? 0}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search name or email..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 bg-card border-border h-9 text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
            className="px-3 h-9 rounded-md bg-card border border-border text-sm text-foreground appearance-none min-w-[120px] focus:outline-none">
            <option value="">All Sources</option>
            <option value="Distributor">Distributor</option>
            <option value="Direct">Direct</option>
            <option value="User Referral">User Referral</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="rounded-xl bg-card border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                {["Account", "Plan", "Source", "Wallet", "Referral Code", "Joined", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <EmptyState filtered={!!(search || roleFilter)} />
              ) : (
                paginated.map((user, i) => (
                  <motion.tr key={user.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.025 }}
                    className="border-b border-border hover:bg-blue-50/30 transition-colors group">

                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {(user.name ?? user.email).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate max-w-[160px]">{user.name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[160px]">{user.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground truncate max-w-[120px]">{user.plan ?? "None"}</span>
                        {user.planMismatch && (
                          <span title="Plan mismatch: latest order plan differs from workspace plan" className="flex-shrink-0 w-4 h-4 rounded-full bg-amber-100 border border-amber-400 flex items-center justify-center text-amber-600 text-[9px] font-bold cursor-help">!</span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${sourceBadge[user.source ?? ""] ?? sourceBadge["Direct"]}`}>
                        {user.source ?? "—"}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1 text-xs">
                        <Wallet className="w-3 h-3 text-muted-foreground" />
                        <span className={user.walletBalance > 0 ? "text-emerald-600 font-semibold" : "text-muted-foreground"}>
                          {user.walletBalance > 0 ? `₹${user.walletBalance.toLocaleString("en-IN")}` : "—"}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-xs font-mono text-muted-foreground">
                      {user.referralCode ?? "—"}
                    </td>

                    <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline" className="h-7 w-7 p-0 border-border">
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-card border-border w-44">
                            <DropdownMenuItem className="gap-2 text-xs" onClick={() => handleAction(user, "reset-password")}>
                              <ShieldAlert className="w-3 h-3" /> Reset Password
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2 text-xs" onClick={() => handleAction(user, "force-logout")}>
                              <LogOut className="w-3 h-3" /> Force Logout
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-danger focus:text-red-500 focus:bg-red-50 gap-2 text-xs"
                              onClick={() => handleAction(user, "delete")}>
                              <Trash2 className="w-3 h-3" /> Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > PAGE && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="h-7 w-7 p-0">
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="h-7 w-7 p-0">
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </motion.div>

      <PasswordRevealDialog info={passwordReveal} onClose={() => setPasswordReveal(null)} />

      <AnimatePresence>
        {showAddUser && (
          <AddUserModal open={showAddUser} onClose={() => setShowAddUser(false)} onCreated={handleCreated} />
        )}
      </AnimatePresence>

      <AlertDialog open={!!confirm} onOpenChange={open => !open && setConfirm(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">{cc?.title}</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">{cc?.desc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-surface-2 border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} className={cc?.btnCls}>{cc?.btnLabel}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
