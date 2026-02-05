import React, { useState } from "react";
import { WorkspaceSelector } from "../components/WorkspaceSelector";
import { DatasetSelector } from "../components/DatasetSelector";
import { ModelFolderSelector } from "../components/ModelFolderSelector";
import { ProgressIndicator } from "../components/ProgressIndicator";
import { ValidationResult, ReplacementStats } from "../types";
import { semanticModelApi } from "../services/apiClient";

export const ReplacePage: React.FC = () => {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [selectedWorkspaceName, setSelectedWorkspaceName] = useState("");
  const [selectedDatasetId, setSelectedDatasetId] = useState("");
  const [selectedDatasetName, setSelectedDatasetName] = useState("");
  const [selectedFolderPath, setSelectedFolderPath] = useState("");
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  
  const [mappings, setMappings] = useState<Array<{ old: string; new: string }>>([
    { old: "", new: "" },
  ]);
  
  const [processing, setProcessing] = useState(false);
  const [replacementResult, setReplacementResult] = useState<ReplacementStats | null>(null);

  const handleWorkspaceSelect = (id: string, name: string) => {
    setSelectedWorkspaceId(id);
    setSelectedWorkspaceName(name);
    setSelectedDatasetId("");
    setSelectedDatasetName("");
    setSelectedFolderPath("");
    setValidationResult(null);
    setReplacementResult(null);
  };

  const handleDatasetSelect = (id: string, name: string) => {
    setSelectedDatasetId(id);
    setSelectedDatasetName(name);
    setReplacementResult(null);
  };

  const handleAddMapping = () => {
    setMappings([...mappings, { old: "", new: "" }]);
  };

  const handleRemoveMapping = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index));
  };

  const handleMappingChange = (index: number, field: "old" | "new", value: string) => {
    const newMappings = [...mappings];
    newMappings[index][field] = value;
    setMappings(newMappings);
  };

  const handleApplyReplacements = async () => {
    if (!validationResult?.valid) {
      alert("Please validate the folder before applying replacements.");
      return;
    }

    // Build server mappings object
    const serverMappings: Record<string, string> = {};
    let hasEmptyMappings = false;
    
    mappings.forEach(mapping => {
      if (mapping.old && mapping.new) {
        serverMappings[mapping.old] = mapping.new;
      } else if (mapping.old || mapping.new) {
        hasEmptyMappings = true;
      }
    });

    if (Object.keys(serverMappings).length === 0) {
      alert("Please add at least one complete keyword mapping.");
      return;
    }

    if (hasEmptyMappings) {
      alert("Some mappings are incomplete. Please fill both old and new values or remove them.");
      return;
    }

    setProcessing(true);
    setReplacementResult(null);

    try {
      const response = await semanticModelApi.replaceKeywords(
        selectedWorkspaceId,
        selectedDatasetId,
        selectedFolderPath,
        serverMappings
      );
      setReplacementResult(response.data);
    } catch (err: any) {
      const result = err.response?.data || {
        status: "failed",
        workspace_id: selectedWorkspaceId,
        semantic_model_id: selectedDatasetId,
        files_updated: 0,
        replacements: {},
        error: err.message,
      };
      setReplacementResult(result);
    } finally {
      setProcessing(false);
    }
  };

  const canApply =
    selectedWorkspaceId &&
    selectedDatasetId &&
    selectedFolderPath &&
    validationResult?.valid &&
    mappings.some(m => m.old && m.new);

  return (
    <div className="replace-page">
      <h1>Replace Keywords in Semantic Model</h1>
      <p>Apply keyword replacements to a downloaded semantic model's TMDL files.</p>

      {/* Step 1: Select Workspace */}
      <div className="step">
        <h2>Step 1: Select Workspace</h2>
        <WorkspaceSelector
          selectedWorkspaceId={selectedWorkspaceId}
          onWorkspaceSelect={handleWorkspaceSelect}
        />
      </div>

      {/* Step 2: Select Dataset */}
      {selectedWorkspaceId && (
        <div className="step">
          <h2>Step 2: Select Semantic Model</h2>
          <DatasetSelector
            workspaceId={selectedWorkspaceId}
            selectedDatasetId={selectedDatasetId}
            onDatasetSelect={handleDatasetSelect}
          />
        </div>
      )}

      {/* Step 3: Select Folder */}
      {selectedWorkspaceId && selectedDatasetId && (
        <div className="step">
          <h2>Step 3: Select Model Folder</h2>
          <ModelFolderSelector
            workspaceId={selectedWorkspaceId}
            selectedPath={selectedFolderPath}
            onPathChange={setSelectedFolderPath}
            onValidationChange={setValidationResult}
          />
        </div>
      )}

      {/* Step 4: Define Replacements */}
      {selectedFolderPath && validationResult?.valid && (
        <div className="step">
          <h2>Step 4: Define Keyword Replacements</h2>
          <div className="mappings-container">
            <p className="hint">
              Define server name replacements (case-insensitive). Examples:
              old-server.database.windows.net → new-server.database.windows.net
            </p>
            
            {mappings.map((mapping, index) => (
              <div key={index} className="mapping-row">
                <input
                  type="text"
                  value={mapping.old}
                  onChange={(e) => handleMappingChange(index, "old", e.target.value)}
                  placeholder="Old keyword (e.g., old-server.database.windows.net)"
                  className="mapping-input"
                />
                <span className="mapping-arrow">→</span>
                <input
                  type="text"
                  value={mapping.new}
                  onChange={(e) => handleMappingChange(index, "new", e.target.value)}
                  placeholder="New keyword (e.g., new-server.database.windows.net)"
                  className="mapping-input"
                />
                <button
                  onClick={() => handleRemoveMapping(index)}
                  className="button-remove"
                  disabled={mappings.length === 1}
                >
                  ✕
                </button>
              </div>
            ))}
            
            <button onClick={handleAddMapping} className="button-add">
              + Add Mapping
            </button>
          </div>
        </div>
      )}

      {/* Apply Button */}
      {selectedFolderPath && validationResult?.valid && (
        <div className="replace-actions">
          <button
            onClick={handleApplyReplacements}
            disabled={!canApply || processing}
            className="replace-button primary"
          >
            {processing ? "Applying Replacements..." : "Apply Replacements"}
          </button>
        </div>
      )}

      {/* Progress */}
      {processing && (
        <ProgressIndicator
          message="Applying keyword replacements to TMDL files..."
          subMessage="Scanning and updating files..."
        />
      )}

      {/* Replacement Result */}
      {replacementResult && (
        <div className={`replacement-result ${replacementResult.status}`}>
          <h3>Replacement Result</h3>
          
          {replacementResult.status === "updated" && (
            <div className="success-message">
              <p>✓ Successfully updated {replacementResult.files_updated} file(s)</p>
              <div className="replacement-details">
                <h4>Replacements Made:</h4>
                <ul>
                  {Object.entries(replacementResult.replacements).map(([keyword, count]) => (
                    <li key={keyword}>
                      <strong>{keyword}</strong>: {count} occurrence(s)
                    </li>
                  ))}
                </ul>
              </div>
              <p className="details">
                Model: {selectedDatasetName}<br />
                Workspace: {selectedWorkspaceName}
              </p>
            </div>
          )}
          
          {replacementResult.status === "no_changes" && (
            <div className="info-message">
              <p>ℹ No changes made</p>
              <p>{replacementResult.error || "No matching keywords found in the model files."}</p>
            </div>
          )}
          
          {replacementResult.status === "failed" && (
            <div className="error-message">
              <p>✗ Replacement Failed</p>
              <p>{replacementResult.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReplacePage;
