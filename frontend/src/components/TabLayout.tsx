import React from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Download,
  FileSpreadsheet,
  Database,
  Network,
  Settings,
  BarChart3,
} from "lucide-react";
import clsx from "clsx";

interface TabItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  exact?: boolean;
}

const TabLayout: React.FC = () => {
  const location = useLocation();

  const tabs: TabItem[] = [
    { path: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { path: "/download", label: "Download", icon: Download },
    { path: "/bulk-edit", label: "Bulk Edit", icon: FileSpreadsheet },
    { path: "/local-models", label: "Local Models", icon: Database },
    { path: "/gateway-connections", label: "Gateway & Connections", icon: Network },
    { path: "/settings", label: "Settings", icon: Settings },
  ];

  const isActive = (path: string, exact: boolean = false) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="tab-layout">
      <header className="header">
        <div className="header-content">
          <div className="header-top">
            <div className="header-logo" aria-hidden="true">
              <BarChart3 size={20} />
            </div>
            <h1>PowerBI Commander</h1>
          </div>
          <nav className="tab-navigation" role="tablist" aria-label="Main navigation">
            {tabs.map((tab) => {
              const TabIcon = tab.icon;
              const active = isActive(tab.path, tab.exact);
              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  className={clsx("tab-item", { active })}
                  role="tab"
                  aria-selected={active}
                  aria-current={active ? "page" : undefined}
                >
                  <TabIcon size={18} />
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="tab-content">
        <Outlet />
      </main>
    </div>
  );
};

export default TabLayout;
