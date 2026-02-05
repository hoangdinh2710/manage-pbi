import { useState, useEffect } from "react";
import { configApi } from "../services/apiClient";
import type { UserConfig, UserConfigUpdate } from "../types";

export default function Settings() {
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
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
  const [powerbiTestResult, setPowerbiTestResult] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await configApi.getConfig();
      setConfig(data);
      
      // Populate form
      setDownloadFolder(data.download_folder);
      setNamingStrategy(data.output_naming_strategy);
      setAutoBackup(data.enable_auto_backup);
      setBackupRetention(data.backup_retention_days);
      setDownloadWorkers(data.parallel_download_workers);
      setBulkWorkers(data.parallel_bulk_workers);
      setHttpTimeout(data.http_timeout_seconds);
      setLogLevel(data.log_level);
      // Power BI fields
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
      setSuccess(false);

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

      // Attach Power BI fields when provided. client_secret is write-only.
      if (tenantId !== "") updates.tenant_id = tenantId;
      if (clientId !== "") updates.client_id = clientId;
      if (clientSecret !== "") updates.client_secret = clientSecret;
      if (powerbiApiBase !== "") updates.powerbi_api_base = powerbiApiBase;
      if (powerbiScope !== "") updates.powerbi_scope = powerbiScope;

      const updated = await configApi.updateConfig(updates);
      setConfig(updated);
      setSuccess(true);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save configuration");
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
        setPowerbiTestResult(`OK — token expires in ${res.token_expires_in || 'unknown'}s`);
      } else {
        setPowerbiTestResult(`Failed: ${res.error || 'unknown error'}`);
      }
    } catch (err) {
      setPowerbiTestResult(err instanceof Error ? err.message : 'Test failed');
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
      // Reset Power BI UI fields (do not populate secret)
      setPowerbiApiBase((config as any).powerbi_api_base || "");
      setPowerbiScope((config as any).powerbi_scope || "");
      setTenantId("");
      setClientId("");
      setClientSecret("");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Settings</h1>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
            <p className="text-green-800">Configuration saved successfully!</p>
          </div>
        )}

        <div className="space-y-6">
          {/* File Operations */}
          <section>
            <h2 className="text-lg font-semibold text-gray-700 mb-4">File Operations</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Download Folder Path
                </label>
                <input
                  type="text"
                  value={downloadFolder}
                  onChange={(e) => setDownloadFolder(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="downloads"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Path where downloaded semantic model definitions will be saved
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Output Naming Strategy
                </label>
                <select
                  value={namingStrategy}
                  onChange={(e) => setNamingStrategy(e.target.value as "model_name" | "model_id")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="model_name">Model Name</option>
                  <option value="model_id">Model ID</option>
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  Choose how to name downloaded model folders
                </p>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="autoBackup"
                  checked={autoBackup}
                  onChange={(e) => setAutoBackup(e.target.checked)}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="autoBackup" className="ml-2 block text-sm text-gray-700">
                  Enable automatic backups
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Backup Retention (days)
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={backupRetention}
                  onChange={(e) => setBackupRetention(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Number of days to retain backup files
                </p>
              </div>
            </div>
          </section>

          {/* Performance Settings */}
          <section>
            <h2 className="text-lg font-semibold text-gray-700 mb-4">Performance</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Parallel Download Workers: {downloadWorkers}
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={downloadWorkers}
                  onChange={(e) => setDownloadWorkers(parseInt(e.target.value))}
                  className="w-full"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Number of concurrent downloads (1-10)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Parallel Bulk Workers: {bulkWorkers}
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={bulkWorkers}
                  onChange={(e) => setBulkWorkers(parseInt(e.target.value))}
                  className="w-full"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Number of concurrent bulk operations (1-10)
                </p>
              </div>
            </div>
          </section>

          {/* Advanced Settings */}
          <section>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center text-lg font-semibold text-gray-700 mb-4 hover:text-blue-600"
            >
              <span className="mr-2">{showAdvanced ? "▼" : "▶"}</span>
              Advanced Settings
            </button>

            {showAdvanced && (
              <div className="space-y-4 pl-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    HTTP Timeout (seconds)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="300"
                    value={httpTimeout}
                    onChange={(e) => setHttpTimeout(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Timeout for HTTP requests (5-300 seconds)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Log Level
                  </label>
                  <select
                    value={logLevel}
                    onChange={(e) => setLogLevel(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="DEBUG">DEBUG</option>
                    <option value="INFO">INFO</option>
                    <option value="WARNING">WARNING</option>
                    <option value="ERROR">ERROR</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                  <p className="mt-1 text-sm text-gray-500">
                    Logging verbosity level
                  </p>
                </div>

                {config && (
                  <div className="bg-gray-50 p-4 rounded-md">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Read-Only Settings</h3>
                    <div className="space-y-2 text-sm text-gray-600">
                      <p><span className="font-medium">Fabric API Base:</span> {config.fabric_api_base}</p>
                      <p><span className="font-medium">Max Retries:</span> {config.operation_max_retries}</p>
                      <p><span className="font-medium">Retry Delay:</span> {config.operation_retry_delay_seconds}s</p>
                      <p><span className="font-medium">Definition Format:</span> {config.definition_format}</p>
                    </div>
                  </div>
                )}

                {/* Power BI Credentials */}
                <div className="mt-4 bg-white p-4 border rounded-md">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Power BI Credentials</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tenant ID</label>
                      <input
                        type="text"
                        value={tenantId}
                        onChange={(e) => setTenantId(e.target.value)}
                        placeholder={powerbiTenantPresent ? "(already configured)" : ""
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
                      <input
                        type="text"
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                        placeholder={powerbiClientPresent ? "(already configured)" : ""}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Client Secret</label>
                      <input
                        type="password"
                        value={clientSecret}
                        onChange={(e) => setClientSecret(e.target.value)}
                        placeholder="(leave empty to keep current)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Power BI API Base</label>
                      <input
                        type="text"
                        value={powerbiApiBase}
                        onChange={(e) => setPowerbiApiBase(e.target.value)}
                        placeholder="https://api.powerbi.com/v1.0/myorg"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Power BI Scope</label>
                      <input
                        type="text"
                        value={powerbiScope}
                        onChange={(e) => setPowerbiScope(e.target.value)}
                        placeholder="https://analysis.windows.net/powerbi/api/.default"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>

                    <div className="flex items-center space-x-3">
                      <button
                        onClick={handleTestPowerbi}
                        disabled={testingPowerbi}
                        className="px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {testingPowerbi ? "Testing..." : "Test Power BI Credentials"}
                      </button>
                      {powerbiTestResult && (
                        <div className="text-sm text-gray-700">{powerbiTestResult}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex justify-end space-x-4">
          <button
            onClick={handleReset}
            disabled={saving}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Configuration"}
          </button>
        </div>
      </div>
    </div>
  );
}
