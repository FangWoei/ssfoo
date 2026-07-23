// src/components/layout/Navbar.jsx
import NotificationsBell from "@/components/layout/NotificationsBell";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import useCartStore from "@/context/cartStore";
import { logoutUser } from "@/firebase/auth";
import { useState } from "react";
import toast from "react-hot-toast";
import {
  FiGrid,
  FiLogOut,
  FiMenu,
  FiMoon,
  FiPackage,
  FiShoppingBag,
  FiShoppingCart,
  FiSun,
  FiUser,
  FiX,
} from "react-icons/fi";
import { Link, NavLink, useNavigate } from "react-router-dom";

export default function Navbar() {
  const { profile, outletName, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const items = useCartStore((s) => s.items);
  const totalItems = items.reduce((s, i) => s + i.qty, 0);
  const [menuOpen, setMenu] = useState(false);

  const handleLogout = async () => {
    try {
      await logoutUser();
      toast.success("Logged out");
      navigate("/login");
    } catch {
      toast.error("Logout failed");
    }
  };

  const navLinks = [
    { to: "/shop", label: "Shop", icon: <FiShoppingBag size={16} /> },
    { to: "/orders", label: "Orders", icon: <FiPackage size={16} /> },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-dark-900 border-b border-dark-100 dark:border-dark-800 shadow-sm">
      <div className="container-app">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            to="/shop"
            className="font-display text-xl sm:text-2xl font-bold text-primary-600 tracking-tight whitespace-nowrap shrink-0">
            SS FOO SDN.BHD.
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600"
                      : "text-dark-600 dark:text-dark-400 hover:bg-dark-50 dark:hover:bg-dark-800"
                  }`
                }>
                {l.icon}
                {l.label}
              </NavLink>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="btn-ghost p-2 rounded-lg text-dark-500 dark:text-dark-400">
              {theme === "dark" ? <FiSun size={18} /> : <FiMoon size={18} />}
            </button>

            {/* Notifications (admin only — outlets use chat widget) */}
            {isAdmin && <NotificationsBell />}

            {/* Cart */}
            <Link
              to="/cart"
              className="relative btn-ghost p-2 rounded-lg text-dark-500 dark:text-dark-400">
              <FiShoppingCart size={20} />
              {totalItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-primary-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                  {totalItems > 99 ? "99+" : totalItems}
                </span>
              )}
            </Link>

            {/* Account dropdown (desktop) */}
            <div className="relative group hidden md:block">
              <button className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-xl border border-dark-100 dark:border-dark-700 hover:border-primary-300 dark:hover:border-primary-700 transition-colors">
                <div className="w-7 h-7 rounded-lg bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
                  <FiUser size={14} className="text-primary-600" />
                </div>
                <div className="hidden lg:block text-left">
                  <p className="text-xs font-medium text-dark-800 dark:text-dark-200 leading-none">
                    {isAdmin
                      ? "Admin"
                      : outletName || profile?.email?.split("@")[0]}
                  </p>
                  <p className="text-[10px] text-dark-400 leading-none mt-0.5">
                    {isAdmin ? "Viewing shop" : profile?.outletId}
                  </p>
                </div>
              </button>

              {/* Dropdown */}
              <div className="absolute right-0 top-full mt-2 w-48 card dark:bg-dark-900 dark:border-dark-800 shadow-lg py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 origin-top-right scale-95 group-hover:scale-100">
                {isAdmin ? (
                  <Link
                    to="/admin"
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-primary-600 dark:text-primary-400 hover:bg-dark-50 dark:hover:bg-dark-800 font-medium">
                    <FiGrid size={14} />
                    Back to Dashboard
                  </Link>
                ) : (
                  <Link
                    to="/account"
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-dark-700 dark:text-dark-300 hover:bg-dark-50 dark:hover:bg-dark-800">
                    <FiUser size={14} />
                    Account
                  </Link>
                )}
                <hr className="border-dark-100 dark:border-dark-800 my-1" />
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                  <FiLogOut size={14} />
                  Logout
                </button>
              </div>
            </div>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMenu((s) => !s)}
              className="md:hidden btn-ghost p-2 rounded-lg text-dark-500 dark:text-dark-400">
              {menuOpen ? <FiX size={20} /> : <FiMenu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-dark-100 dark:border-dark-800 py-3 space-y-1">
            {/* Admin: back to dashboard */}
            {isAdmin && (
              <NavLink
                to="/admin"
                onClick={() => setMenu(false)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-primary-600 bg-primary-50 dark:bg-primary-900/20">
                <FiGrid size={16} />
                Back to Dashboard
              </NavLink>
            )}
            {navLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={() => setMenu(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600"
                      : "text-dark-600 dark:text-dark-400"
                  }`
                }>
                {l.icon}
                {l.label}
              </NavLink>
            ))}
            {!isAdmin && (
              <NavLink
                to="/account"
                onClick={() => setMenu(false)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-dark-600 dark:text-dark-400">
                <FiUser size={16} />
                Account
              </NavLink>
            )}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500">
              <FiLogOut size={14} />
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
