import React from "react";

export interface Dataset {
  id: string;
  name: string;
  description?: string;
  configuredBy?: string;
  targetStorageMode?: string;
}

interface DatasetSelectorProps {
  datasets: Dataset[];
  selectedDatasetId: string | null;
  onDatasetSelect: (datasetId: string) => void;
  loading?: boolean;
  error?: string | null;
  multiSelect?: boolean;
  selectedDatasetIds?: string[];
}

const DatasetSelector: React.FC<DatasetSelectorProps> = ({
  datasets,
  selectedDatasetId,
  onDatasetSelect,
  loading = false,
  error = null,
  multiSelect = false,
  selectedDatasetIds = [],
}) => {
  if (loading) {
    return <div className="loading">Loading datasets...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (!datasets.length) {
    return <p>No datasets found for this workspace.</p>;
  }

  const isSelected = (datasetId: string) => {
    if (multiSelect) {
      return selectedDatasetIds.includes(datasetId);
    }
    return selectedDatasetId === datasetId;
  };

  return (
    <div className="dataset-selector">
      <h3>Select Dataset{multiSelect ? "s" : ""}</h3>
      <ul className="list">
        {datasets.map((dataset) => (
          <li key={dataset.id}>
            <button
              className={isSelected(dataset.id) ? "active" : ""}
              onClick={() => onDatasetSelect(dataset.id)}
            >
              {dataset.name}
              {dataset.description && (
                <span className="dataset-description">{dataset.description}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export { DatasetSelector };
export default DatasetSelector;
