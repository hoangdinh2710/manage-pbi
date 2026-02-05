"""Flask application entrypoint."""
from flask import Flask
from flask_cors import CORS
from flasgger import Swagger
from .core.config import get_settings
from .api import routes


def create_app() -> Flask:
    """Create and configure Flask application."""
    settings = get_settings()
    app = Flask(__name__)
    
    # Configure CORS
    if settings.cors_origins:
        CORS(app, origins=settings.cors_origins)
    else:
        CORS(app)
    
    # Configure Swagger/OpenAPI documentation
    swagger_config = {
        "headers": [],
        "specs": [
            {
                "endpoint": "apispec",
                "route": "/apispec.json",
                "rule_filter": lambda rule: True,
                "model_filter": lambda tag: True,
            }
        ],
        "static_url_path": "/flasgger_static",
        "swagger_ui": True,
        "specs_route": "/docs"
    }
    
    swagger_template = {
        "swagger": "2.0",
        "info": {
            "title": settings.app_name,
            "description": "Power BI Semantic Model Management API",
            "version": "1.0.0"
        },
        "basePath": settings.api_prefix,
        "schemes": ["http", "https"],
    }
    
    Swagger(app, config=swagger_config, template=swagger_template)
    
    # Register blueprints
    app.register_blueprint(routes.bp, url_prefix=settings.api_prefix)
    
    return app


app = create_app()
