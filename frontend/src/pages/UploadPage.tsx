import React from "react";
import { Link } from "react-router-dom";

export const UploadPage: React.FC = () => {
  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <div
        style={{
          padding: "2rem",
          backgroundColor: "#fff4ce",
          borderRadius: "8px",
          border: "2px solid #f1c232",
          maxWidth: "600px",
          margin: "2rem auto",
        }}
      >
        <h2 style={{ marginTop: 0 }}>⚠️ Page Deprecated</h2>
        <p style={{ fontSize: "1.1rem" }}>
          The Upload functionality has been consolidated into the <strong>Local Models</strong> page.
        </p>
        <p>
          You can now deploy models directly from the Local Models page with multi-select support,
          progress tracking, and automatic backups.
        </p>
        <Link
          to="/local-models"
          style={{
            display: "inline-block",
            marginTop: "1rem",
            padding: "0.75rem 1.5rem",
            backgroundColor: "#0078d4",
            color: "white",
            textDecoration: "none",
            borderRadius: "4px",
            fontWeight: "bold",
          }}
        >
          Go to Local Models →
        </Link>
      </div>
    </div>
  );
};

export default UploadPage;

// Old implementation below (preserved for reference)
/*
export const UploadPageOld: React.FC = () => {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [selectedWorkspaceName, setSelectedWorkspaceName] = useState("");
  const [selectedDatasetId, setSelectedDatasetId] = useState("");
  const [selectedDatasetName, setSelectedDatasetName] = useState("");
  const [selectedFolderPath, setSelectedFolderPath] = useState("");
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleWorkspaceSelect = (id: string, name: string) => {
    setSelectedWorkspaceId(id);
    setSelectedWorkspaceName(name);
    setSelectedDatasetId("");
    setSelectedDatasetName("");
    setSelectedFolderPath("");
    setValidationResult(null);
    setUploadResult(null);
  };

  const handleDatasetSelect = (id: string, name: string) => {
    setSelectedDatasetId(id);
    setSelectedDatasetName(name);
    setUploadResult(null);
  };

  const handleUploadClick = () => {
    if (!validationResult?.valid) {
      alert("Please validate the folder before uploading.");
      return;
    }
    setShowConfirmModal(true);
  };

  const handleConfirmUpload = async () => {
    setShowConfirmModal(false);
    setUploading(true);
    setUploadResult(null);

    try {
      const response = await semanticModelApi.uploadSemanticModel(
        selectedWorkspaceId,
        selectedDatasetId,
        selectedFolderPath
      );
      setUploadResult(response.data);
    } catch (err: any) {
      const result = err.response?.data || {
        status: "failed",
        workspace_id: selectedWorkspaceId,
        semantic_model_id: selectedDatasetId,
        error: err.message,
      };
      setUploadResult(result);
    } finally {
      setUploading(false);
    }
  };

  const canUpload =
    selectedWorkspaceId &&
    selectedDatasetId &&
    selectedFolderPath &&
    validationResult?.valid;

  return (
    <div className="upload-page">
      <h1>Upload & Replace Semantic Model</h1>
      <p>Upload a local semantic model definition to replace an existing model in Fabric.</p>

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

      {/* Upload Button */}
      {selectedFolderPath && (
        <div className="upload-actions">
          <button
            onClick={handleUploadClick}
            disabled={!canUpload || uploading}
            className="upload-button primary"
          >
            {uploading ? "Uploading..." : "Upload & Replace"}
          </button>
        </div>
      )}

      {/* Upload Progress */}
      {uploading && (
        <ProgressIndicator
          message="Uploading semantic model definition..."
          subMessage="This may take a few moments. Please wait..."
        />
      )}

      {/* Upload Result */}
      {uploadResult && (
        <div className={`upload-result ${uploadResult.status}`}>
          <h3>Upload Result</h3>
          {uploadResult.status === "success" && (
            <div className="success-message">
              <p>✓ Successfully uploaded {uploadResult.model_name || "semantic model"}</p>
              <p className="details">
                Workspace: {selectedWorkspaceName}<br />
                Model ID: {uploadResult.semantic_model_id}
              </p>
            </div>
          )}
          {uploadResult.status === "validation_failed" && (
            <div className="error-message">
              <p>✗ Validation Failed</p>
              {uploadResult.validation_errors && (
                <ul>
                  {uploadResult.validation_errors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              )}
              {uploadResult.error && <p>{uploadResult.error}</p>}
            </div>
          )}
          {uploadResult.status === "failed" && (
            <div className="error-message">
              <p>✗ Upload Failed</p>
              <p>{uploadResult.error}</p>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="modal-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Confirm Upload</h3>
            <p>
              You are about to replace <strong>{selectedDatasetName}</strong> in workspace{" "}
              <strong>{selectedWorkspaceName}</strong>.
            </p>
            <p className="warning">
              This will overwrite the existing semantic model definition. This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button onClick={() => setShowConfirmModal(false)} className="cancel-button">
                Cancel
              </button>
              <button onClick={handleConfirmUpload} className="confirm-button">
                Confirm Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadPage;
