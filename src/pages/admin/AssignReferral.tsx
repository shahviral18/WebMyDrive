import { useState, useEffect } from "react";
import { GitBranch, ArrowRight, CheckCircle2, Loader2, X, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface User {
  id: number;
  name: string | null;
  email: string;
  plan?: string;
  referredByUserId?: number | null;
  referredByName?: string | null;
  referralCode?: string | null;
}

interface Assignment {
  refereeId: number;
  refereeName: string | null;
  refereeEmail: string;
  referrerId: number;
  referrerName: string | null;
  referrerEmail: string;
  assignedAt: string;
  creditApplied: number;
}

// ── Confirmation Modal ────────────────────────────────────────────────────────

function ConfirmModal({
  referee,
  referrer,
  onConfirmNoCredit,
  onConfirmWithCredit,
  onCancel,
  saving,
}: {
  referee: User;
  referrer: User;
  onConfirmNoCredit: () => void;
  onConfirmWithCredit: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <GitBranch className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Confirm Referral Assignment</h3>
            <p className="text-sm text-muted-foreground mt-1">
              You're linking <span className="font-medium text-foreground">{referee.name ?? referee.email}</span> as referred by <span className="font-medium text-foreground">{referrer.name ?? referrer.email}</span>.
            </p>
          </div>
        </div>

        <div className="bg-surface-2 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Referee (was referred)</span>
            <span className="font-medium text-foreground truncate max-w-[160px]">{referee.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Referrer (gets credit)</span>
            <span className="font-medium text-foreground truncate max-w-[160px]">{referrer.email}</span>
          </div>
          {referee.plan && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Referee's plan</span>
              <span className="font-medium text-foreground">{referee.plan}</span>
            </div>
          )}
        </div>

        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Apply referrer credit only if the referrer genuinely brought this customer before the system tracked it.
          </p>
        </div>

        <div className="flex gap-2 flex-col sm:flex-row">
          <Button variant="outline" onClick={onCancel} disabled={saving} className="flex-1">
            Cancel
          </Button>
          <Button variant="outline" onClick={onConfirmNoCredit} disabled={saving} className="flex-1 border-primary/30 text-primary hover:bg-primary/5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Link only
          </Button>
          <Button onClick={onConfirmWithCredit} disabled={saving} className="flex-1 gap-1">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Link + Credit
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AssignReferralPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  const [refereeSearch, setRefereeSearch] = useState("");
  const [referrerSearch, setReferrerSearch] = useState("");
  const [selectedReferee, setSelectedReferee] = useState<User | null>(null);
  const [selectedReferrer, setSelectedReferrer] = useState<User | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get("/admin/users?limit=1000&skip=0"),
      api.get("/admin/referral-assignments"),
    ]).then(([uRes, aRes]) => {
      // Exclude distributors — they are injected into the users list with id+1000000 offset
      // and don't exist in the User table. Only real users can be referees/referrers.
      setUsers((uRes.users ?? []).filter((u: User) => u.role !== "DISTRIBUTOR"));
      setAssignments(Array.isArray(aRes) ? aRes : []);
    }).catch(() => toast.error("Failed to load data"))
      .finally(() => setLoading(false));
  }, []);

  // Referee list: anyone not already referred by someone
  const filteredReferees = users.filter(u => {
    const matchSearch = !refereeSearch ||
      u.email.toLowerCase().includes(refereeSearch.toLowerCase()) ||
      (u.name ?? "").toLowerCase().includes(refereeSearch.toLowerCase());
    return matchSearch;
  });

  // Referrer list: any user; exclude the selected referee so a user can't refer themselves
  const filteredReferrers = users.filter(u => {
    if (selectedReferee && u.id === selectedReferee.id) return false;
    const matchSearch = !referrerSearch ||
      u.email.toLowerCase().includes(referrerSearch.toLowerCase()) ||
      (u.name ?? "").toLowerCase().includes(referrerSearch.toLowerCase());
    return matchSearch;
  });

  const handleAssign = async (applyCredit: boolean) => {
    if (!selectedReferee || !selectedReferrer) return;
    setSaving(true);
    try {
      const res = await api.post(`/admin/users/${selectedReferee.id}/assign-referrer`, {
        referrerId: selectedReferrer.id,
        applyCredit,
      });
      toast.success(
        applyCredit
          ? `Linked + ₹${res.creditApplied ?? 0} credited to ${selectedReferrer.name ?? selectedReferrer.email}`
          : `${selectedReferee.email} linked to ${selectedReferrer.email}`
      );
      // Refresh assignments list
      const fresh = await api.get("/admin/referral-assignments");
      setAssignments(Array.isArray(fresh) ? fresh : []);
      // Update local users so "already referred" label appears
      setUsers(prev => prev.map(u =>
        u.id === selectedReferee.id ? { ...u, referredByUserId: selectedReferrer.id, referredByName: selectedReferrer.name } : u
      ));
      setSelectedReferee(null);
      setSelectedReferrer(null);
      setShowConfirm(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Assignment failed");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (a: Assignment) => {
    if (!confirm(`Remove referral link between ${a.refereeEmail} and ${a.referrerEmail}?`)) return;
    setSaving(true);
    try {
      await api.post(`/admin/users/${a.refereeId}/assign-referrer`, { referrerId: null, applyCredit: false });
      toast.success("Referral link removed");
      setAssignments(prev => prev.filter(x => x.refereeId !== a.refereeId));
      setUsers(prev => prev.map(u => u.id === a.refereeId ? { ...u, referredByUserId: null, referredByName: null } : u));
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to remove");
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <GitBranch className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Referral Assignment</h1>
          <p className="text-sm text-muted-foreground">Manually link a user to their referrer · each user can have only one referrer</p>
        </div>
      </div>

      {/* Selection row */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-start">
        {/* Referee picker */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">1. Select User (was referred)</p>
          <Input
            placeholder="Search by name or email…"
            value={refereeSearch}
            onChange={e => setRefereeSearch(e.target.value)}
            className="h-9 text-sm"
          />
          {selectedReferee && (
            <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">{selectedReferee.name ?? selectedReferee.email}</p>
                <p className="text-xs text-muted-foreground">{selectedReferee.email}</p>
                {selectedReferee.plan && <p className="text-[10px] text-muted-foreground">{selectedReferee.plan}</p>}
              </div>
              <button onClick={() => setSelectedReferee(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
            {filteredReferees.slice(0, 100).map(u => {
              const alreadyReferred = !!u.referredByUserId;
              const isAssigned = assignments.some(a => a.refereeId === u.id);
              return (
                <button
                  key={u.id}
                  onClick={() => setSelectedReferee(u)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                    selectedReferee?.id === u.id
                      ? "bg-primary/20 text-primary"
                      : "hover:bg-surface-2 text-foreground"
                  )}
                >
                  <p className="font-medium truncate">{u.name ?? u.email}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  {(alreadyReferred || isAssigned) && (
                    <span className="text-[10px] text-amber-500">already linked to a referrer</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Arrow */}
        <div className="flex items-center justify-center py-8">
          <ArrowRight className="w-5 h-5 text-muted-foreground" />
        </div>

        {/* Referrer picker */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">2. Select Referrer (gave the referral)</p>
          <Input
            placeholder="Search by name or email…"
            value={referrerSearch}
            onChange={e => setReferrerSearch(e.target.value)}
            className="h-9 text-sm"
          />
          {selectedReferrer && (
            <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">{selectedReferrer.name ?? selectedReferrer.email}</p>
                <p className="text-xs text-muted-foreground">{selectedReferrer.email}</p>
              </div>
              <button onClick={() => setSelectedReferrer(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
            {filteredReferrers.slice(0, 100).map(u => (
              <button
                key={u.id}
                onClick={() => setSelectedReferrer(u)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                  selectedReferrer?.id === u.id
                    ? "bg-emerald-500/20 text-emerald-600"
                    : "hover:bg-surface-2 text-foreground"
                )}
              >
                <p className="font-medium truncate">{u.name ?? u.email}</p>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                {u.referralCode && (
                  <span className="text-[10px] text-muted-foreground font-mono">{u.referralCode}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Assign button */}
      <div className="flex justify-center">
        <Button
          onClick={() => setShowConfirm(true)}
          disabled={!selectedReferee || !selectedReferrer || saving}
          className="min-w-52 gap-2"
        >
          <CheckCircle2 className="w-4 h-4" />
          Assign Referral
        </Button>
      </div>

      {/* Currently assigned */}
      {assignments.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-sm font-semibold text-foreground mb-3">Manually Assigned Referrals ({assignments.length})</p>
          <div className="space-y-2">
            {assignments.map(a => (
              <div key={a.refereeId} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0 gap-3 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="min-w-0">
                    <span className="font-medium text-foreground">{a.refereeName ?? a.refereeEmail}</span>
                    <span className="text-muted-foreground ml-2 text-xs truncate">{a.refereeEmail}</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="font-medium text-foreground">{a.referrerName ?? a.referrerEmail}</span>
                    <span className="text-muted-foreground ml-2 text-xs truncate">{a.referrerEmail}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {a.creditApplied > 0 && (
                    <Badge variant="outline" className="text-emerald-600 border-emerald-400/40 bg-emerald-500/10 text-xs">
                      +₹{a.creditApplied} credited
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">{a.assignedAt?.slice(0, 10)}</span>
                  <button
                    onClick={() => handleRemove(a)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {showConfirm && selectedReferee && selectedReferrer && (
        <ConfirmModal
          referee={selectedReferee}
          referrer={selectedReferrer}
          onCancel={() => setShowConfirm(false)}
          onConfirmNoCredit={() => handleAssign(false)}
          onConfirmWithCredit={() => handleAssign(true)}
          saving={saving}
        />
      )}
    </div>
  );
}
