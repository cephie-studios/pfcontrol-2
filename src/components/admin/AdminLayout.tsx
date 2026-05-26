import { useState, type ReactNode } from "react";
import { MdMenu } from "react-icons/md";
import Navbar from "../Navbar";
import AdminSidebar from "./AdminSidebar";
import Toast from "../common/Toast";

export type AdminToast = {
  message: string;
  type: "success" | "error" | "info";
} | null;

type AdminLayoutProps = {
  children: ReactNode;
  toast?: AdminToast;
  onToastClose?: () => void;
};

export default function AdminLayout({
  children,
  toast,
  onToastClose,
}: AdminLayoutProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar mobileSidebarOpen={mobileSidebarOpen} />

      <div className="flex pt-16 min-h-[calc(100vh-4rem)]">
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
            aria-hidden
          />
        )}

        <div className="hidden lg:block shrink-0">
          <AdminSidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((c) => !c)}
          />
        </div>

        <div
          className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 lg:hidden ${
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <AdminSidebar
            collapsed={false}
            onToggle={() => setMobileSidebarOpen(false)}
          />
        </div>

        <main className="flex-1 min-w-0 p-4 sm:p-5 lg:p-6 overflow-x-hidden">
          {children}
        </main>
      </div>

      <button
        type="button"
        onClick={() => setMobileSidebarOpen(true)}
        className="lg:hidden fixed bottom-5 right-5 z-30 p-3.5 bg-blue-600 hover:bg-blue-500 rounded-full shadow-lg shadow-blue-900/40 transition-colors"
        aria-label="Open admin menu"
      >
        <MdMenu className="h-6 w-6 text-white" />
      </button>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={onToastClose ?? (() => {})}
        />
      )}
    </div>
  );
}