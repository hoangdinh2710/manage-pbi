import axios from "axios";
import type {
  UserConfig,
  UserConfigUpdate,
  DownloadedModel,
  ValidationResult,
  UploadResult,
  ReplacementStats,
  GatewayDatasourcesResponse,
  CredentialDetailsInput,
  DatasourceUser,
  AddDatasourceUserRequest,
} from "../types";

export const apiClient = axios.create({
  baseURL: "/api"
});

// Configuration API
export const configApi = {
  getConfig: async (): Promise<UserConfig> => {
    const response = await apiClient.get<UserConfig>("/config");
    return response.data;
  },
  
  updateConfig: async (config: UserConfigUpdate): Promise<UserConfig> => {
    const response = await apiClient.put<UserConfig>("/config", config);
    return response.data;
  },
  testPowerBi: async (): Promise<{ ok: boolean; token_expires_in?: number; error?: string }> => {
    const response = await apiClient.post<{ ok: boolean; token_expires_in?: number; error?: string }>("/config/test-powerbi");
    return response.data;
  },
};

// Semantic Model API
export const semanticModelApi = {
  listDownloadedModels: (workspaceId: string) =>
    apiClient.get<{ models: DownloadedModel[] }>(
      `/workspaces/${workspaceId}/downloaded-models`
    ),

  listRemoteModels: (workspaceId: string) =>
    apiClient.get<any[]>(`/workspaces/${workspaceId}/semantic-models`),

  validateFolder: (folderPath: string) =>
    apiClient.post<ValidationResult>("/semantic-models/validate-folder", {
      folder_path: folderPath,
    }),

  uploadSemanticModel: (
    workspaceId: string,
    semanticModelId: string,
    folderPath: string
  ) =>
    apiClient.post<UploadResult>(
      `/workspaces/${workspaceId}/semantic-models/${semanticModelId}/upload`,
      { folder_path: folderPath }
    ),

  replaceKeywords: (
    workspaceId: string,
    semanticModelId: string,
    folderPath: string,
    serverMappings: Record<string, string>
  ) =>
    apiClient.post<ReplacementStats>(
      `/workspaces/${workspaceId}/semantic-models/${semanticModelId}/replace-keywords`,
      { 
        folder_path: folderPath,
        server_mappings: serverMappings 
      }
    ),
};

// Local Artifacts API
export const artifactsApi = {
  getLocalModels: async () => {
    const response = await apiClient.get<any>("/artifacts/downloaded");
    return response.data;
  },

  bulkDownload: async (workspaceId: string, datasetIds: string[]) => {
    const response = await apiClient.post<any>("/semantic-models/download", {
      workspace_id: workspaceId,
      dataset_ids: datasetIds,
    });
    return response.data;
  },

  refreshModel: async (workspaceId: string, semanticModelId: string) => {
    const response = await apiClient.get<any>(
      `/workspaces/${workspaceId}/semantic-models/${semanticModelId}/download`
    );
    return response.data;
  },

  revertModels: async (models: { workspace_id: string; semantic_model_id: string }[]) => {
    const response = await apiClient.post<any>("/semantic-models/revert", { models });
    return response.data;
  },

  openLocalFolder: async (artifactId: string, workspaceId: string) => {
    const response = await apiClient.post<any>(`/artifacts/${artifactId}/open-folder`, {
      workspace_id: workspaceId,
    });
    return response.data;
  },

  openWorkspaceFolder: async (workspaceId: string) => {
    const response = await apiClient.post<any>(`/workspaces/${workspaceId}/open-folder`);
    return response.data;
  },
};

// Gateway & Connections API
export const gatewayApi = {
  listDatasources: async (gatewayIds: string[]): Promise<GatewayDatasourcesResponse> => {
    const response = await apiClient.post<GatewayDatasourcesResponse>("/gateways/datasources", {
      gateway_ids: gatewayIds,
    });
    return response.data;
  },

  updateDatasourceCredentials: async (
    gatewayId: string,
    datasourceId: string,
    credentialDetails: CredentialDetailsInput
  ) => {
    const response = await apiClient.patch(
      `/gateways/${gatewayId}/datasources/${datasourceId}`,
      { credentialDetails }
    );
    return response.data;
  },

  listDatasourceUsers: async (gatewayId: string, datasourceId: string): Promise<DatasourceUser[]> => {
    const response = await apiClient.get<DatasourceUser[]>(
      `/gateways/${gatewayId}/datasources/${datasourceId}/users`
    );
    return response.data;
  },

  addDatasourceUser: async (
    gatewayId: string,
    datasourceId: string,
    payload: AddDatasourceUserRequest
  ) => {
    const response = await apiClient.post(
      `/gateways/${gatewayId}/datasources/${datasourceId}/users`,
      payload
    );
    return response.data;
  },

  removeDatasourceUser: async (
    gatewayId: string,
    datasourceId: string,
    email: string
  ) => {
    const response = await apiClient.delete(
      `/gateways/${gatewayId}/datasources/${datasourceId}/users`,
      { data: { email } }
    );
    return response.data;
  },
};
