import { useLocation, Navigate } from "react-router-dom";

const NotFound = () => {
  const location = useLocation();

  if (location.pathname.startsWith("/admin")) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  if (location.pathname.startsWith("/distributor")) {
    return <Navigate to="/distributor/dashboard" replace />;
  }
  if (location.pathname.startsWith("/user")) {
    return <Navigate to="/user/dashboard" replace />;
  }
  return <Navigate to="/login" replace />;
};

export default NotFound;
