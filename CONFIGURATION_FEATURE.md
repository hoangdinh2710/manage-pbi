# Configuration Feature Implementation

## Overview
Implemented a comprehensive configuration system that allows users to customize file operations, performance settings, and application behavior.

## Changes Made

### 1. Backend Configuration Schema
**File:** `backend/app/core/config.py`

Added the following user-configurable settings:

#### File Operations
- `download_folder` - Path for saving downloaded files (default: "downloads")
- `output_naming_strategy` - "model_name" or "model_id" for folder naming
- `enable_auto_backup` - Toggle automatic backups (default: True)
- `backup_retention_days` - Days to retain backups (default: 30)

#### Performance & Reliability
- `http_timeout_seconds` - HTTP request timeout (default: 30)
- `operation_max_retries` - Max retry attempts (default: 30)
- `operation_retry_delay_seconds` - Delay between retries (default: 5)
- `rate_limit_max_retries` - Max retries for rate limiting (default: 5)
- `rate_limit_initial_delay_seconds` - Initial delay for rate limits (default: 2)
- `rate_limit_max_delay_seconds` - Max delay cap (default: 60)
- `parallel_download_workers` - Concurrent downloads (default: 2)
- `parallel_bulk_workers` - Concurrent bulk operations (default: 5)

#### API Configuration
- `fabric_api_base` - Fabric API URL (supports sovereign clouds)

#### Logging & Advanced
- `log_level` - Logging verbosity (default: "INFO")
- `log_file_path` - Optional file logging path
- `file_encoding` - File encoding (default: "utf-8")
- `definition_format` - Model format (default: "TMDL")
- `update_metadata_on_upload` - Update metadata flag (default: True)
- `cleanup_temp_files` - Auto-cleanup toggle (default: True)

Added validators for:
- Naming strategy (model_name/model_id)
- Log level (DEBUG/INFO/WARNING/ERROR/CRITICAL)
- Definition format (TMDL/TMSL)
- Worker counts (1-10 range)
- Positive integers for timeouts

### 2. API Endpoints
**File:** `backend/app/api/routes.py`

**GET /api/config**
- Returns current configuration settings
- Response model: `UserConfigResponse`

**PUT /api/config**
- Updates user configuration
- Validates folder paths (creates if doesn't exist)
- Validates enum values (naming strategy, log level)
- Request model: `UserConfigUpdate`
- Response model: `UserConfigResponse`

### 3. Pydantic Schemas
**File:** `backend/app/models/schemas.py`

Added:
- `UserConfigUpdate` - For updating configuration (all fields optional)
- `UserConfigResponse` - For returning current configuration

### 4. Service Updates

#### PowerBIService
**File:** `backend/app/services/powerbi_service.py`
- Replaced hardcoded timeout (30s) with `settings.http_timeout_seconds`

#### FabricService
**File:** `backend/app/services/fabric_service.py`
- Uses `settings.fabric_api_base` instead of hardcoded URL
- All HTTP requests now use `settings.http_timeout_seconds`
- `_get_operation_result` uses configurable retry parameters:
  - `settings.operation_max_retries`
  - `settings.operation_retry_delay_seconds`
- Download folder uses `settings.download_folder`
- Folder naming respects `settings.output_naming_strategy`
- Backup creation respects `settings.enable_auto_backup`

### 5. Frontend Implementation

#### Type Definitions
**File:** `frontend/src/types.ts`
- Added `UserConfig` interface (full config)
- Added `UserConfigUpdate` interface (partial updates)

#### API Client
**File:** `frontend/src/services/apiClient.ts`
- Added `configApi` object with:
  - `getConfig()` - Fetch current configuration
  - `updateConfig(config)` - Update configuration

#### Settings Page
**File:** `frontend/src/pages/Settings.tsx`

New React component with sections:
1. **File Operations**
   - Download folder path (text input)
   - Output naming strategy (dropdown)
   - Auto-backup toggle
   - Backup retention days (number input)

2. **Performance**
   - Parallel download workers (slider 1-10)
   - Parallel bulk workers (slider 1-10)

3. **Advanced Settings** (collapsible)
   - HTTP timeout (number input 5-300)
   - Log level (dropdown)
   - Read-only display of other settings

Features:
- Loading state with spinner
- Error handling with red banner
- Success message (auto-dismisses after 3s)
- Reset button to revert changes
- Save button with loading state
- Form validation

#### App Integration
**File:** `frontend/src/App.tsx`
- Added "Settings" view to navigation
- Imported Settings component
- Added Settings button to top navigation bar

## How to Use

### For Users
1. Navigate to the "Settings" tab in the application
2. Configure download folder path
3. Adjust performance settings (workers, timeouts)
4. Enable/disable auto-backup
5. Click "Save Configuration" to apply changes

### For Developers
Configuration can be set via:
1. **UI** - User-friendly settings page for common options
2. **Environment Variables** - `.env` file for deployment settings
3. **Code** - Default values in `config.py`

Example `.env`:
```env
DOWNLOAD_FOLDER=C:\PowerBI\Downloads
PARALLEL_DOWNLOAD_WORKERS=5
HTTP_TIMEOUT_SECONDS=60
LOG_LEVEL=DEBUG
FABRIC_API_BASE=https://api.fabric.microsoft.com/v1
```

## Benefits

1. **Flexibility** - Users can customize behavior without code changes
2. **Performance Tuning** - Adjust parallelism and timeouts for different environments
3. **Multi-tenant Support** - Sovereign cloud support via configurable API URLs
4. **Debugging** - Adjustable log levels for troubleshooting
5. **User Experience** - Download paths and naming strategies match user preferences
6. **Reliability** - Configurable retry logic for unstable networks

## Future Enhancements

Consider adding:
1. **Persistent Storage** - Save config to database/JSON file (currently in-memory)
2. **User Profiles** - Per-user configuration settings
3. **Config Export/Import** - Share configurations between instances
4. **Config History** - Track configuration changes over time
5. **Advanced Validation** - Check folder write permissions before saving
6. **Backup Cleanup** - Automatic deletion of backups older than retention period
7. **Rate Limit Configuration** - Fine-tune exponential backoff parameters
