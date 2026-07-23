// src/components/layout/Layout.jsx
import ChatWidget from "@/components/chat/ChatWidget";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";

export default function Layout() {
  return (
    <div className="min-h-screen bg-dark-50 dark:bg-dark-950 flex flex-col">
      <Navbar />
      <main className="flex-1 container-app pt-20 pb-6">
        <div className="page-enter">
          <Outlet />
        </div>
      </main>
      <ChatWidget />
    </div>
  );
}
