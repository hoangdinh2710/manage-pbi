import { useState, useEffect, useMemo } from "react";
import { apiClient } from "../services/apiClient";

interface Workspace {
  id: string;
  name: string;
  type?: string;
  capacityId?: string;
}

interface SemanticModel {
  id: string;
  name: string;
  description?: string;
  configuredBy?: string;
  targetStorageMode?: string;
}

interface Report {
  id: string;
  name: string;
  description?: string;
}

interface HierarchicalWorkspaceSelectorProps {
  workspaces: Workspace[];
  onWorkspaceSelect?: (workspaceId: string, workspaceName: string, models: SemanticModel[]) => void;
  onModelSelect: (workspaceId: string, modelId: string, workspaceName?: string, modelName?: string) => void;
  selectedModelId: string | null;
  selectedModels?: { workspaceId: string; modelId: string; workspaceName: string; modelName: string }[];
  selectedWorkspaceIds?: string[];
  multiSelectMode?: boolean;
  loading?: boolean;
  error?: string | null;
}

const STORAGE_KEY = "pbiCommanderExpandedWorkspace";
const ITEMS_PER_PAGE = 10;

export function HierarchicalWorkspaceSelector({
  workspaces,
  onWorkspaceSelect,
  onModelSelect,
  selectedModelId,
  selectedModels = [],
  selectedWorkspaceIds = [],
  multiSelectMode = false,
  loading,
  error,
}: HierarchicalWorkspaceSelectorProps) {
  const [expandedWorkspaceId, setExpandedWorkspaceId] = useState<string | null>(null);
  const [semanticModels, setSemanticModels] = useState<Record<string, SemanticModel[]>>({});
  const [reports, setReports] = useState<Record<string, Report[]>>({});
  const [loadingModels, setLoadingModels] = useState<Record<string, boolean>>({});
  const [modelErrors, setModelErrors] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "workspace" | "semantic-model" | "report">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectingAll, setSelectingAll] = useState(false);

  // Load expanded workspace from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && workspaces.some(w => w.id === stored)) {
      setExpandedWorkspaceId(stored);
    } else if (stored) {
      // Clear invalid stored value
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [workspaces]);

  // Clear localStorage if workspace list changes
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && !workspaces.some(w => w.id === stored)) {
      localStorage.removeItem(STORAGE_KEY);
      setExpandedWorkspaceId(null);
    }
  }, [workspaces]);

  // Reset to page 1 when search query or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType]);

  // Sort workspaces A-Z by name
  const sortedWorkspaces = useMemo(() => {
    return [...workspaces].sort((a, b) => a.name.localeCompare(b.name));
  }, [workspaces]);

  // Filter workspaces based on search and filter type
  const filteredWorkspaces = useMemo(() => {
    if (!searchQuery) return sortedWorkspaces;

    const query = searchQuery.toLowerCase();

    return sortedWorkspaces.filter(workspace => {
      // Always check workspace name if filter is "all" or "workspace"
      if (filterType === "all" || filterType === "workspace") {
        if (workspace.name.toLowerCase().includes(query)) {
          return true;
        }
      }

      // Check semantic models if filter is "all" or "semantic-model"
      if ((filterType === "all" || filterType === "semantic-model") && semanticModels[workspace.id]) {
        const hasMatchingModel = semanticModels[workspace.id].some(model =>
          model.name.toLowerCase().includes(query) ||
          model.description?.toLowerCase().includes(query)
        );
        if (hasMatchingModel) return true;
      }

      // Check reports if filter is "all" or "report"
      if ((filterType === "all" || filterType === "report") && reports[workspace.id]) {
        const hasMatchingReport = reports[workspace.id].some(report =>
          report.name.toLowerCase().includes(query) ||
          report.description?.toLowerCase().includes(query)
        );
        if (hasMatchingReport) return true;
      }

      return false;
    });
  }, [sortedWorkspaces, searchQuery, filterType, semanticModels, reports]);

  // Paginate workspaces
  const totalPages = Math.ceil(filteredWorkspaces.length / ITEMS_PER_PAGE);
  const paginatedWorkspaces = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredWorkspaces.slice(startIndex, endIndex);
  }, [filteredWorkspaces, currentPage]);

  const toggleWorkspace = async (workspaceId: string) => {
    if (expandedWorkspaceId === workspaceId) {
      // Collapse current workspace
      setExpandedWorkspaceId(null);
      localStorage.removeItem(STORAGE_KEY);
    } else {
      // Expand new workspace and collapse previous
      setExpandedWorkspaceId(workspaceId);
      localStorage.setItem(STORAGE_KEY, workspaceId);

      // Fetch semantic models and reports if not already loaded
      if (!semanticModels[workspaceId] && !loadingModels[workspaceId]) {
        await fetchWorkspaceModels(workspaceId);
      }
    }
  };

  const fetchWorkspaceModels = async (workspaceId: string) => {
    setLoadingModels(prev => ({ ...prev, [workspaceId]: true }));
    setModelErrors(prev => ({ ...prev, [workspaceId]: "" }));

    try {
      // Fetch semantic models
      const modelsResponse = await apiClient.get(`/workspaces/${workspaceId}/semantic-models`);
      setSemanticModels(prev => ({ ...prev, [workspaceId]: modelsResponse.data }));

      // Fetch reports
      try {
        const reportsResponse = await apiClient.get(`/workspaces/${workspaceId}/reports`);
        setReports(prev => ({ ...prev, [workspaceId]: reportsResponse.data }));
      } catch {
        // Reports fetch is optional, don't fail if it errors
        setReports(prev => ({ ...prev, [workspaceId]: [] }));
      }
      
      return modelsResponse.data;
    } catch (err: any) {
      setModelErrors(prev => ({
        ...prev,
        [workspaceId]: err.response?.data?.error || "Failed to load semantic models"
      }));
      return [];
    } finally {
      setLoadingModels(prev => ({ ...prev, [workspaceId]: false }));
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSelectAll = async () => {
    if (!onWorkspaceSelect) return;
    
    setSelectingAll(true);
    const allWorkspaceIds = filteredWorkspaces.map(w => w.id);
    const areAllSelected = allWorkspaceIds.every(id => selectedWorkspaceIds.includes(id));
    
    if (areAllSelected) {
      // Deselect all
      allWorkspaceIds.forEach(workspaceId => {
        onWorkspaceSelect(workspaceId, workspaces.find(w => w.id === workspaceId)?.name || '', []);
      });
    } else {
      // Select all - use lazy evaluation (don't fetch models)
      for (const workspace of filteredWorkspaces) {
        if (!selectedWorkspaceIds.includes(workspace.id)) {
          // Pass empty array - models will be fetched lazily during download
          onWorkspaceSelect(workspace.id, workspace.name, []);
        }
      }
    }
    
    setSelectingAll(false);
  };

  if (loading) {
    return <div className="hierarchical-selector loading">Loading workspaces...</div>;
  }

  if (error) {
    return <div className="hierarchical-selector error">{error}</div>;
  }

  if (workspaces.length === 0) {
    return <div className="hierarchical-selector empty">No workspaces available.</div>;
  }

  return (
    <div className="hierarchical-selector">
      <h3>Workspaces & Semantic Models</h3>

      {/* Select All Section */}
      {multiSelectMode && onWorkspaceSelect && (
        <div style={{ marginBottom: "1rem", padding: "0.75rem", backgroundColor: "#f0f8ff", borderRadius: "4px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontWeight: "500" }}>
            <input
              type="checkbox"
              checked={filteredWorkspaces.length > 0 && filteredWorkspaces.every(w => selectedWorkspaceIds.includes(w.id))}
              indeterminate={filteredWorkspaces.some(w => selectedWorkspaceIds.includes(w.id)) && !filteredWorkspaces.every(w => selectedWorkspaceIds.includes(w.id))}
              onChange={handleSelectAll}
              disabled={selectingAll || filteredWorkspaces.length === 0}
              style={{ cursor: selectingAll ? "wait" : "pointer" }}
            />
            <span>
              {selectingAll ? "Selecting all workspaces..." : "Select All Workspaces"}
              {filteredWorkspaces.length > 0 && ` (${filteredWorkspaces.length})`}
            </span>
          </label>
        </div>
      )}

      {/* Search and Filter Section */}
      <div className="search-filter-section" style={{ marginBottom: "1rem" }}>
        <input
          type="text"
          placeholder="Search workspaces, models, or reports..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: "100%",
            padding: "0.5rem",
            marginBottom: "0.5rem",
            border: "1px solid #ddd",
            borderRadius: "4px"
          }}
        />
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <input
              type="radio"
              value="all"
              checked={filterType === "all"}
              onChange={(e) => setFilterType(e.target.value as any)}
            />
            All
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <input
              type="radio"
              value="workspace"
              checked={filterType === "workspace"}
              onChange={(e) => setFilterType(e.target.value as any)}
            />
            Workspace
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <input
              type="radio"
              value="semantic-model"
              checked={filterType === "semantic-model"}
              onChange={(e) => setFilterType(e.target.value as any)}
            />
            Semantic Models
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <input
              type="radio"
              value="report"
              checked={filterType === "report"}
              onChange={(e) => setFilterType(e.target.value as any)}
            />
            Reports
          </label>
        </div>
        <div style={{ marginTop: "0.5rem", fontSize: "0.9rem", color: "#666" }}>
          Showing {paginatedWorkspaces.length} of {filteredWorkspaces.length} workspaces
          {searchQuery && ` (filtered from ${workspaces.length} total)`}
        </div>
      </div>

      {filteredWorkspaces.length === 0 ? (
        <div className="empty-results" style={{ padding: "2rem", textAlign: "center", color: "#666" }}>
          No workspaces match your search criteria
        </div>
      ) : (
        <>
          <div className="workspace-list">
            {paginatedWorkspaces.map(workspace => {
              const isWorkspaceSelected = selectedWorkspaceIds.includes(workspace.id);
              const workspaceModels = semanticModels[workspace.id] || [];
              
              return (
          <div key={workspace.id} className="workspace-item">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {multiSelectMode && onWorkspaceSelect && (
                <input
                  type="checkbox"
                  checked={isWorkspaceSelected}
                  onChange={async (e) => {
                    e.stopPropagation();
                    // Use lazy evaluation - only fetch models if already expanded
                    const models = workspaceModels.length > 0 ? workspaceModels : [];
                    onWorkspaceSelect(workspace.id, workspace.name, models);
                  }}
                  disabled={loadingModels[workspace.id]}
                  style={{ cursor: loadingModels[workspace.id] ? "wait" : "pointer" }}
                />
              )}
              <button
                className={`workspace-toggle ${expandedWorkspaceId === workspace.id ? "expanded" : ""}`}
                onClick={() => toggleWorkspace(workspace.id)}
                style={{ flex: 1 }}
              >
                <span className="chevron">{expandedWorkspaceId === workspace.id ? "▼" : "▶"}</span>
                <span className="workspace-name">{workspace.name}</span>
              </button>
            </div>

            {expandedWorkspaceId === workspace.id && (
              <div className="models-container">
                {loadingModels[workspace.id] && (
                  <div className="loading-models">
                    <div className="pulsing-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <span>Loading models...</span>
                  </div>
                )}

                {modelErrors[workspace.id] && (
                  <div className="inline-error">{modelErrors[workspace.id]}</div>
                )}

                {!loadingModels[workspace.id] &&
                  !modelErrors[workspace.id] &&
                  semanticModels[workspace.id] &&
                  semanticModels[workspace.id].length === 0 && (
                    <div className="empty-models">No models available</div>
                  )}

                {!loadingModels[workspace.id] &&
                  !modelErrors[workspace.id] &&
                  semanticModels[workspace.id] &&
                  semanticModels[workspace.id].length > 0 && (
                    <div className="models-list">
                      {semanticModels[workspace.id].map(model => {
                        const isSelected = multiSelectMode
                          ? selectedModels.some(m => m.workspaceId === workspace.id && m.modelId === model.id)
                          : selectedModelId === model.id;
                        
                        return (
                          <button
                            key={model.id}
                            className={`model-item ${isSelected ? "selected" : ""}`}
                            onClick={() => onModelSelect(workspace.id, model.id, workspace.name, model.name)}
                            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                          >
                            {multiSelectMode && (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                style={{ pointerEvents: "none" }}
                              />
                            )}
                            <div style={{ flex: 1, textAlign: "left" }}>
                              <div className="model-name">{model.name}</div>
                              {model.description && (
                                <div className="model-description">{model.description}</div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
              </div>
            )}
          </div>
              );
            })}
      </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="pagination" style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "0.5rem",
              marginTop: "1rem",
              padding: "1rem"
            }}>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                style={{ padding: "0.5rem 1rem", cursor: currentPage === 1 ? "not-allowed" : "pointer" }}
              >
                Previous
              </button>
              <span style={{ margin: "0 1rem" }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                style={{ padding: "0.5rem 1rem", cursor: currentPage === totalPages ? "not-allowed" : "pointer" }}
              >
                Next
              </button>
              
              {/* Page number buttons */}
              <div style={{ display: "flex", gap: "0.25rem", marginLeft: "1rem" }}>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      style={{
                        padding: "0.5rem 0.75rem",
                        backgroundColor: currentPage === pageNum ? "#0078d4" : "#f3f3f3",
                        color: currentPage === pageNum ? "white" : "black",
                        border: "1px solid #ddd",
                        cursor: "pointer",
                        borderRadius: "4px"
                      }}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
