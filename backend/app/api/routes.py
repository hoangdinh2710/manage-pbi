"""Flask API route definitions."""
import subprocess
import sys
from pathlib import Path
from flask import Blueprint, request, jsonify
from ..services.fabric_service import FabricService
from ..services.powerbi_service import PowerBIService
from ..core.config import get_settings
from ..utils.storage import validate_artifact_folder, validate_workspace_folder
from ..core.security import acquire_token

bp = Blueprint('api', __name__)


@bp.route('/health', methods=['GET'])
def health():
    """Health check endpoint.
    ---
    responses:
      200:
        description: Service is healthy
        schema:
          type: object
          properties:
            status:
              type: string
    """
    return jsonify({"status": "healthy"})


@bp.route('/config', methods=['GET'])
def get_config():
    """Get current configuration.
    ---
    tags:
      - Configuration
    responses:
      200:
        description: Current configuration
    """
    try:
        settings = get_settings()
        return jsonify({
          "download_folder": settings.download_folder,
          "output_naming_strategy": settings.output_naming_strategy,
          "enable_auto_backup": settings.enable_auto_backup,
          "backup_retention_days": settings.backup_retention_days,
          "log_level": settings.log_level,
          # Power BI presence indicators (do NOT return secrets)
          "powerbi_tenant_present": bool(settings.tenant_id),
          "powerbi_client_present": bool(settings.client_id),
          "powerbi_api_base": settings.powerbi_api_base,
          "powerbi_scope": settings.powerbi_scope,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route('/config', methods=['PUT'])
def update_config():
    """Update configuration.
    ---
    tags:
      - Configuration
    parameters:
      - name: body
        in: body
        schema:
          type: object
          properties:
            download_folder:
              type: string
            output_naming_strategy:
              type: string
              enum: [model_name, model_id]
            enable_auto_backup:
              type: boolean
            backup_retention_days:
              type: integer
            parallel_download_workers:
              type: integer
            parallel_bulk_workers:
              type: integer
            http_timeout_seconds:
              type: integer
            log_level:
              type: string
    responses:
      200:
        description: Updated configuration
    """
    try:
        from pathlib import Path
        from ..core.config import reload_settings
        
        data = request.get_json()
        settings = get_settings()
        
        updated_fields = []
        
        if 'download_folder' in data:
            folder_path = Path(data['download_folder'])
            try:
                folder_path.mkdir(parents=True, exist_ok=True)
                settings.download_folder = data['download_folder']
                updated_fields.append('download_folder')
            except Exception as e:
                return jsonify({"error": f"Invalid folder path: {str(e)}"}), 400
        
        if 'output_naming_strategy' in data:
            if data['output_naming_strategy'] not in ['model_name', 'model_id']:
                return jsonify({"error": "Invalid naming strategy"}), 400
            settings.output_naming_strategy = data['output_naming_strategy']
            updated_fields.append('output_naming_strategy')
        
        if 'enable_auto_backup' in data:
            settings.enable_auto_backup = data['enable_auto_backup']
            updated_fields.append('enable_auto_backup')
        
        if 'backup_retention_days' in data:
            settings.backup_retention_days = int(data['backup_retention_days'])
            updated_fields.append('backup_retention_days')
        
        if 'parallel_download_workers' in data:
            workers = int(data['parallel_download_workers'])
            if workers < 1 or workers > 10:
                return jsonify({"error": "Download workers must be between 1 and 10"}), 400
            settings.parallel_download_workers = workers
            updated_fields.append('parallel_download_workers')
        
        if 'parallel_bulk_workers' in data:
            workers = int(data['parallel_bulk_workers'])
            if workers < 1 or workers > 10:
                return jsonify({"error": "Bulk workers must be between 1 and 10"}), 400
            settings.parallel_bulk_workers = workers
            updated_fields.append('parallel_bulk_workers')
        
        if 'http_timeout_seconds' in data:
            timeout = int(data['http_timeout_seconds'])
            if timeout < 1:
                return jsonify({"error": "Timeout must be positive"}), 400
            settings.http_timeout_seconds = timeout
            updated_fields.append('http_timeout_seconds')
        
        if 'log_level' in data:
            level = data['log_level'].upper()
            if level not in ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']:
                return jsonify({"error": "Invalid log level"}), 400
            settings.log_level = level
            updated_fields.append('log_level')

        # Power BI credential fields (write-only secret)
        if 'tenant_id' in data:
          settings.tenant_id = data['tenant_id'] or ""
          updated_fields.append('tenant_id')

        if 'client_id' in data:
          settings.client_id = data['client_id'] or ""
          updated_fields.append('client_id')

        # Only save client_secret if provided (empty means keep existing)
        if 'client_secret' in data:
          secret_val = data.get('client_secret')
          if secret_val is not None and secret_val != "":
            settings.client_secret = secret_val
            updated_fields.append('client_secret')

        if 'powerbi_api_base' in data:
          settings.powerbi_api_base = data.get('powerbi_api_base') or settings.powerbi_api_base
          updated_fields.append('powerbi_api_base')

        if 'powerbi_scope' in data:
          settings.powerbi_scope = data.get('powerbi_scope') or settings.powerbi_scope
          updated_fields.append('powerbi_scope')
        
        # Save to JSON file
        if updated_fields:
            settings.save_to_json(updated_fields)
        
        # Reload settings to ensure consistency
        settings = reload_settings()
        
        return jsonify({
            "download_folder": settings.download_folder,
            "output_naming_strategy": settings.output_naming_strategy,
            "enable_auto_backup": settings.enable_auto_backup,
            "backup_retention_days": settings.backup_retention_days,
            "parallel_download_workers": settings.parallel_download_workers,
            "parallel_bulk_workers": settings.parallel_bulk_workers,
            "http_timeout_seconds": settings.http_timeout_seconds,
            "log_level": settings.log_level,
          # Power BI presence indicators (do NOT return secrets)
          "powerbi_tenant_present": bool(settings.tenant_id),
          "powerbi_client_present": bool(settings.client_id),
          "powerbi_api_base": settings.powerbi_api_base,
          "powerbi_scope": settings.powerbi_scope,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


    @bp.route('/config/test-powerbi', methods=['POST'])
    def test_powerbi_config():
      """Test Power BI credentials by attempting to acquire a token.

      Expects no body; uses stored settings. Returns 200 on success, 400/500 on failure.
      """
      try:
        # Attempt to acquire a token for the configured scope
        token = acquire_token()
        return jsonify({"ok": True, "token_expires_in": token.get("expires_in")}), 200
      except RuntimeError as re:
        return jsonify({"ok": False, "error": str(re)}), 400
      except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@bp.route('/workspaces', methods=['GET'])
def list_workspaces():
    """List all Power BI workspaces.
    ---
    tags:
      - Power BI
    responses:
      200:
        description: List of workspaces
        schema:
          type: array
          items:
            type: object
    """
    try:
        service = PowerBIService()
        data = service.list_workspaces()
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route('/workspaces/<workspace_id>/datasets', methods=['GET'])
def list_datasets(workspace_id):
    """List datasets in a workspace.
    ---
    tags:
      - Power BI
    parameters:
      - name: workspace_id
        in: path
        type: string
        required: true
        description: The workspace ID
    responses:
      200:
        description: List of datasets
        schema:
          type: array
    """
    try:
        service = PowerBIService()
        data = service.list_datasets(workspace_id)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route('/workspaces/<workspace_id>/semantic-models', methods=['GET'])
def list_semantic_models(workspace_id):
    """List semantic models in a workspace.
    ---
    tags:
      - Power BI
    parameters:
      - name: workspace_id
        in: path
        type: string
        required: true
        description: The workspace ID
    responses:
      200:
        description: List of semantic models
        schema:
          type: array
    """
    try:
        service = PowerBIService()
        
        # Get workspace info for enrichment
        workspaces = service.list_workspaces()
        workspace = next((ws for ws in workspaces if ws.get('id') == workspace_id), None)
        workspace_name = workspace.get('name') if workspace else None
        
        # Get datasets
        datasets = service.list_datasets(workspace_id)
        
        # Enrich each dataset with workspace information
        if workspace_name:
            for dataset in datasets:
                dataset['workspaceName'] = workspace_name
                dataset['workspaceId'] = workspace_id
        
        return jsonify(datasets)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route('/workspaces/<workspace_id>/reports', methods=['GET'])
def list_reports(workspace_id):
    """List reports in a workspace.
    ---
    tags:
      - Power BI
    parameters:
      - name: workspace_id
        in: path
        type: string
        required: true
        description: The workspace ID
    responses:
      200:
        description: List of reports
    """
    try:
        service = PowerBIService()
        data = service.list_reports(workspace_id)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route('/workspaces/<workspace_id>/semantic-models/<semantic_model_id>/download', methods=['GET'])
def download_single_semantic_model(workspace_id, semantic_model_id):
    """Download a single semantic model's definition.
    ---
    tags:
      - Semantic Models
    parameters:
      - name: workspace_id
        in: path
        type: string
        required: true
        description: The workspace ID
      - name: semantic_model_id
        in: path
        type: string
        required: true
        description: The semantic model ID
      - name: output_folder
        in: query
        type: string
        required: false
        description: Optional custom output folder name
      - name: use_model_id_as_folder
        in: query
        type: boolean
        required: false
        description: Use model ID instead of name for folder
    responses:
      200:
        description: Download successful
        schema:
          type: object
          properties:
            status:
              type: string
            folder:
              type: string
            files:
              type: array
              items:
                type: string
      500:
        description: Download failed
    """
    try:
        output_folder = request.args.get('output_folder')
        use_model_id = request.args.get('use_model_id_as_folder', 'false').lower() == 'true'
        
        service = FabricService()
        result = service.download_single_semantic_model(
            workspace_id=workspace_id,
            semantic_model_id=semantic_model_id,
            output_folder=output_folder,
            use_model_id_as_folder=use_model_id
        )
        
        if result.get("status") == "failed":
            return jsonify(result), 500
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"status": "failed", "error": str(e)}), 500


@bp.route('/semantic-models/download', methods=['POST'])
def download_semantic_models():
    """Download multiple semantic model definitions.
    ---
    tags:
      - Semantic Models
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - workspace_id
            - dataset_ids
          properties:
            workspace_id:
              type: string
              description: The workspace ID
            dataset_ids:
              type: array
              items:
                type: string
              description: List of dataset IDs to download
            create_backup:
              type: boolean
              default: true
              description: Create backup before download
    responses:
      200:
        description: Download results
        schema:
          type: array
          items:
            type: object
    """
    try:
        data = request.get_json()
        workspace_id = data['workspace_id']
        dataset_ids = data['dataset_ids']
        create_backup = data.get('create_backup', True)
        
        service = FabricService()
        results = []
        
        for dataset_id in dataset_ids:
            result = service.download_definition(
                workspace_id=workspace_id,
                workspace_name=workspace_id,
                semantic_model_id=dataset_id,
                model_name=dataset_id,
                create_backup=create_backup,
            )
            
            results.append({
                "workspace_id": workspace_id,
                "semantic_model_id": dataset_id,
                "folder_path": result.get("folder", ""),
                "status": result["status"],
                "error": result.get("error"),
            })
        
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route('/semantic-models/bulk-replace', methods=['POST'])
def bulk_replace_keywords():
    """Apply keyword replacements to semantic model definitions.
    ---
    tags:
      - Semantic Models
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - workspace_id
            - dataset_ids
            - server_mappings
          properties:
            workspace_id:
              type: string
            dataset_ids:
              type: array
              items:
                type: string
            server_mappings:
              type: object
              description: Dictionary of old_server to new_server mappings
              example:
                old-server.database.windows.net: new-server.database.windows.net
    responses:
      200:
        description: Replacement results
    """
    try:
        from pathlib import Path
        
        data = request.get_json()
        workspace_id = data['workspace_id']
        dataset_ids = data['dataset_ids']
        server_mappings = data['server_mappings']
        
        settings = get_settings()
        service = FabricService()
        
        models_processed = []
        successful_count = 0
        failed_count = 0
        total_replacements = {}
        
        for dataset_id in dataset_ids:
            folder_path = Path(settings.data_folder) / workspace_id / dataset_id
            
            if not folder_path.exists():
                models_processed.append({
                    "dataset_id": dataset_id,
                    "status": "failed",
                    "error": "Definition folder not found. Download first.",
                })
                failed_count += 1
                continue
            
            result = service.update_server_name(str(folder_path), server_mappings)
            
            if result["status"] in ["updated", "no_changes"]:
                successful_count += 1
                for keyword, count in result.get("replacements", {}).items():
                    total_replacements[keyword] = total_replacements.get(keyword, 0) + count
            else:
                failed_count += 1
            
            models_processed.append({
                "dataset_id": dataset_id,
                "status": result["status"],
                "error": result.get("error"),
                "files_updated": result.get("files_updated", 0),
                "replacements": result.get("replacements", {}),
            })
        
        return jsonify({
            "total_models": len(dataset_ids),
            "processed": len(models_processed),
            "successful": successful_count,
            "failed": failed_count,
            "models": models_processed,
            "replacements_summary": total_replacements,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route('/semantic-models/deploy', methods=['POST'])
def deploy_semantic_models():
    """Deploy modified semantic model definitions to Fabric.
    ---
    tags:
      - Semantic Models
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - workspace_id
            - dataset_ids
          properties:
            workspace_id:
              type: string
            dataset_ids:
              type: array
              items:
                type: string
    responses:
      200:
        description: Deployment results
    """
    try:
        from pathlib import Path
        
        data = request.get_json()
        workspace_id = data['workspace_id']
        dataset_ids = data['dataset_ids']
        
        settings = get_settings()
        service = FabricService()
        
        models_processed = []
        successful_count = 0
        failed_count = 0
        
        for dataset_id in dataset_ids:
            folder_path = Path(settings.data_folder) / workspace_id / dataset_id
            
            if not folder_path.exists():
                models_processed.append({
                    "dataset_id": dataset_id,
                    "status": "failed",
                    "error": "Definition folder not found. Download first.",
                })
                failed_count += 1
                continue
            
            result = service.upload_definition(
                workspace_id=workspace_id,
                semantic_model_id=dataset_id,
                definition_folder=str(folder_path),
                model_name=dataset_id,
            )
            
            if result["status"] == "uploaded":
                successful_count += 1
            else:
                failed_count += 1
            
            models_processed.append({
                "dataset_id": dataset_id,
                "status": result["status"],
                "error": result.get("error"),
            })
        
        return jsonify({
            "total_models": len(dataset_ids),
            "processed": len(models_processed),
            "successful": successful_count,
            "failed": failed_count,
            "models": models_processed,
            "replacements_summary": {},
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route('/workspaces/<workspace_id>/semantic-models/<semantic_model_id>/replace-keywords', methods=['POST'])
def replace_keywords_single_model(workspace_id, semantic_model_id):
    """Apply keyword replacements to a single semantic model.
    ---
    tags:
      - Semantic Models
    parameters:
      - name: workspace_id
        in: path
        type: string
        required: true
      - name: semantic_model_id
        in: path
        type: string
        required: true
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - folder_path
            - server_mappings
          properties:
            folder_path:
              type: string
              description: Path to model folder (absolute or relative)
            server_mappings:
              type: object
              description: Dictionary of old_server to new_server mappings
    responses:
      200:
        description: Replacement successful
      400:
        description: Invalid request
      500:
        description: Replacement failed
    """
    try:
        data = request.get_json()
        folder_path = data.get('folder_path')
        server_mappings = data.get('server_mappings')
        
        if not folder_path:
            return jsonify({
                "status": "failed",
                "error": "folder_path is required",
                "workspace_id": workspace_id,
                "semantic_model_id": semantic_model_id
            }), 400
        
        if not server_mappings:
            return jsonify({
                "status": "failed",
                "error": "server_mappings is required",
                "workspace_id": workspace_id,
                "semantic_model_id": semantic_model_id
            }), 400
        
        service = FabricService()
        
        # Resolve path
        try:
            resolved_path = service.resolve_model_path(folder_path)
            folder_path_str = str(resolved_path)
        except FileNotFoundError as e:
            return jsonify({
                "status": "failed",
                "error": str(e),
                "workspace_id": workspace_id,
                "semantic_model_id": semantic_model_id
            }), 400
        
        # Apply replacements
        result = service.update_server_name(folder_path_str, server_mappings)
        
        return jsonify({
            "status": result["status"],
            "workspace_id": workspace_id,
            "semantic_model_id": semantic_model_id,
            "files_updated": result.get("files_updated", 0),
            "replacements": result.get("replacements", {}),
            "error": result.get("error")
        }), 200 if result["status"] in ["updated", "no_changes"] else 500
        
    except Exception as e:
        return jsonify({
            "status": "failed",
            "error": str(e),
            "workspace_id": workspace_id,
            "semantic_model_id": semantic_model_id
        }), 500


@bp.route('/workspaces/<workspace_id>/downloaded-models', methods=['GET'])
def list_downloaded_models(workspace_id):
    """List downloaded semantic models for a specific workspace.
    ---
    tags:
      - Semantic Models
    parameters:
      - name: workspace_id
        in: path
        type: string
        required: true
        description: The workspace ID to filter models
    responses:
      200:
        description: List of downloaded models
        schema:
          type: object
          properties:
            models:
              type: array
    """
    try:
        from pathlib import Path
        settings = get_settings()
        base_path = Path(settings.download_folder)
        
        models = []
        workspace_folder = base_path / workspace_id
        
        if workspace_folder.exists() and workspace_folder.is_dir():
            for model_folder in workspace_folder.iterdir():
                if model_folder.is_dir():
                    # Check for required files
                    pbism_file = model_folder / "definition.pbism"
                    definition_folder = model_folder / "definition"
                    
                    if pbism_file.exists() and definition_folder.exists():
                        models.append({
                            "workspace": workspace_id,
                            "model_name": model_folder.name,
                            "path": str(model_folder),
                            "relative_path": f"{workspace_id}/{model_folder.name}"
                        })
        
        return jsonify({"models": models})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route('/semantic-models/validate-folder', methods=['POST'])
def validate_model_folder():
    """Validate a semantic model folder before upload.
    ---
    tags:
      - Semantic Models
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - folder_path
          properties:
            folder_path:
              type: string
              description: Path to model folder (absolute or relative)
    responses:
      200:
        description: Validation successful
      400:
        description: Validation failed
    """
    try:
        data = request.get_json()
        folder_path = data.get('folder_path')
        
        if not folder_path:
            return jsonify({"error": "folder_path is required"}), 400
        
        service = FabricService()
        
        # Try to resolve path
        try:
            resolved_path = service.resolve_model_path(folder_path)
            folder_path = str(resolved_path)
        except FileNotFoundError as e:
            return jsonify({
                "valid": False,
                "missing_files": ["folder_not_found"],
                "folder_path": folder_path,
                "error": str(e)
            }), 400
        
        # Validate folder structure
        result = service.validate_semantic_model_folder(folder_path)
        
        if result["valid"]:
            return jsonify(result), 200
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route('/workspaces/<workspace_id>/semantic-models/<semantic_model_id>/upload', methods=['POST'])
def upload_semantic_model(workspace_id, semantic_model_id):
    """Upload and replace a semantic model definition from local folder.
    ---
    tags:
      - Semantic Models
    parameters:
      - name: workspace_id
        in: path
        type: string
        required: true
      - name: semantic_model_id
        in: path
        type: string
        required: true
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - folder_path
          properties:
            folder_path:
              type: string
              description: Path to model folder (absolute or relative)
    responses:
      200:
        description: Upload successful
      400:
        description: Validation failed
      500:
        description: Upload failed
    """
    try:
        data = request.get_json()
        folder_path = data.get('folder_path')
        
        if not folder_path:
            return jsonify({
                "status": "validation_failed",
                "error": "folder_path is required",
                "workspace_id": workspace_id,
                "semantic_model_id": semantic_model_id
            }), 400
        
        service = FabricService()
        
        # Resolve path
        try:
            resolved_path = service.resolve_model_path(folder_path)
            folder_path_str = str(resolved_path)
        except FileNotFoundError as e:
            return jsonify({
                "status": "validation_failed",
                "error": str(e),
                "workspace_id": workspace_id,
                "semantic_model_id": semantic_model_id,
                "validation_errors": ["folder_not_found"]
            }), 400
        
        # Validate folder structure (blocks upload if invalid)
        validation_result = service.validate_semantic_model_folder(folder_path_str)
        
        if not validation_result["valid"]:
            return jsonify({
                "status": "validation_failed",
                "error": "Required files missing",
                "workspace_id": workspace_id,
                "semantic_model_id": semantic_model_id,
                "validation_errors": validation_result["missing_files"]
            }), 400
        
        # Perform upload
        upload_result = service.upload_single_semantic_model(
            workspace_id=workspace_id,
            semantic_model_id=semantic_model_id,
            definition_folder=folder_path_str,
            update_metadata=True
        )
        
        if upload_result["status"] == "success":
            return jsonify({
                "status": "success",
                "workspace_id": workspace_id,
                "semantic_model_id": semantic_model_id,
                "model_name": upload_result.get("model_name"),
                "message": "Semantic model uploaded successfully"
            }), 200
        else:
            return jsonify({
                "status": "failed",
                "workspace_id": workspace_id,
                "semantic_model_id": semantic_model_id,
                "error": upload_result.get("error")
            }), 500
            
    except Exception as e:
        return jsonify({
            "status": "failed",
            "error": str(e),
            "workspace_id": workspace_id,
            "semantic_model_id": semantic_model_id
        }), 500


@bp.route('/semantic-models/revert', methods=['POST'])
def revert_semantic_models():
    """Revert multiple semantic models from backup.
    ---
    tags:
      - Semantic Models
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - models
          properties:
            models:
              type: array
              items:
                type: object
                properties:
                  workspace_id:
                    type: string
                  semantic_model_id:
                    type: string
    responses:
      200:
        description: Batch revert results
        schema:
          type: object
          properties:
            total:
              type: integer
            successful:
              type: integer
            failed:
              type: integer
            results:
              type: array
      400:
        description: Invalid request
    """
    try:
        from pathlib import Path
        from ..utils.storage import build_artifact_path, build_backup_path, restore_backup, backup_exists
        
        data = request.get_json()
        models = data.get('models', [])
        
        if not models:
            return jsonify({
                "error": "models array is required",
                "total": 0,
                "successful": 0,
                "failed": 0,
                "results": []
            }), 400
        
        settings = get_settings()
        results = []
        successful_count = 0
        failed_count = 0
        
        for model in models:
            workspace_id = model.get('workspace_id')
            semantic_model_id = model.get('semantic_model_id')
            
            if not workspace_id or not semantic_model_id:
                results.append({
                    "workspace_id": workspace_id,
                    "semantic_model_id": semantic_model_id,
                    "status": "failed",
                    "error": "workspace_id and semantic_model_id are required"
                })
                failed_count += 1
                continue
            
            try:
                # Build paths
                target_folder = build_artifact_path(
                    base_folder=settings.data_folder,
                    workspace_id=workspace_id,
                    artifact_type=settings.semantic_models_folder_name,
                    artifact_id=semantic_model_id
                )
                
                backup_folder = build_backup_path(
                    base_folder=settings.data_folder,
                    workspace_id=workspace_id,
                    artifact_type=settings.semantic_models_folder_name,
                    artifact_id=semantic_model_id,
                    backup_folder_name=settings.backup_folder_name
                )
                
                # Check if backup exists
                if not backup_exists(backup_folder):
                    results.append({
                        "workspace_id": workspace_id,
                        "semantic_model_id": semantic_model_id,
                        "status": "failed",
                        "error": "No backup found"
                    })
                    failed_count += 1
                    continue
                
                # Restore backup
                restore_backup(backup_folder, target_folder)
                
                results.append({
                    "workspace_id": workspace_id,
                    "semantic_model_id": semantic_model_id,
                    "status": "success"
                })
                successful_count += 1
                
            except Exception as e:
                results.append({
                    "workspace_id": workspace_id,
                    "semantic_model_id": semantic_model_id,
                    "status": "failed",
                    "error": str(e)
                })
                failed_count += 1
        
        return jsonify({
            "total": len(models),
            "successful": successful_count,
            "failed": failed_count,
            "results": results
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route('/artifacts/downloaded', methods=['GET'])
def list_downloaded_artifacts():
    """List all downloaded semantic models from local storage.
    ---
    tags:
      - Artifacts
    responses:
      200:
        description: List of downloaded artifacts with metadata
        schema:
          type: object
          properties:
            total:
              type: integer
            workspaces:
              type: array
              items:
                type: object
                properties:
                  workspace_id:
                    type: string
                  workspace_name:
                    type: string
                  semantic_models:
                    type: array
      500:
        description: Error listing artifacts
    """
    try:
        from pathlib import Path
        import json
        from ..utils.storage import build_backup_path, backup_exists
        
        settings = get_settings()
        data_folder = Path(settings.data_folder)
        
        if not data_folder.exists():
            return jsonify({
                "total": 0,
                "workspaces": [],
                "message": "Data folder not found"
            })
        
        workspaces = []
        total_models = 0
        
        # Scan workspace folders
        for workspace_path in data_folder.iterdir():
            if not workspace_path.is_dir():
                continue
            
            workspace_id = workspace_path.name
            workspace_name = workspace_id  # Default to ID
            
            # Check for semantic-models subfolder
            semantic_models_path = workspace_path / settings.semantic_models_folder_name
            if not semantic_models_path.exists():
                continue
            
            semantic_models = []
            
            # Scan model folders
            for model_path in semantic_models_path.iterdir():
                if not model_path.is_dir() or model_path.name == settings.backup_folder_name:
                    continue
                
                model_id = model_path.name
                
                # Read metadata if available
                metadata_file = model_path / "metadata.json"
                if metadata_file.exists():
                    try:
                        with open(metadata_file, 'r', encoding='utf-8') as f:
                            metadata = json.load(f)
                        
                        # Use workspace name from metadata
                        workspace_name = metadata.get("workspace_name", workspace_id)
                        
                        # Check if backup exists
                        backup_folder = build_backup_path(
                            base_folder=settings.data_folder,
                            workspace_id=workspace_id,
                            artifact_type=settings.semantic_models_folder_name,
                            artifact_id=model_id,
                            backup_folder_name=settings.backup_folder_name
                        )
                        has_backup = backup_exists(backup_folder)
                        
                        semantic_models.append({
                            "artifact_id": metadata.get("artifact_id", model_id),
                            "artifact_name": metadata.get("artifact_name", model_id),
                            "workspace_id": metadata.get("workspace_id", workspace_id),
                            "workspace_name": metadata.get("workspace_name", workspace_id),
                            "last_updated": metadata.get("last_updated"),
                            "download_timestamp": metadata.get("download_timestamp"),
                            "definition_format": metadata.get("definition_format", "TMDL"),
                            "files_count": metadata.get("files_count", 0),
                            "folder_path": str(model_path),
                            "has_backup": has_backup
                        })
                        total_models += 1
                    except Exception:
                        # If metadata read fails, use basic info
                        semantic_models.append({
                            "artifact_id": model_id,
                            "artifact_name": model_id,
                            "workspace_id": workspace_id,
                            "workspace_name": workspace_id,
                            "folder_path": str(model_path),
                            "has_backup": False
                        })
                        total_models += 1
                else:
                    # No metadata, use basic info
                    semantic_models.append({
                        "artifact_id": model_id,
                        "artifact_name": model_id,
                        "workspace_id": workspace_id,
                        "workspace_name": workspace_id,
                        "folder_path": str(model_path),
                        "has_backup": False
                    })
                    total_models += 1
            
            if semantic_models:
                workspaces.append({
                    "workspace_id": workspace_id,
                    "workspace_name": workspace_name,
                    "semantic_models": semantic_models
                })
        
        return jsonify({
            "total": total_models,
            "workspaces": workspaces
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route('/artifacts/<artifact_id>/open-folder', methods=['POST'])
def open_artifact_folder(artifact_id: str):
    """Open artifact folder in Windows Explorer.
    ---
    tags:
      - Artifacts
    parameters:
      - name: artifact_id
        in: path
        required: true
        type: string
        description: Artifact ID
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            workspace_id:
              type: string
              description: Workspace ID
          required:
            - workspace_id
    responses:
      200:
        description: Folder opened successfully
      404:
        description: Folder not found
      500:
        description: Error opening folder
    """
    try:
        data = request.get_json()
        workspace_id = data.get('workspace_id')
        
        if not workspace_id:
            return jsonify({"error": "workspace_id is required"}), 400
        
        settings = get_settings()
        
        # Validate and get folder path
        folder_path = validate_artifact_folder(
            artifact_id=artifact_id,
            workspace_id=workspace_id,
            base_folder=settings.data_folder,
            artifact_type=settings.semantic_models_folder_name,
        )
        
        # Open folder in Windows Explorer
        if sys.platform == 'win32':
            subprocess.run(['explorer', str(folder_path)], check=False)
        else:
            return jsonify({"error": "Folder opening is only supported on Windows"}), 400
        
        return jsonify({
            "success": True,
            "message": "Folder opened successfully",
            "folder_path": str(folder_path)
        })
        
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route('/workspaces/<workspace_id>/open-folder', methods=['POST'])
def open_workspace_folder(workspace_id: str):
    """Open workspace folder in Windows Explorer.
    ---
    tags:
      - Workspaces
    parameters:
      - name: workspace_id
        in: path
        required: true
        type: string
        description: Workspace ID
    responses:
      200:
        description: Folder opened successfully
      404:
        description: Folder not found
      500:
        description: Error opening folder
    """
    try:
        settings = get_settings()
        
        # Validate and get folder path
        folder_path = validate_workspace_folder(
            workspace_id=workspace_id,
            base_folder=settings.data_folder,
            artifact_type=settings.semantic_models_folder_name,
        )
        
        # Open folder in Windows Explorer
        if sys.platform == 'win32':
            subprocess.run(['explorer', str(folder_path)], check=False)
        else:
            return jsonify({"error": "Folder opening is only supported on Windows"}), 400
        
        return jsonify({
            "success": True,
            "message": "Folder opened successfully",
            "folder_path": str(folder_path)
        })
        
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500
