import { useGoogleLogin } from "@react-oauth/google";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";

interface GoogleSignInButtonProps {
    onSuccess: (response: { token: string; user: any }) => void;
    onError?: (msg: string) => void;
    label?: string;
    className?: string;
    /** Optional distributor ID to attach on new Google registrations */
    distributorId?: number;
}

export function GoogleSignInButton({
    onSuccess,
    onError,
    label = "Continue with Google",
    className = "",
    distributorId,
}: GoogleSignInButtonProps) {
    const [loading, setLoading] = useState(false);

    const login = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            setLoading(true);
            try {
                // Exchange the access_token for a user info object from Google, then
                // send the id_token to our backend. With the implicit flow we get
                // an access token, so we fetch userinfo ourselves.
                const infoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                    headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                });
                if (!infoRes.ok) throw new Error("Failed to get user info from Google.");
                const userInfo = await infoRes.json();

                // Send the verified email + name directly to our backend
                const res = await api.post("/auth/google-login", {
                    googleEmail: userInfo.email,
                    name: userInfo.name || userInfo.email.split("@")[0],
                    distributorId,
                });

                if (res.token) {
                    onSuccess({ token: res.token, user: res.user });
                } else {
                    throw new Error("No token returned from server.");
                }
            } catch (err: any) {
                const msg = err.message || "Google sign-in failed.";
                onError?.(msg);
            } finally {
                setLoading(false);
            }
        },
        onError: () => {
            onError?.("Google sign-in was cancelled or failed.");
        },
        flow: "implicit",
    });

    return (
        <button
            type="button"
            onClick={() => login()}
            disabled={loading}
            className={`w-full flex items-center justify-center gap-3 h-11 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition-all shadow-sm text-sm font-semibold text-gray-700 disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
        >
            {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
            ) : (
                <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
                    <path fill="#4285F4" d="M47.53 24.56c0-1.64-.15-3.22-.42-4.74H24v8.97h13.22c-.57 3.06-2.29 5.65-4.88 7.39v6.14h7.9c4.63-4.26 7.29-10.54 7.29-17.76z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.92-2.14 15.9-5.82l-7.9-6.14c-2.14 1.44-4.88 2.29-8 2.29-6.15 0-11.36-4.15-13.22-9.74H2.57v6.33C6.52 42.75 14.68 48 24 48z" />
                    <path fill="#FBBC05" d="M10.78 28.59A14.88 14.88 0 0 1 10 24c0-1.59.27-3.14.78-4.59v-6.33H2.57A23.94 23.94 0 0 0 0 24c0 3.86.92 7.52 2.57 10.92l8.21-6.33z" />
                    <path fill="#EA4335" d="M24 9.5c3.47 0 6.59 1.19 9.04 3.53l6.77-6.77C35.91 2.38 30.47 0 24 0 14.68 0 6.52 5.25 2.57 13.08l8.21 6.33C12.64 13.65 17.85 9.5 24 9.5z" />
                </svg>
            )}
            {loading ? "Signing in…" : label}
        </button>
    );
}
