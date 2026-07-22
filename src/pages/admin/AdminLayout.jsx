// src/pages/admin/AdminLayout.jsx
import logo from "@/assets/logo.jpg";
import NotificationsBell from "@/components/layout/NotificationsBell";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { logoutUser } from "@/firebase/auth";
import { listenAllChats } from "@/firebase/chat";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  FiBox,
  FiExternalLink,
  FiGrid,
  FiHome,
  FiLogOut,
  FiMenu,
  FiMessageCircle,
  FiMoon,
  FiShoppingBag,
  FiSun,
  FiTag,
} from "react-icons/fi";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: FiGrid, end: true },
  { to: "/admin/products", label: "Products", icon: FiBox },
  { to: "/admin/orders", label: "Orders", icon: FiShoppingBag },
  { to: "/admin/outlets", label: "Outlets", icon: FiHome },
  { to: "/admin/categories", label: "Categories & Brands", icon: FiTag },
  { to: "/admin/chats", label: "Chats", icon: FiMessageCircle },
];

export default function AdminLayout() {
  const { isAdmin } = useAuth();
  const [chatUnread, setChatUnread] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;
    return listenAllChats((all) =>
      setChatUnread(all.filter((c) => c.unreadByAdmin).length),
    );
  }, [isAdmin]);

  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [sideOpen, setSideOpen] = useState(false);

  const handleLogout = async () => {
    await logoutUser();
    toast.success("Logged out");
    navigate("/login");
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white dark:bg-dark-900">
      {/* Header */}
      <div className="flex flex-col px-5 py-3 h-16 border-b border-dark-100 dark:border-dark-800 shrink-0 justify-center">
        <span className="text-lg font-display font-bold text-primary-600">
          Ssfoo
        </span>
        <div className="text-[10px] bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 px-2 py-0.5 rounded-full font-medium w-fit">
          Admin
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setSideOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? "bg-primary-600 text-white"
                  : "text-dark-600 dark:text-dark-400 hover:bg-dark-50 dark:hover:bg-dark-800 hover:text-dark-900 dark:hover:text-dark-100"
              }`
            }>
            <Icon size={18} />
            <span style={{ flex: 1 }}>{label}</span>
            {label === "Chats" && chatUnread > 0 && (
              <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {chatUnread > 99 ? "99+" : chatUnread}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-dark-100 dark:border-dark-800 space-y-1">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-dark-500 dark:text-dark-400 hover:bg-dark-50 dark:hover:bg-dark-800 transition-colors">
          {theme === "dark" ? <FiSun size={16} /> : <FiMoon size={16} />}
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </button>
        <NavLink
          to="/shop"
          target="_blank"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-dark-500 dark:text-dark-400 hover:bg-dark-50 dark:hover:bg-dark-800 transition-colors">
          <FiExternalLink size={16} /> View Shop
        </NavLink>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
          <FiLogOut size={16} /> Logout
        </button>
        <div className="flex items-center gap-2.5 px-3 py-2">
          <img
            src={logo}
            alt="Ssfoo"
            className="h-8 w-8 rounded-full object-cover shrink-0 border border-primary-100 dark:border-primary-800"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-dark-800 dark:text-dark-200 truncate">
              Administrator
            </p>
            <p className="text-[11px] text-dark-400 truncate">{user?.email}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-dark-50 dark:bg-dark-950 overflow-hidden">
      <aside className="hidden md:flex w-56 border-r border-dark-100 dark:border-dark-800 flex-col shrink-0">
        <SidebarContent />
      </aside>

      {sideOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSideOpen(false)}
          />
          <aside className="relative w-64 flex flex-col shadow-xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex md:hidden items-center gap-3 h-14 px-4 bg-white dark:bg-dark-900 border-b border-dark-100 dark:border-dark-800">
          <button
            onClick={() => setSideOpen(true)}
            className="text-dark-600 dark:text-dark-400">
            <FiMenu size={22} />
          </button>
          <span className="font-display font-bold text-dark-900 dark:text-white">
            Ssfoo Admin
          </span>
          <div className="ml-auto">
            <NotificationsBell />
          </div>
        </div>
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 bg-dark-50 dark:bg-dark-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
