// src/components/common/ProtectedRoute.jsx
import { useAuth } from "@/context/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import LoadingSpinner from "./LoadingSpinner";

// Outlet pages — outlets use them fully; admin may browse (View Shop)
export const OutletRoute = ({ children }) => {
  const { user, isOutlet, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingSpinner fullPage />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!isOutlet && !isAdmin) return <Navigate to="/login" replace />;

  return children;
};

// Requires admin login
export const AdminRoute = ({ children }) => {
  const { user, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingSpinner fullPage />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!isAdmin) return <Navigate to="/login" replace />;

  return children;
};

// Requires editor OR admin login (for shared routes like /admin/orders,
// /admin/products which the editor role can also access).
export const StaffRoute = ({ children }) => {
  const { user, isAdmin, isEditor, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingSpinner fullPage />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!isAdmin && !isEditor) return <Navigate to="/login" replace />;

  return children;
};

// Redirect if already logged in
export const GuestRoute = ({ children }) => {
  const { user, isAdmin, isEditor, isOutlet, loading } = useAuth();

  if (loading) return <LoadingSpinner fullPage />;
  if (user && isAdmin) return <Navigate to="/admin" replace />;
  if (user && isEditor) return <Navigate to="/admin/orders" replace />;
  if (user && isOutlet) return <Navigate to="/shop" replace />;

  return children;
};
