import React from "react";
import Layout from "../components/Layout";
import WorkspaceList from "../components/WorkspaceList";
import DatasetList from "../components/DatasetList";
import ReportList from "../components/ReportList";
import { usePowerBI } from "../hooks/usePowerBI";

const Dashboard: React.FC = () => {
  const {
    workspaces,
    datasets,
    reports,
    selectedWorkspace,
    loading,
    error,
    fetchWorkspaceDetails
  } = usePowerBI();

  return (
    <Layout>
      <section>
        {loading && <p>Loading...</p>}
        {error && <p className="error">{error}</p>}
        <WorkspaceList
          workspaces={workspaces}
          selectedWorkspace={selectedWorkspace}
          onSelect={fetchWorkspaceDetails}
        />
      </section>
      <div className="details-grid">
        <DatasetList datasets={datasets} />
        <ReportList reports={reports} />
      </div>
    </Layout>
  );
};

export default Dashboard;
