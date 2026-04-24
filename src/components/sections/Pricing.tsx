import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { usePlans } from "@/hooks/use-plans";
import { Skeleton } from "@/components/ui/skeleton";

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDesktop;
}

const sharedFeatures = [
  "Google Drive",
  "Google Photos",
  "Google Mails Login",
  "Self Help Portal Access",
  "Remote Support",
];

function parseAmount(price: string): number {
  const value = Number(price.replace(/[^\d.]/g, ""));
  return Number.isFinite(value) ? value : 0;
}

function formatInr(value: number, decimals = 0): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function getPlanTitle(name: string): string {
  const cleanName = name.replace(/^Cloud Storage\s*[–-]\s*/i, "").trim();
  return `CLOUD STORAGE - ${cleanName.toUpperCase()}`;
}

function getStorageValue(storage: string): string {
  return storage.replace(/\s*Combined Storage$/i, "").trim();
}

export function Pricing() {
  const { data: plans, isLoading, error } = usePlans();
  const navigate = useNavigate();
  const [billingPeriod, setBillingPeriod] = React.useState<'monthly' | 'yearly'>('yearly');
  const isDesktop = useIsDesktop();

  const themeColors = [
    {
      button: "from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400",
      pill: "bg-gradient-to-r from-cyan-600 to-blue-600 shadow-cyan-900/50",
      couponBg: "bg-cyan-500/10 border-cyan-400/30",
      couponText: "from-cyan-300 to-blue-300",
      check: "text-cyan-400"
    },
    {
      button: "from-fuchsia-500 to-purple-500 hover:from-fuchsia-400 hover:to-purple-400",
      pill: "bg-gradient-to-r from-fuchsia-600 to-purple-600 shadow-fuchsia-900/50",
      couponBg: "bg-fuchsia-500/10 border-fuchsia-400/30",
      couponText: "from-fuchsia-300 to-purple-300",
      check: "text-fuchsia-400"
    },
    {
      button: "from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400",
      pill: "bg-gradient-to-r from-orange-600 to-amber-600 shadow-orange-900/50",
      couponBg: "bg-orange-500/10 border-orange-400/30",
      couponText: "from-orange-300 to-amber-300",
      check: "text-orange-400"
    },
    {
      button: "from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400",
      pill: "bg-gradient-to-r from-emerald-600 to-teal-600 shadow-emerald-900/50",
      couponBg: "bg-emerald-500/10 border-emerald-400/30",
      couponText: "from-emerald-300 to-teal-300",
      check: "text-emerald-400"
    },
  ];

  return (
    <section
      id="pricing"
      className="py-24 bg-gradient-to-b from-blue-50/50 via-white to-blue-50/50 relative scroll-mt-24"
    >
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-gradient-to-l from-indigo-100/40 to-transparent rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-tl from-purple-100/30 to-transparent rounded-full blur-3xl -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <h2 className="bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent font-semibold tracking-wider uppercase text-sm mb-3">
            Pricing
          </h2>
          <h3 className="text-3xl md:text-5xl font-display font-bold text-slate-900 mb-5">
            Pick your cloud storage plan
          </h3>
          <p className="text-lg text-slate-600 mb-8">
            Switch between monthly and annual billing.
          </p>

          <div className="flex justify-center gap-3 mb-2">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-6 py-2 rounded-full font-semibold transition-all ${billingPeriod === 'monthly'
                ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('yearly')}
              className={`px-6 py-2 rounded-full font-semibold transition-all ${billingPeriod === 'yearly'
                ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
            >
              Yearly
            </button>
          </div>
          <p className="text-sm text-slate-500 mb-8">Save up to 40% with annual billing</p>
        </div>

        {error || !plans || plans.length === 0 ? (
          <div className="text-center p-10 bg-white rounded-3xl shadow-xl">
            <p className="text-destructive font-semibold text-lg">Unable to load pricing plans.</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => window.location.reload()}
            >
              Try Again
            </Button>
          </div>
        ) : (
          <div className="rounded-3xl border border-gray-200 bg-white/50 overflow-hidden">
            <div
              className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200 h-full"
              style={isDesktop ? { gridTemplateColumns: `repeat(${plans?.length ?? 4}, minmax(0, 1fr))` } : undefined}
            >
              {isLoading
                ? Array(4)
                  .fill(0)
                  .map((_, index) => (
                    <div key={index} className="p-8">
                      <Skeleton className="h-6 w-full mb-8" />
                      <Skeleton className="h-5 w-40 mx-auto mb-10" />
                      <Skeleton className="h-12 w-32 mx-auto mb-4" />
                      <Skeleton className="h-4 w-48 mx-auto mb-6" />
                      <Skeleton className="h-11 w-full rounded-md mb-8" />
                      <Skeleton className="h-px w-full mb-8" />
                      <div className="space-y-4">
                        <Skeleton className="h-4 w-4/5" />
                        <Skeleton className="h-4 w-4/5" />
                        <Skeleton className="h-4 w-4/5" />
                        <Skeleton className="h-4 w-4/5" />
                        <Skeleton className="h-4 w-4/5" />
                      </div>
                    </div>
                  ))
                : plans?.map((plan, index) => {
                  const isYearly = billingPeriod === 'yearly';
                  const displayAmount = isYearly ? plan.yearlyPerMonth : plan.monthlyPrice;
                  const theme = themeColors[index % themeColors.length];

                  // Plan features + global features (deduplicated)
                  const customFeatures = plan.planFeatures ?? [];
                  const globalToAdd = sharedFeatures.filter(g => !customFeatures.some(c => c.toLowerCase().includes(g.toLowerCase())));
                  const featureList: string[] = customFeatures.length > 0
                    ? [...customFeatures, ...globalToAdd]
                    : [getStorageValue(plan.storage), ...sharedFeatures];

                  return (
                    <motion.div
                      key={plan.id}
                      initial={{ opacity: 0, y: 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.35, delay: index * 0.08 }}
                      className="p-8 text-slate-900 relative bg-white flex flex-col h-full"
                    >
                      <h4 className="text-center text-sm font-semibold tracking-[0.2em] text-slate-700 mb-8 mt-2">
                        {getPlanTitle(plan.name)}
                      </h4>

                      <p className="text-center text-slate-600 mb-10">{plan.storage}</p>

                      <div className="text-center mb-7 relative">
                        {plan.discount && (
                          <span className={`absolute -top-7 left-1/2 -translate-x-1/2 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg whitespace-nowrap ${theme.pill}`}>
                            {plan.discount}
                          </span>
                        )}
                        <p className="text-5xl font-display font-bold text-slate-900">
                          {formatInr(displayAmount)}
                        </p>
                        <div className="text-lg text-slate-600 mt-2 flex flex-col items-center gap-2">
                          <span>{billingPeriod === 'monthly' ? 'Billed Monthly' : 'Per Month / Billed Annually'}</span>
                          {plan.coupon && (
                            <span className="text-sm tracking-wide mt-1">
                              Use code:{" "}
                              <span className={`font-bold border px-2 py-0.5 rounded text-transparent bg-clip-text bg-gradient-to-r shadow-sm ${theme.couponBg} ${theme.couponText}`}>
                                {plan.coupon}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>

                      <ul className="space-y-4 flex-grow">
                        {featureList.map((feature) => (
                          <li key={`${plan.id}-${feature}`} className="flex items-center gap-3 text-slate-700">
                            <Check className={`h-4 w-4 ${theme.check}`} />
                            <span className="text-lg leading-none">{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <div className="my-9 h-px bg-slate-200" />

                      <Button
                        className={`w-full h-11 rounded-md text-sm font-semibold tracking-wide uppercase text-slate-950 bg-gradient-to-r ${theme.button} shadow-lg shadow-black/25 mt-2`}
                        onClick={() => navigate(`/subscribe/${plan.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`)}
                      >
                        Subscribe
                      </Button>
                    </motion.div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
