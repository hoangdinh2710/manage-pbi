import React from 'react';
import './MetadataCard.css';

interface MetadataCardProps {
  metadata: {
    workspace_id: string;
    workspace_name: string;
    artifact_id: string;
    artifact_name: string;
    artifact_type: string;
    download_timestamp: string;
    last_updated: string;
    definition_format?: string;
    files_count: number;
  };
  onClick?: () => void;
}

export const MetadataCard: React.FC<MetadataCardProps> = ({ metadata, onClick }) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  const extractStatus = (name: string): string[] => {
    const statusMatch = name.match(/\[(.*?)\]/g);
    return statusMatch || [];
  };

  const cleanName = (name: string) => {
    return name.replace(/\[.*?\]/g, '').trim();
  };

  const getBadgeClass = (status: string): string => {
    const lower = status.toLowerCase();
    if (lower.includes('retired')) return 'badge-danger';
    if (lower.includes('deprecated')) return 'badge-warning';
    if (lower.includes('active')) return 'badge-success';
    return 'badge-info';
  };

  const statuses = extractStatus(metadata.artifact_name);
  const displayName = cleanName(metadata.artifact_name);

  return (
    <div className="metadata-card" onClick={onClick} role={onClick ? 'button' : undefined}>
      <div className="metadata-header">
        <div className="metadata-icon">
          {metadata.artifact_type === 'semantic-model' ? '📊' : '📄'}
        </div>
        <div className="metadata-title">
          <h3 title={displayName}>{displayName}</h3>
          {statuses.length > 0 && (
            <div className="metadata-badges">
              {statuses.map((status, idx) => (
                <span 
                  key={idx} 
                  className={`badge ${getBadgeClass(status)}`}
                >
                  {status.replace(/[\[\]]/g, '')}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="metadata-body">
        <div className="metadata-row">
          <span className="metadata-label">Workspace</span>
          <span className="metadata-value" title={metadata.workspace_name}>
            {metadata.workspace_name}
          </span>
        </div>
        
        {metadata.definition_format && (
          <div className="metadata-row">
            <span className="metadata-label">Format</span>
            <span className="metadata-value">{metadata.definition_format}</span>
          </div>
        )}
        
        <div className="metadata-row">
          <span className="metadata-label">Files</span>
          <span className="metadata-value">
            {metadata.files_count} {metadata.files_count === 1 ? 'file' : 'files'}
          </span>
        </div>
        
        <div className="metadata-row">
          <span className="metadata-label">Downloaded</span>
          <span className="metadata-value" title={formatDate(metadata.download_timestamp)}>
            {formatRelativeTime(metadata.download_timestamp)}
          </span>
        </div>
        
        <div className="metadata-row">
          <span className="metadata-label">Updated</span>
          <span className="metadata-value" title={formatDate(metadata.last_updated)}>
            {formatRelativeTime(metadata.last_updated)}
          </span>
        </div>
      </div>

      <div className="metadata-footer">
        <button className="metadata-action-btn" onClick={(e) => { e.stopPropagation(); }}>
          <span>📋</span> Copy ID
        </button>
        <button className="metadata-action-btn" onClick={(e) => { e.stopPropagation(); }}>
          <span>📁</span> Open Folder
        </button>
      </div>
    </div>
  );
};

export default MetadataCard;
