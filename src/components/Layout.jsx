import React, { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, MapPin, ScanLine, ArrowLeftRight,
  Menu, X, ChevronRight, TableProperties, Settings, Package, RefreshCw, LogOut, LogIn, User, BookOpen, MoreHorizontal, ShoppingCart, BarChart3 } from
"lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import OfflineSyncManager from "./OfflineSyncManager";


const navItems = [
{ path: "/Dashboard", label: "Dashboard", icon: LayoutDashboard },
{ path: "/Scanner", label: "Scanner", icon: ScanLine },
{ path: "/Inventory", label: "Inventory", icon: Package },
{ path: "/Locations", label: "Locations", icon: MapPin },
{ path: "/Transfers", label: "Transfers", icon: ArrowLeftRight },
{ path: "/InventoryLog", label: "Activity Log", icon: TableProperties },
{ path: "/Catalog", label: "Catalog", icon: BookOpen },
{ path: "/PurchaseOrders", label: "Purchase Orders", icon: ShoppingCart },
{ path: "/Reports", label: "Reports", icon: BarChart3 },
{ path: "/Settings", label: "Settings", icon: Settings }];


const SIDEBAR_BG = "#0d1117";
const SIDEBAR_ACTIVE = "#2563eb";
const SIDEBAR_HOVER = "rgba(255,255,255,0.07)";
const SIDEBAR_TEXT = "rgba(255,255,255,0.65)";
const SIDEBAR_TEXT_ACTIVE = "#ffffff";
const LOGO_ACCENT = "#f97316";

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user, navigateToLogin } = useAuth();



  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries();
      await queryClient.refetchQueries({ type: 'active' });
      window.location.reload();
    } catch (error) {
      console.error('Refresh failed:', error);
      setRefreshing(false);
    }
  };

  const NavLink = ({ item, onClick }) => {
    const isActive = location.pathname === item.path;
    return (
      <Link
        to={item.path}
        onClick={onClick}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "10px 12px",
          borderRadius: "8px",
          fontSize: "14px",
          fontWeight: 500,
          transition: "all 0.15s",
          color: isActive ? SIDEBAR_TEXT_ACTIVE : SIDEBAR_TEXT,
          background: isActive ? SIDEBAR_ACTIVE : "transparent",
          textDecoration: "none"
        }}
        onMouseEnter={(e) => {if (!isActive) e.currentTarget.style.background = SIDEBAR_HOVER;}}
        onMouseLeave={(e) => {if (!isActive) e.currentTarget.style.background = "transparent";}} className="bg-[#3c83f6]">
        
        <item.icon style={{ width: 18, height: 18, flexShrink: 0 }} />
        {item.label}
        {isActive && <ChevronRight style={{ width: 14, height: 14, marginLeft: "auto" }} />}
      </Link>);

  };

  const SidebarContent = ({ mobile = false }) =>
  <>
      <div style={{ padding: "20px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <img
          src="https://media.base44.com/images/public/69b3124b7d98dd82b5f338b4/bb1b98609_Stockrlogo.png"
          alt="Stockr"
          style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover" }} />
        
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#fff", letterSpacing: 1 }}>
              STOCK<span style={{ color: LOGO_ACCENT }}>R</span>
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Inventory Mgmt</div>
          </div>

        </div>
      </div>
      <nav style={{ flex: 1, padding: "16px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
         {navItems.map((item) =>
      <NavLink key={item.path} item={item} onClick={mobile ? () => setMobileOpen(false) : undefined} />
      )}
       </nav>
       <div style={{ padding: "12px", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 4 }}>
         <button
        onClick={handleRefresh}
        disabled={refreshing}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "10px 12px",
          borderRadius: "8px",
          fontSize: "14px",
          fontWeight: 500,
          transition: "all 0.15s",
          color: SIDEBAR_TEXT,
          background: "transparent",
          border: "none",
          cursor: refreshing ? "not-allowed" : "pointer",
          opacity: refreshing ? 0.6 : 1,
          width: "100%"
        }}
        onMouseEnter={(e) => {if (!refreshing) e.currentTarget.style.background = SIDEBAR_HOVER;}}
        onMouseLeave={(e) => {if (!refreshing) e.currentTarget.style.background = "transparent";}}>
        
           <RefreshCw style={{ width: 18, height: 18, flexShrink: 0, animation: refreshing ? "spin 1s linear infinite" : "none" }} />
           Refresh
         </button>

         {/* User / Auth */}
         {user ?
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
             <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.05)" }}>
               <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#f97316", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                 <User style={{ width: 14, height: 14, color: "#fff" }} />
               </div>
               <div style={{ flex: 1, minWidth: 0 }}>
                 <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.full_name || user.email}</div>
                 <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
               </div>
             </div>
             <button
          onClick={() => base44.auth.logout()}
          style={{
            display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
            borderRadius: 8, fontSize: 14, fontWeight: 500, transition: "all 0.15s",
            color: "rgba(255,100,100,0.8)", background: "transparent", border: "none",
            cursor: "pointer", width: "100%"
          }}
          onMouseEnter={(e) => {e.currentTarget.style.background = "rgba(255,80,80,0.1)";e.currentTarget.style.color = "#ff6b6b";}}
          onMouseLeave={(e) => {e.currentTarget.style.background = "transparent";e.currentTarget.style.color = "rgba(255,100,100,0.8)";}}>
          
               <LogOut style={{ width: 18, height: 18, flexShrink: 0 }} />
               Sign Out
             </button>
           </div> :

      <button
        onClick={() => base44.auth.redirectToLogin()}
        style={{
          display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
          borderRadius: 8, fontSize: 14, fontWeight: 500, transition: "all 0.15s",
          color: SIDEBAR_TEXT, background: "transparent", border: "none",
          cursor: "pointer", width: "100%"
        }}
        onMouseEnter={(e) => {e.currentTarget.style.background = SIDEBAR_HOVER;}}
        onMouseLeave={(e) => {e.currentTarget.style.background = "transparent";}}>
        
             <LogIn style={{ width: 18, height: 18, flexShrink: 0 }} />
             Sign In
           </button>
      }
       </div>
      </>;


  // Bottom tab bar items (mobile primary nav)
  const bottomTabs = [
    { path: "/Dashboard", label: "Home", icon: LayoutDashboard },
    { path: "/Scanner", label: "Scanner", icon: ScanLine },
    { path: "/Inventory", label: "Inventory", icon: Package },
    { path: "/Transfers", label: "Activity", icon: ArrowLeftRight },
  ];

  const isMoreActive = !["/Dashboard", "/Scanner", "/Inventory", "/Transfers"].includes(location.pathname);

  return (
    <div className="min-h-screen flex bg-background" style={{ '--spin': '360deg' }}>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Desktop Sidebar */}
      <aside
        className="hidden lg:flex flex-col w-64 fixed inset-y-0 left-0 z-30"
        style={{ background: SIDEBAR_BG, borderRight: "1px solid rgba(255,255,255,0.06)" }}>
        <SidebarContent />
      </aside>

      {/* Mobile Top Bar */}
      <div
        className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center justify-between px-4 shadow-lg"
        style={{ background: SIDEBAR_BG }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <img
            src="https://media.base44.com/images/public/69b3124b7d98dd82b5f338b4/bb1b98609_Stockrlogo.png"
            alt="Stockr"
            style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover" }} />
          <span style={{ fontWeight: 800, fontSize: 15, color: "#fff", letterSpacing: 1 }}>
            STOCK<span style={{ color: LOGO_ACCENT }}>R</span>
          </span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.6)", padding: 6 }}>
          <RefreshCw style={{ width: 18, height: 18, animation: refreshing ? "spin 1s linear infinite" : "none" }} />
        </button>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex"
        style={{ background: SIDEBAR_BG, borderTop: "1px solid rgba(255,255,255,0.1)", paddingBottom: "env(safe-area-inset-bottom)" }}>
        {bottomTabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5"
              style={{ color: isActive ? "#f97316" : "rgba(255,255,255,0.5)", textDecoration: "none" }}>
              <tab.icon style={{ width: 22, height: 22 }} />
              <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 500 }}>{tab.label}</span>
            </Link>
          );
        })}
        {/* More tab */}
        <button
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5"
          style={{ background: "transparent", border: "none", cursor: "pointer", color: isMoreActive ? "#f97316" : "rgba(255,255,255,0.5)" }}
          onClick={() => setMobileOpen(true)}>
          <MoreHorizontal style={{ width: 22, height: 22 }} />
          <span style={{ fontSize: 10, fontWeight: isMoreActive ? 700 : 500 }}>More</span>
        </button>
      </nav>

      {/* Mobile "More" Overlay (for secondary nav items) */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setMobileOpen(false)}>
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-2xl"
            style={{ background: SIDEBAR_BG, paddingBottom: "env(safe-area-inset-bottom)" }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700, color: "#fff", fontSize: 14 }}>More</span>
              <button onClick={() => setMobileOpen(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)" }}>
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>
            <div style={{ padding: "8px 12px" }}>
              {[
                { path: "/Locations", label: "Locations", icon: MapPin },
                { path: "/InventoryLog", label: "Activity Log", icon: TableProperties },
                { path: "/Catalog", label: "Catalog", icon: BookOpen },
                { path: "/PurchaseOrders", label: "Purchase Orders", icon: ShoppingCart },
                { path: "/Reports", label: "Reports", icon: BarChart3 },
                { path: "/Settings", label: "Settings", icon: Settings },
              ].map((item) => (
                <NavLink key={item.path} item={item} onClick={() => setMobileOpen(false)} />
              ))}
            </div>
            {/* User info */}
            {user && (
              <div style={{ padding: "8px 12px 16px", borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.05)", marginBottom: 4 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#f97316", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <User style={{ width: 14, height: 14, color: "#fff" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.full_name || user.email}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
                  </div>
                </div>
                <button
                  onClick={() => base44.auth.logout()}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 8, fontSize: 14, fontWeight: 500, color: "rgba(255,100,100,0.8)", background: "transparent", border: "none", cursor: "pointer", width: "100%" }}>
                  <LogOut style={{ width: 18, height: 18, flexShrink: 0 }} />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Offline sync banner + queue replay */}
      <OfflineSyncManager />

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 mt-14 lg:mt-0 pb-20 lg:pb-0 overflow-x-hidden">
        <div className="bg-background mx-auto p-4 lg:p-8 max-w-7xl w-full overflow-x-hidden">
          <Outlet />
        </div>
      </main>

    </div>
  );
}
