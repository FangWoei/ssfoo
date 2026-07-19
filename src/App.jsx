// src/App.jsx
import EnterToNext from "@/components/common/EnterToNext";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import {
  AdminRoute,
  GuestRoute,
  OutletRoute,
} from "@/components/common/ProtectedRoute";
import ScrollToTop from "@/components/common/ScrollToTop";
import Layout from "@/components/layout/Layout";
import { AuthProvider } from "@/context/AuthContext";
import AdminLayout from "@/pages/admin/AdminLayout";
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

// Auth
const LoginPage = lazy(() => import("@/pages/auth/LoginPage"));
const ForgotPasswordPage = lazy(
  () => import("@/pages/auth/ForgotPasswordPage"),
);

// Outlet
const ShopPage = lazy(() => import("@/pages/shop/ShopPage"));
const CartPage = lazy(() => import("@/pages/shop/CartPage"));
const CheckoutPage = lazy(() => import("@/pages/shop/CheckoutPage"));
const OrderSuccess = lazy(() => import("@/pages/shop/OrderSuccessPage"));
const OrdersPage = lazy(() => import("@/pages/user/OrdersPage"));
const OrderDetail = lazy(() => import("@/pages/user/OrderDetail"));
const AccountPage = lazy(() => import("@/pages/user/AccountPage"));

// Admin
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const AdminProducts = lazy(() => import("@/pages/admin/AdminProducts"));
const AdminProductForm = lazy(() => import("@/pages/admin/AdminProductForm"));
const AdminOrders = lazy(() => import("@/pages/admin/AdminOrders"));
const AdminOrderDetail = lazy(() => import("@/pages/admin/AdminOrderDetail"));
const AdminOutlets = lazy(() => import("@/pages/admin/AdminOutlets"));
const AdminCategories = lazy(() => import("@/pages/admin/AdminCategories"));
const AdminChats = lazy(() => import("@/pages/admin/AdminChats"));

const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));

const Fallback = () => <LoadingSpinner fullPage />;

export default function App() {
  return (
    <AuthProvider>
      <EnterToNext />
      <ScrollToTop />
      <Suspense fallback={<Fallback />}>
        <Routes>
          {/* ── Public ── */}
          <Route
            path="/login"
            element={
              <GuestRoute>
                <LoginPage />
              </GuestRoute>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <GuestRoute>
                <ForgotPasswordPage />
              </GuestRoute>
            }
          />

          {/* ── Outlet ── */}
          <Route
            element={
              <OutletRoute>
                <Layout />
              </OutletRoute>
            }>
            <Route index element={<Navigate to="/shop" replace />} />
            <Route path="/shop" element={<ShopPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/order-success" element={<OrderSuccess />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/orders/:id" element={<OrderDetail />} />
            <Route path="/account" element={<AccountPage />} />
          </Route>

          {/* ── Admin ── */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }>
            <Route index element={<AdminDashboard />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="products/new" element={<AdminProductForm />} />
            <Route path="products/:id/edit" element={<AdminProductForm />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="orders/:id" element={<AdminOrderDetail />} />
            <Route path="outlets" element={<AdminOutlets />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="chats" element={<AdminChats />} />
          </Route>

          {/* ── 404 ── */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
