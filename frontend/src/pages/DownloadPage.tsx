import { useState, useEffect } from "react";
import { Download, X, AlertCircle, CheckCircle, Package } from "lucide-react";
import { apiClient } from "../services/apiClient";
import { HierarchicalWorkspaceSelector } from "../components/HierarchicalWorkspaceSelector";
import { Button, Spinner } from "../components/ui";
import { useToast } from "../components/ui";

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
  const { success: showSuccess, error: showError } = useToast();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedModels, setSelectedModels] = useState<SelectedModel[]>([]);
  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState<string[]>([]);
  const [workspaceOnlySelections, setWorkspaceOnlySelections] = useState<Set<string>>(new Set());
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<string | null>(null);

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
    const isSelected = selectedWorkspaceIds.includes(workspaceId);
    
    if (isSelected) {
      setSelectedWorkspaceIds(prev => prev.filter(id => id !== workspaceId));
      setSelectedModels(prev => prev.filter(m => m.workspaceId !== workspaceId));
      setWorkspaceOnlySelections(prev => {
        const newSet = new Set(prev);
        newSet.delete(workspaceId);
        return newSet;
      });
    } else {
      setSelectedWorkspaceIds(prev => [...prev, workspaceId]);
      
      if (models && models.length > 0) {
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
        setWorkspaceOnlySelections(prev => new Set(prev).add(workspaceId));
      }
    }
    setError(null);
  };

  const handleModelSelect = (workspaceId: string, modelId: string, workspaceName?: string, modelName?: string) => {
    const existingIndex = selectedModels.findIndex(
      m => m.workspaceId === workspaceId && m.modelId === modelId
    );
    
    if (existingIndex >= 0) {
      setSelectedModels(prev => prev.filter((_, i) => i !== existingIndex));
    } else {
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
  };

  const handleRemoveModel = (workspaceId: string, modelId: string) => {
    setSelectedModels(prev => prev.filter(
      m => !(m.workspaceId === workspaceId && m.modelId === modelId)
    ));
  };

  const handleDownload = async () => {
    if (selectedModels.length === 0 && workspaceOnlySelections.size === 0) {
      setError("Please select at least one semantic model or workspace");
      return;
    }

    setDownloading(true);
    setError(null);
    setDownloadProgress("Preparing download...");

    const results: { success: string[]; failed: string[] } = { success: [], failed: [] };

    try {
      const workspaceModelsToDownload: SelectedModel[] = [];
      
      for (const workspaceId of Array.from(workspaceOnlySelections)) {
        try {
          const workspace = workspaces.find(w => w.id === workspaceId);
          setDownloadProgress(`Fetching models from ${workspace?.name || workspaceId}...`);
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

      const allModelsToDownload = [...selectedModels, ...workspaceModelsToDownload];

      if (allModelsToDownload.length === 0) {
        setError("No models found in selected workspaces");
        setDownloading(false);
        setDownloadProgress(null);
        return;
      }

      let current = 0;
      for (const model of allModelsToDownload) {
        current++;
        setDownloadProgress(`Downloading ${current}/${allModelsToDownload.length}: ${model.modelName}`);
        
        try {
          const response = await apiClient.get(
            `/workspaces/${model.workspaceId}/semantic-models/${model.modelId}/download`,
            { responseType: "blob" }
          );

          const contentDisposition = response.headers["content-disposition"];
          let filename = `${model.modelName}.zip`;
          if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
            if (filenameMatch && filenameMatch[1]) {
              filename = filenameMatch[1];
            }
          }

          const url = window.URL.createObjectURL(new Blob([response.data]));
          const link = document.createElement("a");
          link.href = url;
          link.setAttribute("download", filename);
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(url);

          results.success.push(model.modelName);
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err: any) {
          results.failed.push(model.modelName);
        }
      }

      if (results.failed.length === 0) {
        showSuccess(`Successfully downloaded ${results.success.length} model(s)`);
      } else if (results.success.length === 0) {
        showError(`Failed to download all ${results.failed.length} model(s)`);
      } else {
        showSuccess(`Downloaded ${results.success.length} model(s). Failed: ${results.failed.length}`);
      }
    } catch (err: any) {
      showError("Failed to process download request");
    } finally {
      setDownloading(false);
      setDownloadProgress(null);
    }
  };

  const totalSelected = selectedModels.length + workspaceOnlySelections.size;

  return (
    <div className="download-page">
      <div className="page-header">
        <h1>Download Semantic Models</h1>
        <p className="subtitle">Select workspace(s) and semantic model(s) to download</p>
      </div>

      <div className="download-container">
        {error && (
          <div className="error-state">
            <AlertCircle size={20} className="error-state-icon" />
            <div className="error-state-content">
              <div className="error-state-message">{error}</div>
            </div>
          </div>
        )}

        <div className="selection-section">
          {totalSelected > 0 && (
            <div className="selection-summary">
              <Package size={18} />
              <span>
                <strong>{selectedModels.length}</strong> model(s) + <strong>{workspaceOnlySelections.size}</strong> workspace(s) selected
              </span>
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
            <div className="selected-models-panel">
              <div className="selected-models-header">
                <h4>Selected Models ({selectedModels.length})</h4>
              </div>
              <ul className="selected-models-list">
                {selectedModels.map(model => (
                  <li key={`${model.workspaceId}-${model.modelId}`} className="selected-model-item">
                    <div className="selected-model-info">
                      <span className="selected-model-workspace">{model.workspaceName}</span>
                      <span className="selected-model-name">{model.modelName}</span>
                    </div>
                    <button
                      className="remove-model-btn"
                      onClick={() => handleRemoveModel(model.workspaceId, model.modelId)}
                      aria-label={`Remove ${model.modelName}`}
                    >
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="action-section">
          {downloading && downloadProgress && (
            <div className="download-progress">
              <Spinner size="sm" />
              <span>{downloadProgress}</span>
            </div>
          )}
          
          <Button
            variant="primary"
            size="lg"
            leftIcon={Download}
            onClick={handleDownload}
            disabled={totalSelected === 0 || downloading}
            loading={downloading}
          >
            {downloading 
              ? "Downloading..." 
              : `Download All Selected (${totalSelected} items)`}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default DownloadPage;
