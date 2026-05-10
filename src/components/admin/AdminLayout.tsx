import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users,
  ScrollText, Settings, ChevronLeft, ChevronRight,
  LogOut, Menu, X, Shield, CreditCard, Gift, Tag,
  FileText, ChevronDown, Handshake, Briefcase, ArrowLeftRight, ShieldCheck, Receipt,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { ThemeSwitch } from "@/components/ui/theme-switch";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { useUser } from "@/contexts/UserContext";
import { usePermissions, ModuleKey } from "@/contexts/PermissionsContext";

// ─────────────────────────────────────────────────────────────────────────────
// Navigation structure
// ─────────────────────────────────────────────────────────────────────────────
const navGroups = [
  {
    label: "CORE",
    items: [
      { label: "Dashboard",   href: "/admin/dashboard",   icon: LayoutDashboard, module: "dashboard"   as ModuleKey },
      { label: "Accounts",    href: "/admin/users",        icon: Users,           module: "users"       as ModuleKey },
      { label: "Change Plan", href: "/admin/change-plan",  icon: ArrowLeftRight,  module: "changePlan"  as ModuleKey },
    ],
  },
  {
    label: "COMMERCIAL",
    items: [
      { label: "Plans",           href: "/admin/plans",           icon: CreditCard, module: "plans"         as ModuleKey },
      { label: "Orders",          href: "/admin/orders",          icon: FileText,   module: "orders"        as ModuleKey },
      { label: "Referral Engine", href: "/admin/referral-engine", icon: Gift,       module: "referralEngine" as ModuleKey },
      { label: "Vouchers",        href: "/admin/vouchers",        icon: Tag,        module: "vouchers"      as ModuleKey },
      { label: "Invoices",        href: "/admin/invoices",        icon: Receipt,    module: "invoices"      as ModuleKey },
    ],
  },
  {
    label: "OPERATIONS",
    items: [
      { label: "Import Users",              href: "/admin/import-users",              icon: Users,     module: "importUsers"             as ModuleKey },
      { label: "Distributors",              href: "/admin/distributors",              icon: Handshake, module: "distributors"            as ModuleKey },
      { label: "Assign Distributor",        href: "/admin/assign-distributor",        icon: Users,     module: "assignDistributor"       as ModuleKey },
      { label: "Distributor Applications",  href: "/admin/distributor-applications",  icon: Briefcase, module: "distributorApplications" as ModuleKey },
      { label: "Distributor Payouts",       href: "/admin/distributor-payouts",       icon: Briefcase, module: "distributorPayouts"      as ModuleKey },
      { label: "Audit Logs",                href: "/admin/audit-logs",                icon: ScrollText, module: "auditLogs"             as ModuleKey },
    ],
  },
  {
    label: "SETTINGS",
    items: [
      { label: "Settings",         href: "/admin/settings",     icon: Settings,     module: "settings" as ModuleKey },
      { label: "Portal Users",     href: "/admin/portal-users", icon: Shield,       superAdminOnly: true },
      { label: "Role Permissions", href: "/admin/permissions",  icon: ShieldCheck,  superAdminOnly: true },
    ],
  },
];

const allNavItems = navGroups.flatMap((g) => g.items);

// ─────────────────────────────────────────────────────────────────────────────
// Single nav item
// ─────────────────────────────────────────────────────────────────────────────
function NavItem({
  item,
  collapsed,
  onClick,
}: {
  item: (typeof allNavItems)[0];
  collapsed: boolean;
  onClick?: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive =
    location.pathname === item.href ||
    location.pathname.startsWith(item.href + "/");

  const button = (
    <button
      onClick={() => { navigate(item.href); onClick?.(); }}
      className={cn(
        // base
        "relative w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg",
        "transition-all duration-150 cursor-pointer select-none",
        collapsed ? "justify-center" : "justify-start",
        // active vs idle
        isActive
          ? [
            "bg-primary/10 text-primary-glow",
            "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2",
            "before:h-5 before:w-0.5 before:rounded-full before:bg-blue-500",
          ]
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {/* icon */}
      <item.icon
        className={cn(
          "w-4 h-4 shrink-0",
          isActive ? "text-primary" : "text-muted-foreground"
        )}
      />

      {/* label */}
      {!collapsed && (
        <span className="flex-1 truncate leading-none">{item.label}</span>
      )}

    </button>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right" className="text-xs font-medium">
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar navigation list (shared by desktop + mobile)
// ─────────────────────────────────────────────────────────────────────────────
function SidebarNav({
  collapsed,
  onClick,
}: {
  collapsed: boolean;
  onClick?: () => void;
}) {
  const { user } = useUser();
  const { can } = usePermissions();
  const isSuperAdmin = (user.role ?? "").toUpperCase() === "SUPERADMIN";

  return (
    <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
      {navGroups.map((group, gi) => {
        const visibleItems = group.items.filter((item: any) => {
          if (item.superAdminOnly && !isSuperAdmin) return false;
          if (item.module && !isSuperAdmin) return can(item.module, "view");
          return true;
        });
        if (visibleItems.length === 0) return null;
        return (
          <div key={group.label}>
            {!collapsed && (
              <div className="mb-1.5 px-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground select-none">
                  {group.label}
                </p>
                <div className="mt-1 h-px bg-primary/20" />
              </div>
            )}
            {collapsed && gi > 0 && (
              <div className="my-1 mx-3 h-px bg-primary/20" />
            )}
            <div className="space-y-0.5">
              {visibleItems.map((item) => (
                <NavItem
                  key={item.href}
                  item={item}
                  collapsed={collapsed}
                  onClick={onClick}
                />
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// User Footer (Identity & Logout)
// ─────────────────────────────────────────────────────────────────────────────
function UserFooter({ collapsed, onLogout, onSettings }: { collapsed: boolean; onLogout: () => void; onSettings: () => void }) {
  const { isDark, toggleTheme } = useTheme();
  const { user } = useUser();
  const handleThemeChange = (next: boolean) => {
    if (next !== isDark) toggleTheme();
  };

  const initials = user.name
    ? user.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    : "AD";

  return (
    <div className="flex flex-col border-t border-border shrink-0 select-none">
      <div className={cn("px-3 py-2 flex items-center gap-2", collapsed ? "justify-center" : "justify-between")}>
        {!collapsed && <span className="text-[10px] font-bold text-muted-foreground pl-1 uppercase tracking-widest leading-none">Theme</span>}
        <ThemeSwitch
          checked={isDark}
          onCheckedChange={handleThemeChange}
          size={12}
          ariaLabel="Toggle theme"
        />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className={cn(
            "p-3 border-t border-border/50 cursor-pointer hover:bg-accent transition-colors",
            collapsed && "flex justify-center"
          )}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shadow-sm shadow-none shrink-0">
                {initials}
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-xs font-bold text-foreground truncate">{user.name || "Admin"}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                </>
              )}
            </div>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent side={collapsed ? "right" : "top"} align={collapsed ? "end" : "center"} className="w-56 mb-2">
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onSettings} className="cursor-pointer">
            <Settings className="w-4 h-4 mr-2" /> Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onLogout} className="text-danger cursor-pointer focus:text-red-600 focus:bg-red-50">
            <LogOut className="w-4 h-4 mr-2" /> Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main AdminLayout
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const currentPage = allNavItems.find(
    (i) =>
      location.pathname === i.href ||
      location.pathname.startsWith(i.href + "/")
  );

  const handleLogout = () => {
    sessionStorage.removeItem("wmd_admin_auth");
    sessionStorage.removeItem("token");
    localStorage.removeItem("token");
    navigate("/login");
  };
  const handleSettings = () => navigate("/admin/settings");


  // ── Sidebar shell (desktop) ──────────────────────────────────────────────
  const sidebarBg = "bg-card border-r border-border";

  return (
    <div className="flex h-screen bg-surface-2 overflow-hidden">

      {/* ══ Desktop Sidebar ══════════════════════════════════════════════════ */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 240 }}
        transition={{ type: "spring", bounce: 0, duration: 0.3 }}
        className={cn("hidden md:flex flex-col h-full shrink-0 z-20", sidebarBg)}
      >
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div
          className={cn(
            "flex items-center h-14 border-b border-border px-3 shrink-0",
            collapsed ? "justify-center" : "justify-between"
          )}
        >
          {/* logo + name */}
          <div className={cn("flex items-center gap-2.5 min-w-0", collapsed && "justify-center")}>
            <img src={`${import.meta.env.BASE_URL}Logo-2.png`} alt="WebMyDrive" className="w-8 h-8 object-contain shrink-0" />
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="min-w-0"
              >
                <p className="text-sm font-bold text-foreground leading-tight truncate">
                  WebMyDrive
                </p>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Admin Console
                </p>
              </motion.div>
            )}
          </div>

          {/* inline collapse arrow */}
          {!collapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setCollapsed(true)}
                  className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-primary transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">Collapse</TooltipContent>
            </Tooltip>
          )}

          {collapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setCollapsed(false)}
                  className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-primary transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">Expand</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* ── Nav ──────────────────────────────────────────────────────────── */}
        <SidebarNav collapsed={collapsed} />

        {/* ── Footer: User & Logout ────────────────────────────────────────── */}
        <UserFooter collapsed={collapsed} onLogout={handleLogout} onSettings={handleSettings} />

      </motion.aside>

      {/* ══ Mobile Drawer ════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              className={cn(
                "fixed left-0 top-0 h-full w-64 z-40 md:hidden flex flex-col",
                sidebarBg
              )}
            >
              <div className="flex items-center justify-between h-14 border-b border-border px-3">
                <div className="flex items-center gap-2.5">
                  <img src={`${import.meta.env.BASE_URL}Logo-2.png`} alt="WebMyDrive" className="w-8 h-8 object-contain shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-foreground leading-tight">WebMyDrive</p>
                    <p className="text-[10px] text-muted-foreground">Admin Console</p>
                  </div>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-1.5 rounded-md text-muted-foreground hover:bg-accent transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <SidebarNav collapsed={false} onClick={() => setMobileOpen(false)} />

              <UserFooter collapsed={false} onLogout={handleLogout} onSettings={handleSettings} />

            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ══ Main content ═════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Top bar ──────────────────────────────────────────────────────── */}
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 md:px-6 shrink-0 gap-4">

          {/* LEFT: Mobile Toggle & Title */}
          <div className="flex items-center gap-3 min-w-0">
            {/* mobile hamburger */}
            <button
              className="md:hidden p-2 rounded-lg text-muted-foreground hover:bg-surface-3 transition-colors"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* page title */}
            <h2 className="text-sm font-bold text-foreground leading-tight">
              {currentPage?.label ?? "Dashboard"}
            </h2>
          </div>

          {/* RIGHT: Time Range & Notifications only */}
          <div className="flex items-center gap-2 shrink-0">
          </div>
        </header>

        {/* ── Page content ─────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto bg-surface-2 relative">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
