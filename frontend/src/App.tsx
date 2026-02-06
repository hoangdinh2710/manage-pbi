import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ToastProvider } from "./components/ui";
import TabLayout from "./components/TabLayout";
import DashboardPage from "./pages/DashboardPage";
import DownloadPage from "./pages/DownloadPage";
import LocalModelsPage from "./pages/LocalModelsPage";
import BulkEditPage from "./pages/BulkEditPage";
import GatewayConnectionsPage from "./pages/GatewayConnectionsPage";
import Settings from "./pages/Settings";
import "./styles/app.css";

const App: React.FC = () => {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<TabLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="download" element={<DownloadPage />} />
            <Route path="bulk-edit" element={<BulkEditPage />} />
            <Route path="local-models" element={<LocalModelsPage />} />
          <Route path="gateway-connections" element={<GatewayConnectionsPage />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
};

export default App;
