import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../services/apiClient";

interface ActivityStats {
  totalDownloads: number;
  totalUploads: number;
  recentActivity: Array<{
    type: "download" | "upload" | "update";
    timestamp: string;
    description: string;
  }>;
}

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<ActivityStats>({
    totalDownloads: 0,
    totalUploads: 0,
    recentActivity: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      // For now, use mock data. Can be replaced with actual API call
      // const response = await apiClient.get("/dashboard/stats");
      
      // Mock data
      setStats({
        totalDownloads: 0,
        totalUploads: 0,
        recentActivity: [],
      });
      setError(null);
    } catch (err) {
      setError("Failed to load dashboard data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-page">
      <h1>Dashboard</h1>
      <p className="subtitle">Welcome to PowerBI Commander</p>

      {loading && <div className="loading">Loading dashboard...</div>}
      {error && <div className="error-message">{error}</div>}

      {!loading && !error && (
        <>
          {/* Stats Cards */}
          <section className="stats-section">
            <div className="stats-grid">
              <div className="stats-card">
                <div className="stats-icon">📥</div>
                <div className="stats-content">
                  <h3>Total Downloads</h3>
                  <p className="stats-value">{stats.totalDownloads}</p>
                </div>
              </div>

              <div className="stats-card">
                <div className="stats-icon">📤</div>
                <div className="stats-content">
                  <h3>Total Uploads</h3>
                  <p className="stats-value">{stats.totalUploads}</p>
                </div>
              </div>

              <div className="stats-card">
                <div className="stats-icon">✅</div>
                <div className="stats-content">
                  <h3>System Status</h3>
                  <p className="stats-value status-active">Active</p>
                </div>
              </div>
            </div>
          </section>

          {/* Quick Actions */}
          <section className="quick-actions-section">
            <h2>Quick Actions</h2>
            <div className="action-buttons-grid">
              <button
                className="action-button primary"
                onClick={() => navigate("/download")}
              >
                <span className="action-icon">📥</span>
                <span className="action-label">Download Semantic Models</span>
                <span className="action-description">
                  Download models from Fabric workspace
                </span>
              </button>

              <button
                className="action-button secondary"
                onClick={() => navigate("/update")}
              >
                <span className="action-icon">✏️</span>
                <span className="action-label">Update Models</span>
                <span className="action-description">
                  Apply bulk updates and transformations
                </span>
              </button>

              <button
                className="action-button success"
                onClick={() => navigate("/upload")}
              >
                <span className="action-icon">📤</span>
                <span className="action-label">Upload & Deploy</span>
                <span className="action-description">
                  Deploy models to Fabric workspace
                </span>
              </button>

              <button
                className="action-button neutral"
                onClick={() => navigate("/settings")}
              >
                <span className="action-icon">⚙️</span>
                <span className="action-label">Settings</span>
                <span className="action-description">
                  Configure application settings
                </span>
              </button>
            </div>
          </section>

          {/* Recent Activity */}
          <section className="recent-activity-section">
            <h2>Recent Activity</h2>
            {stats.recentActivity.length === 0 ? (
              <p className="empty-state">No recent activity</p>
            ) : (
              <ul className="activity-list">
                {stats.recentActivity.map((activity, index) => (
                  <li key={index} className="activity-item">
                    <span className="activity-type">{activity.type}</span>
                    <span className="activity-description">{activity.description}</span>
                    <span className="activity-timestamp">{activity.timestamp}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default DashboardPage;
