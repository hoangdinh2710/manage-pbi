import React from "react";
import { Link } from "react-router-dom";

const UpdatePage: React.FC = () => {
  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <div
        style={{
          padding: "2rem",
          backgroundColor: "#fff4ce",
          borderRadius: "8px",
          border: "2px solid #f1c232",
          maxWidth: "600px",
          margin: "2rem auto",
        }}
      >
        <h2 style={{ marginTop: 0 }}>⚠️ Page Deprecated</h2>
        <p style={{ fontSize: "1.1rem" }}>
          The Update Keywords functionality has been consolidated into the <strong>Local Models</strong> page.
        </p>
        <p>
          You can now update keywords for multiple models at once from the Local Models page with
          progress tracking, preset support, and automatic backups.
        </p>
        <Link
          to="/local-models"
          style={{
            display: "inline-block",
            marginTop: "1rem",
            padding: "0.75rem 1.5rem",
            backgroundColor: "#0078d4",
            color: "white",
            textDecoration: "none",
            borderRadius: "4px",
            fontWeight: "bold",
          }}
        >
          Go to Local Models →
        </Link>
      </div>
    </div>
  );
};

export default UpdatePage;

// Old implementation below (preserved for reference)
/*
import React, { useState } from "react";
  const [models, setModels] = useState<LoadedModel[]>([]);
  const [rules, setRules] = useState<ReplacementRule[]>([]);
  const [newRuleKeyword, setNewRuleKeyword] = useState("");
  const [newRuleReplacement, setNewRuleReplacement] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<ProcessResult[]>([]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setModels((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${file.name}`,
            name: file.name,
            content,
          },
        ]);
      };
      reader.readAsText(file);
    });
  };

  const addRule = () => {
    if (!newRuleKeyword) return;

    const newRule: ReplacementRule = {
      id: Date.now().toString(),
      keyword: newRuleKeyword,
      replacement: newRuleReplacement,
      caseSensitive,
      columns: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setRules([...rules, newRule]);
    setNewRuleKeyword("");
    setNewRuleReplacement("");
  };

  const removeRule = (ruleId: string) => {
    setRules(rules.filter((r) => r.id !== ruleId));
  };

  const removeModel = (modelId: string) => {
    setModels(models.filter((m) => m.id !== modelId));
  };

  const applyRules = () => {
    if (models.length === 0 || rules.length === 0) {
      return;
    }

    setProcessing(true);
    
    // Simple replacement logic
    const processedResults = models.map((model) => {
      let modifiedContent = model.content;
      let totalReplacements = 0;

      rules.forEach((rule) => {
        const flags = rule.caseSensitive ? "g" : "gi";
        const regex = new RegExp(rule.keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags);
        const matches = modifiedContent.match(regex);
        if (matches) {
          totalReplacements += matches.length;
          modifiedContent = modifiedContent.replace(regex, rule.replacement);
        }
      });

      return {
        modelName: model.name,
        totalReplacements,
        modifiedContent,
      };
    });

    setResults(processedResults);
    setProcessing(false);
  };

  const downloadModifiedModel = (modelName: string, index: number) => {
    const result = results[index];
    if (!result) return;

    const blob = new Blob([result.modifiedContent], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `modified_${modelName}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="update-page">
      <h1>Update Semantic Models</h1>
      <p className="subtitle">Load models and apply bulk keyword replacements</p>

      <div className="update-container">
        {/* File Upload Section */}
        <section className="panel">
          <h2>1. Load Models</h2>
          <div className="upload-section">
            <input
              type="file"
              id="model-upload"
              accept=".json,.txt,.bim"
              multiple
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
            <label htmlFor="model-upload" className="btn btn-secondary">
              Select Model Files
            </label>
            <p className="help-text">Select JSON, TXT, or BIM files</p>
          </div>

          {models.length > 0 && (
            <div className="models-list">
              <h3>Loaded Models ({models.length})</h3>
              <ul className="list">
                {models.map((model) => (
                  <li key={model.id}>
                    <span>{model.name}</span>
                    <button
                      className="btn btn-small btn-danger"
                      onClick={() => removeModel(model.id)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Rules Section */}
        <section className="panel">
          <h2>2. Define Replacement Rules</h2>
          <div className="rule-builder">
            <div className="form-group">
              <label>Keyword to Replace</label>
              <input
                type="text"
                value={newRuleKeyword}
                onChange={(e) => setNewRuleKeyword(e.target.value)}
                placeholder="Enter keyword"
                className="input"
              />
            </div>

            <div className="form-group">
              <label>Replacement Value</label>
              <input
                type="text"
                value={newRuleReplacement}
                onChange={(e) => setNewRuleReplacement(e.target.value)}
                placeholder="Enter replacement"
                className="input"
              />
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={caseSensitive}
                  onChange={(e) => setCaseSensitive(e.target.checked)}
                />
                Case Sensitive
              </label>
            </div>

            <button
              className="btn btn-primary"
              onClick={addRule}
              disabled={!newRuleKeyword}
            >
              Add Rule
            </button>
          </div>

          {rules.length > 0 && (
            <div className="rules-list">
              <h3>Active Rules ({rules.length})</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Keyword</th>
                    <th>Replacement</th>
                    <th>Case Sensitive</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={rule.id}>
                      <td><code>{rule.keyword}</code></td>
                      <td><code>{rule.replacement}</code></td>
                      <td>{rule.caseSensitive ? "Yes" : "No"}</td>
                      <td>
                        <button
                          className="btn btn-small btn-danger"
                          onClick={() => removeRule(rule.id)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Apply Rules Section */}
        <section className="panel">
          <h2>3. Apply Rules</h2>
          <button
            className="btn btn-success"
            onClick={applyRules}
            disabled={models.length === 0 || rules.length === 0 || processing}
          >
            {processing ? "Processing..." : "Apply Rules to All Models"}
          </button>

          {results.length > 0 && (
            <div className="results-section">
              <h3>Results</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Replacements</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result, index) => (
                    <tr key={index}>
                      <td>{result.modelName}</td>
                      <td>{result.totalReplacements} replacements</td>
                      <td>
                        <button
                          className="btn btn-small btn-primary"
                          onClick={() => downloadModifiedModel(result.modelName, index)}
                        >
                          Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default UpdatePage;
