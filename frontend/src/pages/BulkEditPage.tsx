import { useEffect, useMemo, useState } from "react";
import { 
  Download, 
  Upload, 
  FileText, 
  Trash2, 
  Plus, 
  FolderOpen, 
  Loader2, 
  Play,
  X 
} from "lucide-react";
import { artifactsApi, semanticModelApi } from "../services/apiClient";
import { Button, Spinner } from "../components/ui";
import { useToast } from "../components/ui";
import type {
  BulkImportEntry,
  KeywordMapping,
  LocalSemanticModel,
  LocalWorkspace,
  RemoteSemanticModel,
  SelectedModel,
} from "../types";

const REQUIRED_HEADERS = ["workspace_id", "dataset_id"];
const BULK_EDIT_STORAGE_KEY = "pbi_commander_bulk_edit_state";

type BulkAction = "download" | "deploy" | "update_keywords";

type CsvRow = Record<string, string>;

type ActionSummary = {
  total: number;
  success: number;
  failed: number;
  errors: string[];
};

type StoredBulkEditState = {
  entries: BulkImportEntry[];
  lastUploadTime: string;
};

const initialSummary: ActionSummary = { total: 0, success: 0, failed: 0, errors: [] };

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === "\"") {
      if (inQuotes && line[i + 1] === "\"") {
        current += "\"";
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase();
}

function parseCsv(content: string): CsvRow[] {
  const sanitized = content.replace(/\r\n/g, "\n").trim();
  if (!sanitized) {
    return [];
  }

  const lines = sanitized
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return [];
  }

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    throw new Error(`Missing required columns: ${missingHeaders.join(", ")}`);
  }

  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]);
    if (values.every((value) => value.trim().length === 0)) {
      continue;
    }

    const row: CsvRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() ?? "";
    });

    rows.push(row);
  }

  return rows;
}

function buildLocalMap(workspaces: LocalWorkspace[]): Map<string, LocalSemanticModel & { workspace_name: string }> {
  const map = new Map<string, LocalSemanticModel & { workspace_name: string }>();

  workspaces.forEach((workspace) => {
    workspace.semantic_models.forEach((model) => {
      map.set(`${workspace.workspace_id}::${model.artifact_id}`, {
        ...model,
        workspace_name: workspace.workspace_name,
      });
    });
  });

  return map;
}

function reconcileEntries(
  entries: BulkImportEntry[],
  workspaces: LocalWorkspace[],
): BulkImportEntry[] {
  const localMap = buildLocalMap(workspaces);

  return entries.map((entry) => {
    const localModel = localMap.get(`${entry.workspaceId}::${entry.datasetId}`) ?? null;
    return {
      ...entry,
      localModel,
      workspaceName: entry.workspaceName || localModel?.workspace_name,
      datasetName: entry.datasetName || localModel?.artifact_name,
      status: localModel ? "local" : entry.status,
      error: localModel ? undefined : entry.error,
    };
  });
}

export default function BulkEditPage(): JSX.Element {
  const toast = useToast();
  const [localData, setLocalData] = useState<LocalWorkspace[]>([]);
  const [entries, setEntries] = useState<BulkImportEntry[]>([]);
  const [loadingLocal, setLoadingLocal] = useState(true);
  const [loadingCsv, setLoadingCsv] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [selectedModels, setSelectedModels] = useState<SelectedModel[]>([]);
  const [selectedAction, setSelectedAction] = useState<BulkAction>("download");
  const [keywordMappings, setKeywordMappings] = useState<KeywordMapping[]>([
    { id: crypto.randomUUID(), oldValue: "", newValue: "" },
  ]);

  // Folder opening state
  const [openingFolder, setOpeningFolder] = useState<string | null>(null);
  const [actionSummary, setActionSummary] = useState<ActionSummary>(initialSummary);
  const [processingAction, setProcessingAction] = useState(false);
  const [downloadingMissing, setDownloadingMissing] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoadingLocal(true);
        const data = await artifactsApi.getLocalModels();
        setLocalData(data.workspaces || []);

        // Try to restore entries from localStorage
        const storedState = localStorage.getItem(BULK_EDIT_STORAGE_KEY);
        if (storedState) {
          try {
            const parsed: StoredBulkEditState = JSON.parse(storedState);
            if (parsed.entries && Array.isArray(parsed.entries)) {
              setEntries(parsed.entries);
            }
          } catch (err) {
            console.error("Failed to restore bulk edit state from localStorage:", err);
          }
        }
      } catch (error: any) {
        console.error("Failed to load local models", error);
      } finally {
        setLoadingLocal(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    setEntries((prev) => reconcileEntries(prev, localData));
  }, [localData]);

  useEffect(() => {
    // Save entries to localStorage whenever they change
    if (entries.length > 0) {
      const stateToStore: StoredBulkEditState = {
        entries,
        lastUploadTime: new Date().toISOString(),
      };
      localStorage.setItem(BULK_EDIT_STORAGE_KEY, JSON.stringify(stateToStore));
    }
  }, [entries]);

  useEffect(() => {
    setSelectedModels((prev) =>
      prev.filter((model) =>
        entries.some(
          (entry) =>
            entry.localModel &&
            entry.workspaceId === model.workspaceId &&
            entry.datasetId === model.modelId,
        ),
      ),
    );
  }, [entries]);

  const missingEntries = useMemo(
    () => entries.filter((entry) => entry.status === "missing" || entry.status === "error"),
    [entries],
  );

  const localMap = useMemo(() => buildLocalMap(localData), [localData]);

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

  const handleFileInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setLoadingCsv(true);
      setCsvError(null);
      const content = await file.text();
      const rows = parseCsv(content);

      if (rows.length === 0) {
        setEntries([]);
        setCsvError("The CSV file is empty.");
        return;
      }

      const unique = new Map<string, BulkImportEntry>();
      const rowErrors: string[] = [];

      rows.forEach((row, index) => {
        const workspaceId = row["workspace_id"]?.trim();
        const datasetId = row["dataset_id"]?.trim();

        if (!workspaceId || !datasetId) {
          rowErrors.push(`Row ${index + 2} is missing workspace_id or dataset_id.`);
          return;
        }

        const key = `${workspaceId}::${datasetId}`;
        if (unique.has(key)) {
          return;
        }

        const localModel = localMap.get(key) ?? null;

        unique.set(key, {
          id: key,
          workspaceId,
          datasetId,
          workspaceName: row["workspace_name"] || row["workspace"] || localModel?.workspace_name,
          datasetName: row["dataset_name"] || row["model_name"] || localModel?.artifact_name,
          localModel,
          status: localModel ? "local" : "missing",
        });
      });

      if (rowErrors.length > 0) {
        setCsvError(rowErrors.join("\n"));
      }

      const initialEntries = Array.from(unique.values());
      setEntries(initialEntries);
      if (initialEntries.length > 0) {
        await hydrateRemoteNames(initialEntries);
      }
    } catch (error: any) {
      setCsvError(error.message || "Failed to parse CSV file.");
      setEntries([]);
    } finally {
      setLoadingCsv(false);
    }
  };

  const hydrateRemoteNames = async (initialEntries: BulkImportEntry[]) => {
    const byWorkspace = new Map<string, BulkImportEntry[]>();
    const workspaceMetadata = new Map<string, string>(); // Store workspace names

    initialEntries.forEach((entry) => {
      if (entry.localModel) {
        return;
      }
      if (!byWorkspace.has(entry.workspaceId)) {
        byWorkspace.set(entry.workspaceId, []);
      }
      byWorkspace.get(entry.workspaceId)!.push(entry);
    });

    if (byWorkspace.size === 0) {
      return;
    }

    const updatedEntries = [...initialEntries];

    await Promise.all(
      Array.from(byWorkspace.entries()).map(async ([workspaceId, workspaceEntries]) => {
        try {
          const response = await semanticModelApi.listRemoteModels(workspaceId);
          const datasets: RemoteSemanticModel[] = Array.isArray(response?.data)
            ? response.data
            : [];

          // Extract workspace name from first dataset if available
          if (datasets.length > 0 && datasets[0].workspaceName) {
            workspaceMetadata.set(workspaceId, datasets[0].workspaceName);
          }

          workspaceEntries.forEach((entry) => {
            const remoteMatch = datasets.find((dataset) => dataset.id === entry.datasetId);
            if (remoteMatch) {
              const datasetName = typeof remoteMatch.name === "string" ? remoteMatch.name : undefined;
              const workspaceName = typeof remoteMatch.workspaceName === "string" 
                ? remoteMatch.workspaceName 
                : workspaceMetadata.get(workspaceId);
              
              entry.workspaceName = entry.workspaceName || workspaceName || undefined;
              entry.datasetName = datasetName || entry.datasetName;
            } else if (workspaceMetadata.has(workspaceId)) {
              // Even if dataset not found, still populate workspace name
              entry.workspaceName = entry.workspaceName || workspaceMetadata.get(workspaceId);
            }
          });
        } catch (error) {
          console.warn(`Failed to load remote metadata for workspace ${workspaceId}`, error);
        }
      }),
    );

    setEntries(updatedEntries);
  };

  const toggleSelectEntry = (entry: BulkImportEntry) => {
    if (!entry.localModel) {
      alert("Download the model before selecting it for actions.");
      return;
    }

    const exists = selectedModels.some(
      (model) => model.workspaceId === entry.workspaceId && model.modelId === entry.datasetId,
    );

    if (exists) {
      setSelectedModels((prev) =>
        prev.filter((model) => !(model.workspaceId === entry.workspaceId && model.modelId === entry.datasetId)),
      );
      return;
    }

    if (!entry.localModel) {
      return;
    }

    setSelectedModels((prev) => [
      ...prev,
      {
        workspaceId: entry.workspaceId,
        modelId: entry.datasetId,
        modelName: entry.localModel!.artifact_name,
        folderPath: entry.localModel!.folder_path,
        hasBackup: entry.localModel!.has_backup || false,
      },
    ]);
  };

  const handleSelectAll = () => {
    const selectables = entries.filter((entry) => entry.localModel);
    if (selectables.length === 0) {
      return;
    }

    if (selectedModels.length === selectables.length) {
      setSelectedModels([]);
      return;
    }

    setSelectedModels(
      selectables.map((entry) => ({
        workspaceId: entry.workspaceId,
        modelId: entry.datasetId,
        modelName: entry.localModel!.artifact_name,
        folderPath: entry.localModel!.folder_path,
        hasBackup: entry.localModel!.has_backup || false,
      })),
    );
  };

  const addKeywordMapping = () => {
    setKeywordMappings((prev) => [...prev, { id: crypto.randomUUID(), oldValue: "", newValue: "" }]);
  };

  const removeKeywordMapping = (id: string) => {
    setKeywordMappings((prev) => prev.filter((mapping) => mapping.id !== id));
  };

  const updateKeywordMapping = (id: string, field: "oldValue" | "newValue", value: string) => {
    setKeywordMappings((prev) =>
      prev.map((mapping) => (mapping.id === id ? { ...mapping, [field]: value } : mapping)),
    );
  };

  const handleDownloadMissing = async () => {
    if (missingEntries.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      `Download ${missingEntries.length} missing semantic model${missingEntries.length > 1 ? "s" : ""}?`,
    );
    if (!confirmed) {
      return;
    }

    setDownloadingMissing(true);
    setEntries((prev) =>
      prev.map((entry) =>
        missingEntries.some((missing) => missing.id === entry.id)
          ? { ...entry, status: "downloading", error: undefined }
          : entry,
      ),
    );

    const grouped = new Map<string, string[]>();
    missingEntries.forEach((entry) => {
      if (!grouped.has(entry.workspaceId)) {
        grouped.set(entry.workspaceId, []);
      }
      grouped.get(entry.workspaceId)!.push(entry.datasetId);
    });

    const errors: string[] = [];

    for (const [workspaceId, datasetIds] of grouped.entries()) {
      try {
        const results = await artifactsApi.bulkDownload(workspaceId, datasetIds);
        const normalized = Array.isArray(results) ? results : [];

        setEntries((prev) =>
          prev.map((entry) => {
            if (entry.workspaceId !== workspaceId || !datasetIds.includes(entry.datasetId)) {
              return entry;
            }

            const result = normalized.find((r: any) => r.semantic_model_id === entry.datasetId);
            if (result && result.status === "success") {
              return { ...entry, status: "downloaded", error: undefined };
            }

            const errorMessage = result?.error || "Download failed";
            errors.push(`${entry.datasetId}: ${errorMessage}`);
            return { ...entry, status: "error", error: errorMessage };
          }),
        );
      } catch (error: any) {
        const message = error.response?.data?.error || error.message || "Download failed";
        errors.push(`${workspaceId}: ${message}`);
        setEntries((prev) =>
          prev.map((entry) =>
            entry.workspaceId === workspaceId && datasetIds.includes(entry.datasetId)
              ? { ...entry, status: "error", error: message }
              : entry,
          ),
        );
      }
    }

    try {
      const data = await artifactsApi.getLocalModels();
      setLocalData(data.workspaces || []);
    } catch (error) {
      console.error("Failed to refresh local models after download", error);
    } finally {
      setDownloadingMissing(false);
      if (errors.length > 0) {
        alert(`Some downloads failed:\n${errors.join("\n")}`);
      }
    }
  };

  const executeAction = async () => {
    if (selectedModels.length === 0) {
      alert("Select at least one model before running an action.");
      return;
    }

    if (selectedAction === "update_keywords") {
      const validMappings = keywordMappings.filter((mapping) => mapping.oldValue && mapping.newValue);
      if (validMappings.length === 0) {
        alert("Add at least one keyword mapping before updating definitions.");
        return;
      }
    }

    const confirmed = window.confirm(getConfirmationMessage(selectedAction, selectedModels.length));
    if (!confirmed) {
      return;
    }

    setProcessingAction(true);
    setActionSummary(initialSummary);

    const summary: ActionSummary = { total: selectedModels.length, success: 0, failed: 0, errors: [] };

    for (const model of selectedModels) {
      try {
        if (selectedAction === "download") {
          await artifactsApi.refreshModel(model.workspaceId, model.modelId);
        } else if (selectedAction === "deploy") {
          await semanticModelApi.uploadSemanticModel(model.workspaceId, model.modelId, model.folderPath);
        } else if (selectedAction === "update_keywords") {
          const mappings = keywordMappings
            .filter((mapping) => mapping.oldValue && mapping.newValue)
            .reduce((acc, mapping) => {
              acc[mapping.oldValue] = mapping.newValue;
              return acc;
            }, {} as Record<string, string>);

          await semanticModelApi.replaceKeywords(
            model.workspaceId,
            model.modelId,
            model.folderPath,
            mappings,
          );
        }

        summary.success += 1;
      } catch (error: any) {
        const message = error.response?.data?.error || error.message || "Operation failed";
        summary.failed += 1;
        summary.errors.push(`${model.modelName} (${model.modelId}): ${message}`);
      }
    }

    setActionSummary(summary);

    try {
      const data = await artifactsApi.getLocalModels();
      setLocalData(data.workspaces || []);
    } catch (error) {
      console.error("Failed to refresh local models after action", error);
    } finally {
      setProcessingAction(false);
      if (summary.failed > 0) {
        alert(`Action completed with ${summary.failed} failure(s).`);
      } else {
        alert("Action completed successfully.");
      }
    }
  };

  const getConfirmationMessage = (action: BulkAction, count: number): string => {
    switch (action) {
      case "deploy":
        return `Deploy ${count} model${count > 1 ? "s" : ""} to Power BI Fabric? Existing definitions will be overwritten.`;
      case "update_keywords":
        return `Apply keyword replacements to ${count} local definition${count > 1 ? "s" : ""}?`;
      case "download":
      default:
        return `Download ${count} model${count > 1 ? "s" : ""} from Power BI Fabric? Local files will be refreshed.`;
    }
  };

  const handleClearAll = () => {
    const confirmed = window.confirm(
      "Clear all uploaded entries and reset the bulk edit state? This cannot be undone.",
    );
    if (!confirmed) {
      return;
    }

    setEntries([]);
    setSelectedModels([]);
    setCsvError(null);
    localStorage.removeItem(BULK_EDIT_STORAGE_KEY);
  };

  return (
    <div className="local-models-page">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Bulk Edit</h2>
            <p className="panel-subtitle">
              Upload a CSV with workspace and dataset identifiers to reconcile and manage definitions in bulk.
            </p>
          </div>
          <div className="panel-actions">
            <a className="button" href="/bulk_edit_template.csv" download>
              <FileText size={16} />
              <span>Download Template</span>
            </a>
            {entries.length > 0 && (
              <Button variant="link" className="danger" leftIcon={Trash2} onClick={handleClearAll}>
                Clear All
              </Button>
            )}
          </div>
        </div>

        <div className="upload-summary">
          <div>
            <strong>{entries.length}</strong>
            <span>Total Entries</span>
          </div>
          <div>
            <strong>{entries.filter((entry) => entry.localModel).length}</strong>
            <span>Matched Locally</span>
          </div>
          <div>
            <strong>{missingEntries.length}</strong>
            <span>Missing Locally</span>
          </div>
          <div className="actions">
            <Button
              variant="secondary"
              leftIcon={Download}
              onClick={handleDownloadMissing}
              disabled={missingEntries.length === 0 || downloadingMissing}
              loading={downloadingMissing}
            >
              {downloadingMissing ? "Downloading..." : "Download Missing"}
            </Button>
          </div>
        </div>

        <label className="button ghost" style={{ width: "fit-content" }}>
          {loadingCsv ? "Processing..." : "Upload CSV"}
          <input type="file" accept=".csv" style={{ display: "none" }} onChange={handleFileInput} />
        </label>

        {csvError && <div className="tag danger">{csvError}</div>}

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    onChange={handleSelectAll}
                    checked={entries.length > 0 && selectedModels.length === entries.filter((entry) => entry.localModel).length}
                    disabled={entries.every((entry) => !entry.localModel)}
                  />
                </th>
                <th>Workspace</th>
                <th>Workspace ID</th>
                <th>Dataset</th>
                <th>Dataset ID</th>
                <th>Status</th>
                <th>Details</th>
                <th style={{ width: "60px" }}>Folder</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedModels.some(
                        (model) => model.workspaceId === entry.workspaceId && model.modelId === entry.datasetId,
                      )}
                      disabled={!entry.localModel}
                      onChange={() => toggleSelectEntry(entry)}
                    />
                  </td>
                  <td>{entry.workspaceName || "—"}</td>
                  <td>{entry.workspaceId}</td>
                  <td>{entry.datasetName || "—"}</td>
                  <td>{entry.datasetId}</td>
                  <td>
                    <span
                      className={`tag ${entry.status === "local" ? "success" : entry.status === "error" ? "danger" : ""}`}
                    >
                      {entry.status}
                    </span>
                  </td>
                  <td>{entry.error || ""}</td>
                  <td style={{ textAlign: "center" }}>
                    <button
                      className="button ghost sm"
                      onClick={() => handleOpenArtifactFolder(entry.datasetId, entry.workspaceId)}
                      disabled={!entry.localModel || openingFolder === entry.datasetId}
                      title={entry.localModel ? "Open folder in Explorer" : "Not available locally"}
                      style={{ minHeight: "32px", padding: "0.25rem 0.5rem" }}
                    >
                      {openingFolder === entry.datasetId ? <Loader2 size={16} className="button-spinner" /> : <FolderOpen size={16} />}
                    </button>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "1.5rem" }}>
                    {loadingLocal ? "Loading local models..." : "Upload a CSV to get started."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Actions</h2>
            <p className="panel-subtitle">
              Select models to download, deploy, or update keyword mappings.
            </p>
          </div>
        </div>

        <div className="actions-panel">
          <div className="action-row">
            <label htmlFor="bulk-action">Action</label>
            <select
              id="bulk-action"
              value={selectedAction}
              onChange={(event) => setSelectedAction(event.target.value as BulkAction)}
            >
              <option value="download">Download</option>
              <option value="deploy">Upload</option>
              <option value="update_keywords">Update Keywords</option>
            </select>
          </div>

          <div className="action-row">
            <span>Selected Models: {selectedModels.length}</span>
          </div>

          {selectedAction === "update_keywords" && (
            <div className="keyword-mapping-panel">
              <h3>Keyword Mappings</h3>
              <p className="panel-subtitle">Only pairs with both values are applied.</p>
              <div className="keyword-mapping-grid">
                {keywordMappings.map((mapping) => (
                  <div key={mapping.id} className="keyword-mapping-row">
                    <input
                      type="text"
                      placeholder="Find"
                      value={mapping.oldValue}
                      onChange={(event) => updateKeywordMapping(mapping.id, "oldValue", event.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Replace"
                      value={mapping.newValue}
                      onChange={(event) => updateKeywordMapping(mapping.id, "newValue", event.target.value)}
                    />
                    <button 
                      className="button ghost sm" 
                      onClick={() => removeKeywordMapping(mapping.id)}
                      style={{ minHeight: "32px", padding: "0.25rem 0.5rem" }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <Button variant="ghost" leftIcon={Plus} onClick={addKeywordMapping}>
                Add Mapping
              </Button>
            </div>
          )}

          <Button 
            variant="primary" 
            leftIcon={Play} 
            onClick={executeAction} 
            disabled={processingAction || selectedModels.length === 0}
            loading={processingAction}
          >
            {processingAction ? "Processing..." : "Run Action"}
          </Button>

          {actionSummary.total > 0 && (
            <div className="action-summary">
              <strong>
                {actionSummary.success} succeeded, {actionSummary.failed} failed
              </strong>
              {actionSummary.errors.length > 0 && (
                <pre style={{ whiteSpace: "pre-wrap" }}>{actionSummary.errors.join("\n")}</pre>
              )}
            </div>
          )}
        </div>
      </section>

    </div>
  );
}
