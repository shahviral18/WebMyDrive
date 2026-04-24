import { useQuery } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/api";

export interface Plan {
  id: string;
  name: string;
  storage: string;
  price: string;
  monthlyPrice: number;
  yearlyPerMonth: number;   // priceINR / 12
  yearlyTotal: number;      // priceINR (annual total)
  yearlyPrice: number;      // kept for Pricing component compat (= yearlyTotal)
  discount?: string;
  coupon?: string;
  isBestSeller?: boolean;
  planFeatures: string[];   // plan-specific features from DB
}

function formatStorageGB(gb: number): string {
  if (gb >= 1024) return `${Math.round(gb / 1024)} TB Combined Storage`;
  return `${gb} GB Combined Storage`;
}

export function usePlans() {
  return useQuery({
    queryKey: ["plans"],
    queryFn: async (): Promise<Plan[]> => {
      const res = await fetch(getApiUrl("/user/plans"));
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      const raw: any[] = Array.isArray(data) ? data : (data.plans ?? []);

      return raw
        .filter(p => p.isActive !== 0 && p.isActive !== false)
        .map(plan => {
          const monthly: number = Number(plan.priceMonthlyINR) || Number(plan.price) || 0;
          const rawPriceINR = Number(plan.priceINR) || 0;
          // If priceINR < monthly it was entered as per-month-annually; otherwise it's annual total
          const annualTotal: number = rawPriceINR > 0
            ? (rawPriceINR < monthly ? rawPriceINR * 12 : rawPriceINR)
            : monthly * 12;
          const yearlyPerMonth = Math.round(annualTotal / 12);
          const storageGB: number = Number(plan.storageGB) || 0;

          // Parse plan-specific custom features
          const planFeatures: string[] = [];
          if (plan.features) {
            try {
              const feats = JSON.parse(plan.features);
              if (Array.isArray(feats)) {
                feats.forEach((f: any) => {
                  const label = typeof f === "string" ? f : (f.label ?? "");
                  if (label) planFeatures.push(label);
                });
              }
            } catch { /* ignore */ }
          }

          // Discount % from price difference
          const discountPct = monthly > 0 && yearlyPerMonth < monthly
            ? Math.round((1 - yearlyPerMonth / monthly) * 100)
            : 0;

          // Coupon from features text
          let coupon = "";
          const joined = planFeatures.join(" ");
          const couponMatch = joined.match(/Coupon:\s*(\w+)/i);
          if (couponMatch) coupon = couponMatch[1];
          const isBestSeller = /best\s*seller/i.test(joined);

          return {
            id: String(plan.id),
            name: plan.name,
            storage: formatStorageGB(storageGB),
            price: `₹${yearlyPerMonth}`,
            monthlyPrice: monthly,
            yearlyPerMonth,
            yearlyTotal: annualTotal,
            yearlyPrice: annualTotal,   // Pricing component divides by 12 → shows per-month
            discount: discountPct > 0 ? `${discountPct}% OFF` : undefined,
            coupon: coupon || undefined,
            isBestSeller,
            planFeatures,
          };
        });
    },
  });
}
