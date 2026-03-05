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

const fallbackPlans: Plan[] = [
  {
    id: "4",
    name: "Cloud Storage – Basic",
    storage: "500 GB Combined Storage",
    price: "₹3000",
    monthlyPrice: 3000,
    yearlyPrice: 36000,
    discount: "10% OFF",
    coupon: "tds20",
  },
  {
    id: "5",
    name: "Cloud Storage – Professional",
    storage: "5 TB Combined Storage",
    price: "₹5000",
    monthlyPrice: 5000,
    yearlyPrice: 60000,
    discount: "20% OFF",
    coupon: "tds20",
  },
  {
    id: "6",
    name: "Cloud Storage – Premium",
    storage: "50 TB Combined Storage",
    price: "₹9000",
    monthlyPrice: 9000,
    yearlyPrice: 108000,
    discount: "40% OFF",
    coupon: "tds40",
    isBestSeller: true,
  },
  {
    id: "7",
    name: "Cloud Storage – Enterprise",
    storage: "100 TB Combined Storage",
    price: "₹15000",
    monthlyPrice: 15000,
    yearlyPrice: 180000,
    discount: "40% OFF",
    coupon: "tds40",
  },
];

export function usePlans() {
  return useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";
        const res = await fetch(`${apiUrl}/api/user/plans`);
        if (res.ok) {
          const data = await res.json();
          let plansArray = (data.plans || data) as any[];
          
          console.log("Raw API plans:", plansArray.map(p => ({ id: p.id, name: p.name })));
          
          // Filter to only include TechnoDoc plans (Cloud Storage – *)
          plansArray = plansArray.filter(p => p.name?.includes('Cloud Storage'));
          
          console.log("Filtered plans:", plansArray.map(p => ({ id: p.id, name: p.name })));
          
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
              price: `₹${plan.priceMonthlyINR || plan.monthlyPrice || plan.price || 499}`,
              monthlyPrice: plan.priceMonthlyINR || plan.monthlyPrice || plan.price || 499,
              yearlyPrice: plan.priceYearlyINR || plan.yearlyPrice || (plan.price || 499) * 12,
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
