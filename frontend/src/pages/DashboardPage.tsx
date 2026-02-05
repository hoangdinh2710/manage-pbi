import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Download,
  Upload,
  FileEdit,
  Settings,
  CheckCircle,
  Clock,
  ArrowRight,
  Inbox,
} from "lucide-react";
import { Spinner, SkeletonStatsCard } from "../components/ui";

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
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Mock data - can be replaced with actual API call
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
      <div className="page-header">
        <h1>Dashboard</h1>
        <p className="subtitle">Welcome to PowerBI Commander</p>
      </div>

      {/* Stats Cards */}
      <section className="stats-section">
        {loading ? (
          <div className="stats-grid">
            <SkeletonStatsCard />
            <SkeletonStatsCard />
            <SkeletonStatsCard />
          </div>
        ) : error ? (
          <div className="error-state">
            <div className="error-state-content">
              <div className="error-state-title">Error loading stats</div>
              <div className="error-state-message">{error}</div>
            </div>
          </div>
        ) : (
          <div className="stats-grid">
            <div className="stats-card">
              <div className="stats-icon">
                <Download />
              </div>
              <div className="stats-content">
                <h3>Total Downloads</h3>
                <p className="stats-value">{stats.totalDownloads}</p>
              </div>
            </div>

            <div className="stats-card">
              <div className="stats-icon">
                <Upload />
              </div>
              <div className="stats-content">
                <h3>Total Uploads</h3>
                <p className="stats-value">{stats.totalUploads}</p>
              </div>
            </div>

            <div className="stats-card">
              <div className="stats-icon success">
                <CheckCircle />
              </div>
              <div className="stats-content">
                <h3>System Status</h3>
                <p className="stats-value status-active">Active</p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Quick Actions */}
      <section className="quick-actions-section">
        <h2>Quick Actions</h2>
        <div className="action-buttons-grid">
          <button
            className="action-button primary"
            onClick={() => navigate("/download")}
          >
            <div className="action-icon">
              <Download />
            </div>
            <span className="action-label">Download Semantic Models</span>
            <span className="action-description">
              Download models from Fabric workspace
            </span>
          </button>

          <button
            className="action-button secondary"
            onClick={() => navigate("/bulk-edit")}
          >
            <div className="action-icon">
              <FileEdit />
            </div>
            <span className="action-label">Bulk Edit</span>
            <span className="action-description">
              Apply bulk updates via CSV
            </span>
          </button>

          <button
            className="action-button success"
            onClick={() => navigate("/local-models")}
          >
            <div className="action-icon">
              <Upload />
            </div>
            <span className="action-label">Manage Local Models</span>
            <span className="action-description">
              Deploy and manage local models
            </span>
          </button>

          <button
            className="action-button neutral"
            onClick={() => navigate("/settings")}
          >
            <div className="action-icon">
              <Settings />
            </div>
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
          <div className="empty-state">
            <div className="empty-state-icon">
              <Inbox />
            </div>
            <h3 className="empty-state-title">No recent activity</h3>
            <p className="empty-state-description">
              Your recent downloads, uploads, and updates will appear here.
            </p>
          </div>
        ) : (
          <ul className="activity-list">
            {stats.recentActivity.map((activity, index) => (
              <li key={index} className="activity-item">
                <div className="activity-icon">
                  {activity.type === "download" && <Download size={16} />}
                  {activity.type === "upload" && <Upload size={16} />}
                  {activity.type === "update" && <FileEdit size={16} />}
                </div>
                <div className="activity-content">
                  <span className="activity-description">
                    {activity.description}
                  </span>
                  <span className="activity-timestamp">
                    <Clock size={12} />
                    {activity.timestamp}
                  </span>
                </div>
                <ArrowRight size={16} className="activity-arrow" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default DashboardPage;
