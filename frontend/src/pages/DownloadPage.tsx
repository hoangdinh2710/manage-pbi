import { useState, useEffect } from "react";
import { apiClient } from "../services/apiClient";
import { HierarchicalWorkspaceSelector } from "../components/HierarchicalWorkspaceSelector";

interface Workspace {
  id: string;
  name: string;
  type?: string;
  capacityId?: string;
}

interface SelectedModel {
  workspaceId: string;
  modelId: string;
  workspaceName: string;
  modelName: string;
}

export function DownloadPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedModels, setSelectedModels] = useState<SelectedModel[]>([]);
  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState<string[]>([]);
  const [workspaceOnlySelections, setWorkspaceOnlySelections] = useState<Set<string>>(new Set());
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const fetchWorkspaces = async () => {
    setLoadingWorkspaces(true);
    setError(null);
    try {
      const response = await apiClient.get("/workspaces");
      setWorkspaces(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load workspaces");
    } finally {
      setLoadingWorkspaces(false);
    }
  };

  const handleWorkspaceSelect = (workspaceId: string, workspaceName: string, models: any[]) => {
    // Toggle workspace selection
    const isSelected = selectedWorkspaceIds.includes(workspaceId);
    
    if (isSelected) {
      // Deselect workspace and remove all its models
      setSelectedWorkspaceIds(prev => prev.filter(id => id !== workspaceId));
      setSelectedModels(prev => prev.filter(m => m.workspaceId !== workspaceId));
      setWorkspaceOnlySelections(prev => {
        const newSet = new Set(prev);
        newSet.delete(workspaceId);
        return newSet;
      });
    } else {
      // Select workspace
      setSelectedWorkspaceIds(prev => [...prev, workspaceId]);
      
      if (models && models.length > 0) {
        // Models are loaded, add them to selection
        const modelsToAdd = models.map(model => ({
          workspaceId,
          modelId: model.id,
          workspaceName,
          modelName: model.name
        }));
        setSelectedModels(prev => [
          ...prev.filter(m => m.workspaceId !== workspaceId),
          ...modelsToAdd
        ]);
        setWorkspaceOnlySelections(prev => {
          const newSet = new Set(prev);
          newSet.delete(workspaceId);
          return newSet;
        });
      } else {
        // Models not loaded yet - mark for lazy evaluation
        setWorkspaceOnlySelections(prev => new Set(prev).add(workspaceId));
      }
    }
    setError(null);
    setSuccess(null);
  };

  const handleModelSelect = (workspaceId: string, modelId: string, workspaceName?: string, modelName?: string) => {
    // Toggle selection
    const existingIndex = selectedModels.findIndex(
      m => m.workspaceId === workspaceId && m.modelId === modelId
    );
    
    if (existingIndex >= 0) {
      // Remove from selection
      setSelectedModels(prev => prev.filter((_, i) => i !== existingIndex));
    } else {
      // Add to selection
      setSelectedModels(prev => [
        ...prev,
        {
          workspaceId,
          modelId,
          workspaceName: workspaceName || workspaceId,
          modelName: modelName || modelId
        }
      ]);
    }
    setError(null);
    setSuccess(null);
  };

  const handleDownload = async () => {
    if (selectedModels.length === 0 && workspaceOnlySelections.size === 0) {
      setError("Please select at least one semantic model or workspace");
      return;
    }

    setDownloading(true);
    setError(null);
    setSuccess(null);

    const results: { success: string[]; failed: string[] } = { success: [], failed: [] };

    try {
      // First, fetch models for workspace-only selections
      const workspaceModelsToDownload: SelectedModel[] = [];
      
      for (const workspaceId of Array.from(workspaceOnlySelections)) {
        try {
          const workspace = workspaces.find(w => w.id === workspaceId);
          const modelsResponse = await apiClient.get(`/workspaces/${workspaceId}/semantic-models`);
          const models = modelsResponse.data;
          
          models.forEach((model: any) => {
            workspaceModelsToDownload.push({
              workspaceId,
              modelId: model.id,
              workspaceName: workspace?.name || workspaceId,
              modelName: model.name
            });
          });
        } catch (err: any) {
          console.error(`Failed to fetch models for workspace ${workspaceId}:`, err);
        }
      }

      // Combine explicitly selected models with workspace models
      const allModelsToDownload = [...selectedModels, ...workspaceModelsToDownload];

      if (allModelsToDownload.length === 0) {
        setError("No models found in selected workspaces");
        setDownloading(false);
        return;
      }

      // Download all models
      for (const model of allModelsToDownload) {
        try {
          const response = await apiClient.get(
            `/workspaces/${model.workspaceId}/semantic-models/${model.modelId}/download`,
            { responseType: "blob" }
          );

          // Extract filename from Content-Disposition header
          const contentDisposition = response.headers["content-disposition"];
          let filename = `${model.modelName}.zip`;
          if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
            if (filenameMatch && filenameMatch[1]) {
              filename = filenameMatch[1];
            }
          }

          // Create download link
          const url = window.URL.createObjectURL(new Blob([response.data]));
          const link = document.createElement("a");
          link.href = url;
          link.setAttribute("download", filename);
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(url);

          results.success.push(model.modelName);

          // Small delay between downloads to avoid overwhelming the browser
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err: any) {
          results.failed.push(model.modelName);
        }
      }

      if (results.failed.length === 0) {
        setSuccess(`Successfully downloaded ${results.success.length} model(s)`);
      } else if (results.success.length === 0) {
        setError(`Failed to download all ${results.failed.length} model(s)`);
      } else {
        setSuccess(
          `Downloaded ${results.success.length} model(s). Failed: ${results.failed.length}`
        );
      }
    } catch (err: any) {
      setError("Failed to process download request");
    } finally {
      setDownloading(false);
      setTimeout(() => setSuccess(null), 8000);
    }
  };

  return (
    <div className="download-page">
      <h1>Download Semantic Models</h1>
      <p className="subtitle">Select workspace(s) and semantic model(s) to download</p>

      <div className="download-container">
        <div className="selection-section">
          {(selectedModels.length > 0 || workspaceOnlySelections.size > 0) && (
            <div style={{ marginBottom: "1rem", fontSize: "0.9rem", color: "#0078d4" }}>
              {selectedModels.length} individual model(s) + {workspaceOnlySelections.size} workspace(s) selected
            </div>
          )}

          <HierarchicalWorkspaceSelector
            workspaces={workspaces}
            onWorkspaceSelect={handleWorkspaceSelect}
            onModelSelect={handleModelSelect}
            selectedModelId={null}
            selectedModels={selectedModels}
            selectedWorkspaceIds={selectedWorkspaceIds}
            multiSelectMode={true}
            loading={loadingWorkspaces}
            error={error}
          />

          {selectedModels.length > 0 && (
            <div className="selected-models-summary" style={{ 
              marginTop: "1rem", 
              padding: "1rem", 
              backgroundColor: "#f5f5f5", 
              borderRadius: "4px" 
            }}>
              <h4>Selected Models ({selectedModels.length}):</h4>
              <ul style={{ marginTop: "0.5rem", paddingLeft: "1.5rem" }}>
                {selectedModels.map(model => (
                  <li key={`${model.workspaceId}-${model.modelId}`}>
                    <strong>{model.workspaceName}</strong> - {model.modelName}
                    <button
                      onClick={() => handleModelSelect(model.workspaceId, model.modelId)}
                      style={{
                        marginLeft: "0.5rem",
                        padding: "0.2rem 0.5rem",
                        fontSize: "0.8rem",
                        cursor: "pointer"
                      }}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="action-section">
          <button
            className="download-button"
            onClick={handleDownload}
            disabled={(selectedModels.length === 0 && workspaceOnlySelections.size === 0) || downloading}
          >
            {downloading 
              ? `Downloading models...` 
              : `Download All Selected (${selectedModels.length + workspaceOnlySelections.size} items)`}
          </button>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
        </div>
      </div>
    </div>
  );
}

export default DownloadPage;

