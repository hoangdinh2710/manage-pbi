import React, { useState, useRef, useEffect } from 'react';
import './FilterPanel.css';

interface FilterPanelProps {
  filters: {
    workspace: string;
    status: string;
    type: string;
  };
  onChange: (filters: any) => void;
  workspaces: string[];
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  onChange,
  workspaces
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleFilterChange = (key: string, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  const hasActiveFilters = Object.values(filters).some(f => f !== 'all');

  const clearAllFilters = () => {
    onChange({ workspace: 'all', status: 'all', type: 'all' });
  };

  return (
    <div className="filter-panel" ref={dropdownRef}>
      <button
        className={`filter-btn ${hasActiveFilters ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <span className="filter-icon">⚙</span>
        <span>Filters</span>
        {hasActiveFilters && <span className="filter-badge">•</span>}
      </button>

      {isOpen && (
        <div className="filter-dropdown">
          <div className="filter-header">
            <h4>Filter Options</h4>
            {hasActiveFilters && (
              <button
                className="clear-filters-link"
                onClick={clearAllFilters}
                type="button"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="filter-group">
            <label htmlFor="status-filter">Status</label>
            <select
              id="status-filter"
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="retired">Retired</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="workspace-filter">Workspace</label>
            <select
              id="workspace-filter"
              value={filters.workspace}
              onChange={(e) => handleFilterChange('workspace', e.target.value)}
            >
              <option value="all">All Workspaces</option>
              {workspaces.map(ws => (
                <option key={ws} value={ws}>{ws}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="type-filter">Type</label>
            <select
              id="type-filter"
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="semantic-model">Semantic Model</option>
              <option value="report">Report</option>
              <option value="dashboard">Dashboard</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterPanel;
