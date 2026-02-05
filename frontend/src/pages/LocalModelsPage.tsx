import { useState, useEffect } from "react";
import {
  Upload,
  RotateCcw,
  Download,
  RefreshCw,
  Search,
  FolderOpen,
  Loader2,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  CheckCircle,
  XCircle,
  Clock,
  Play,
  Check,
  FileText,
} from "lucide-react";
import { artifactsApi, semanticModelApi } from "../services/apiClient";
import { Button, Spinner, Modal, ConfirmModal } from "../components/ui";
import { useToast } from "../components/ui";
import type {
  LocalWorkspace,
  LocalSemanticModel,
  SelectedModel,
  KeywordMapping,
  KeywordMappingPreset,
  ActionLog,
  BatchOperationResult,
} from "../types";

type ActionType = "deploy" | "update_keywords" | "revert" | "download";
type OperationStatus = "pending" | "processing" | "success" | "failed";

export default function LocalModelsPage() {
  const toast = useToast();
  
  // Core state
  const [workspaces, setWorkspaces] = useState<LocalWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Record<string, boolean>>({});

  // Selection state
  const [selectedModels, setSelectedModels] = useState<SelectedModel[]>([]);

  // Action state
  const [selectedAction, setSelectedAction] = useState<ActionType>("deploy");
  const [keywordMappings, setKeywordMappings] = useState<KeywordMapping[]>([
    { id: crypto.randomUUID(), oldValue: "", newValue: "" },
  ]);
  const [availablePresets, setAvailablePresets] = useState<KeywordMappingPreset[]>([]);
  const [selectedPresetName, setSelectedPresetName] = useState<string>("");

  // Modal states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showLogsPanel, setShowLogsPanel] = useState(false);

  // Progress tracking
  const [progressResults, setProgressResults] = useState<BatchOperationResult[]>([]);
  const [currentProcessing, setCurrentProcessing] = useState(0);

  // Action logs (session-based, max 1000 entries)
  const [actionLogs, setActionLogs] = useState<ActionLog[]>([]);

  // Folder opening state
  const [openingFolder, setOpeningFolder] = useState<string | null>(null);

  // Load local models
  const loadLocalModels = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await artifactsApi.getLocalModels();
      setWorkspaces(data.workspaces || []);

      // Auto-expand all workspaces on initial load
      const expanded: Record<string, boolean> = {};
      (data.workspaces || []).forEach((ws: LocalWorkspace) => {
        expanded[ws.workspace_id] = true;
      });
      setExpandedWorkspaces(expanded);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Failed to load local models");
    } finally {
      setLoading(false);
    }
  };

  // Folder opening handlers
  const handleOpenArtifactFolder = async (artifactId: string, workspaceId: string) => {
    try {
      setOpeningFolder(artifactId);
      await artifactsApi.openLocalFolder(artifactId, workspaceId);
      toast.success('Folder opened in Explorer');
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || "Failed to open folder";
      toast.error(errorMsg);
    } finally {
      setOpeningFolder(null);
    }
  };

  const handleOpenWorkspaceFolder = async (workspaceId: string) => {
    try {
      setOpeningFolder(workspaceId);
      await artifactsApi.openWorkspaceFolder(workspaceId);
      toast.success('Workspace folder opened in Explorer');
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || "Failed to open folder";
      toast.error(errorMsg);
    } finally {
      setOpeningFolder(null);
    }
  };

  // Selection handlers
  const handleSelectModel = (model: LocalSemanticModel, workspaceId: string) => {
    const modelId = model.artifact_id;
    const isSelected = selectedModels.some(
      (m) => m.modelId === modelId && m.workspaceId === workspaceId
    );

    if (isSelected) {
      setSelectedModels((prev) =>
        prev.filter((m) => !(m.modelId === modelId && m.workspaceId === workspaceId))
      );
    } else {
      setSelectedModels((prev) => [
        ...prev,
        {
          workspaceId,
          modelId,
          modelName: model.artifact_name,
          folderPath: model.folder_path,
          hasBackup: model.has_backup || false,
        },
      ]);
    }
  };

  const handleSelectAll = () => {
    const allModels: SelectedModel[] = [];
    workspaces.forEach((ws) => {
      ws.semantic_models.forEach((model) => {
        allModels.push({
          workspaceId: ws.workspace_id,
          modelId: model.artifact_id,
          modelName: model.artifact_name,
          folderPath: model.folder_path,
          hasBackup: model.has_backup || false,
        });
      });
    });

    if (selectedModels.length === allModels.length) {
      setSelectedModels([]);
    } else {
      setSelectedModels(allModels);
    }
  };

  const clearSelection = () => {
    setSelectedModels([]);
  };

  // Keyword mapping handlers
  const addKeywordMapping = () => {
    setKeywordMappings((prev) => [
      ...prev,
      { id: crypto.randomUUID(), oldValue: "", newValue: "" },
    ]);
  };

  const removeKeywordMapping = (id: string) => {
    setKeywordMappings((prev) => prev.filter((m) => m.id !== id));
  };

  const updateKeywordMapping = (id: string, field: "oldValue" | "newValue", value: string) => {
    setKeywordMappings((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  // Keyword mapping preset handlers
  const refreshPresetOptions = (preferredSelection?: string) => {
    try {
      const presetsStr = localStorage.getItem("keywordMappingPresets");
      const presets: KeywordMappingPreset[] = presetsStr ? JSON.parse(presetsStr) : [];
      setAvailablePresets(presets);

      if (preferredSelection && presets.some((preset) => preset.name === preferredSelection)) {
        setSelectedPresetName(preferredSelection);
        return;
      }

      if (!presets.some((preset) => preset.name === selectedPresetName)) {
        setSelectedPresetName("");
      }
    } catch (err) {
      console.error("Failed to load keyword mapping presets", err);
      setAvailablePresets([]);
      setSelectedPresetName("");
    }
  };

  const saveKeywordPreset = () => {
    const inputName = prompt("Enter a name for this keyword mapping preset:");
    if (!inputName) return;

    const presetName = inputName.trim();
    if (!presetName) {
      alert("Preset name cannot be empty");
      return;
    }

    const validMappings = keywordMappings.filter((m) => m.oldValue && m.newValue);
    if (validMappings.length === 0) {
      alert("No valid keyword mappings to save");
      return;
    }

    try {
      const presetsStr = localStorage.getItem("keywordMappingPresets");
      const presets: KeywordMappingPreset[] = presetsStr ? JSON.parse(presetsStr) : [];

      const nameExists = presets.some((preset) => preset.name === presetName);
      if (nameExists) {
        alert("A preset with that name already exists. Choose a different name.");
        return;
      }

      presets.push({
        name: presetName,
        mappings: validMappings,
      });

      localStorage.setItem("keywordMappingPresets", JSON.stringify(presets));
      alert(`Preset "${presetName}" saved successfully`);
      refreshPresetOptions(presetName);
    } catch (err) {
      alert("Failed to save preset");
    }
  };

  const handleLoadSelectedPreset = () => {
    if (!selectedPresetName) return;

    const preset = availablePresets.find((p) => p.name === selectedPresetName);
    if (!preset) {
      alert("Preset not found");
      refreshPresetOptions();
      return;
    }

    setKeywordMappings(preset.mappings.map((m) => ({ ...m, id: crypto.randomUUID() })));
  };

  const handleDeleteSelectedPreset = () => {
    if (!selectedPresetName) return;

    const preset = availablePresets.find((p) => p.name === selectedPresetName);
    if (!preset) {
      alert("Preset not found");
      refreshPresetOptions();
      return;
    }

    const confirmed = confirm(
      `Delete preset "${selectedPresetName}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    const updatedPresets = availablePresets.filter((p) => p.name !== selectedPresetName);
    localStorage.setItem("keywordMappingPresets", JSON.stringify(updatedPresets));
    setAvailablePresets(updatedPresets);
    setSelectedPresetName("");
    alert(`Preset "${selectedPresetName}" deleted successfully`);
  };

  // Confirmation handlers
  const handleExecuteAction = () => {
    if (selectedModels.length === 0) {
      alert("Please select at least one model");
      return;
    }

    if (selectedAction === "update_keywords") {
      const validMappings = keywordMappings.filter((m) => m.oldValue && m.newValue);
      if (validMappings.length === 0) {
        alert("Please add at least one valid keyword mapping");
        return;
      }
    }

    if (selectedAction === "revert") {
      const modelsWithoutBackup = selectedModels.filter((m) => !m.hasBackup);
      if (modelsWithoutBackup.length > 0) {
        alert(
          `${modelsWithoutBackup.length} selected model(s) do not have backups and cannot be reverted`
        );
        return;
      }
    }

    setShowConfirmModal(true);
  };

  const getConfirmationMessage = (): string => {
    switch (selectedAction) {
      case "deploy":
        return "This will overwrite the selected models in Power BI Fabric. A backup will be created automatically.";
      case "update_keywords":
        return "This will modify local TMDL files. A backup will be created automatically.";
      case "revert":
        return "This will restore models from backup. Current changes will be lost.";
      case "download":
        return "This will download/refresh the selected models from Power BI Fabric. Existing local files will be updated.";
      default:
        return "";
    }
  };

  // Execute batch operation
  const executeBatchOperation = async () => {
    setShowConfirmModal(false);
    setShowProgressModal(true);

    // Initialize progress tracking
    const initialResults: BatchOperationResult[] = selectedModels.map((model) => ({
      workspace_id: model.workspaceId,
      semantic_model_id: model.modelId,
      status: "pending",
    }));
    setProgressResults(initialResults);
    setCurrentProcessing(0);

    const results: BatchOperationResult[] = [];

    for (let i = 0; i < selectedModels.length; i++) {
      const model = selectedModels[i];
      setCurrentProcessing(i + 1);

      // Update status to processing
      setProgressResults((prev) =>
        prev.map((r, idx) =>
          idx === i ? { ...r, status: "processing" as OperationStatus } : r
        )
      );

      try {
        let result: any;

        switch (selectedAction) {
          case "deploy":
            result = await semanticModelApi.uploadSemanticModel(
              model.workspaceId,
              model.modelId,
              model.folderPath
            );
            break;

          case "update_keywords":
            const serverMappings = keywordMappings
              .filter((m) => m.oldValue && m.newValue)
              .reduce((acc, m) => {
                acc[m.oldValue] = m.newValue;
                return acc;
              }, {} as Record<string, string>);

            result = await semanticModelApi.replaceKeywords(
              model.workspaceId,
              model.modelId,
              model.folderPath,
              serverMappings
            );
            break;

          case "revert":
            result = await artifactsApi.revertModels([
              { workspace_id: model.workspaceId, semantic_model_id: model.modelId },
            ]);
            result = result.results[0]; // Extract first result from batch response
            break;

          case "download":
            result = await artifactsApi.refreshModel(model.workspaceId, model.modelId);
            break;
        }

        const success = result.status === "success" || result.status === "updated";
        results.push({
          workspace_id: model.workspaceId,
          semantic_model_id: model.modelId,
          status: success ? "success" : "failed",
          error: success ? undefined : result.error,
        });

        // Update progress
        setProgressResults((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? {
                  ...r,
                  status: success ? ("success" as OperationStatus) : ("failed" as OperationStatus),
                  error: success ? undefined : result.error,
                }
              : r
          )
        );
      } catch (err: any) {
        const errorMsg = err.response?.data?.error || err.message || "Unknown error";
        results.push({
          workspace_id: model.workspaceId,
          semantic_model_id: model.modelId,
          status: "failed",
          error: errorMsg,
        });

        // Update progress
        setProgressResults((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? { ...r, status: "failed" as OperationStatus, error: errorMsg }
              : r
          )
        );
      }
    }

    // Save to action logs
    const successCount = results.filter((r) => r.status === "success").length;
    const failedCount = results.filter((r) => r.status === "failed").length;

    const newLog: ActionLog = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action: selectedAction,
      modelsCount: selectedModels.length,
      successful: successCount,
      failed: failedCount,
      results,
    };

    setActionLogs((prev) => {
      const updated = [newLog, ...prev];
      // Keep max 1000 entries
      return updated.slice(0, 1000);
    });

    // Clear selection on success
    if (failedCount === 0) {
      setSelectedModels([]);
    }

    // Reload models to refresh backup status
    await loadLocalModels();
  };

  // Retry failed operations
  const retryFailedFromProgress = () => {
    const failedModels = selectedModels.filter((model, idx) => {
      const result = progressResults[idx];
      return result && result.status === "failed";
    });

    if (failedModels.length === 0) return;

    setSelectedModels(failedModels);
    setShowProgressModal(false);

    // Re-execute
    setTimeout(() => {
      setShowConfirmModal(true);
    }, 100);
  };

  const retryFailedFromLog = (log: ActionLog) => {
    const failedResults = log.results.filter((r) => r.status === "failed");
    if (failedResults.length === 0) return;

    // Find models in current workspace list
    const failedModels: SelectedModel[] = [];
    workspaces.forEach((ws) => {
      ws.semantic_models.forEach((model) => {
        const isFailed = failedResults.some(
          (r) => r.workspace_id === ws.workspace_id && r.semantic_model_id === model.artifact_id
        );
        if (isFailed) {
          failedModels.push({
            workspaceId: ws.workspace_id,
            modelId: model.artifact_id,
            modelName: model.artifact_name,
            folderPath: model.folder_path,
            hasBackup: model.has_backup || false,
          });
        }
      });
    });

    if (failedModels.length === 0) {
      alert("Failed models not found in current workspace list");
      return;
    }

    setSelectedModels(failedModels);
    setSelectedAction(log.action);
    setShowLogsPanel(false);

    // Show confirmation
    setTimeout(() => {
      setShowConfirmModal(true);
    }, 100);
  };

  // Utility functions
  const toggleWorkspace = (workspaceId: string) => {
    setExpandedWorkspaces((prev) => ({
      ...prev,
      [workspaceId]: !prev[workspaceId],
    }));
  };

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return "Unknown";
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

  const getActionLabel = (action: ActionType): string => {
    switch (action) {
      case "deploy":
        return "Deploy to Fabric";
      case "update_keywords":
        return "Update Keywords";
      case "revert":
        return "Revert from Backup";
      case "download":
        return "Download/Refresh";
      default:
        return action;
    }
  };

  const getStatusIcon = (status: OperationStatus): React.ReactNode => {
    switch (status) {
      case "pending":
        return <Clock size={20} className="status-icon pending" />;
      case "processing":
        return <Loader2 size={20} className="status-icon processing button-spinner" />;
      case "success":
        return <CheckCircle size={20} className="status-icon success" style={{ color: "var(--color-success)" }} />;
      case "failed":
        return <XCircle size={20} className="status-icon failed" style={{ color: "var(--color-error)" }} />;
      default:
        return <Clock size={20} className="status-icon pending" />;
    }
  };

  useEffect(() => {
    loadLocalModels();
  }, []);

  useEffect(() => {
    refreshPresetOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rendering code continues below...
  return (
    <div style={{ padding: "2rem" }}>
      {/* Header with selection count */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <h1>
          Local Models ({workspaces.reduce((sum, ws) => sum + ws.semantic_models.length, 0)})
          {selectedModels.length > 0 && (
            <span style={{ color: "#0078d4", marginLeft: "1rem" }}>
              ({selectedModels.length} selected)
            </span>
          )}
        </h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={() => setShowLogsPanel(!showLogsPanel)}>
            {showLogsPanel ? "Hide Logs" : "View Action Logs"}
          </button>
          <button onClick={loadLocalModels} disabled={loading}>
            {loading ? "Loading..." : "Refresh List"}
          </button>
        </div>
      </div>

      {/* Action Toolbar */}
      {selectedModels.length > 0 && (
        <div
          style={{
            marginBottom: "1.5rem",
            padding: "1.5rem",
            backgroundColor: "#f5f5f5",
            borderRadius: "8px",
            border: "2px solid #0078d4",
          }}
        >
          <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
            <label>
              <strong>Action:</strong>
            </label>
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value as ActionType)}
              style={{ padding: "0.5rem", minWidth: "200px" }}
            >
              <option value="download">Download/Refresh from Fabric</option>
              <option value="deploy">Deploy to Fabric</option>
              <option value="update_keywords">Update Keywords</option>
              <option value="revert">Revert from Backup</option>
            </select>

            <button onClick={handleExecuteAction} style={{ backgroundColor: "#0078d4", color: "white" }}>
              Execute Selected ({selectedModels.length})
            </button>
            <button onClick={clearSelection}>Clear Selection</button>
          </div>

          {/* Keyword Mappings Panel (only for Update Keywords action) */}
          {selectedAction === "update_keywords" && (
            <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "white", borderRadius: "4px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h3 style={{ margin: 0 }}>Keyword Mappings</h3>
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                  <button onClick={saveKeywordPreset}>Save Preset</button>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <select
                      value={availablePresets.length > 0 ? selectedPresetName : ""}
                      onChange={(e) => setSelectedPresetName(e.target.value)}
                      style={{ padding: "0.5rem", minWidth: "200px" }}
                      disabled={availablePresets.length === 0}
                    >
                      {availablePresets.length === 0 ? (
                        <option value="">-- No Presets Available --</option>
                      ) : (
                        <>
                          <option value="">-- Select Preset --</option>
                          {availablePresets.map((preset) => (
                            <option key={preset.name} value={preset.name}>
                              {preset.name}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                    <button
                      onClick={handleLoadSelectedPreset}
                      disabled={!selectedPresetName}
                      style={{ padding: "0.5rem 1rem" }}
                    >
                      Load
                    </button>
                    <button
                      onClick={handleDeleteSelectedPreset}
                      disabled={!selectedPresetName}
                      style={{ padding: "0.5rem 0.75rem" }}
                    >
                      ✕
                    </button>
                  </div>
                  <button onClick={addKeywordMapping}>Add Mapping</button>
                </div>
              </div>

              {keywordMappings.map((mapping) => (
                <div key={mapping.id} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <input
                    type="text"
                    placeholder="Old value"
                    value={mapping.oldValue}
                    onChange={(e) => updateKeywordMapping(mapping.id, "oldValue", e.target.value)}
                    style={{ flex: 1, padding: "0.5rem" }}
                  />
                  <span style={{ alignSelf: "center" }}>→</span>
                  <input
                    type="text"
                    placeholder="New value"
                    value={mapping.newValue}
                    onChange={(e) => updateKeywordMapping(mapping.id, "newValue", e.target.value)}
                    style={{ flex: 1, padding: "0.5rem" }}
                  />
                  <button
                    onClick={() => removeKeywordMapping(mapping.id)}
                    disabled={keywordMappings.length === 1}
                    style={{ padding: "0.5rem 1rem" }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action Logs Panel */}
      {showLogsPanel && (
        <div
          style={{
            marginBottom: "1.5rem",
            padding: "1.5rem",
            backgroundColor: "#fff",
            borderRadius: "8px",
            border: "1px solid #ddd",
            maxHeight: "400px",
            overflowY: "auto",
          }}
        >
          <h2>Action Logs ({actionLogs.length})</h2>
          {actionLogs.length === 0 ? (
            <p style={{ color: "#666" }}>No actions performed yet</p>
          ) : (
            actionLogs.map((log) => (
              <div
                key={log.id}
                style={{
                  marginBottom: "1rem",
                  padding: "1rem",
                  backgroundColor: "#f9f9f9",
                  borderRadius: "4px",
                  border: "1px solid #eee",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong>{getActionLabel(log.action)}</strong>
                    <span style={{ marginLeft: "1rem", color: "#666" }}>
                      {formatTimestamp(log.timestamp)}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "green", marginRight: "1rem" }}>
                      ✅ {log.successful}
                    </span>
                    <span style={{ color: "red" }}>❌ {log.failed}</span>
                    {log.failed > 0 && (
                      <button
                        onClick={() => retryFailedFromLog(log)}
                        style={{ marginLeft: "1rem", padding: "0.25rem 0.5rem" }}
                      >
                        Retry Failed
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <div className="loading-spinner">Loading local models...</div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div style={{ padding: "1rem", backgroundColor: "#fee", borderRadius: "4px", marginBottom: "1rem" }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && workspaces.length === 0 && (
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <h2>No Downloaded Models</h2>
          <p>Download models from the Download page to see them here.</p>
        </div>
      )}

      {/* Workspaces list */}
      {!loading && workspaces.length > 0 && (
        <>
          {/* Select All checkbox */}
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={
                  selectedModels.length > 0 &&
                  selectedModels.length ===
                    workspaces.reduce((sum, ws) => sum + ws.semantic_models.length, 0)
                }
                onChange={handleSelectAll}
              />
              <strong>Select All Models</strong>
            </label>
          </div>

          {workspaces.map((workspace) => (
            <div
              key={workspace.workspace_id}
              style={{
                marginBottom: "2rem",
                border: "1px solid #ddd",
                borderRadius: "8px",
                overflow: "hidden",
              }}
            >
              {/* Workspace header */}
              <div
                style={{
                  padding: "1rem",
                  backgroundColor: "#f5f5f5",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div
                  style={{ cursor: "pointer", flex: 1 }}
                  onClick={() => toggleWorkspace(workspace.workspace_id)}
                >
                  <h2 style={{ margin: 0, fontSize: "1.2rem" }}>
                    {expandedWorkspaces[workspace.workspace_id] ? "▼" : "▶"} {workspace.workspace_name}
                  </h2>
                  <small style={{ color: "#666" }}>
                    {workspace.semantic_models.length} model
                    {workspace.semantic_models.length !== 1 ? "s" : ""}
                  </small>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenWorkspaceFolder(workspace.workspace_id);
                  }}
                  disabled={openingFolder === workspace.workspace_id}
                  title="Open workspace folder in Explorer"
                  style={{
                    padding: "0.5rem 1rem",
                    backgroundColor: "white",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    cursor: openingFolder === workspace.workspace_id ? "wait" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  {openingFolder === workspace.workspace_id ? (
                    "⏳"
                  ) : (
                    <>
                      📁 Open Folder
                    </>
                  )}
                </button>
              </div>

              {/* Models table */}
              {expandedWorkspaces[workspace.workspace_id] && (
                <div style={{ padding: "1rem" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #ddd" }}>
                        <th style={{ textAlign: "left", padding: "0.5rem", width: "40px" }}>
                          <input
                            type="checkbox"
                            checked={workspace.semantic_models.every((model) =>
                              selectedModels.some(
                                (m) =>
                                  m.modelId === model.artifact_id &&
                                  m.workspaceId === workspace.workspace_id
                              )
                            )}
                            onChange={() => {
                              const allSelected = workspace.semantic_models.every((model) =>
                                selectedModels.some(
                                  (m) =>
                                    m.modelId === model.artifact_id &&
                                    m.workspaceId === workspace.workspace_id
                                )
                              );

                              if (allSelected) {
                                // Deselect all in this workspace
                                setSelectedModels((prev) =>
                                  prev.filter((m) => m.workspaceId !== workspace.workspace_id)
                                );
                              } else {
                                // Select all in this workspace
                                const workspaceModels: SelectedModel[] = workspace.semantic_models.map(
                                  (model) => ({
                                    workspaceId: workspace.workspace_id,
                                    modelId: model.artifact_id,
                                    modelName: model.artifact_name,
                                    folderPath: model.folder_path,
                                    hasBackup: model.has_backup || false,
                                  })
                                );

                                setSelectedModels((prev) => {
                                  const filtered = prev.filter(
                                    (m) => m.workspaceId !== workspace.workspace_id
                                  );
                                  return [...filtered, ...workspaceModels];
                                });
                              }
                            }}
                          />
                        </th>
                        <th style={{ textAlign: "left", padding: "0.5rem" }}>Model Name</th>
                        <th style={{ textAlign: "left", padding: "0.5rem" }}>Last Updated</th>
                        <th style={{ textAlign: "center", padding: "0.5rem" }}>Files</th>
                        <th style={{ textAlign: "center", padding: "0.5rem" }}>Format</th>
                        <th style={{ textAlign: "center", padding: "0.5rem" }}>Backup</th>
                        <th style={{ textAlign: "center", padding: "0.5rem", width: "60px" }}>Folder</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workspace.semantic_models.map((model) => {
                        const isSelected = selectedModels.some(
                          (m) =>
                            m.modelId === model.artifact_id &&
                            m.workspaceId === workspace.workspace_id
                        );

                        return (
                          <tr
                            key={model.artifact_id}
                            style={{
                              borderBottom: "1px solid #eee",
                              backgroundColor: isSelected ? "#e6f2ff" : "transparent",
                            }}
                          >
                            <td style={{ padding: "0.75rem" }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleSelectModel(model, workspace.workspace_id)}
                              />
                            </td>
                            <td style={{ padding: "0.75rem" }}>
                              <strong>{model.artifact_name}</strong>
                              <br />
                              <small style={{ color: "#666" }}>{model.artifact_id}</small>
                            </td>
                            <td style={{ padding: "0.75rem" }}>
                              {formatTimestamp(model.last_updated || model.download_timestamp)}
                            </td>
                            <td style={{ padding: "0.75rem", textAlign: "center" }}>
                              {model.files_count || "-"}
                            </td>
                            <td style={{ padding: "0.75rem", textAlign: "center" }}>
                              {model.definition_format || "TMDL"}
                            </td>
                            <td style={{ padding: "0.75rem", textAlign: "center" }}>
                              {model.has_backup ? (
                                <span style={{ color: "var(--color-success)", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                                  <Check size={14} /> Yes
                                </span>
                              ) : (
                                <span style={{ color: "var(--color-text-tertiary)" }}>No</span>
                              )}
                            </td>
                            <td style={{ padding: "0.75rem", textAlign: "center" }}>
                              <button
                                className="button ghost sm"
                                onClick={() => handleOpenArtifactFolder(model.artifact_id, workspace.workspace_id)}
                                disabled={openingFolder === model.artifact_id}
                                title="Open folder in Explorer"
                                style={{ minHeight: "32px", padding: "0.25rem 0.5rem" }}
                              >
                                {openingFolder === model.artifact_id ? <Loader2 size={16} className="button-spinner" /> : <FolderOpen size={16} />}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowConfirmModal(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "white",
              padding: "2rem",
              borderRadius: "8px",
              maxWidth: "600px",
              maxHeight: "80vh",
              overflow: "auto",
            }}
          >
            <h2>Confirm {getActionLabel(selectedAction)}</h2>
            <p className="warning" style={{ color: "#d83b01", marginBottom: "1rem" }}>
              <strong>Warning:</strong> {getConfirmationMessage()}
            </p>

            <div style={{ marginBottom: "1rem" }}>
              <strong>Models to process ({selectedModels.length}):</strong>
              <ul style={{ maxHeight: "200px", overflowY: "auto", marginTop: "0.5rem" }}>
                {selectedModels.map((model) => (
                  <li key={`${model.workspaceId}-${model.modelId}`}>
                    {model.modelName}
                    {selectedAction === "revert" && !model.hasBackup && (
                      <span style={{ color: "red", marginLeft: "0.5rem" }}>(No backup)</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="modal-actions" style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
              <button onClick={() => setShowConfirmModal(false)} className="cancel-button">
                Cancel
              </button>
              <button
                onClick={executeBatchOperation}
                className="confirm-button"
                style={{ backgroundColor: "#0078d4", color: "white" }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Modal */}
      {showProgressModal && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            className="modal-content"
            style={{
              backgroundColor: "white",
              padding: "2rem",
              borderRadius: "8px",
              maxWidth: "700px",
              maxHeight: "80vh",
              overflow: "auto",
              minWidth: "500px",
            }}
          >
            <h2>
              {currentProcessing === selectedModels.length
                ? "Operation Complete"
                : `Processing ${currentProcessing} of ${selectedModels.length} models...`}
            </h2>

            <div style={{ marginBottom: "1rem" }}>
              <div
                style={{
                  width: "100%",
                  height: "20px",
                  backgroundColor: "#e0e0e0",
                  borderRadius: "10px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${(currentProcessing / selectedModels.length) * 100}%`,
                    height: "100%",
                    backgroundColor: "#0078d4",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            </div>

            <div
              style={{
                maxHeight: "400px",
                overflowY: "auto",
                border: "1px solid #ddd",
                borderRadius: "4px",
                padding: "1rem",
              }}
            >
              {selectedModels.map((model, idx) => {
                const result = progressResults[idx];
                const status = result?.status || "pending";
                const icon = getStatusIcon(status);

                return (
                  <div
                    key={`${model.workspaceId}-${model.modelId}`}
                    style={{
                      padding: "0.5rem",
                      marginBottom: "0.5rem",
                      backgroundColor: status === "failed" ? "#fee" : status === "success" ? "#efe" : "#f9f9f9",
                      borderRadius: "4px",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center" }}>{icon}</span>
                    <div style={{ flex: 1 }}>
                      <div>{model.modelName}</div>
                      {result?.error && (
                        <div style={{ fontSize: "0.8rem", color: "red" }}>{result.error}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: "1rem" }}>
              <strong>Summary:</strong>
              <div style={{ marginTop: "0.5rem", display: "flex", gap: "1rem" }}>
                <span style={{ color: "var(--color-success)", display: "flex", alignItems: "center", gap: "4px" }}>
                  <CheckCircle size={16} /> Successful: {progressResults.filter((r) => r.status === "success").length}
                </span>
                <span style={{ color: "var(--color-error)", display: "flex", alignItems: "center", gap: "4px" }}>
                  <XCircle size={16} /> Failed: {progressResults.filter((r) => r.status === "failed").length}
                </span>
              </div>
            </div>

            <div
              className="modal-actions"
              style={{ display: "flex", gap: "1rem", justifyContent: "flex-end", marginTop: "1.5rem" }}
            >
              {progressResults.some((r) => r.status === "failed") && currentProcessing === selectedModels.length && (
                <button onClick={retryFailedFromProgress} style={{ backgroundColor: "#d83b01", color: "white" }}>
                  Retry Failed
                </button>
              )}
              <button
                onClick={() => setShowProgressModal(false)}
                disabled={currentProcessing < selectedModels.length}
              >
                {currentProcessing === selectedModels.length ? "Close" : "Processing..."}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
