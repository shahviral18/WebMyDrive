import { useQuery } from "@tanstack/react-query";

export interface Plan {
  id: string;
  name: string;
  storage: string;
  price: string;
  monthlyPrice?: number;
  yearlyPrice?: number;
  discount?: string;
  coupon?: string;
  isBestSeller?: boolean;
}

import { MONTHLY_BASE_PRICES, roundDiscountedPrice, getShortPlanName } from "@/lib/pricing";



const basePlans = [
  { id: "4", name: "Cloud Storage – Basic", storage: "500 GB Combined Storage", discount: "10% OFF", coupon: "tds20" },
  { id: "5", name: "Cloud Storage – Professional", storage: "5 TB Combined Storage", discount: "20% OFF", coupon: "tds20" },
  { id: "6", name: "Cloud Storage – Premium", storage: "50 TB Combined Storage", discount: "40% OFF", coupon: "tds40", isBestSeller: true },
  { id: "7", name: "Cloud Storage – Enterprise", storage: "100 TB Combined Storage", discount: "40% OFF", coupon: "tds40" },
];

const fallbackPlans: Plan[] = basePlans.map(plan => {
  const shortName = getShortPlanName(plan.name);
  const monthly = MONTHLY_BASE_PRICES[shortName] || 330;
  const discountedMonthly = roundDiscountedPrice(monthly);
  return {
    ...plan,
    price: `₹${monthly}`,
    monthlyPrice: monthly,
    yearlyPrice: discountedMonthly * 12
  };
});

export function usePlans() {
  return useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      try {
        const isDev = import.meta.env.DEV;
        let apiUrl = import.meta.env.VITE_API_URL || "";
        if (!isDev && (apiUrl.includes("localhost") || apiUrl.includes("192.168") || apiUrl.includes("127.0.0.1"))) {
          apiUrl = "";
        }
        if (isDev) apiUrl = "";

        const res = await fetch(`${apiUrl}/api/user/plans`);
        if (res.ok) {
          const data = await res.json();
          let plansArray = Array.isArray(data.plans) ? data.plans : Array.isArray(data) ? data : [];

          if (plansArray.length > 0) {
            console.log("Raw API plans:", plansArray.map((p: any) => ({ id: p.id, name: p.name })));
          }

          // Filter to only include Cloud Storage plans (if they exist with that naming)
          const filteredByName = plansArray.filter(p => p.name?.includes('Cloud Storage'));

          // If we found Cloud Storage plans, use them; otherwise use all plans
          if (filteredByName.length > 0) {
            plansArray = filteredByName;
            console.log("Using Cloud Storage filtered plans:", plansArray.map(p => ({ id: p.id, name: p.name })));
          } else {
            console.log("No 'Cloud Storage' named plans found, using all plans:", plansArray.map(p => ({ id: p.id, name: p.name })));
          }

          // If still no plans found, use fallback
          if (plansArray.length === 0) {
            console.log("No plans found, using fallback plans");
            return fallbackPlans;
          }

          // Transform API response to frontend format
          const transformed = plansArray.map((plan: any) => {
            // Parse features array if it exists
            let discount = "0% OFF";
            let coupon = "";
            let isBestSeller = false;

            if (plan.features) {
              try {
                const features = JSON.parse(plan.features);
                const featureStr = features.join(" ");

                // Extract discount from features (e.g., "10% OFF", "20% OFF", "40% OFF")
                const discountMatch = featureStr.match(/(\d+%\s+OFF)/);
                if (discountMatch) {
                  discount = discountMatch[1];
                }

                // Extract coupon code (e.g., "Coupon: tds20")
                const couponMatch = featureStr.match(/Coupon:\s*(\w+)/);
                if (couponMatch) {
                  coupon = couponMatch[1];
                }

                // Check for best seller
                isBestSeller = featureStr.includes("Best Seller");
              } catch (e) {
                // Ignore parse errors
              }
            }

            return {
              id: String(plan.id),
              name: plan.name,
              storage: `${plan.storageGB || plan.storage || 500} GB Combined Storage`,
              price: `₹${MONTHLY_BASE_PRICES[getShortPlanName(plan.name)] || 499}`,
              monthlyPrice: MONTHLY_BASE_PRICES[getShortPlanName(plan.name)] || 499,
              yearlyPrice: roundDiscountedPrice(MONTHLY_BASE_PRICES[getShortPlanName(plan.name)] || 499) * 12,
              discount,
              coupon,
              isBestSeller,
            };
          }) as Plan[];

          console.log("Transformed plans:", transformed.map(p => ({ id: p.id, name: p.name })));
          return transformed;
        }
        throw new Error("fetch failed");
      } catch (error) {
        console.error("Plans fetch error:", error);
        // fallback to static list if backend not available
        return fallbackPlans;
      }
    },
  });
}
