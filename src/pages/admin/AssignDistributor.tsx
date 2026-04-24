import { useState, useEffect } from "react";
import { UserPlus, Users, ArrowRight, CheckCircle2, Loader2, Copy, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface User {
  id: number;
  name: string | null;
  email: string;
  role: string;
  source?: string;
  plan?: string;
  distributorId?: number | null;
}

interface Distributor {
  id: string;
  name: string;
  email: string;
  status: string;
  tier: string;
  referralCode: string;
  totalCustomers: number;
}

// ── Sub-page: Assign User → Distributor ───────────────────────────────────────

function AssignUserTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [distSearch, setDistSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedDist, setSelectedDist] = useState<Distributor | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get("/admin/users?limit=500&skip=0"),
      api.get("/admin/distributors?limit=200"),
    ]).then(([uRes, dRes]) => {
      setUsers(uRes.users ?? []);
      setDistributors(dRes.distributors ?? []);
    }).catch(() => toast.error("Failed to load data"))
      .finally(() => setLoading(false));
  }, []);

  const filteredUsers = users.filter(u =>
    !userSearch ||
    u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.name ?? "").toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredDists = distributors.filter(d =>
    !distSearch ||
    d.email.toLowerCase().includes(distSearch.toLowerCase()) ||
    d.name.toLowerCase().includes(distSearch.toLowerCase())
  );

  const handleAssign = async () => {
    if (!selectedUser || !selectedDist) return;
    setSaving(true);
    try {
      await api.post(`/admin/users/${selectedUser.id}/assign-distributor`, {
        distributorId: selectedDist.id,
      });
      toast.success(`${selectedUser.email} assigned to ${selectedDist.name}`);
      setSelectedUser(null);
      setSelectedDist(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Assignment failed");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (user: User) => {
    setSaving(true);
    try {
      await api.post(`/admin/users/${user.id}/assign-distributor`, { distributorId: "" });
      toast.success(`Distributor removed from ${user.email}`);
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, distributorId: null } : u));
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Selection row */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-start">
        {/* User picker */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">1. Select User</p>
          <Input
            placeholder="Search by name or email…"
            value={userSearch}
            onChange={e => setUserSearch(e.target.value)}
            className="h-9 text-sm"
          />
          {selectedUser && (
            <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">{selectedUser.name ?? selectedUser.email}</p>
                <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
              </div>
              <button onClick={() => setSelectedUser(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
            {filteredUsers.slice(0, 80).map(u => (
              <button
                key={u.id}
                onClick={() => setSelectedUser(u)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                  selectedUser?.id === u.id
                    ? "bg-primary/20 text-primary"
                    : "hover:bg-surface-2 text-foreground"
                )}
              >
                <p className="font-medium truncate">{u.name ?? u.email}</p>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                {u.distributorId && (
                  <span className="text-[10px] text-amber-500">already assigned</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Arrow */}
        <div className="flex items-center justify-center py-8">
          <ArrowRight className="w-5 h-5 text-muted-foreground" />
        </div>

        {/* Distributor picker */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">2. Select Distributor</p>
          <Input
            placeholder="Search distributor…"
            value={distSearch}
            onChange={e => setDistSearch(e.target.value)}
            className="h-9 text-sm"
          />
          {selectedDist && (
            <div className="flex items-center justify-between bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">{selectedDist.name}</p>
                <p className="text-xs text-muted-foreground">{selectedDist.email}</p>
              </div>
              <button onClick={() => setSelectedDist(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
            {filteredDists.map(d => (
              <button
                key={d.id}
                onClick={() => setSelectedDist(d)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                  selectedDist?.id === d.id
                    ? "bg-yellow-500/20 text-yellow-600"
                    : "hover:bg-surface-2 text-foreground"
                )}
              >
                <p className="font-medium truncate">{d.name}</p>
                <p className="text-xs text-muted-foreground truncate">{d.email} · {d.totalCustomers} customers</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Assign button */}
      <div className="flex justify-center">
        <Button
          onClick={handleAssign}
          disabled={!selectedUser || !selectedDist || saving}
          className="min-w-48 gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Assign to Distributor
        </Button>
      </div>

      {/* Users already assigned */}
      {users.some(u => u.distributorId) && (
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-sm font-semibold text-foreground mb-3">Currently Assigned Users</p>
          <div className="space-y-2">
            {users.filter(u => u.distributorId).map(u => {
              const dist = distributors.find(d => String(d.id) === String(u.distributorId));
              return (
                <div key={u.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                  <div>
                    <span className="font-medium text-foreground">{u.name ?? u.email}</span>
                    <span className="text-muted-foreground ml-2 text-xs">{u.email}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-yellow-600 border-yellow-400/40 bg-yellow-500/10 text-xs">
                      {dist?.name ?? `Dist #${u.distributorId}`}
                    </Badge>
                    <button
                      onClick={() => handleRemove(u)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-page: Promote User → Distributor ──────────────────────────────────────

function PromoteUserTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [commissionPct, setCommissionPct] = useState("10");
  const [tier, setTier] = useState("Starter");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ email: string; password: string } | null>(null);

  useEffect(() => {
    api.get("/admin/users?limit=500&skip=0")
      .then(res => setUsers(res.users ?? []))
      .catch(() => toast.error("Failed to load users"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = users.filter(u =>
    !search ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const handlePromote = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const res = await api.post(`/admin/users/${selectedUser.id}/promote-distributor`, {
        commissionPct: parseFloat(commissionPct),
        tier,
      });
      setResult({ email: res.distributor.email, password: res.plainPassword });
      toast.success("User promoted to distributor!");
      setSelectedUser(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Promotion failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {result && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold">
            <CheckCircle2 className="w-5 h-5" />
            Distributor account created!
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-20">Email:</span>
              <span className="font-mono font-medium">{result.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-20">Password:</span>
              <span className="font-mono font-medium">{result.password}</span>
              <button
                onClick={() => { navigator.clipboard.writeText(result.password); toast.success("Copied!"); }}
                className="text-muted-foreground hover:text-foreground"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Share these credentials with the new distributor. Password won't be shown again.</p>
          <button onClick={() => setResult(null)} className="text-xs text-muted-foreground hover:text-foreground underline">Dismiss</button>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <p className="text-sm font-semibold text-foreground">Select User to Promote</p>
        <Input
          placeholder="Search by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-9 text-sm"
        />
        {selectedUser && (
          <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
            <div>
              <p className="text-sm font-medium text-foreground">{selectedUser.name ?? selectedUser.email}</p>
              <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
            </div>
            <button onClick={() => setSelectedUser(null)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
          {filtered.slice(0, 80).map(u => (
            <button
              key={u.id}
              onClick={() => setSelectedUser(u)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                selectedUser?.id === u.id
                  ? "bg-primary/20 text-primary"
                  : "hover:bg-surface-2 text-foreground"
              )}
            >
              <p className="font-medium truncate">{u.name ?? u.email}</p>
              <p className="text-xs text-muted-foreground truncate">{u.email}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <p className="text-sm font-semibold text-foreground">Distributor Settings</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">Commission %</label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={commissionPct}
              onChange={e => setCommissionPct(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">Tier</label>
            <select
              value={tier}
              onChange={e => setTier(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              <option>Starter</option>
              <option>Silver</option>
              <option>Gold</option>
              <option>Platinum</option>
            </select>
          </div>
        </div>
      </div>

      <Button
        onClick={handlePromote}
        disabled={!selectedUser || saving}
        className="min-w-52 gap-2"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
        Promote to Distributor
      </Button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = "assign" | "promote";

export default function AssignDistributorPage() {
  const [tab, setTab] = useState<Tab>("assign");

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
          <Users className="w-5 h-5 text-yellow-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Distributor Management</h1>
          <p className="text-sm text-muted-foreground">Assign users to distributors or promote users as distributors</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-2 p-1 rounded-xl w-fit">
        {(["assign", "promote"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-5 py-2 rounded-lg text-sm font-medium transition-all",
              tab === t
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "assign" ? "Assign to Distributor" : "Promote as Distributor"}
          </button>
        ))}
      </div>

      {tab === "assign" ? <AssignUserTab /> : <PromoteUserTab />}
    </div>
  );
}
