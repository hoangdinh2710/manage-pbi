"""Application configuration management."""
import json
from pathlib import Path
from functools import lru_cache
from pydantic import Field, field_validator, BaseModel


# Path to settings JSON file
SETTINGS_FILE = Path(__file__).parent.parent.parent.parent / "config" / "settings.json"


def load_json_settings() -> dict:
    """Load settings from JSON file."""
    if SETTINGS_FILE.exists():
        with open(SETTINGS_FILE, 'r', encoding='utf-8-sig') as f:
            return json.load(f)
    return {}


def save_json_settings(settings_dict: dict) -> None:
    """Save settings to JSON file."""
    SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(SETTINGS_FILE, 'w', encoding='utf-8') as f:
        json.dump(settings_dict, f, indent=2, ensure_ascii=False)


class Settings(BaseModel):
    """Application settings loaded strictly from config/settings.json.

    NOTE: This class intentionally does not read environment variables.
    Settings should be managed via the Settings JSON file only.
    """

    app_name: str = Field(default="Power BI Web Manager")
    api_prefix: str = Field(default="/api")
    cors_origins: list[str] | str = Field(default="*")
    tenant_id: str = Field(default="")
    client_id: str = Field(default="")
    client_secret: str = Field(default="")
    authority_url: str = Field(default="https://login.microsoftonline.com")
    powerbi_scope: str = Field(
        default="https://analysis.windows.net/powerbi/api/.default",
        alias="POWERBI_SCOPE",
    )
    powerbi_api_base: str = Field(
        default="https://api.powerbi.com/v1.0/myorg",
        alias="POWERBI_API_BASE",
    )
    
    # File storage configuration
    data_folder: str = Field(default="../data")
    temp_folder: str = Field(default="../temp")
    
    # User-configurable file operations
    download_folder: str = Field(default="../downloads")
    output_naming_strategy: str = Field(default="model_name")  # "model_name" | "model_id"
    enable_auto_backup: bool = Field(default=True)
    backup_on_update: bool = Field(default=True)  # Create backup when replacing keywords
    backup_retention_days: int = Field(default=30)
    
    # Storage structure settings
    use_workspace_id_in_path: bool = Field(default=True)  # Use workspace ID vs name in paths
    store_artifact_metadata: bool = Field(default=True)  # Create metadata.json files
    semantic_models_folder_name: str = Field(default="semantic-models")
    reports_folder_name: str = Field(default="reports")
    backup_folder_name: str = Field(default="backup")  # Backup subfolder name
    
    # Performance & reliability settings
    http_timeout_seconds: int = Field(default=30)
    operation_max_retries: int = Field(default=30)
    operation_retry_delay_seconds: int = Field(default=5)
    rate_limit_max_retries: int = Field(default=5)
    rate_limit_initial_delay_seconds: int = Field(default=2)
    rate_limit_max_delay_seconds: int = Field(default=60)
    parallel_download_workers: int = Field(default=2)
    parallel_bulk_workers: int = Field(default=5)
    
    # API URLs (allow override for sovereign clouds)
    fabric_api_base: str = Field(
        default="https://api.fabric.microsoft.com/v1",
        alias="FABRIC_API_BASE"
    )
    
    # Logging configuration
    log_level: str = Field(default="INFO")
    log_file_path: str | None = Field(default=None)
    
    # Advanced settings
    file_encoding: str = Field(default="utf-8")
    definition_format: str = Field(default="TMDL")
    update_metadata_on_upload: bool = Field(default=True)
    cleanup_temp_files: bool = Field(default=True)

    def __init__(self, **kwargs):
        """Initialize settings, loading from JSON only.

        JSON settings are the single source of truth; environment variables
        will not be consulted.
        """
        json_settings = load_json_settings()
        merged = {**json_settings, **kwargs}
        super().__init__(**merged)

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value):
        """Parse CORS origins from string or list."""
        if value is None or value == "":
            return ["*"]  # Default to allow all origins
        if isinstance(value, str):
            # Handle comma-separated string
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        if isinstance(value, list):
            return value
        return ["*"]
    
    @field_validator("output_naming_strategy")
    @classmethod
    def validate_naming_strategy(cls, value):
        allowed = ["model_name", "model_id"]
        if value not in allowed:
            raise ValueError(f"output_naming_strategy must be one of {allowed}")
        return value
    
    @field_validator("log_level")
    @classmethod
    def validate_log_level(cls, value):
        allowed = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        value_upper = value.upper()
        if value_upper not in allowed:
            raise ValueError(f"log_level must be one of {allowed}")
        return value_upper
    
    @field_validator("definition_format")
    @classmethod
    def validate_definition_format(cls, value):
        allowed = ["TMDL", "TMSL"]
        value_upper = value.upper()
        if value_upper not in allowed:
            raise ValueError(f"definition_format must be one of {allowed}")
        return value_upper
    
    @field_validator("parallel_download_workers", "parallel_bulk_workers")
    @classmethod
    def validate_worker_count(cls, value):
        if value < 1 or value > 10:
            raise ValueError("Worker count must be between 1 and 10")
        return value
    
    @field_validator("http_timeout_seconds", "operation_retry_delay_seconds", 
                     "rate_limit_initial_delay_seconds", "rate_limit_max_delay_seconds")
    @classmethod
    def validate_positive_int(cls, value):
        if value < 1:
            raise ValueError("Timeout and delay values must be positive")
        return value
    
    def save_to_json(self, fields: list[str]) -> None:
        """Save specified fields back to JSON file."""
        current_json = load_json_settings()
        
        # Update only the specified fields
        for field in fields:
            if hasattr(self, field):
                current_json[field] = getattr(self, field)
        
        save_json_settings(current_json)
        
        # Clear cache so next call loads fresh data
        get_settings.cache_clear()


@lru_cache()
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()


def reload_settings() -> Settings:
    """Force reload settings from JSON (env ignored)."""
    get_settings.cache_clear()
    return get_settings()