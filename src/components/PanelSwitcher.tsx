import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Users, BarChart3 } from "lucide-react";

interface PanelSwitcherProps {
  currentPanel: "user" | "distributor";
}

export function PanelSwitcher({ currentPanel }: PanelSwitcherProps) {
  const navigate = useNavigate();
  const [hasUserToken, setHasUserToken] = useState(!!localStorage.getItem("wmd_user_token"));
  const [hasDistToken, setHasDistToken] = useState(!!localStorage.getItem("wmd_dist_token"));

  useEffect(() => {
    const sync = () => {
      setHasUserToken(!!localStorage.getItem("wmd_user_token"));
      setHasDistToken(!!localStorage.getItem("wmd_dist_token"));
    };
    window.addEventListener("storage", sync);
    // Poll briefly after mount in case tokens are set by the same tab
    const id = setInterval(sync, 1000);
    setTimeout(() => clearInterval(id), 8000);
    return () => { window.removeEventListener("storage", sync); clearInterval(id); };
  }, []);

  if (currentPanel === "distributor" && !hasUserToken) return null;
  if (currentPanel === "user" && !hasDistToken) return null;
  if (!hasUserToken && !hasDistToken) return null;

  const switchToUser = () => {
    const userToken = localStorage.getItem("wmd_user_token");
    if (!userToken) return;
    localStorage.setItem("wmd_dist_token", localStorage.getItem("token") || "");
    localStorage.setItem("token", userToken);
    sessionStorage.setItem("wmd_user_auth", "true");
    sessionStorage.setItem("wmd_user_role", "user");
    navigate("/user/dashboard");
    window.location.reload();
  };

  const switchToDistributor = () => {
    const distToken = localStorage.getItem("wmd_dist_token");
    if (!distToken) return;
    localStorage.setItem("wmd_user_token", localStorage.getItem("token") || "");
    localStorage.setItem("token", distToken);
    sessionStorage.setItem("wmd_user_role", "distributor");
    navigate("/distributor/dashboard");
    window.location.reload();
  };

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 rounded-lg border text-xs">
      <Button
        variant={currentPanel === "distributor" ? "default" : "ghost"}
        size="sm"
        className="h-7 px-2 text-xs gap-1.5"
        onClick={currentPanel === "user" ? switchToDistributor : undefined}
        disabled={currentPanel === "distributor"}
      >
        <BarChart3 className="w-3 h-3" />
        Distributor
      </Button>
      <Button
        variant={currentPanel === "user" ? "default" : "ghost"}
        size="sm"
        className="h-7 px-2 text-xs gap-1.5"
        onClick={currentPanel === "distributor" ? switchToUser : undefined}
        disabled={currentPanel === "user"}
      >
        <Users className="w-3 h-3" />
        My Account
      </Button>
    </div>
  );
}
