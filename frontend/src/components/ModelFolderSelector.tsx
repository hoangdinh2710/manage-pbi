import React, { useState, useEffect } from "react";
import { DownloadedModel, ValidationResult } from "../types";
import { semanticModelApi } from "../services/apiClient";

interface ModelFolderSelectorProps {
  workspaceId: string;
  selectedPath: string;
  onPathChange: (path: string) => void;
  onValidationChange?: (result: ValidationResult | null) => void;
}

export const ModelFolderSelector: React.FC<ModelFolderSelectorProps> = ({
  workspaceId,
  selectedPath,
  onPathChange,
  onValidationChange,
}) => {
  const [selectionMode, setSelectionMode] = useState<"dropdown" | "manual">("dropdown");
  const [downloadedModels, setDownloadedModels] = useState<DownloadedModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  // Load downloaded models when workspace changes
  useEffect(() => {
    if (workspaceId && selectionMode === "dropdown") {
      loadDownloadedModels();
    }
  }, [workspaceId, selectionMode]);

  const loadDownloadedModels = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await semanticModelApi.listDownloadedModels(workspaceId);
      setDownloadedModels(response.data.models);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load downloaded models");
      setDownloadedModels([]);
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    if (!selectedPath) return;

    setValidating(true);
    setValidationResult(null);
    try {
      const response = await semanticModelApi.validateFolder(selectedPath);
      setValidationResult(response.data);
      onValidationChange?.(response.data);
    } catch (err: any) {
      const result = err.response?.data || {
        valid: false,
        missing_files: ["validation_error"],
        folder_path: selectedPath,
        error: err.message,
      };
      setValidationResult(result);
      onValidationChange?.(result);
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="model-folder-selector">
      <h3>Select Model Folder</h3>

      {/* Selection Mode Toggle */}
      <div className="selection-mode">
        <label>
          <input
            type="radio"
            value="dropdown"
            checked={selectionMode === "dropdown"}
            onChange={() => {
              setSelectionMode("dropdown");
              setValidationResult(null);
            }}
          />
          Select from Downloaded Models
        </label>
        <label>
          <input
            type="radio"
            value="manual"
            checked={selectionMode === "manual"}
            onChange={() => {
              setSelectionMode("manual");
              setValidationResult(null);
            }}
          />
          Enter Path Manually
        </label>
      </div>

      {/* Dropdown Mode */}
      {selectionMode === "dropdown" && (
        <div className="dropdown-mode">
          {loading && <p>Loading models...</p>}
          {error && <p className="error">{error}</p>}
          {!loading && !error && downloadedModels.length === 0 && (
            <p className="info">No downloaded models found for this workspace.</p>
          )}
          {!loading && downloadedModels.length > 0 && (
            <select
              value={selectedPath}
              onChange={(e) => {
                onPathChange(e.target.value);
                setValidationResult(null);
              }}
              className="model-dropdown"
            >
              <option value="">-- Select a model --</option>
              {downloadedModels.map((model) => (
                <option key={model.path} value={model.relative_path}>
                  {model.model_name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Manual Mode */}
      {selectionMode === "manual" && (
        <div className="manual-mode">
          <input
            type="text"
            value={selectedPath}
            onChange={(e) => {
              onPathChange(e.target.value);
              setValidationResult(null);
            }}
            placeholder="Enter path (e.g., workspace-id/model-name or absolute path)"
            className="path-input"
          />
          <p className="hint">
            Enter absolute path or relative path from download folder
          </p>
        </div>
      )}

      {/* Validate Button */}
      {selectedPath && (
        <button
          onClick={handleValidate}
          disabled={validating}
          className="validate-button"
        >
          {validating ? "Validating..." : "Validate Folder"}
        </button>
      )}

      {/* Validation Results */}
      {validationResult && (
        <div className={`validation-result ${validationResult.valid ? "valid" : "invalid"}`}>
          {validationResult.valid ? (
            <p className="success">✓ Folder is valid and ready for upload</p>
          ) : (
            <div className="error-details">
              <p className="error">✗ Validation failed</p>
              <ul>
                {validationResult.missing_files.map((file) => (
                  <li key={file}>Missing: {file}</li>
                ))}
              </ul>
              {validationResult.error && <p className="error">{validationResult.error}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
