import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserPlus, Trash2, KeyRound, Shield, Loader2, X, UserCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface PortalUser {
  id: number;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
}

// ── Add Admin Modal ───────────────────────────────────────────────────────────
function AddAdminModal({ open, onClose, onCreated }: {
  open: boolean;
  onClose: () => void;
  onCreated: (user: PortalUser, password: string) => void;
}) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const email = username.trim().toLowerCase() + "@webmydrive.com";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) { toast.error("Username is required"); return; }
    setSaving(true);
    try {
      const res = await api.post("/admin/users", { name, email, password: password || undefined, role: "ADMIN" });
      const created: PortalUser = res.user || {
        id: Date.now(), name: name || email, email, role: "ADMIN", createdAt: new Date().toISOString(),
      };
      toast.success(`Support admin created — password: ${res.plainPassword ?? "(see below)"}`);
      onCreated(created, res.plainPassword ?? "");
      setName(""); setUsername(""); setPassword("");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to create admin");
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
            <h2 className="text-lg font-bold text-foreground">Add Support Admin</h2>
            <p className="text-sm text-muted-foreground">Creates an ADMIN-role portal account</p>
          </div>
          <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-surface-3">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Full Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Username</Label>
            <div className="flex mt-1">
              <Input
                value={username}
                onChange={e => setUsername(e.target.value.replace(/[@\s]/g, ""))}
                placeholder="dhwani.panchal"
                className="rounded-r-none flex-1"
                required
              />
              <span className="flex items-center px-3 bg-muted border border-l-0 border-input rounded-r-md text-sm text-muted-foreground select-none">
                @webmydrive.com
              </span>
            </div>
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Password (Optional)</Label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Leave blank to auto-generate" className="mt-1" autoComplete="new-password" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className="flex-1 bg-primary hover:bg-primary/90 text-white">
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</> : "Create Admin"}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PortalUsers() {
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PortalUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [resettingId, setResettingId] = useState<number | null>(null);

  useEffect(() => {
    api.get("/admin/users?limit=500&skip=0")
      .then(data => {
        const all: PortalUser[] = data.users || [];
        setUsers(all.filter(u => u.role === "ADMIN"));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCreated = (user: PortalUser) => {
    setUsers(prev => [user, ...prev]);
  };

  const handleResetPassword = async (user: PortalUser) => {
    setResettingId(user.id);
    try {
      const res = await api.post(`/admin/users/${user.id}/reset-password`, {});
      toast.success(`New password for ${user.email}: ${res.plainPassword}`, { duration: 10000 });
    } catch (err: any) {
      toast.error(err.message || "Failed to reset password");
    } finally {
      setResettingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/users/${deleteTarget.id}`);
      setUsers(prev => prev.filter(u => u.id !== deleteTarget.id));
      toast.success(`${deleteTarget.email} deleted`);
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Portal Users</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Support admin accounts with configurable module permissions.
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="shrink-0 gap-2">
          <UserPlus className="w-4 h-4" /> Add Admin
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-[1fr_160px_180px] bg-muted/60 border-b border-border">
          <div className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Account</div>
          <div className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Joined</div>
          <div className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Actions</div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <UserCircle2 className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No support admins yet</p>
            <p className="text-xs text-muted-foreground">Click "Add Admin" to create the first one</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {users.map((user, i) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, height: 0 }}
                className={`grid grid-cols-[1fr_160px_180px] items-center border-b border-border last:border-0 ${i % 2 === 0 ? "bg-card" : "bg-muted/20"}`}
              >
                <div className="px-4 py-3.5">
                  <p className="text-sm font-medium text-foreground">{user.name || "—"}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <div className="px-4 py-3.5 text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(user.createdAt.replace(' ', 'T') + 'Z'), { addSuffix: true })}
                </div>
                <div className="px-4 py-3.5 flex items-center justify-end gap-2">
                  <Button
                    size="sm" variant="outline"
                    className="h-7 gap-1.5 text-xs"
                    disabled={resettingId === user.id}
                    onClick={() => handleResetPassword(user)}
                  >
                    {resettingId === user.id
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <KeyRound className="w-3 h-3" />
                    }
                    Reset Pwd
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    className="h-7 w-7 p-0 text-red-400 hover:text-red-500 hover:bg-red-500/10 border-border"
                    onClick={() => setDeleteTarget(user)}
                    title="Delete admin"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Add modal */}
      <AnimatePresence>
        {showAdd && (
          <AddAdminModal
            open={showAdd}
            onClose={() => setShowAdd(false)}
            onCreated={(u, _pwd) => handleCreated(u)}
          />
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Admin Account</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Permanently delete {deleteTarget?.email}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDelete}
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
