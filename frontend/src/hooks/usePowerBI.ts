import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../services/apiClient";

export interface Workspace {
  id: string;
  name: string;
  type?: string;
}

export interface Dataset {
  id: string;
  name: string;
  workspace_id: string;
}

export interface Report {
  id: string;
  name: string;
  workspace_id: string;
  dataset_id?: string;
}

export const usePowerBI = () => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkspaces = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<Workspace[]>("/workspaces");
      setWorkspaces(response.data);
      setError(null);
    } catch (err) {
      setError("Failed to load workspaces");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWorkspaceDetails = useCallback(async (workspaceId: string) => {
    setLoading(true);
    try {
      const [datasetsResponse, reportsResponse] = await Promise.all([
        apiClient.get<Dataset[]>(`/workspaces/${workspaceId}/datasets`),
        apiClient.get<Report[]>(`/workspaces/${workspaceId}/reports`)
      ]);
      setDatasets(datasetsResponse.data);
      setReports(reportsResponse.data);
      setSelectedWorkspace(workspaceId);
      setError(null);
    } catch (err) {
      setError("Failed to load workspace details");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  return {
    workspaces,
    datasets,
    reports,
    selectedWorkspace,
    loading,
    error,
    fetchWorkspaces,
    fetchWorkspaceDetails
  };
};
