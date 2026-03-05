import { Navigate } from "react-router-dom";
import Landing from "./Landing";

export default function Index() {
  const isAdminAuth = sessionStorage.getItem("wmd_admin_auth") === "true";
  if (isAdminAuth) return <Navigate to="/admin/dashboard" replace />;

  const isUserAuth = sessionStorage.getItem("wmd_user_auth") === "true";
  if (isUserAuth) {
    const role = sessionStorage.getItem("wmd_user_role");
    if (role === "distributor") return <Navigate to="/distributor/dashboard" replace />;
    return <Navigate to="/user/dashboard" replace />;
  }

  return <Landing />;
}
