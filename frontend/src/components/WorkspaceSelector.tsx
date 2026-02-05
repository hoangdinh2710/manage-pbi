import React from "react";

export interface Workspace {
  id: string;
  name: string;
  type?: string;
  capacityId?: string;
}

interface WorkspaceSelectorProps {
  workspaces: Workspace[];
  selectedWorkspaceId: string | null;
  onWorkspaceSelect: (workspaceId: string) => void;
  loading?: boolean;
  error?: string | null;
}

const WorkspaceSelector: React.FC<WorkspaceSelectorProps> = ({
  workspaces,
  selectedWorkspaceId,
  onWorkspaceSelect,
  loading = false,
  error = null,
}) => {
  if (loading) {
    return <div className="loading">Loading workspaces...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (!workspaces.length) {
    return <p>No workspaces available.</p>;
  }

  return (
    <div className="workspace-selector">
      <h3>Select Workspace</h3>
      <ul className="list">
        {workspaces.map((workspace) => (
          <li key={workspace.id}>
            <button
              className={selectedWorkspaceId === workspace.id ? "active" : ""}
              onClick={() => onWorkspaceSelect(workspace.id)}
            >
              {workspace.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export { WorkspaceSelector };
export default WorkspaceSelector;
