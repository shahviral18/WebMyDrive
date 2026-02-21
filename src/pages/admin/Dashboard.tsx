import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, TrendingDown,
  Users, ArrowRight, IndianRupee, BarChart3,
  ShoppingCart, Inbox, CreditCard, Loader2,
} from "lucide-react";
import {
  Tooltip as UITooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

// ── Animation variants ────────────────────────────────────────────────────────
const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

// ── Animated number counter ────────────────────────────────────────────────────
function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const [display, setDisplay] = useState(0);
  const frameRef = useRef<number>();

  useEffect(() => {
    const start = 0;
    const end = value;
    const duration = 900;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplay(start + (end - start) * ease);
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [value]);

  const formatted =
    decimals > 0
      ? display.toFixed(decimals)
      : Math.round(display).toLocaleString("en-IN");

  return (
    <span>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  deltaLabel: string;
  deltaUp?: boolean;
  icon: React.ReactNode;
  tooltip: string;
  onClick?: () => void;
}

function KpiCard({
  label, value, prefix, suffix, decimals, deltaLabel, deltaUp,
  icon, tooltip, onClick,
}: KpiCardProps) {
  return (
    <UITooltip>
      <TooltipTrigger asChild>
        <motion.div
          variants={fadeUp}
          onClick={onClick}
          className={cn(
            "rounded-xl bg-surface-1 border border-border p-4 shadow-card transition-all duration-200",
            "hover:shadow-card-hover hover:border-border/80 hover:-translate-y-0.5",
            onClick && "cursor-pointer"
          )}
        >
          {/* Header row */}
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              {label}
            </p>
            <div className="w-8 h-8 rounded-lg bg-surface-2 border border-border flex items-center justify-center shrink-0">
              {icon}
            </div>
          </div>

          {/* Primary value */}
          <p className="text-2xl font-bold text-foreground tabular-nums mb-1">
            <AnimatedNumber
              value={value}
              prefix={prefix}
              suffix={suffix}
              decimals={decimals}
            />
          </p>

          {/* Delta */}
          <div
            className={cn(
              "flex items-center gap-1 text-xs",
              deltaUp === undefined
                ? "text-muted-foreground"
                : deltaUp
                  ? "text-success"
                  : "text-danger"
            )}
          >
            {deltaUp !== undefined &&
              (deltaUp ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              ))}
            <span>{deltaLabel}</span>
          </div>
        </motion.div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[200px] text-xs">
        {tooltip}
      </TooltipContent>
    </UITooltip>
  );
}

// ── Empty chart placeholder ───────────────────────────────────────────────────
function ChartEmpty({ message = "No activity yet. System standing by." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[180px] gap-3 text-center">
      <div className="w-12 h-12 rounded-xl bg-surface-2 border border-border flex items-center justify-center">
        <Inbox className="w-5 h-5 text-muted-foreground" />
      </div>
      <p className="text-xs text-muted-foreground max-w-[200px]">{message}</p>
    </div>
  );
}

// ── Action type config ─────────────────────────────────────────────────────────
const actionTypeConfig: Record<string, { color: string; label: string }> = {
  sync: { color: "bg-primary/20 text-primary border-primary/30", label: "Sync" },
  control: { color: "bg-warning/20 text-warning border-warning/30", label: "Control" },
  queue: { color: "bg-success/20 text-success border-success/30", label: "Queue" },
  danger: { color: "bg-danger/20 text-danger border-danger/30", label: "Danger" },
  billing: { color: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30", label: "Billing" },
  promo: { color: "bg-purple-500/20 text-purple-400 border-purple-500/30", label: "Promo" },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  return `${h}h ago`;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const [kpis, setKpis] = useState<any>(null);
  const [kpisLoading, setKpisLoading] = useState(true);

  useEffect(() => {
    api.get("/admin/kpis")
      .then(data => setKpis(data))
      .catch(console.error)
      .finally(() => setKpisLoading(false));
  }, []);

  const customTooltipStyle = {
    backgroundColor: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    color: "hsl(var(--foreground))",
    fontSize: "12px",
    padding: "8px 12px",
  };

  // ── Analytics KPI card definitions ────────────────────────────────────────
  const analyticsCards: KpiCardProps[] = [
    {
      label: "Total Users",
      value: kpis?.totalUsers || 0,
      deltaLabel: `${kpis?.totalOrders || 0} total orders`,
      deltaUp: (kpis?.totalUsers || 0) > 0,
      icon: <Users className="w-4 h-4 text-primary" />,
      tooltip: "Total registered customers across all plans.",
      onClick: () => navigate("/admin/users"),
    },
    {
      label: "Monthly Revenue",
      value: kpis?.monthRevenue || 0,
      prefix: "₹",
      deltaLabel: `₹${(kpis?.totalRevenue || 0).toLocaleString("en-IN")} all time`,
      deltaUp: (kpis?.monthRevenue || 0) > 0,
      icon: <IndianRupee className="w-4 h-4 text-success" />,
      tooltip: "Total billing collected this month.",
      onClick: () => navigate("/admin/orders"),
    },
    {
      label: "Active Distributors",
      value: kpis?.activeDistributors || 0,
      deltaLabel: "Active & approved",
      deltaUp: (kpis?.activeDistributors || 0) > 0,
      icon: <CreditCard className="w-4 h-4 text-indigo-400" />,
      tooltip: "Number of active distributor accounts.",
      onClick: () => navigate("/admin/distributors"),
    },
    {
      label: "Pending Orders",
      value: kpis?.pendingOrders || 0,
      deltaLabel: kpis?.pendingOrders > 0 ? "Awaiting payment" : "All clear",
      deltaUp: (kpis?.pendingOrders || 0) === 0,
      icon: <BarChart3 className="w-4 h-4 text-orange-500" />,
      tooltip: "Orders that are pending payment verification.",
      onClick: () => navigate("/admin/orders"),
    },
  ];

  return (
    <div className="p-6 space-y-8 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
        <p className="text-muted-foreground mt-1">Platform analytics and metrics</p>
      </div>

      {/* ── 2. Analytics Cards ── */}
      {kpisLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {analyticsCards.map((card) => (
            <KpiCard key={card.label} {...card} />
          ))}
        </motion.div>
      )}

      {/* ── 3. Revenue Timeline ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-xl bg-surface-1 border border-border p-5 shadow-card"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Revenue Timeline
            </h3>
            <p className="text-xs text-muted-foreground">
              Monthly revenue (₹) — last 6 months
            </p>
          </div>
          <span className="text-xs text-muted-foreground font-mono bg-surface-2 border border-border px-2 py-0.5 rounded-md">
            ₹ INR
          </span>
        </div>
        {/* Revenue Timeline — empty state until real time-series API is built */}
        {<ChartEmpty message="Connect time-series API to show revenue chart." />}
      </motion.div>
    </div>
  );
}
