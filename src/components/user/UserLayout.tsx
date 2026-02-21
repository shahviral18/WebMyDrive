import { useState, useEffect } from "react";
import { Link, useLocation, Navigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    Cloud,
    LayoutDashboard,
    Settings,
    LogOut,
    CreditCard,
    Bell,
    Users,
    Sun,
    Moon,
    ChevronLeft,
    ChevronRight,
    Menu,
    Package,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useUser } from "@/contexts/UserContext";
import { useTheme } from "@/contexts/ThemeContext";

interface UserLayoutProps {
    children: React.ReactNode;
}

const navItems = [
    { label: "Dashboard", href: "/user/dashboard", icon: LayoutDashboard },
    { label: "Plans", href: "/user/plans", icon: Package },
    { label: "Referrals", href: "/user/referrals", icon: Users },
    { label: "Billing", href: "/user/billing", icon: CreditCard },
    { label: "Settings", href: "/user/settings", icon: Settings },
];

export default function UserLayout({ children }: UserLayoutProps) {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const { isDark, toggleTheme } = useTheme();  // ← single global source
    const location = useLocation();
    const { user } = useUser();

    // Declarative auth guard
    const isAuth = sessionStorage.getItem("wmd_user_auth") === "true";
    if (!isAuth) {
        return <Navigate to="/login" replace />;
    }

    const handleLogout = () => {
        sessionStorage.removeItem("wmd_user_auth");
        sessionStorage.removeItem("wmd_user_email");
        sessionStorage.removeItem("wmd_user_role");
        window.location.href = "/login";
    };

    const initials = user.name
        ? user.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
        : user.email[0].toUpperCase();

    function NavItem({ item, mobile = false }: { item: typeof navItems[0]; mobile?: boolean }) {
        const isActive = location.pathname === item.href;
        const btn = (
            <Link
                to={item.href}
                onClick={() => mobile && setMobileOpen(false)}
                className={cn(
                    "relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                    collapsed && !mobile ? "justify-center" : "justify-start",
                    isActive
                        ? "bg-primary/10 text-primary before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-0.5 before:rounded-full before:bg-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
            >
                <item.icon className={cn("w-5 h-5 shrink-0", isActive ? "text-primary" : "")} />
                {(!collapsed || mobile) && <span className="truncate">{item.label}</span>}
            </Link>
        );
        if (collapsed && !mobile) {
            return (
                <Tooltip>
                    <TooltipTrigger asChild>{btn}</TooltipTrigger>
                    <TooltipContent side="right" className="text-xs font-medium">{item.label}</TooltipContent>
                </Tooltip>
            );
        }
        return btn;
    }

    function SidebarContent({ mobile = false }: { mobile?: boolean }) {
        return (
            <>
                {/* Logo header */}
                <div className={cn(
                    "h-16 flex items-center border-b border-border px-4 shrink-0",
                    collapsed && !mobile ? "justify-center" : "justify-between"
                )}>
                    <div className={cn("flex items-center gap-2 text-primary font-bold text-lg min-w-0", collapsed && !mobile && "justify-center")}>
                        <Cloud className="w-6 h-6 shrink-0" />
                        {(!collapsed || mobile) && (
                            <motion.span initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="truncate text-base">
                                WebMyDrive
                            </motion.span>
                        )}
                    </div>
                    {!mobile && !collapsed && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button onClick={() => setCollapsed(true)} className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-primary transition-colors shrink-0">
                                    <ChevronLeft className="w-3.5 h-3.5" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="text-xs">Collapse</TooltipContent>
                        </Tooltip>
                    )}
                    {!mobile && collapsed && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button onClick={() => setCollapsed(false)} className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-primary transition-colors">
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="text-xs">Expand</TooltipContent>
                        </Tooltip>
                    )}
                </div>

                {/* Nav */}
                <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
                    {navItems.map(item => <NavItem key={item.href} item={item} mobile={mobile} />)}
                </nav>

                {/* User footer */}
                <div className={cn("p-3 border-t border-border", collapsed && !mobile ? "flex flex-col items-center gap-2" : "space-y-2")}>

                    {/* Theme Toggle */}
                    <div className={cn("flex items-center", collapsed && !mobile ? "justify-center" : "justify-between px-3 py-1")}>
                        {(!collapsed || mobile) && <span className="text-xs font-medium text-muted-foreground">Theme</span>}
                        <button onClick={toggleTheme} className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors flex items-center justify-center">
                            {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                        </button>
                    </div>

                    {/* Profile */}
                    <div className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-2",
                        collapsed && !mobile ? "px-0 py-0 bg-transparent justify-center" : ""
                    )}>
                        <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                            {initials}
                        </div>
                        {(!collapsed || mobile) && (
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-foreground truncate">{user.name || user.email}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{user.plan} Plan</p>
                            </div>
                        )}
                    </div>
                    {collapsed && !mobile ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button onClick={handleLogout} className="p-2 rounded-md text-danger hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
                                    <LogOut className="w-4 h-4" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="text-xs">Sign Out</TooltipContent>
                        </Tooltip>
                    ) : (
                        <button onClick={handleLogout} className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-danger hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
                            <LogOut className="w-4 h-4" /> Sign Out
                        </button>
                    )}
                </div>
            </>
        );
    }

    return (
        <div className="flex bg-surface-2 min-h-screen font-sans text-foreground">

            {/* Desktop Sidebar */}
            <motion.aside
                animate={{ width: collapsed ? 64 : 240 }}
                transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                className="hidden lg:flex flex-col bg-card border-r border-border h-screen sticky top-0 z-30 shrink-0 overflow-hidden"
            >
                <SidebarContent />
            </motion.aside>

            {/* Main */}
            <main className="flex-1 flex flex-col min-h-screen min-w-0">

                {/* Desktop Top Bar — SINGLE theme toggle lives here */}
                <header className="hidden lg:flex items-center justify-end h-14 px-6 border-b border-border bg-card sticky top-0 z-20 gap-3">

                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                        <Bell className="w-5 h-5" />
                    </Button>
                    <Button className="bg-primary hover:bg-primary/90 text-white rounded-full px-5 h-9 text-xs font-semibold shadow-md">
                        Upload New File
                    </Button>
                </header>

                {/* Mobile Top Bar — SINGLE theme toggle lives here */}
                <header className="lg:hidden h-14 bg-card border-b border-border flex items-center justify-between px-4 sticky top-0 z-20">
                    <div className="flex items-center gap-2 text-primary font-bold">
                        <Cloud className="w-5 h-5" />
                        <span className="text-sm">WebMyDrive</span>
                    </div>
                    <div className="flex items-center gap-1">

                        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
                            <Menu className="w-5 h-5" />
                        </Button>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto bg-surface-2 p-4 relative">
                    {children}
                </main>
            </main>

            {/* Mobile Drawer */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetContent side="left" className="w-[80vw] sm:w-[300px] p-0">
                    <div className="flex flex-col h-full bg-card">
                        <SidebarContent mobile />
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
