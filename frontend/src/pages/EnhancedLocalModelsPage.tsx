import React, { useState, useEffect } from 'react';
import { artifactsApi } from '../services/apiClient';
import MetadataCard from '../components/MetadataCard';
import SearchBar from '../components/SearchBar';
import FilterPanel from '../components/FilterPanel';
import type { LocalWorkspace, LocalSemanticModel } from '../types';
import './EnhancedLocalModelsPage.css';

interface ModelMetadata {
  workspace_id: string;
  workspace_name: string;
  artifact_id: string;
  artifact_name: string;
  artifact_type: string;
  download_timestamp: string;
  last_updated: string;
  definition_format?: string;
  files_count: number;
}

const EnhancedLocalModelsPage: React.FC = () => {
  const [models, setModels] = useState<ModelMetadata[]>([]);
  const [filteredModels, setFilteredModels] = useState<ModelMetadata[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    workspace: 'all',
    status: 'all',
    type: 'all'
  });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadModels();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, filters, models]);

  const loadModels = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await artifactsApi.getLocalModels();
      
      const allModels: ModelMetadata[] = [];
      (data.workspaces || []).forEach((ws: LocalWorkspace) => {
        ws.semantic_models.forEach((model: LocalSemanticModel) => {
          allModels.push({
            workspace_id: ws.workspace_id,
            workspace_name: ws.workspace_name,
            artifact_id: model.artifact_id,
            artifact_name: model.artifact_name,
            artifact_type: 'semantic-model',
            download_timestamp: model.download_date || new Date().toISOString(),
            last_updated: model.last_updated || model.download_date || new Date().toISOString(),
            definition_format: model.definition_format || 'TMDL',
            files_count: model.file_count || 0
          });
        });
      });
      
      setModels(allModels);
    } catch (err: any) {
      setError(err.message || 'Failed to load local models');
      console.error('Error loading models:', err);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...models];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(model =>
        model.artifact_name.toLowerCase().includes(term) ||
        model.workspace_name.toLowerCase().includes(term)
      );
    }

    if (filters.status !== 'all') {
      filtered = filtered.filter(model => {
        const isRetired = model.artifact_name.toLowerCase().includes('[retired]');
        return filters.status === 'retired' ? isRetired : !isRetired;
      });
    }

    if (filters.workspace !== 'all') {
      filtered = filtered.filter(model => model.workspace_name === filters.workspace);
    }

    if (filters.type !== 'all') {
      filtered = filtered.filter(model => model.artifact_type === filters.type);
    }

    setFilteredModels(filtered);
  };

  const getUniqueWorkspaces = () => {
    return [...new Set(models.map(m => m.workspace_name))].sort();
  };

  const stats = {
    total: models.length,
    active: models.filter(m => !m.artifact_name.toLowerCase().includes('[retired]')).length,
    retired: models.filter(m => m.artifact_name.toLowerCase().includes('[retired]')).length,
    workspaces: getUniqueWorkspaces().length
  };

  if (loading) {
    return (
      <div className="enhanced-local-models-page">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading local models...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="enhanced-local-models-page">
        <div className="error-state">
          <div className="error-icon">⚠️</div>
          <h3>Error Loading Models</h3>
          <p>{error}</p>
          <button onClick={loadModels} className="retry-btn">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="enhanced-local-models-page">
      <div className="page-header">
        <div className="header-content">
          <h1>Local Models</h1>
          <p className="subtitle">Manage your downloaded Power BI semantic models</p>
        </div>
        <button onClick={loadModels} className="refresh-btn" aria-label="Refresh">
          🔄 Refresh
        </button>
      </div>

      <div className="stats-bar">
        <div className="stat-card stat-primary">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Models</div>
        </div>
        <div className="stat-card stat-success">
          <div className="stat-value">{stats.active}</div>
          <div className="stat-label">Active</div>
        </div>
        <div className="stat-card stat-warning">
          <div className="stat-value">{stats.retired}</div>
          <div className="stat-label">Retired</div>
        </div>
        <div className="stat-card stat-info">
          <div className="stat-value">{stats.workspaces}</div>
          <div className="stat-label">Workspaces</div>
        </div>
      </div>

      <div className="toolbar">
        <SearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search models or workspaces..."
        />
        
        <div className="toolbar-actions">
          <FilterPanel
            filters={filters}
            onChange={setFilters}
            workspaces={getUniqueWorkspaces()}
          />
          
          <div className="view-toggle">
            <button
              className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
              type="button"
            >
              ⊞
            </button>
            <button
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              aria-label="List view"
              type="button"
            >
              ☰
            </button>
          </div>
        </div>
      </div>

      <div className="results-info">
        Showing {filteredModels.length} of {models.length} models
      </div>

      <div className={`models-container ${viewMode}`}>
        {filteredModels.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h3>No models found</h3>
            <p>
              {models.length === 0 
                ? 'You have no local models. Download some from the Download page.'
                : 'Try adjusting your search or filters'}
            </p>
          </div>
        ) : (
          filteredModels.map(model => (
            <MetadataCard 
              key={model.artifact_id} 
              metadata={model}
              onClick={() => console.log('Clicked:', model.artifact_name)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default EnhancedLocalModelsPage;
