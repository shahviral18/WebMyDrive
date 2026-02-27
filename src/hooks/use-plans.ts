import { useQuery } from "@tanstack/react-query";

export interface Plan {
  id: string;
  name: string;
  storage: string;
  price: string;
  discount?: string;
  coupon?: string;
  isBestSeller?: boolean;
}

const fallbackPlans: Plan[] = [
  {
    id: "1",
    name: "Cloud Storage – Basic",
    storage: "500 GB Combined Storage",
    price: "₹3000",
    discount: "10% OFF",
    coupon: "tds20",
  },
  {
    id: "2",
    name: "Cloud Storage – Professional",
    storage: "5 TB Combined Storage",
    price: "₹5000",
    discount: "20% OFF",
    coupon: "tds20",
  },
  {
    id: "3",
    name: "Cloud Storage – Premium",
    storage: "50 TB Combined Storage",
    price: "₹9000",
    discount: "40% OFF",
    coupon: "tds40",
    isBestSeller: true,
  },
  {
    id: "4",
    name: "Cloud Storage – Enterprise",
    storage: "100 TB Combined Storage",
    price: "₹15000",
    discount: "40% OFF",
    coupon: "tds40",
  },
];

export function usePlans() {
  return useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/plans");
        if (res.ok) {
          return (await res.json()) as Plan[];
        }
        throw new Error("fetch failed");
      } catch {
        // fallback to static list if backend not available
        return fallbackPlans;
      }
    },
  });
}
