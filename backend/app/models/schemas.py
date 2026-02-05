"""Pydantic schemas for API payloads."""
from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field, ConfigDict


class Workspace(BaseModel):
    id: str = Field(..., description="Power BI workspace identifier")
    name: str
    type: str | None = None


class Dataset(BaseModel):
    id: str
    name: str
    workspace_id: str = Field(..., description="Parent workspace identifier")
    created_date: datetime | None = None
    configured_by: str | None = None


class Report(BaseModel):
    id: str
    name: str
    workspace_id: str
    dataset_id: str | None = None


class SourceCredential(BaseModel):
    datasource_id: str
    gateway_id: str
    type: str
    status: str | None = None


class RefreshRequest(BaseModel):
    notify_option: str = Field(default="MailOnFailure")


# Bulk operations schemas
class ServerMapping(BaseModel):
    """Server name mapping for bulk replacement."""
    old_server: str = Field(..., description="Old server name to find")
    new_server: str = Field(..., description="New server name to replace with")


class BulkProcessRequest(BaseModel):
    """Request to process multiple semantic models."""
    workspace_id: str = Field(..., description="Workspace ID")
    dataset_ids: list[str] = Field(..., description="List of dataset IDs to process")
    server_mappings: list[ServerMapping] = Field(
        ..., description="Server name mappings to apply"
    )
    review_mode: bool = Field(
        default=True, description="If True, only download and update locally without uploading"
    )
    create_backup: bool = Field(default=True, description="Create backup of original files")


class DefinitionMetadata(BaseModel):
    """Metadata about a downloaded semantic model definition."""
    model_config = ConfigDict(protected_namespaces=())
    
    workspace_id: str
    semantic_model_id: str
    model_name: str | None = None
    folder_path: str
    status: str = Field(..., description="Status: exists, downloaded, failed")
    error: str | None = None


class ReplacementResult(BaseModel):
    """Result of keyword replacement operation."""
    old_keyword: str
    new_keyword: str
    occurrences: int = Field(..., description="Number of replacements made")


class ProcessStatus(BaseModel):
    """Status of bulk processing operation."""
    total_models: int
    processed: int
    successful: int
    failed: int
    models: list[dict[str, Any]] = Field(
        ..., description="Per-model status details"
    )
    replacements_summary: dict[str, int] = Field(
        default_factory=dict, description="Total replacements by keyword"
    )


class DownloadRequest(BaseModel):
    """Request to download semantic model definitions."""
    workspace_id: str
    dataset_ids: list[str]
    create_backup: bool = Field(default=True)


class BulkReplaceRequest(BaseModel):
    """Request to apply keyword replacements."""
    workspace_id: str
    dataset_ids: list[str]
    server_mappings: list[ServerMapping]


class DeployRequest(BaseModel):
    """Request to deploy semantic models to Fabric."""
    workspace_id: str
    dataset_ids: list[str]


class SingleModelReplaceRequest(BaseModel):
    """Request to apply keyword replacements to a single semantic model."""
    folder_path: str = Field(..., description="Path to model folder (absolute or relative)")
    server_mappings: dict[str, str] = Field(..., description="Dictionary of old_server to new_server mappings")


class ReplacementStats(BaseModel):
    """Statistics from keyword replacement operation."""
    status: str = Field(..., description="Status: updated, no_changes, failed")
    files_updated: int = Field(..., description="Number of files that were modified")
    replacements: dict[str, int] = Field(..., description="Replacements made per keyword")
    error: str | None = None


class UserConfigUpdate(BaseModel):
    """User-configurable settings update request."""
    download_folder: str | None = Field(default=None, description="Path to save downloaded files")
    output_naming_strategy: str | None = Field(default=None, description="Naming strategy: 'model_name' or 'model_id'")
    enable_auto_backup: bool | None = Field(default=None, description="Enable automatic backups")
    backup_retention_days: int | None = Field(default=None, ge=1, le=365, description="Days to retain backups")
    parallel_download_workers: int | None = Field(default=None, ge=1, le=10, description="Number of parallel download workers")
    parallel_bulk_workers: int | None = Field(default=None, ge=1, le=10, description="Number of parallel bulk workers")
    http_timeout_seconds: int | None = Field(default=None, ge=5, le=300, description="HTTP request timeout")
    log_level: str | None = Field(default=None, description="Logging level: DEBUG, INFO, WARNING, ERROR")


class UserConfigResponse(BaseModel):
    """Current user configuration settings."""
    download_folder: str
    output_naming_strategy: str
    enable_auto_backup: bool
    backup_retention_days: int
    parallel_download_workers: int
    parallel_bulk_workers: int
    http_timeout_seconds: int
    operation_max_retries: int
    operation_retry_delay_seconds: int
    rate_limit_max_retries: int
    rate_limit_initial_delay_seconds: int
    rate_limit_max_delay_seconds: int
    fabric_api_base: str
    log_level: str
    log_file_path: str | None
    file_encoding: str
    definition_format: str
    update_metadata_on_upload: bool
    cleanup_temp_files: bool


class DownloadedModelInfo(BaseModel):
    """Information about a downloaded semantic model."""
    workspace: str = Field(..., description="Workspace ID or name")
    model_name: str = Field(..., description="Model folder name")
    path: str = Field(..., description="Absolute path to model folder")
    relative_path: str = Field(..., description="Relative path from download folder")


class ValidationResult(BaseModel):
    """Result of semantic model folder validation."""
    valid: bool = Field(..., description="Whether folder contains required files")
    missing_files: list[str] = Field(..., description="List of missing required files")
    folder_path: str = Field(..., description="Path that was validated")


class SemanticModelUploadRequest(BaseModel):
    """Request to upload a semantic model definition."""
    workspace_id: str = Field(..., description="Workspace ID")
    semantic_model_id: str = Field(..., description="Semantic model ID")
    folder_path: str = Field(..., description="Path to model folder (absolute or relative)")


class UploadResult(BaseModel):
    """Result of semantic model upload operation."""
    status: str = Field(..., description="Status: success, failed, validation_failed")
    workspace_id: str
    semantic_model_id: str
    model_name: str | None = None
    error: str | None = None
    validation_errors: list[str] | None = None
