import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL ?? "/";

async function publicGet(path: string) {
  const res = await fetch(`${BASE_URL}api/public${path}`, { method: "GET", headers: { "Content-Type": "application/json" } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function publicPost(path: string, body: object) {
  const res = await fetch(`${BASE_URL}api/public${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

interface Info {
  email: string;
  name: string;
  planName: string;
  amount: number;
  daysLeft: number;
}

export default function ReactivateAccount() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const [info, setInfo] = useState<Info | null>(null);
  const [tokenError, setTokenError] = useState("");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) { setTokenError("No token provided."); setLoading(false); return; }
    publicGet(`/reactivate?token=${encodeURIComponent(token)}`)
      .then(d => setInfo(d))
      .catch(e => setTokenError(e.message || "Invalid or expired link."))
      .finally(() => setLoading(false));
  }, [token]);

  const handlePay = async () => {
    if (!info || paying) return;
    setPaying(true);
    try {
      const sessionData = await publicPost("/reactivate/pay", { token });

      const loadWidget = async () => {
        try {
          const zpay = new (window as any).ZPayments({
            account_id: sessionData.account_id,
            domain: "IN",
            otherOptions: { api_key: sessionData.api_key },
          });

          const ref = sessionData.referenceNumber;

          let pollStopped = false;
          const poll = setInterval(async () => {
            if (pollStopped) return;
            try {
              const res = await fetch(`${BASE_URL}api/payment/status?ref=${encodeURIComponent(ref)}`);
              const d = await res.json();
              if (d.status === "COMPLETED") {
                pollStopped = true;
                clearInterval(poll);
                setSuccess(true);
                setPaying(false);
              }
            } catch {}
          }, 2000);

          const result = await zpay.requestPaymentMethod({
            payments_session_id: sessionData.payments_session_id,
            transaction_type: "payment",
            amount: parseFloat(sessionData.amount).toFixed(2),
            currency_code: "INR",
            reference_number: ref,
            business: "WebMyDrive",
            description: `WebMyDrive ${info.planName} — Account Reactivation`,
            address: { name: info.name || info.email, email: info.email },
          });

          pollStopped = true;
          clearInterval(poll);

          if (result?.status === "success" || result?.status === "succeeded") {
            setSuccess(true);
          } else if (result?.status === "widget_closed" || result?.status === "cancelled") {
            // do nothing
          } else {
            try {
              const res = await fetch(`${BASE_URL}api/payment/status?ref=${encodeURIComponent(ref)}`);
              const d = await res.json();
              if (d.status === "COMPLETED") { setSuccess(true); return; }
            } catch {}
          }
        } catch (err: any) {
          toast.error(err.message || "Payment failed");
        } finally {
          setPaying(false);
        }
      };

      const existing = document.getElementById("zpay-sdk");
      if (existing || (window as any).ZPayments) {
        loadWidget();
      } else {
        const script = document.createElement("script");
        script.id = "zpay-sdk";
        script.src = "https://static.zohocdn.com/zpay/zpay-js/v1/zpayments.js";
        script.async = true;
        script.onload = loadWidget;
        script.onerror = () => { toast.error("Failed to load payment widget."); setPaying(false); };
        document.body.appendChild(script);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to start payment");
      setPaying(false);
    }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(n);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <img src={`${BASE_URL}logo.png`} alt="WebMyDrive" className="h-10 mx-auto mb-3" onError={e => (e.currentTarget.style.display = "none")} />
          <h1 className="text-2xl font-bold text-slate-800">Restore Your Account</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          {loading && (
            <div className="flex flex-col items-center py-10 gap-3 text-slate-400">
              <Loader2 className="w-7 h-7 animate-spin" />
              <span className="text-sm">Verifying link…</span>
            </div>
          )}

          {!loading && tokenError && (
            <div className="flex flex-col items-center py-10 gap-3 text-center">
              <AlertTriangle className="w-10 h-10 text-amber-500" />
              <p className="font-semibold text-slate-700">Link Invalid or Expired</p>
              <p className="text-sm text-slate-500">{tokenError}</p>
              <p className="text-xs text-slate-400 mt-2">Please contact support if you believe this is an error.</p>
            </div>
          )}

          {!loading && !tokenError && success && (
            <div className="flex flex-col items-center py-10 gap-3 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              <p className="text-lg font-semibold text-slate-800">Account Reactivated!</p>
              <p className="text-sm text-slate-500">Your WebMyDrive account is now active. Check your email for login details.</p>
            </div>
          )}

          {!loading && !tokenError && !success && info && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Row label="Account" value={info.email} />
                <Row label="Plan" value={info.planName} />
                <Row label="Amount" value={fmt(info.amount)} />
                <Row label="Window" value={`${info.daysLeft} day${info.daysLeft !== 1 ? "s" : ""} remaining`} warn={info.daysLeft <= 5} />
              </div>

              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-amber-700 text-xs">
                After payment, your portal and Google Workspace access will be restored immediately.
              </div>

              <Button className="w-full" onClick={handlePay} disabled={paying}>
                {paying ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing…</> : "Pay & Reactivate Account"}
              </Button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Need help? Contact{" "}
          <a href="mailto:support@webmydrive.com" className="underline hover:text-slate-600">support@webmydrive.com</a>
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-medium ${warn ? "text-amber-600" : "text-slate-800"}`}>{value}</span>
    </div>
  );
}
