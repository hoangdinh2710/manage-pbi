export type UploadStatus = "ready" | "error";

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  status: UploadStatus;
  error?: string;
  previewRows: string[][];
  content: string;
  columns: string[];
  lastModified: number;
}

export interface ReplacementRule {
  id: string;
  keyword: string;
  replacement: string;
  caseSensitive: boolean;
  columns: string[];
  createdAt: number;
  updatedAt: number;
}

export interface RunResult {
  fileId: string;
  fileName: string;
  applied: boolean;
  replacements: number;
  updatedContent: string;
  previewBefore: string[][];
  previewAfter: string[][];
}

export interface PublishSettings {
  workspace: string;
  dataset: string;
  publishMode: "immediate" | "scheduled";
  scheduledOn?: string;
  notes: string;
  overwriteExisting: boolean;
}

export interface UserConfig {
  download_folder: string;
  output_naming_strategy: "model_name" | "model_id";
  enable_auto_backup: boolean;
  backup_retention_days: number;
  parallel_download_workers: number;
  parallel_bulk_workers: number;
  http_timeout_seconds: number;
  operation_max_retries: number;
  operation_retry_delay_seconds: number;
  rate_limit_max_retries: number;
  rate_limit_initial_delay_seconds: number;
  rate_limit_max_delay_seconds: number;
  fabric_api_base: string;
  log_level: string;
  log_file_path: string | null;
  file_encoding: string;
  definition_format: string;
  update_metadata_on_upload: boolean;
  cleanup_temp_files: boolean;
  powerbi_api_base?: string;
  powerbi_scope?: string;
}

export interface UserConfigUpdate {
  download_folder?: string;
  output_naming_strategy?: "model_name" | "model_id";
  enable_auto_backup?: boolean;
  backup_retention_days?: number;
  parallel_download_workers?: number;
  parallel_bulk_workers?: number;
  http_timeout_seconds?: number;
  log_level?: string;
  // Power BI settings (client_secret is write-only)
  tenant_id?: string;
  client_id?: string;
  client_secret?: string;
  powerbi_api_base?: string;
  powerbi_scope?: string;
}

export interface DownloadedModel {
  workspace: string;
  model_name: string;
  path: string;
  relative_path: string;
}

export interface ValidationResult {
  valid: boolean;
  missing_files: string[];
  folder_path: string;
  error?: string;
}

export interface UploadResult {
  status: "success" | "failed" | "validation_failed";
  workspace_id: string;
  semantic_model_id: string;
  model_name?: string;
  error?: string;
  validation_errors?: string[];
  message?: string;
}

export interface ReplacementStats {
  status: "updated" | "no_changes" | "failed";
  workspace_id: string;
  semantic_model_id: string;
  files_updated: number;
  replacements: Record<string, number>;
  error?: string;
}

export interface RemoteSemanticModel {
  id: string;
  name: string;
  workspaceName?: string;
  workspaceId?: string;
  [key: string]: unknown;
}

export interface LocalSemanticModel {
  artifact_id: string;
  artifact_name: string;
  workspace_id: string;
  workspace_name: string;
  last_updated?: string;
  download_timestamp?: string;
  definition_format?: string;
  files_count?: number;
  folder_path: string;
  has_backup?: boolean;
}

export interface LocalWorkspace {
  workspace_id: string;
  workspace_name: string;
  semantic_models: LocalSemanticModel[];
}

export interface LocalArtifactsResponse {
  total: number;
  workspaces: LocalWorkspace[];
  message?: string;
}

export interface SelectedModel {
  workspaceId: string;
  modelId: string;
  modelName: string;
  folderPath: string;
  hasBackup: boolean;
}

export interface KeywordMapping {
  id: string;
  oldValue: string;
  newValue: string;
}

export interface KeywordMappingPreset {
  name: string;
  mappings: KeywordMapping[];
}

export interface BatchOperationResult {
  workspace_id: string;
  semantic_model_id: string;
  status: 'success' | 'failed' | 'pending' | 'processing';
  error?: string;
}

export interface BatchOperationResponse {
  total: number;
  successful: number;
  failed: number;
  results: BatchOperationResult[];
}

export interface ActionLog {
  id: string;
  timestamp: string;
  action: 'deploy' | 'update_keywords' | 'revert' | 'download';
  modelsCount: number;
  successful: number;
  failed: number;
  results: BatchOperationResult[];
}

export interface GatewayDatasource {
  id?: string;
  name?: string;
  datasourceType?: string;
  connectionDetails?: string | Record<string, unknown>;
  [key: string]: unknown;
}

export interface GatewayDatasourcesResult {
  gateway_id: string;
  datasources: GatewayDatasource[];
  error?: string;
}

export interface GatewayDatasourcesResponse {
  gateways: GatewayDatasourcesResult[];
}

export interface CredentialDetailsInput {
  credentialType: string;
  credentials: string;
  encryptedConnection?: string;
  encryptionAlgorithm?: string;
  privacyLevel?: string;
  useEndUserOAuth2Credentials?: boolean;
}

export interface DatasourceUser {
  emailAddress?: string;
  displayName?: string;
  principalType?: string;
  datasourceAccessRight?: string;
  identifier?: string;
}

export interface AddDatasourceUserRequest {
  email: string;
  access_right?: string;
}

export type BulkEntryStatus = "local" | "missing" | "downloading" | "downloaded" | "error";

export interface BulkImportEntry {
  id: string;
  workspaceId: string;
  datasetId: string;
  workspaceName?: string;
  datasetName?: string;
  localModel?: LocalSemanticModel | null;
  status: BulkEntryStatus;
  error?: string;
}
