import React from "react";
import { Outlet, Link, useLocation } from "react-router-dom";

const TabLayout: React.FC = () => {
  const location = useLocation();

  const tabs = [
    { path: "/", label: "Dashboard", exact: true },
    { path: "/download", label: "Download" },
    { path: "/bulk-edit", label: "Bulk Edit" },
    { path: "/local-models", label: "Local Models" },
    { path: "/settings", label: "Settings" },
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
          <h1>PowerBI Commander</h1>
          <nav className="tab-navigation">
            {tabs.map((tab) => (
              <Link
                key={tab.path}
                to={tab.path}
                className={`tab-item ${isActive(tab.path, tab.exact) ? "active" : ""}`}
              >
                {tab.label}
              </Link>
            ))}
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
