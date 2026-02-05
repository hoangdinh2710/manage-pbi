"""Storage utilities for managing file paths, metadata, and backups."""
import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any


def build_artifact_path(
    base_folder: str,
    workspace_id: str,
    artifact_type: str,
    artifact_id: str,
    workspace_name: str | None = None,
    use_workspace_id: bool = True,
) -> Path:
    """Build standardized path for artifact storage.
    
    Args:
        base_folder: Root folder for data storage
        workspace_id: Workspace ID (immutable identifier)
        artifact_type: Type of artifact (e.g., 'semantic-models', 'reports')
        artifact_id: Artifact ID
        workspace_name: Optional workspace name (for display/metadata)
        use_workspace_id: If True, use workspace_id in path; else use workspace_name
        
    Returns:
        Path object for artifact storage location
        
    Structure:
        {base_folder}/{workspace_id_or_name}/{artifact_type}/{artifact_id}/
    """
    base = Path(base_folder)
    
    # Use workspace ID by default (immutable), but allow workspace name
    workspace_folder = workspace_id if use_workspace_id else (workspace_name or workspace_id)
    
    # Sanitize workspace name if used in path
    if not use_workspace_id and workspace_name:
        workspace_folder = sanitize_folder_name(workspace_name)
    
    return base / workspace_folder / artifact_type / artifact_id


def build_backup_path(
    base_folder: str,
    workspace_id: str,
    artifact_type: str,
    artifact_id: str,
    backup_folder_name: str = "backup",
    workspace_name: str | None = None,
    use_workspace_id: bool = True,
) -> Path:
    """Build backup path within the same workspace structure.
    
    Args:
        base_folder: Root folder for data storage
        workspace_id: Workspace ID
        artifact_type: Type of artifact (e.g., 'semantic-models', 'reports')
        artifact_id: Artifact ID
        backup_folder_name: Name of backup subfolder (default: 'backup')
        workspace_name: Optional workspace name
        use_workspace_id: If True, use workspace_id in path
        
    Returns:
        Path object for backup location
        
    Structure:
        {base_folder}/{workspace_id}/{artifact_type}/backup/{artifact_id}/
    """
    base = Path(base_folder)
    
    # Use workspace ID by default
    workspace_folder = workspace_id if use_workspace_id else (workspace_name or workspace_id)
    
    # Sanitize workspace name if used in path
    if not use_workspace_id and workspace_name:
        workspace_folder = sanitize_folder_name(workspace_name)
    
    return base / workspace_folder / artifact_type / backup_folder_name / artifact_id


def sanitize_folder_name(name: str) -> str:
    """Sanitize a string for use as folder name.
    
    Args:
        name: Original name string
        
    Returns:
        Sanitized name with invalid characters replaced
    """
    import re
    # Replace invalid characters with underscore
    return re.sub(r'[<>:"/\\|?*]', '_', name)


def create_metadata_file(
    folder_path: Path,
    metadata: dict[str, Any],
) -> Path:
    """Create metadata.json file in artifact folder.
    
    Args:
        folder_path: Path to artifact folder
        metadata: Metadata dictionary to save
        
    Returns:
        Path to created metadata file
    """
    metadata_path = folder_path / "metadata.json"
    
    # Ensure folder exists
    folder_path.mkdir(parents=True, exist_ok=True)
    
    # Add timestamp if not present
    if "last_updated" not in metadata:
        metadata["last_updated"] = datetime.utcnow().isoformat()
    
    # Write metadata
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    
    return metadata_path


def read_metadata_file(folder_path: Path) -> dict[str, Any] | None:
    """Read metadata.json from artifact folder.
    
    Args:
        folder_path: Path to artifact folder
        
    Returns:
        Metadata dictionary or None if not found
    """
    metadata_path = folder_path / "metadata.json"
    
    if not metadata_path.exists():
        return None
    
    try:
        with open(metadata_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def create_backup(
    source_folder: Path,
    backup_folder: Path,
) -> Path:
    """Create simple backup of artifact folder.
    
    Args:
        source_folder: Source artifact folder to backup
        backup_folder: Destination backup folder path
        
    Returns:
        Path to created backup folder
        
    Note:
        This creates/overwrites a single backup copy. Previous backup is replaced.
    """
    if not source_folder.exists():
        raise FileNotFoundError(f"Source folder not found: {source_folder}")
    
    # Remove existing backup if present
    if backup_folder.exists():
        shutil.rmtree(backup_folder)
    
    # Create backup directory
    backup_folder.parent.mkdir(parents=True, exist_ok=True)
    
    # Copy entire folder
    shutil.copytree(source_folder, backup_folder)
    
    # Add backup timestamp to metadata
    backup_metadata = {
        "backup_timestamp": datetime.utcnow().isoformat(),
        "source_folder": str(source_folder),
    }
    
    backup_metadata_path = backup_folder / "backup_info.json"
    with open(backup_metadata_path, "w", encoding="utf-8") as f:
        json.dump(backup_metadata, f, indent=2)
    
    return backup_folder


def backup_exists(backup_folder: Path) -> bool:
    """Check if a backup exists.
    
    Args:
        backup_folder: Path to backup folder
        
    Returns:
        True if backup exists and contains files
    """
    return backup_folder.exists() and any(backup_folder.iterdir())


def restore_backup(
    backup_folder: Path,
    target_folder: Path,
) -> bool:
    """Restore artifact folder from backup.
    
    Args:
        backup_folder: Source backup folder to restore from
        target_folder: Destination folder to restore to
        
    Returns:
        True if restore successful, False otherwise
        
    Note:
        This will completely replace the target folder with backup contents.
        Current target folder contents will be lost.
    """
    if not backup_exists(backup_folder):
        raise FileNotFoundError(f"Backup folder not found or empty: {backup_folder}")
    
    # Remove existing target folder if present
    if target_folder.exists():
        shutil.rmtree(target_folder)
    
    # Create parent directory
    target_folder.parent.mkdir(parents=True, exist_ok=True)
    
    # Copy backup to target
    shutil.copytree(backup_folder, target_folder)
    
    # Remove backup_info.json from restored folder (it's backup metadata)
    backup_info_path = target_folder / "backup_info.json"
    if backup_info_path.exists():
        backup_info_path.unlink()
    
    # Update metadata timestamp to reflect restoration
    metadata = read_metadata_file(target_folder)
    if metadata:
        metadata["last_restored"] = datetime.utcnow().isoformat()
        metadata["restored_from_backup"] = True
        create_metadata_file(target_folder, metadata)
    
    return True


def validate_artifact_folder(
    artifact_id: str,
    workspace_id: str,
    base_folder: str,
    artifact_type: str = "semantic-models",
) -> Path:
    """Validate that an artifact folder exists and is within the configured data directory.
    
    Args:
        artifact_id: Artifact ID
        workspace_id: Workspace ID
        base_folder: Base data folder path
        artifact_type: Type of artifact (default: 'semantic-models')
        
    Returns:
        Validated absolute Path object
        
    Raises:
        ValueError: If path is invalid or outside base folder
        FileNotFoundError: If folder doesn't exist
    """
    # Build expected path
    artifact_path = build_artifact_path(
        base_folder=base_folder,
        workspace_id=workspace_id,
        artifact_type=artifact_type,
        artifact_id=artifact_id,
    )
    
    # Resolve to absolute path
    artifact_path = artifact_path.resolve()
    base_path = Path(base_folder).resolve()
    
    # Security check: ensure path is within base folder (prevent path traversal)
    try:
        artifact_path.relative_to(base_path)
    except ValueError:
        raise ValueError(f"Invalid path: folder is outside configured data directory")
    
    # Check existence
    if not artifact_path.exists():
        raise FileNotFoundError(f"Artifact folder not found: {artifact_path}")
    
    if not artifact_path.is_dir():
        raise ValueError(f"Path is not a directory: {artifact_path}")
    
    return artifact_path


def validate_workspace_folder(
    workspace_id: str,
    base_folder: str,
    artifact_type: str = "semantic-models",
) -> Path:
    """Validate that a workspace folder exists and is within the configured data directory.
    
    Args:
        workspace_id: Workspace ID
        base_folder: Base data folder path
        artifact_type: Type of artifact (default: 'semantic-models')
        
    Returns:
        Validated absolute Path object to workspace's semantic-models folder
        
    Raises:
        ValueError: If path is invalid or outside base folder
        FileNotFoundError: If folder doesn't exist
    """
    # Build workspace semantic-models path
    workspace_path = Path(base_folder) / workspace_id / artifact_type
    
    # Resolve to absolute path
    workspace_path = workspace_path.resolve()
    base_path = Path(base_folder).resolve()
    
    # Security check: ensure path is within base folder
    try:
        workspace_path.relative_to(base_path)
    except ValueError:
        raise ValueError(f"Invalid path: folder is outside configured data directory")
    
    # Check existence
    if not workspace_path.exists():
        raise FileNotFoundError(f"Workspace folder not found: {workspace_path}")
    
    if not workspace_path.is_dir():
        raise ValueError(f"Path is not a directory: {workspace_path}")
    
    return workspace_path

