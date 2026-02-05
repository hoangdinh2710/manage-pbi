# Storage Structure Documentation

## Overview

This document describes the standardized file storage structure for Power BI artifacts (semantic models and reports) in PBI Commander.

## Directory Structure

### Main Storage

```
data/
├── {workspace_id}/
│   ├── semantic-models/
│   │   ├── {model_id_1}/
│   │   │   ├── metadata.json
│   │   │   ├── definition.pbism
│   │   │   └── definition/
│   │   │       ├── database.tmdl
│   │   │       ├── model.tmdl
│   │   │       ├── relationships.tmdl
│   │   │       ├── expressions.tmdl
│   │   │       ├── tables/
│   │   │       │   ├── Table1.tmdl
│   │   │       │   └── Table2.tmdl
│   │   │       └── cultures/
│   │   │           └── en-US.tmdl
│   │   └── {model_id_2}/
│   │       └── ...
│   └── reports/
│       ├── {report_id_1}/
│       │   ├── metadata.json
│       │   └── report_definition/
│       └── {report_id_2}/
│           └── ...
└── {workspace_id_2}/
    └── ...
```

### Backup Storage

```
data_backup/
├── {workspace_id}/
│   └── semantic-models/
│       └── {model_id}/
│           ├── 20260202_143025/    # Timestamp-based backup folders
│           │   ├── backup_info.json
│           │   ├── metadata.json
│           │   ├── definition.pbism
│           │   └── definition/
│           ├── 20260202_154530/
│           │   └── ...
│           └── 20260201_091245/
│               └── ...
```

## Design Principles

### 1. Workspace ID as Primary Path Component

- **Why**: Workspace IDs are immutable, while workspace names can change
- **Benefit**: Prevents path conflicts and broken references when workspaces are renamed
- **Configuration**: Controlled by `use_workspace_id_in_path` setting (default: `true`)

### 2. Artifact Type Folders

- **Semantic Models**: `semantic-models/` (plural, hyphenated)
- **Reports**: `reports/` (plural)
- **Future**: `dashboards/`, `dataflows/`, etc.
- **Why**: Matches Microsoft Fabric REST API conventions
- **Benefit**: Clear organization and easy to extend for new artifact types

### 3. Artifact ID as Folder Name

- **Why**: IDs are guaranteed unique and immutable
- **Benefit**: Eliminates name conflicts and supports artifacts with identical names
- **Note**: Original names are preserved in metadata.json for display purposes

## Metadata File

Each artifact folder contains a `metadata.json` file with comprehensive information:

```json
{
  "workspace_id": "799c7da6-4d60-4629-aab1-f4a8b14ea4be",
  "workspace_name": "My Workspace",
  "artifact_id": "21b3d77e-3f0d-401b-9784-e52beb4b34ff",
  "artifact_name": "Sales Analysis Model",
  "artifact_type": "semantic-model",
  "download_timestamp": "2026-02-02T14:30:25.123456",
  "last_updated": "2026-02-02T15:45:30.654321",
  "definition_format": "TMDL",
  "files_count": 45,
  "last_operation": "server_name_update",
  "server_mappings": {
    "old-server.domain.com": "new-server.domain.com"
  }
}
```

### Metadata Fields

- `workspace_id`: Immutable workspace identifier
- `workspace_name`: Human-readable workspace name (for display)
- `artifact_id`: Immutable artifact identifier  
- `artifact_name`: Human-readable artifact name (for display)
- `artifact_type`: Type of artifact (`semantic-model`, `report`, etc.)
- `download_timestamp`: When artifact was first downloaded (ISO 8601 UTC)
- `last_updated`: When artifact was last modified (ISO 8601 UTC)
- `definition_format`: Format of definition files (`TMDL` or `TMSL`)
- `files_count`: Number of files in definition
- `last_operation`: Last operation performed (optional)
- `server_mappings`: Server name mappings applied (optional)

## Backup Strategy

### Timestamped Backups

- **Format**: `YYYYMMDD_HHMMSS` (e.g., `20260202_143025`)
- **Created**:
  - Before downloading (if artifact exists) - controlled by `backup_on_download`
  - Before updating server names - controlled by `backup_on_update`
  - Manual backups via API
- **Location**: Separate `data_backup/` folder with same structure as main data folder

### Backup Retention

- **Default**: 30 days (configurable via `backup_retention_days`)
- **Cleanup**: Automatic cleanup runs after each backup creation
- **Logic**: Removes backups older than retention period based on timestamp

### Backup Metadata

Each backup folder contains `backup_info.json`:

```json
{
  "backup_timestamp": "2026-02-02T14:30:25.123456",
  "source_folder": "C:/path/to/data/workspace_id/semantic-models/model_id",
  "workspace_id": "799c7da6-4d60-4629-aab1-f4a8b14ea4be",
  "artifact_type": "semantic-models",
  "artifact_id": "21b3d77e-3f0d-401b-9784-e52beb4b34ff"
}
```

## Configuration

### Settings (backend/app/core/config.py)

```python
# Storage locations
data_folder: str = "../data"
backup_folder: str = "../data_backup"

# Structure settings
use_workspace_id_in_path: bool = True
store_artifact_metadata: bool = True
semantic_models_folder_name: str = "semantic-models"
reports_folder_name: str = "reports"

# Backup settings
enable_auto_backup: bool = True
backup_on_download: bool = True
backup_on_update: bool = True
backup_retention_days: int = 30
```

## Migration from Old Structure

### Old Structure

```
downloads/
└── {workspace_name}/
    ├── {model_name_or_id}/
    │   └── definition/
    └── ...
```

### Migration Steps

1. **Identify Artifacts**: Parse existing folders to identify workspace/model names
2. **Retrieve IDs**: Match names to IDs via Power BI API
3. **Restructure**: Move files to new structure under `data/`
4. **Generate Metadata**: Create `metadata.json` files for each artifact
5. **Update References**: Update any code/configs pointing to old paths

### Migration Script (Future)

A migration utility will be provided to automate the process:

```bash
python scripts/migrate_storage.py --old-path downloads/ --new-path data/
```

## API Integration

### Download Endpoint

```python
# Returns new structure information
{
  "status": "downloaded",
  "folder": "C:/path/to/data/workspace_id/semantic-models/model_id",
  "metadata": {
    "workspace_id": "...",
    "artifact_name": "...",
    ...
  }
}
```

### Update Endpoint

```python
# Includes backup creation and metadata update
{
  "status": "updated",
  "files_updated": 12,
  "replacements": {
    "old-server": 3
  },
  "backup_created": true
}
```

## Utilities (backend/app/utils/storage.py)

### Path Construction

```python
from app.utils.storage import build_artifact_path

path = build_artifact_path(
    base_folder="data",
    workspace_id="799c7da6-...",
    artifact_type="semantic-models",
    artifact_id="21b3d77e-...",
    workspace_name="My Workspace",  # Optional
    use_workspace_id=True
)
```

### Metadata Management

```python
from app.utils.storage import create_metadata_file, read_metadata_file

# Create
create_metadata_file(folder_path, metadata_dict)

# Read
metadata = read_metadata_file(folder_path)
```

### Backup Operations

```python
from app.utils.storage import (
    create_backup,
    cleanup_old_backups,
    get_latest_backup,
    list_backups
)

# Create backup
backup_path = create_backup(
    source_folder=artifact_path,
    backup_base_folder="data_backup",
    workspace_id="799c7da6-...",
    artifact_type="semantic-models",
    artifact_id="21b3d77e-..."
)

# Cleanup old backups
deleted = cleanup_old_backups(
    backup_base_folder="data_backup",
    workspace_id="799c7da6-...",
    artifact_type="semantic-models",
    artifact_id="21b3d77e-...",
    retention_days=30
)

# Get latest backup
latest = get_latest_backup(...)

# List all backups
backups = list_backups(...)
```

## Benefits

### 1. Immutability
- Paths remain stable even when names change
- No broken references or manual path updates needed

### 2. Scalability
- Clear separation by workspace and artifact type
- Easy to add new artifact types (reports, dashboards, etc.)

### 3. Traceability
- Comprehensive metadata for each artifact
- Complete backup history with timestamps
- Audit trail of operations

### 4. Automation
- Automatic backup creation and cleanup
- Configurable retention policies
- No manual maintenance required

### 5. Consistency
- Matches Microsoft Fabric API conventions
- Predictable paths for automation
- Clear naming standards

## Future Enhancements

1. **Report Support**: Extend structure to include report definitions
2. **Dataflow Support**: Add dataflow artifact management
3. **Version Tracking**: Git-like versioning with diffs between versions
4. **Cloud Sync**: Optional sync to Azure Blob Storage or S3
5. **Compression**: Compress old backups to save disk space
6. **Search Index**: Build search index across all metadata files
