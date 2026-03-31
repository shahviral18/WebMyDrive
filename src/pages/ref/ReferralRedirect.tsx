import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { toast } from "sonner";

export default function ReferralRedirect() {
    const { code } = useParams();
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (code) {
            const clean = code.toUpperCase();
            // Force a clean state for the buyer (log out any existing sessions)
            localStorage.removeItem("token");
            sessionStorage.removeItem("wmd_user_auth");
            sessionStorage.removeItem("wmd_admin_auth");
            sessionStorage.removeItem("wmd_user_role");

            localStorage.setItem("wmd_pending_ref", clean);
            toast.success(`Referral link applied!`, { id: "ref-redirect" });
        }
        setReady(true);
    }, [code]);

    if (!ready) return null; // wait for localStorage to be written before redirecting

    return <Navigate to="/" replace />;
}
