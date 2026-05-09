import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Users, BarChart3 } from "lucide-react";

interface PanelSwitcherProps {
  currentPanel: "user" | "distributor";
  collapsed?: boolean;
}

export function PanelSwitcher({ currentPanel, collapsed = false }: PanelSwitcherProps) {
  const navigate = useNavigate();
  const [hasUserToken, setHasUserToken] = useState(!!localStorage.getItem("wmd_user_token"));
  const [hasDistToken, setHasDistToken] = useState(!!localStorage.getItem("wmd_dist_token"));

  useEffect(() => {
    const sync = () => {
      setHasUserToken(!!localStorage.getItem("wmd_user_token"));
      setHasDistToken(!!localStorage.getItem("wmd_dist_token"));
    };
    window.addEventListener("storage", sync);
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

  const targetLabel = currentPanel === "user" ? "Distributor" : "My Account";
  const TargetIcon = currentPanel === "user" ? BarChart3 : Users;
  const handleSwitch = currentPanel === "user" ? switchToDistributor : switchToUser;

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleSwitch}
            className="p-2 rounded-md text-muted-foreground hover:bg-accent hover:text-primary transition-colors"
          >
            <TargetIcon className="w-4 h-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">Switch to {targetLabel}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <button
      onClick={handleSwitch}
      className={cn(
        "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
        "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      <TargetIcon className="w-5 h-5 shrink-0" />
      <span className="truncate">Switch to {targetLabel}</span>
    </button>
  );
}
