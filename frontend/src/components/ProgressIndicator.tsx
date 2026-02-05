import React from "react";

interface ProgressIndicatorProps {
  isLoading: boolean;
  message?: string;
  progress?: number;
  type?: "spinner" | "bar" | "dots";
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  isLoading,
  message = "Loading...",
  progress,
  type = "spinner",
}) => {
  if (!isLoading) {
    return null;
  }

  return (
    <div className="progress-indicator">
      {type === "spinner" && (
        <div className="spinner">
          <div className="spinner-circle"></div>
        </div>
      )}
      
      {type === "bar" && progress !== undefined && (
        <div className="progress-bar-container">
          <div className="progress-bar" style={{ width: `${progress}%` }}></div>
        </div>
      )}
      
      {type === "dots" && (
        <div className="loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      )}
      
      {message && <p className="progress-message">{message}</p>}
    </div>
  );
};

export { ProgressIndicator };
export default ProgressIndicator;
