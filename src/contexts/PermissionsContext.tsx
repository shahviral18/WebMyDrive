import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useUser } from "@/contexts/UserContext";
import { api } from "@/lib/api";

export type PermLevel = "full" | "limited" | "read" | "none";
export type PermAction = "view" | "create" | "edit" | "delete";
export type ModuleKey =
  | "dashboard" | "users" | "googleUsers" | "plans" | "orders"
  | "referralEngine" | "vouchers" | "distributors" | "distributorApplications"
  | "distributorPayouts" | "importUsers" | "assignDistributor"
  | "auditLogs" | "settings" | "changePlan";

type RolePerms = Record<ModuleKey, PermLevel>;

const ACTION_LEVELS: Record<PermAction, PermLevel[]> = {
  view:   ["full", "limited", "read"],
  create: ["full", "limited"],
  edit:   ["full", "limited"],
  delete: ["full"],
};

interface PermissionsCtx {
  permissions: RolePerms | null;
  can: (module: ModuleKey, action: PermAction) => boolean;
  reload: () => void;
}

const Context = createContext<PermissionsCtx>({
  permissions: null,
  can: () => true,
  reload: () => {},
});

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const [permissions, setPermissions] = useState<RolePerms | null>(null);
  const [tick, setTick] = useState(0);

  const isSuperAdmin = (user?.role ?? "").toUpperCase() === "SUPERADMIN";

  useEffect(() => {
    if (!user?.role || isSuperAdmin) return; // SUPERADMIN needs no config
    api.get("/admin/config?type=ROLE_PERMISSIONS")
      .then((data: any) => {
        const perms = (data?.ADMIN ?? data) as RolePerms;
        if (perms && typeof perms === "object") setPermissions(perms);
      })
      .catch(() => {});
  }, [user?.role, tick]);

  const can = (module: ModuleKey, action: PermAction): boolean => {
    if (isSuperAdmin) return true;
    if (!permissions) return false;
    const level = permissions[module] ?? "none";
    return ACTION_LEVELS[action].includes(level);
  };

  return (
    <Context.Provider value={{ permissions, can, reload: () => setTick(t => t + 1) }}>
      {children}
    </Context.Provider>
  );
}

export function usePermissions() {
  return useContext(Context);
}
