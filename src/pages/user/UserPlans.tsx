import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Package, Loader2, AlertCircle, Zap } from "lucide-react";
import UserLayout from "@/components/user/UserLayout";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface Plan {
    id: number;
    name: string;
    price: number;
    priceINR?: number;
    features: string | null;
    isActive?: boolean;
    storageGB?: number;
    maxUsers?: number;
    googleSKU?: string;
}

function parseFeatures(f: string | null): string[] {
    if (!f) return [];
    try { return JSON.parse(f); } catch { return f.split(",").map(s => s.trim()).filter(Boolean); }
}

export default function UserPlans() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState<number | null>(null);

    useEffect(() => {
        api.get("/user/plans")
            .then(data => {
                const arr: Plan[] = Array.isArray(data) ? data : (data.plans || []);
                // Only show active plans
                setPlans(arr.filter(p => p.isActive !== false));
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const handlePurchase = async (plan: Plan) => {
        setPurchasing(plan.id);
        try {
            // Real Razorpay Checkout integration
            const data = await api.post("/referral/create-checkout", { planId: plan.id });
            if (data.success) {
                const options = {
                    key: data.razorpayKeyId,
                    amount: data.amount * 100,
                    currency: "INR",
                    name: "WebMyDrive",
                    description: `Subscription to ${plan.name}`,
                    order_id: data.rzpOrderId,
                    handler: async function (response: any) {
                        try {
                            const verifyData = await api.post("/referral/verify-payment", {
                                orderId: data.orderId,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_signature: response.razorpay_signature
                            });

                            if (verifyData.success) {
                                toast.success(`Payment successful! Upgraded to ${plan.name}.`);
                                // Refresh workspace if needed
                            } else {
                                toast.error(verifyData.error || "Payment verification failed");
                            }
                        } catch (e: any) {
                            toast.error(e.message || "Failed to verify transaction");
                        }
                    },
                    theme: { color: "#2563eb" }
                };

                // Dynamically load Razorpay script
                if (!(window as any).Razorpay) {
                    const script = document.createElement("script");
                    script.src = "https://checkout.razorpay.com/v1/checkout.js";
                    script.onload = () => {
                        const rzp = new (window as any).Razorpay(options);
                        rzp.open();
                    };
                    document.body.appendChild(script);
                } else {
                    const rzp = new (window as any).Razorpay(options);
                    rzp.open();
                }
            } else {
                toast.error(data.error || "Failed doing checkout session");
            }
        } catch (e: any) {
            toast.error(e.message || "Network error. Please try again.");
        } finally {
            setPurchasing(null);
        }
    };

    return (
        <UserLayout>
            <div className="space-y-8">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Plans & Pricing</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Choose the plan that's right for your team. All plans include Google Workspace provisioning.
                    </p>
                </div>

                {loading ? (
                    <div className="flex justify-center py-24">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : plans.length === 0 ? (
                    <div className="flex flex-col items-center gap-4 py-24 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-primary/5 border border-border flex items-center justify-center">
                            <AlertCircle className="w-7 h-7 text-muted-foreground" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">No plans available yet</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">Check back soon — we're adding plans shortly.</p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {plans.map((plan, i) => {
                            const features = parseFeatures(plan.features);
                            const price = plan.priceINR ?? plan.price ?? 0;
                            const isPopular = i === 1; // middle plan highlighted

                            return (
                                <motion.div
                                    key={plan.id}
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.07 }}
                                    className={`relative rounded-2xl border p-6 flex flex-col gap-5 transition-all
                                        ${isPopular
                                            ? "bg-primary border-primary shadow-lg shadow-primary/10 text-primary-foreground"
                                            : "bg-card border-border hover:border-primary/30 hover:shadow-md"
                                        }`}
                                >
                                    {isPopular && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-400 text-amber-900 shadow">
                                                <Zap className="w-3 h-3" /> Most Popular
                                            </span>
                                        </div>
                                    )}

                                    {/* Plan header */}
                                    <div className="flex items-start gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isPopular ? "bg-white/20" : "bg-primary/10"}`}>
                                            <Package className={`w-5 h-5 ${isPopular ? "text-white" : "text-primary"}`} />
                                        </div>
                                        <div>
                                            <h3 className={`font-bold text-lg ${isPopular ? "text-white" : "text-foreground"}`}>{plan.name}</h3>
                                            {plan.googleSKU && (
                                                <p className={`text-xs font-mono mt-0.5 ${isPopular ? "text-white/60" : "text-muted-foreground"}`}>{plan.googleSKU}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Price */}
                                    <div className="flex items-end gap-1">
                                        <span className={`text-3xl font-extrabold ${isPopular ? "text-white" : "text-foreground"}`}>
                                            ₹{price.toLocaleString("en-IN")}
                                        </span>
                                        <span className={`text-sm mb-1 ${isPopular ? "text-white/70" : "text-muted-foreground"}`}>/month</span>
                                    </div>

                                    {/* Meta */}
                                    {(plan.maxUsers || plan.storageGB) && (
                                        <div className={`flex gap-3 text-xs font-medium ${isPopular ? "text-white/80" : "text-muted-foreground"}`}>
                                            {plan.maxUsers ? <span>👥 {plan.maxUsers === 0 ? "Unlimited" : plan.maxUsers} users</span> : null}
                                            {plan.storageGB ? <span>💾 {plan.storageGB} GB storage</span> : null}
                                        </div>
                                    )}

                                    {/* Features */}
                                    {features.length > 0 && (
                                        <ul className="space-y-2 flex-1">
                                            {features.map(f => (
                                                <li key={f} className="flex items-start gap-2 text-sm">
                                                    <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${isPopular ? "text-white/80" : "text-primary"}`} />
                                                    <span className={isPopular ? "text-white/90" : "text-foreground/80"}>{f}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}

                                    {/* CTA */}
                                    <Button
                                        onClick={() => handlePurchase(plan)}
                                        disabled={purchasing === plan.id}
                                        className={`w-full mt-auto font-semibold ${isPopular
                                            ? "bg-white text-primary hover:bg-white/90"
                                            : "bg-primary text-primary-foreground hover:bg-primary/90"
                                            }`}
                                    >
                                        {purchasing === plan.id ? (
                                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing…</>
                                        ) : (
                                            "Get Started"
                                        )}
                                    </Button>
                                </motion.div>
                            );
                        })}
                    </div>
                )}

                {/* Footer note */}
                {plans.length > 0 && (
                    <p className="text-xs text-muted-foreground text-center">
                        All plans are billed monthly. Contact support for annual discounts or custom enterprise plans.
                    </p>
                )}
            </div>
        </UserLayout>
    );
}
