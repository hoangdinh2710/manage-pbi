import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Save, RotateCcw, Zap, CheckCircle, AlertCircle } from "lucide-react";
import { configApi } from "../services/apiClient";
import { Button, Spinner } from "../components/ui";
import { useToast } from "../components/ui";
import type { UserConfig, UserConfigUpdate } from "../types";

export default function Settings() {
  const { success: showSuccess, error: showError } = useToast();
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Form state
  const [downloadFolder, setDownloadFolder] = useState("");
  const [namingStrategy, setNamingStrategy] = useState<"model_name" | "model_id">("model_name");
  const [autoBackup, setAutoBackup] = useState(true);
  const [backupRetention, setBackupRetention] = useState(30);
  const [downloadWorkers, setDownloadWorkers] = useState(2);
  const [bulkWorkers, setBulkWorkers] = useState(5);
  const [httpTimeout, setHttpTimeout] = useState(30);
  const [logLevel, setLogLevel] = useState("INFO");
  // Power BI fields
  const [tenantId, setTenantId] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [powerbiApiBase, setPowerbiApiBase] = useState("");
  const [powerbiScope, setPowerbiScope] = useState("");
  const [powerbiTenantPresent, setPowerbiTenantPresent] = useState(false);
  const [powerbiClientPresent, setPowerbiClientPresent] = useState(false);
  const [testingPowerbi, setTestingPowerbi] = useState(false);
  const [powerbiTestResult, setPowerbiTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await configApi.getConfig();
      setConfig(data);
      
      setDownloadFolder(data.download_folder);
      setNamingStrategy(data.output_naming_strategy);
      setAutoBackup(data.enable_auto_backup);
      setBackupRetention(data.backup_retention_days);
      setDownloadWorkers(data.parallel_download_workers);
      setBulkWorkers(data.parallel_bulk_workers);
      setHttpTimeout(data.http_timeout_seconds);
      setLogLevel(data.log_level);
      setPowerbiApiBase((data as any).powerbi_api_base || "");
      setPowerbiScope((data as any).powerbi_scope || "");
      setPowerbiTenantPresent(Boolean((data as any).powerbi_tenant_present));
      setPowerbiClientPresent(Boolean((data as any).powerbi_client_present));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load configuration");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const updates: UserConfigUpdate = {
        download_folder: downloadFolder,
        output_naming_strategy: namingStrategy,
        enable_auto_backup: autoBackup,
        backup_retention_days: backupRetention,
        parallel_download_workers: downloadWorkers,
        parallel_bulk_workers: bulkWorkers,
        http_timeout_seconds: httpTimeout,
        log_level: logLevel,
      };

      if (tenantId !== "") updates.tenant_id = tenantId;
      if (clientId !== "") updates.client_id = clientId;
      if (clientSecret !== "") updates.client_secret = clientSecret;
      if (powerbiApiBase !== "") updates.powerbi_api_base = powerbiApiBase;
      if (powerbiScope !== "") updates.powerbi_scope = powerbiScope;

      const updated = await configApi.updateConfig(updates);
      setConfig(updated);
      showSuccess("Configuration saved successfully!");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleTestPowerbi = async () => {
    try {
      setTestingPowerbi(true);
      setPowerbiTestResult(null);
      const res = await configApi.testPowerBi();
      if (res.ok) {
        setPowerbiTestResult({ ok: true, message: `Connected — token expires in ${res.token_expires_in || 'unknown'}s` });
      } else {
        setPowerbiTestResult({ ok: false, message: res.error || 'Unknown error' });
      }
    } catch (err) {
      setPowerbiTestResult({ ok: false, message: err instanceof Error ? err.message : 'Test failed' });
    } finally {
      setTestingPowerbi(false);
    }
  };

  const handleReset = () => {
    if (config) {
      setDownloadFolder(config.download_folder);
      setNamingStrategy(config.output_naming_strategy);
      setAutoBackup(config.enable_auto_backup);
      setBackupRetention(config.backup_retention_days);
      setDownloadWorkers(config.parallel_download_workers);
      setBulkWorkers(config.parallel_bulk_workers);
      setHttpTimeout(config.http_timeout_seconds);
      setLogLevel(config.log_level);
      setPowerbiApiBase((config as any).powerbi_api_base || "");
      setPowerbiScope((config as any).powerbi_scope || "");
      setTenantId("");
      setClientId("");
      setClientSecret("");
    }
  };

  if (loading) {
    return (
      <div className="loading-state">
        <Spinner size="lg" label="Loading configuration..." />
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1>Settings</h1>
        <p className="subtitle">Configure application settings and preferences</p>
      </div>

      {error && (
        <div className="error-state">
          <AlertCircle size={20} className="error-state-icon" />
          <div className="error-state-content">
            <div className="error-state-message">{error}</div>
          </div>
        </div>
      )}

      <div className="settings-content">
        {/* File Operations Section */}
        <section className="settings-section">
          <h2 className="settings-section-title">File Operations</h2>
          
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="downloadFolder">Download Folder Path</label>
              <input
                id="downloadFolder"
                type="text"
                value={downloadFolder}
                onChange={(e) => setDownloadFolder(e.target.value)}
                placeholder="downloads"
              />
              <span className="form-hint">
                Path where downloaded semantic model definitions will be saved
              </span>
            </div>

            <div className="form-field">
              <label htmlFor="namingStrategy">Output Naming Strategy</label>
              <select
                id="namingStrategy"
                value={namingStrategy}
                onChange={(e) => setNamingStrategy(e.target.value as "model_name" | "model_id")}
              >
                <option value="model_name">Model Name</option>
                <option value="model_id">Model ID</option>
              </select>
              <span className="form-hint">Choose how to name downloaded model folders</span>
            </div>

            <div className="form-field checkbox">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={autoBackup}
                  onChange={(e) => setAutoBackup(e.target.checked)}
                />
                <span>Enable automatic backups</span>
              </label>
            </div>

            <div className="form-field">
              <label htmlFor="backupRetention">Backup Retention (days)</label>
              <input
                id="backupRetention"
                type="number"
                min="1"
                max="365"
                value={backupRetention}
                onChange={(e) => setBackupRetention(parseInt(e.target.value))}
              />
              <span className="form-hint">Number of days to retain backup files</span>
            </div>
          </div>
        </section>

        {/* Performance Section */}
        <section className="settings-section">
          <h2 className="settings-section-title">Performance</h2>
          
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="downloadWorkers">
                Parallel Download Workers: <strong>{downloadWorkers}</strong>
              </label>
              <input
                id="downloadWorkers"
                type="range"
                min="1"
                max="10"
                value={downloadWorkers}
                onChange={(e) => setDownloadWorkers(parseInt(e.target.value))}
                className="range-input"
              />
              <span className="form-hint">Number of concurrent downloads (1-10)</span>
            </div>

            <div className="form-field">
              <label htmlFor="bulkWorkers">
                Parallel Bulk Workers: <strong>{bulkWorkers}</strong>
              </label>
              <input
                id="bulkWorkers"
                type="range"
                min="1"
                max="10"
                value={bulkWorkers}
                onChange={(e) => setBulkWorkers(parseInt(e.target.value))}
                className="range-input"
              />
              <span className="form-hint">Number of concurrent bulk operations (1-10)</span>
            </div>
          </div>
        </section>

        {/* Advanced Settings Section */}
        <section className="settings-section">
          <button
            className="settings-section-toggle"
            onClick={() => setShowAdvanced(!showAdvanced)}
            type="button"
          >
            {showAdvanced ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
            <span>Advanced Settings</span>
          </button>

          {showAdvanced && (
            <div className="settings-section-content">
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="httpTimeout">HTTP Timeout (seconds)</label>
                  <input
                    id="httpTimeout"
                    type="number"
                    min="5"
                    max="300"
                    value={httpTimeout}
                    onChange={(e) => setHttpTimeout(parseInt(e.target.value))}
                  />
                  <span className="form-hint">Timeout for HTTP requests (5-300 seconds)</span>
                </div>

                <div className="form-field">
                  <label htmlFor="logLevel">Log Level</label>
                  <select
                    id="logLevel"
                    value={logLevel}
                    onChange={(e) => setLogLevel(e.target.value)}
                  >
                    <option value="DEBUG">DEBUG</option>
                    <option value="INFO">INFO</option>
                    <option value="WARNING">WARNING</option>
                    <option value="ERROR">ERROR</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                  <span className="form-hint">Logging verbosity level</span>
                </div>
              </div>

              {config && (
                <div className="readonly-settings">
                  <h3>System Configuration (Read-only)</h3>
                  <div className="readonly-grid">
                    <div className="readonly-item">
                      <span className="readonly-label">Fabric API Base</span>
                      <span className="readonly-value">{config.fabric_api_base}</span>
                    </div>
                    <div className="readonly-item">
                      <span className="readonly-label">Max Retries</span>
                      <span className="readonly-value">{config.operation_max_retries}</span>
                    </div>
                    <div className="readonly-item">
                      <span className="readonly-label">Retry Delay</span>
                      <span className="readonly-value">{config.operation_retry_delay_seconds}s</span>
                    </div>
                    <div className="readonly-item">
                      <span className="readonly-label">Definition Format</span>
                      <span className="readonly-value">{config.definition_format}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Power BI Credentials */}
              <div className="credentials-section">
                <h3>Power BI Credentials</h3>
                
                <div className="form-grid">
                  <div className="form-field">
                    <label htmlFor="tenantId">Tenant ID</label>
                    <input
                      id="tenantId"
                      type="text"
                      value={tenantId}
                      onChange={(e) => setTenantId(e.target.value)}
                      placeholder={powerbiTenantPresent ? "(already configured)" : "Enter tenant ID"}
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="clientId">Client ID</label>
                    <input
                      id="clientId"
                      type="text"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      placeholder={powerbiClientPresent ? "(already configured)" : "Enter client ID"}
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="clientSecret">Client Secret</label>
                    <input
                      id="clientSecret"
                      type="password"
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      placeholder="(leave empty to keep current)"
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="powerbiApiBase">Power BI API Base</label>
                    <input
                      id="powerbiApiBase"
                      type="text"
                      value={powerbiApiBase}
                      onChange={(e) => setPowerbiApiBase(e.target.value)}
                      placeholder="https://api.powerbi.com/v1.0/myorg"
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="powerbiScope">Power BI Scope</label>
                    <input
                      id="powerbiScope"
                      type="text"
                      value={powerbiScope}
                      onChange={(e) => setPowerbiScope(e.target.value)}
                      placeholder="https://analysis.windows.net/powerbi/api/.default"
                    />
                  </div>
                </div>

                <div className="test-connection">
                  <Button
                    variant="secondary"
                    leftIcon={Zap}
                    onClick={handleTestPowerbi}
                    loading={testingPowerbi}
                  >
                    {testingPowerbi ? "Testing..." : "Test Connection"}
                  </Button>
                  
                  {powerbiTestResult && (
                    <div className={`test-result ${powerbiTestResult.ok ? 'success' : 'error'}`}>
                      {powerbiTestResult.ok ? (
                        <CheckCircle size={16} />
                      ) : (
                        <AlertCircle size={16} />
                      )}
                      <span>{powerbiTestResult.message}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Action Buttons */}
      <div className="settings-actions">
        <Button
          variant="ghost"
          leftIcon={RotateCcw}
          onClick={handleReset}
          disabled={saving}
        >
          Reset
        </Button>
        <Button
          variant="primary"
          leftIcon={Save}
          onClick={handleSave}
          loading={saving}
        >
          {saving ? "Saving..." : "Save Configuration"}
        </Button>
      </div>
    </div>
  );
}
