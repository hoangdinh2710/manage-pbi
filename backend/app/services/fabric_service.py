"""Service layer for Fabric API operations."""
import re
import shutil
import base64
import time
import requests
from pathlib import Path
from typing import Any
from datetime import datetime
from ..core.config import get_settings
from ..core.security import acquire_token
from ..utils.storage import (
    build_artifact_path,
    build_backup_path,
    create_metadata_file,
    read_metadata_file,
    create_backup,
    backup_exists,
)


class FabricService:
    """Service for Fabric API operations - semantic model download/upload/keyword replacement."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self.base_url = self.settings.fabric_api_base
        # Get access token using existing MSAL authentication
        token = acquire_token()
        self.access_token = token["access_token"]
        
    def _make_request(
        self,
        method: str,
        endpoint: str,
        data: dict[str, Any] | None = None,
        params: dict[str, Any] | None = None,
    ) -> requests.Response:
        """Make HTTP request to Fabric API."""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }
        
        response = requests.request(
            method=method,
            url=url,
            json=data,
            params=params,
            headers=headers,
            timeout=self.settings.http_timeout_seconds,
        )
        response.raise_for_status()
        return response
    
    def _get_operation_result(
        self, operation_id: str, max_retries: int | None = None, retry_delay: int | None = None
    ) -> dict[str, Any]:
        """Poll long-running operation until completion."""
        if max_retries is None:
            max_retries = self.settings.operation_max_retries
        if retry_delay is None:
            retry_delay = self.settings.operation_retry_delay_seconds
        
        status_url = f"{self.base_url}/operations/{operation_id}"
        
        for attempt in range(max_retries):
            response = requests.get(
                status_url,
                headers={"Authorization": f"Bearer {self.access_token}"},
                timeout=self.settings.http_timeout_seconds,
            )
            response.raise_for_status()
            
            result = response.json()
            status = result.get("status", "").lower()
            
            if status == "succeeded":
                # Try to fetch result from /result endpoint
                result_url = f"{self.base_url}/operations/{operation_id}/result"
                result_response = requests.get(
                    result_url,
                    headers={"Authorization": f"Bearer {self.access_token}"},
                    timeout=self.settings.http_timeout_seconds,
                )
                
                if result_response.status_code == 200:
                    return result_response.json()
                elif result_response.status_code == 400:
                    # OperationHasNoResult - return status info
                    return result
                else:
                    result_response.raise_for_status()
                    
            elif status == "failed":
                error_details = result.get("error", result)
                raise RuntimeError(f"Operation failed: {error_details}")
            elif status in ["running", "notstarted", "inprogress"]:
                if attempt < max_retries - 1:
                    time.sleep(retry_delay)
                    continue
            else:
                return result
        
        raise TimeoutError(f"Operation timed out after {max_retries} attempts")
    
    def _save_definition_to_folder(
        self, definition_data: dict[str, Any], output_folder: str
    ) -> list[str]:
        """Save semantic model definition parts to folder structure."""
        parts = definition_data.get("parts", [])
        output_path = Path(output_folder)
        output_path.mkdir(parents=True, exist_ok=True)
        
        saved_files = []
        
        for part in parts:
            file_path = part.get("path", "")
            payload = part.get("payload", "")
            payload_type = part.get("payloadType", "")
            
            if not file_path or not payload:
                continue
            
            # Decode payload
            if payload_type == "InlineBase64":
                try:
                    decoded_content = base64.b64decode(payload).decode("utf-8")
                except Exception:
                    continue
            else:
                decoded_content = payload
            
            # Write file
            full_path = output_path / file_path
            full_path.parent.mkdir(parents=True, exist_ok=True)
            
            try:
                with open(full_path, "w", encoding="utf-8") as f:
                    f.write(decoded_content)
                saved_files.append(str(full_path))
            except Exception:
                pass
        
        return saved_files
    
    def _build_definition_from_folder(
        self, folder_path: str, format_type: str = "TMDL"
    ) -> dict[str, Any]:
        """Build definition object from folder structure."""
        folder = Path(folder_path)
        if not folder.exists():
            raise FileNotFoundError(f"Folder not found: {folder_path}")
        
        parts = []
        
        for file_path in folder.rglob("*"):
            if file_path.is_file():
                relative_path = file_path.relative_to(folder)
                path_str = str(relative_path).replace("\\", "/")
                
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        content = f.read()
                    
                    encoded_content = base64.b64encode(content.encode("utf-8")).decode(
                        "utf-8"
                    )
                    
                    parts.append({
                        "path": path_str,
                        "payload": encoded_content,
                        "payloadType": "InlineBase64",
                    })
                except Exception:
                    pass
        
        return {"format": format_type, "parts": parts}

    def download_definition(
        self,
        workspace_id: str,
        workspace_name: str,
        semantic_model_id: str,
        model_name: str,
        create_backup: bool = True,
    ) -> dict[str, Any]:
        """Download semantic model definition to local storage.
        
        Args:
            workspace_id: Workspace ID
            workspace_name: Workspace name for folder structure
            semantic_model_id: Semantic model ID
            model_name: Model name for display
            create_backup: Whether to create a backup copy
            
        Returns:
            Dict with status, folder path, metadata, and error (if any)
        """
        try:
            # Build standardized path using new structure
            # Structure: {base}/{workspace_id}/semantic-models/{model_id}/
            folder_path = build_artifact_path(
                base_folder=self.settings.data_folder,
                workspace_id=workspace_id,
                artifact_type=self.settings.semantic_models_folder_name,
                artifact_id=semantic_model_id,
                workspace_name=workspace_name,
                use_workspace_id=self.settings.use_workspace_id_in_path,
            )
            
            # Build backup path
            backup_path = build_backup_path(
                base_folder=self.settings.data_folder,
                workspace_id=workspace_id,
                artifact_type=self.settings.semantic_models_folder_name,
                artifact_id=semantic_model_id,
                backup_folder_name=self.settings.backup_folder_name,
                workspace_name=workspace_name,
                use_workspace_id=self.settings.use_workspace_id_in_path,
            )
            
            # Check if definition already exists
            definition_exists = folder_path.exists() and (folder_path / "definition.pbism").exists()
            
            if definition_exists:
                # Create backup of existing definition before re-downloading
                if create_backup and self.settings.enable_auto_backup:
                    try:
                        create_backup(
                            source_folder=folder_path,
                            backup_folder=backup_path,
                        )
                    except Exception:
                        pass  # Continue even if backup fails
                
                # Read existing metadata
                metadata = read_metadata_file(folder_path) or {}
                
                return {
                    "status": "exists",
                    "folder": str(folder_path),
                    "backup": str(backup_path) if backup_exists(backup_path) else None,
                    "metadata": metadata,
                    "error": None,
                }
            
            # Create the directory structure
            folder_path.mkdir(parents=True, exist_ok=True)
            
            # Call Fabric API to get definition
            endpoint = f"workspaces/{workspace_id}/semanticModels/{semantic_model_id}/getDefinition"
            response = self._make_request("POST", endpoint, data={})
            
            # Handle long-running operation
            if response.status_code == 202:
                operation_id = response.headers.get("x-ms-operation-id")
                if not operation_id:
                    raise ValueError("No operation ID in response")
                
                result = self._get_operation_result(operation_id)
            else:
                result = response.json() if response.text else {}
            
            # Extract definition
            if "definition" in result:
                definition = result["definition"]
            elif "format" in result and "parts" in result:
                definition = result
            else:
                raise ValueError("No definition found in response")
            
            # Save to folder
            saved_files = self._save_definition_to_folder(definition, str(folder_path))
            
            # Create metadata file if enabled
            metadata = {
                "workspace_id": workspace_id,
                "workspace_name": workspace_name,
                "artifact_id": semantic_model_id,
                "artifact_name": model_name,
                "artifact_type": "semantic-model",
                "download_timestamp": datetime.utcnow().isoformat(),
                "last_updated": datetime.utcnow().isoformat(),
                "definition_format": definition.get("format", "TMDL"),
                "files_count": len(saved_files),
            }
            
            if self.settings.store_artifact_metadata:
                create_metadata_file(folder_path, metadata)
            
            # Create backup of newly downloaded definition
            if create_backup and self.settings.enable_auto_backup:
                try:
                    create_backup(
                        source_folder=folder_path,
                        backup_folder=backup_path,
                    )
                except Exception:
                    pass  # Continue even if backup fails
            
            return {
                "status": "downloaded",
                "folder": str(folder_path),
                "backup": str(backup_path) if backup_exists(backup_path) else None,
                "metadata": metadata,
                "error": None,
            }
            
        except Exception as e:
            return {"status": "failed", "folder": None, "backup": None, "metadata": None, "error": str(e)}

    def update_server_name(
        self,
        definition_folder: str,
        server_mappings: dict[str, str],
        workspace_id: str | None = None,
        semantic_model_id: str | None = None,
        create_backup: bool = True,
    ) -> dict[str, Any]:
        """Update server names in .tmdl files using keyword replacement.
        
        Args:
            definition_folder: Path to the semantic model definition
            server_mappings: Dictionary of {old_server: new_server} mappings
            workspace_id: Optional workspace ID for backup (if using new structure)
            semantic_model_id: Optional model ID for backup (if using new structure)
            create_backup: Whether to create backup before updating
            
        Returns:
            Dict with status, replacements made, and error (if any)
        """
        try:
            folder_path = Path(definition_folder)
            
            # Create backup before making changes
            if create_backup and self.settings.enable_auto_backup and self.settings.backup_on_update:
                if workspace_id and semantic_model_id:
                    try:
                        backup_path = build_backup_path(
                            base_folder=self.settings.data_folder,
                            workspace_id=workspace_id,
                            artifact_type=self.settings.semantic_models_folder_name,
                            artifact_id=semantic_model_id,
                            backup_folder_name=self.settings.backup_folder_name,
                        )
                        create_backup(
                            source_folder=folder_path,
                            backup_folder=backup_path,
                        )
                    except Exception:
                        pass  # Continue even if backup fails
            
            # Look for .tmdl files in multiple locations
            search_paths = [
                folder_path / "definition",
                folder_path / "definition" / "tables",
                folder_path,
            ]
            
            tmdl_files = []
            for search_path in search_paths:
                if search_path.exists():
                    tmdl_files.extend(list(search_path.rglob("*.tmdl")))
            
            # Remove duplicates
            tmdl_files = list(set(tmdl_files))
            
            if not tmdl_files:
                return {
                    "status": "no_changes",
                    "error": "No .tmdl files found",
                    "replacements": {},
                    "files_updated": 0,
                }
            
            updated_count = 0
            replacements_made = {}
            
            for file_path in tmdl_files:
                try:
                    # Read file content
                    with open(file_path, "r", encoding="utf-8") as f:
                        content = f.read()
                    
                    file_had_changes = False
                    
                    # Apply all server mappings with case-insensitive matching
                    for old_srv, new_srv in server_mappings.items():
                        if old_srv.lower() in content.lower():
                            # Create case-insensitive pattern
                            pattern = re.compile(re.escape(old_srv), re.IGNORECASE)
                            matches = pattern.findall(content)
                            
                            if matches:
                                # Replace all occurrences
                                content = pattern.sub(new_srv, content)
                                file_had_changes = True
                                
                                # Track replacements
                                if old_srv not in replacements_made:
                                    replacements_made[old_srv] = 0
                                replacements_made[old_srv] += len(matches)
                    
                    # Write back to file if changes were made
                    if file_had_changes:
                        with open(file_path, "w", encoding="utf-8") as f:
                            f.write(content)
                        updated_count += 1
                        
                except Exception as e:
                    # Continue processing other files
                    pass
            
            # Update metadata file if it exists and changes were made
            if updated_count > 0 and self.settings.store_artifact_metadata:
                metadata = read_metadata_file(folder_path)
                if metadata:
                    metadata["last_updated"] = datetime.utcnow().isoformat()
                    metadata["last_operation"] = "server_name_update"
                    metadata["server_mappings"] = server_mappings
                    create_metadata_file(folder_path, metadata)
            
            if updated_count > 0:
                return {
                    "status": "updated",
                    "error": None,
                    "replacements": replacements_made,
                    "files_updated": updated_count,
                }
            else:
                return {
                    "status": "no_changes",
                    "error": "No matching server names found",
                    "replacements": {},
                    "files_updated": 0,
                }
                
        except Exception as e:
            return {
                "status": "failed",
                "error": str(e),
                "replacements": {},
                "files_updated": 0,
            }

    def download_single_semantic_model(
        self,
        workspace_id: str,
        semantic_model_id: str,
        output_folder: str | None = None,
        use_model_id_as_folder: bool = False,
    ) -> dict[str, Any]:
        """Download a single semantic model's definition files using structured storage.
        
        Args:
            workspace_id: The workspace ID
            semantic_model_id: The semantic model ID
            output_folder: Optional custom output folder name (overrides structured path)
            use_model_id_as_folder: Use model ID instead of name for folder (legacy parameter)
            
        Returns:
            Dictionary with download results including saved files list
        """
        try:
            # Get model info and workspace info
            endpoint = f"workspaces/{workspace_id}/semanticModels/{semantic_model_id}"
            response = self._make_request("GET", endpoint)
            model_info = response.json()
            model_name = model_info.get("displayName", semantic_model_id)
            
            # Get workspace name for metadata
            workspace_endpoint = f"workspaces/{workspace_id}"
            workspace_response = self._make_request("GET", workspace_endpoint)
            workspace_info = workspace_response.json()
            workspace_name = workspace_info.get("displayName", workspace_id)
            
            # Use structured path (consistent with download_definition)
            if output_folder:
                # Custom output folder for backward compatibility
                folder_path = Path(output_folder)
            else:
                # Use standardized structure: {data_folder}/{workspace_id}/semantic-models/{model_id}/
                folder_path = build_artifact_path(
                    base_folder=self.settings.data_folder,
                    workspace_id=workspace_id,
                    artifact_type=self.settings.semantic_models_folder_name,
                    artifact_id=semantic_model_id,
                    workspace_name=workspace_name,
                    use_workspace_id=self.settings.use_workspace_id_in_path,
                )
            
            # Create backup if model already exists
            definition_exists = folder_path.exists() and (folder_path / "definition.pbism").exists()
            if definition_exists and self.settings.enable_auto_backup:
                backup_path = build_backup_path(
                    base_folder=self.settings.data_folder,
                    workspace_id=workspace_id,
                    artifact_type=self.settings.semantic_models_folder_name,
                    artifact_id=semantic_model_id,
                    backup_folder_name=self.settings.backup_folder_name,
                    workspace_name=workspace_name,
                    use_workspace_id=self.settings.use_workspace_id_in_path,
                )
                try:
                    create_backup(source_folder=folder_path, backup_folder=backup_path)
                except Exception:
                    pass  # Continue even if backup fails
            
            folder_path.mkdir(parents=True, exist_ok=True)
            
            # Get definition
            endpoint = f"workspaces/{workspace_id}/semanticModels/{semantic_model_id}/getDefinition"
            response = self._make_request("POST", endpoint, data={})
            
            # Handle long-running operation
            if response.status_code == 202:
                operation_id = response.headers.get("x-ms-operation-id")
                if not operation_id:
                    raise ValueError("No operation ID in response")
                result = self._get_operation_result(operation_id)
            else:
                result = response.json() if response.text else {}
            
            # Extract definition
            if "definition" in result:
                definition = result["definition"]
            elif "format" in result and "parts" in result:
                definition = result
            else:
                raise ValueError("No definition found in response")
            
            # Save to folder
            saved_files = self._save_definition_to_folder(definition, str(folder_path))
            
            # Create metadata file
            metadata = {
                "workspace_id": workspace_id,
                "workspace_name": workspace_name,
                "artifact_id": semantic_model_id,
                "artifact_name": model_name,
                "artifact_type": "semantic-model",
                "download_timestamp": datetime.utcnow().isoformat(),
                "last_updated": datetime.utcnow().isoformat(),
                "definition_format": definition.get("format", "TMDL"),
                "files_count": len(saved_files),
            }
            
            if self.settings.store_artifact_metadata:
                create_metadata_file(folder_path, metadata)
            
            return {
                "workspace_id": workspace_id,
                "semantic_model_id": semantic_model_id,
                "model_name": model_name,
                "workspace_name": workspace_name,
                "output_folder": str(folder_path),
                "files_saved": len(saved_files),
                "saved_files": saved_files,
                "metadata": metadata,
                "status": "success"
            }
            
        except Exception as e:
            return {
                "workspace_id": workspace_id,
                "semantic_model_id": semantic_model_id,
                "error": str(e),
                "status": "failed"
            }
    
    def upload_single_semantic_model(
        self,
        workspace_id: str,
        semantic_model_id: str,
        definition_folder: str,
        update_metadata: bool = True,
    ) -> dict[str, Any]:
        """Upload/update a single semantic model's definition from a local folder.
        
        Args:
            workspace_id: The workspace ID
            semantic_model_id: The semantic model ID
            definition_folder: Path to folder containing model files
            update_metadata: Update metadata from .platform file (default: True)
            
        Returns:
            Dictionary with upload results
        """
        from fabricpandas.semantic_model import SemanticModelClient
        
        try:
            client = SemanticModelClient()
            
            # Get model info for name
            try:
                model_info = client.get_semantic_model(workspace_id, semantic_model_id)
                model_name = model_info.get("displayName", semantic_model_id)
            except Exception:
                model_name = semantic_model_id
            
            # Upload the semantic model definition
            result = client.update_semantic_model_definition(
                workspace_id=workspace_id,
                semantic_model_id=semantic_model_id,
                definition_folder=definition_folder,
                update_metadata=update_metadata,
                wait_for_completion=True
            )
            
            return {
                "workspace_id": workspace_id,
                "semantic_model_id": semantic_model_id,
                "model_name": model_name,
                "definition_folder": definition_folder,
                "status": "success",
                "message": "Semantic model definition uploaded successfully"
            }
            
        except Exception as e:
            return {
                "workspace_id": workspace_id,
                "semantic_model_id": semantic_model_id,
                "definition_folder": definition_folder,
                "error": str(e),
                "status": "failed"
            }
    
    def upload_definition(
        self,
        workspace_id: str,
        semantic_model_id: str,
        definition_folder: str,
        model_name: str,
    ) -> dict[str, Any]:
        """Upload updated definition back to Fabric.
        
        Args:
            workspace_id: Workspace ID
            semantic_model_id: Semantic model ID
            definition_folder: Path to definition folder
            model_name: Model name for logging
            
        Returns:
            Dict with status and error (if any)
        """
        try:
            # Build definition from folder
            definition = self._build_definition_from_folder(definition_folder)
            
            # Prepare request
            endpoint = f"workspaces/{workspace_id}/semanticModels/{semantic_model_id}/updateDefinition"
            payload = {
                "definition": definition,
                "updateMetadata": False,
            }
            
            # Make request
            response = self._make_request("POST", endpoint, data=payload)
            
            # Handle long-running operation
            if response.status_code == 202:
                operation_id = response.headers.get("x-ms-operation-id")
                if not operation_id:
                    raise ValueError("No operation ID in response")
                
                # Poll for completion
                status_url = f"{self.base_url}/operations/{operation_id}"
                
                for attempt in range(30):
                    status_response = requests.get(
                        status_url,
                        headers={"Authorization": f"Bearer {self.access_token}"},
                    )
                    status_response.raise_for_status()
                    
                    operation_status = status_response.json()
                    status = operation_status.get("status", "").lower()
                    
                    if status == "succeeded":
                        return {"status": "uploaded", "error": None}
                    elif status == "failed":
                        error_details = operation_status.get("error", operation_status)
                        raise RuntimeError(f"Operation failed: {error_details}")
                    elif status in ["running", "notstarted", "inprogress"]:
                        if attempt < 29:
                            time.sleep(5)
                            continue
                
                raise TimeoutError("Operation timed out")
            
            # Immediate success
            return {"status": "uploaded", "error": None}
            
        except Exception as e:
            return {"status": "failed", "error": str(e)}
    
    def resolve_model_path(self, path_input: str) -> Path:
        """Resolve model path from user input (absolute or relative path).
        
        Tries download_folder first, then data_folder as fallback.
        
        Args:
            path_input: User-provided path (absolute or relative)
            
        Returns:
            Resolved Path object
            
        Raises:
            FileNotFoundError: If path cannot be resolved
        """
        input_path = Path(path_input)
        
        # If absolute path exists, use it
        if input_path.is_absolute() and input_path.exists():
            return input_path
        
        # Try relative to download_folder (primary location)
        download_path = Path(self.settings.download_folder) / path_input
        if download_path.exists():
            return download_path
        
        # Try relative to data_folder (fallback location)
        data_path = Path(self.settings.data_folder) / path_input
        if data_path.exists():
            return data_path
        
        raise FileNotFoundError(
            f"Model folder not found: {path_input}. "
            f"Tried: {download_path}, {data_path}"
        )
    
    def validate_semantic_model_folder(self, folder_path: str) -> dict[str, Any]:
        """Validate that a folder contains required TMDL files for upload.
        
        Checks for minimum required files only:
        - definition.pbism
        - definition/database.tmdl
        - definition/model.tmdl
        
        Args:
            folder_path: Path to semantic model folder
            
        Returns:
            Dict with 'valid', 'missing_files', and 'folder_path' keys
        """
        try:
            folder = Path(folder_path)
            
            if not folder.exists():
                return {
                    "valid": False,
                    "missing_files": ["folder_not_found"],
                    "folder_path": str(folder)
                }
            
            validation_result = {
                "valid": False,
                "missing_files": [],
                "folder_path": str(folder)
            }
            
            # Required files/folders (minimum only)
            required = {
                "definition.pbism": folder / "definition.pbism",
                "definition/": folder / "definition",
                "definition/database.tmdl": folder / "definition" / "database.tmdl",
                "definition/model.tmdl": folder / "definition" / "model.tmdl"
            }
            
            # Check each required item
            for name, path in required.items():
                if not path.exists():
                    validation_result["missing_files"].append(name)
            
            # Set valid if no missing required files
            validation_result["valid"] = len(validation_result["missing_files"]) == 0
            
            return validation_result
            
        except Exception as e:
            return {
                "valid": False,
                "missing_files": [f"validation_error: {str(e)}"],
                "folder_path": str(folder_path)
            }
