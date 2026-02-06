import { useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  Search,
  KeyRound,
  Users,
  RefreshCcw,
  AlertCircle,
} from "lucide-react";
import { Button, Card, CardBody, CardHeader, Modal, ConfirmModal, Spinner } from "../components/ui";
import { useToast } from "../components/ui";
import { gatewayApi } from "../services/apiClient";
import type {
  GatewayDatasourcesResult,
  GatewayDatasource,
  CredentialDetailsInput,
  DatasourceUser,
} from "../types";

interface GatewayRow {
  id: string;
  value: string;
}

const defaultCredentialDetails: CredentialDetailsInput = {
  credentialType: "Basic",
  credentials: "",
  encryptedConnection: "Encrypted",
  encryptionAlgorithm: "RSA-OAEP",
  privacyLevel: "Private",
  useEndUserOAuth2Credentials: false,
};

const getDatasourceId = (datasource: GatewayDatasource) => {
  const raw =
    datasource.id ??
    (datasource as { datasourceId?: string }).datasourceId ??
    (datasource as { datasource_id?: string }).datasource_id;
  return raw ? String(raw) : "";
};

const getDatasourceName = (datasource: GatewayDatasource) => {
  return (
    datasource.name ??
    (datasource as { datasourceName?: string }).datasourceName ??
    (datasource as { datasource_name?: string }).datasource_name ??
    "Unnamed datasource"
  );
};

const getDatasourceType = (datasource: GatewayDatasource) => {
  return (
    datasource.datasourceType ??
    (datasource as { datasourceType?: string }).datasourceType ??
    (datasource as { datasource_type?: string }).datasource_type ??
    "-"
  );
};

const getConnectionDetails = (datasource: GatewayDatasource) => {
  const details =
    datasource.connectionDetails ??
    (datasource as { connection_details?: unknown }).connection_details ??
    "";
  if (!details) {
    return "-";
  }
  if (typeof details === "string") {
    return details;
  }
  try {
    return JSON.stringify(details);
  } catch {
    return String(details);
  }
};

const GatewayConnectionsPage = () => {
  const { success: showSuccess, error: showError, warning: showWarning } = useToast();
  const [gatewayRows, setGatewayRows] = useState<GatewayRow[]>([
    { id: "gateway-1", value: "" },
  ]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GatewayDatasourcesResult[]>([]);

  const [selectedDatasource, setSelectedDatasource] = useState<{
    gatewayId: string;
    datasource: GatewayDatasource;
  } | null>(null);
  const [credentialDetails, setCredentialDetails] = useState<CredentialDetailsInput>(
    defaultCredentialDetails
  );
  const [savingCredentials, setSavingCredentials] = useState(false);

  const [userModal, setUserModal] = useState<{
    gatewayId: string;
    datasourceId: string;
    datasourceName: string;
  } | null>(null);
  const [users, setUsers] = useState<DatasourceUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userAccessRight, setUserAccessRight] = useState("Read");
  const [addingUser, setAddingUser] = useState(false);
  const [removeCandidate, setRemoveCandidate] = useState<{
    gatewayId: string;
    datasourceId: string;
    email: string;
    displayName?: string;
  } | null>(null);
  const [removingUser, setRemovingUser] = useState(false);

  const uniqueGatewayIds = useMemo(() => {
    const ids = gatewayRows.map((row) => row.value.trim()).filter(Boolean);
    return Array.from(new Set(ids));
  }, [gatewayRows]);

  const handleAddRow = () => {
    setGatewayRows((prev) => [
      ...prev,
      { id: `gateway-${Date.now()}`, value: "" },
    ]);
  };

  const handleRemoveRow = (rowId: string) => {
    setGatewayRows((prev) => (prev.length === 1 ? prev : prev.filter((row) => row.id !== rowId)));
  };

  const handleRowChange = (rowId: string, value: string) => {
    setGatewayRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, value } : row))
    );
  };

  const fetchDatasources = async () => {
    if (uniqueGatewayIds.length === 0) {
      showWarning("Provide at least one Gateway ID.");
      return;
    }
    try {
      setLoading(true);
      const data = await gatewayApi.listDatasources(uniqueGatewayIds);
      setResults(data.gateways);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to load gateway datasources");
    } finally {
      setLoading(false);
    }
  };

  const openCredentialsModal = (gatewayId: string, datasource: GatewayDatasource) => {
    setSelectedDatasource({ gatewayId, datasource });
    setCredentialDetails({
      ...defaultCredentialDetails,
    });
  };

  const closeCredentialsModal = () => {
    setSelectedDatasource(null);
    setCredentialDetails(defaultCredentialDetails);
  };

  const handleSaveCredentials = async () => {
    if (!selectedDatasource) return;
    const datasourceId = getDatasourceId(selectedDatasource.datasource);
    if (!datasourceId) {
      showError("Datasource ID not found.");
      return;
    }
    try {
      setSavingCredentials(true);
      await gatewayApi.updateDatasourceCredentials(
        selectedDatasource.gatewayId,
        datasourceId,
        credentialDetails
      );
      showSuccess("Datasource credentials updated.");
      closeCredentialsModal();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to update credentials");
    } finally {
      setSavingCredentials(false);
    }
  };

  const openUsersModal = async (gatewayId: string, datasource: GatewayDatasource) => {
    const datasourceId = getDatasourceId(datasource);
    if (!datasourceId) {
      showError("Datasource ID not found.");
      return;
    }
    setUserModal({
      gatewayId,
      datasourceId,
      datasourceName: getDatasourceName(datasource),
    });
    setUsers([]);
    setUserEmail("");
    setUserAccessRight("Read");
    try {
      setUsersLoading(true);
      const data = await gatewayApi.listDatasourceUsers(gatewayId, datasourceId);
      setUsers(data);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to load datasource users");
    } finally {
      setUsersLoading(false);
    }
  };

  const closeUsersModal = () => {
    setUserModal(null);
    setUsers([]);
    setUserEmail("");
    setUserAccessRight("Read");
  };

  const handleAddUser = async () => {
    if (!userModal) return;
    const email = userEmail.trim();
    if (!email) {
      showWarning("Enter a user email.");
      return;
    }
    try {
      setAddingUser(true);
      await gatewayApi.addDatasourceUser(userModal.gatewayId, userModal.datasourceId, {
        email,
        access_right: userAccessRight,
      });
      const data = await gatewayApi.listDatasourceUsers(
        userModal.gatewayId,
        userModal.datasourceId
      );
      setUsers(data);
      setUserEmail("");
      showSuccess("User added.");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to add user");
    } finally {
      setAddingUser(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!removeCandidate) return;
    try {
      setRemovingUser(true);
      await gatewayApi.removeDatasourceUser(
        removeCandidate.gatewayId,
        removeCandidate.datasourceId,
        removeCandidate.email
      );
      if (userModal) {
        const data = await gatewayApi.listDatasourceUsers(
          userModal.gatewayId,
          userModal.datasourceId
        );
        setUsers(data);
      }
      showSuccess("User removed.");
      setRemoveCandidate(null);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to remove user");
    } finally {
      setRemovingUser(false);
    }
  };

  return (
    <div className="gateway-page">
      <div className="page-header">
        <h1>Gateway & Connections</h1>
        <p className="subtitle">Manage gateway datasources, credentials, and users</p>
      </div>

      <Card>
        <CardHeader
          title="Gateway IDs"
          subtitle="Add one or more Gateway IDs to fetch datasources"
          action={
            <Button variant="secondary" leftIcon={Plus} onClick={handleAddRow}>
              Add Gateway
            </Button>
          }
        />
        <CardBody>
          <div className="gateway-inputs">
            {gatewayRows.map((row, index) => (
              <div key={row.id} className="gateway-input-row">
                <input
                  type="text"
                  value={row.value}
                  onChange={(event) => handleRowChange(row.id, event.target.value)}
                  placeholder={`Gateway ID ${index + 1}`}
                />
                <Button
                  variant="ghost"
                  onClick={() => handleRemoveRow(row.id)}
                  disabled={gatewayRows.length === 1}
                  leftIcon={Trash2}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
          <div className="gateway-actions">
            <Button
              variant="primary"
              leftIcon={Search}
              loading={loading}
              onClick={fetchDatasources}
            >
              {loading ? "Fetching..." : "Fetch Datasources"}
            </Button>
            <Button
              variant="ghost"
              leftIcon={RefreshCcw}
              onClick={() => setResults([])}
              disabled={results.length === 0}
            >
              Clear Results
            </Button>
          </div>
        </CardBody>
      </Card>

      <div className="gateway-results">
        {loading && (
          <div className="loading-state">
            <Spinner size="lg" label="Loading gateway datasources..." />
          </div>
        )}

        {!loading && results.length === 0 && (
          <div className="empty-state">
            <AlertCircle size={20} />
            <span>No gateway datasources loaded yet.</span>
          </div>
        )}

        {results.map((gateway) => (
          <Card key={gateway.gateway_id} className="gateway-card">
            <CardHeader
              title={`Gateway ${gateway.gateway_id}`}
              subtitle={gateway.error ? "Failed to load datasources" : undefined}
            />
            <CardBody>
              {gateway.error && (
                <div className="error-state">
                  <AlertCircle size={18} className="error-state-icon" />
                  <div className="error-state-content">
                    <div className="error-state-message">{gateway.error}</div>
                  </div>
                </div>
              )}
              {!gateway.error && gateway.datasources.length === 0 && (
                <div className="empty-state">
                  <span>No datasources found for this gateway.</span>
                </div>
              )}
              {!gateway.error && gateway.datasources.length > 0 && (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Connection</th>
                        <th className="align-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gateway.datasources.map((datasource) => {
                        const datasourceId = getDatasourceId(datasource);
                        return (
                          <tr key={`${gateway.gateway_id}-${datasourceId || getDatasourceName(datasource)}`}>
                            <td>
                              <div className="datasource-name">
                                {getDatasourceName(datasource)}
                              </div>
                              {datasourceId && (
                                <div className="datasource-id">{datasourceId}</div>
                              )}
                            </td>
                            <td>{getDatasourceType(datasource)}</td>
                            <td>
                              <div className="datasource-connection">
                                {getConnectionDetails(datasource)}
                              </div>
                            </td>
                            <td className="align-right">
                              <div className="datasource-actions">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  leftIcon={KeyRound}
                                  onClick={() => openCredentialsModal(gateway.gateway_id, datasource)}
                                >
                                  Edit Credentials
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  leftIcon={Users}
                                  onClick={() => openUsersModal(gateway.gateway_id, datasource)}
                                >
                                  Users
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        ))}
      </div>

      <Modal
        isOpen={!!selectedDatasource}
        onClose={closeCredentialsModal}
        title="Update Datasource Credentials"
        size="lg"
        footer={
          <div className="modal-footer-actions">
            <Button variant="ghost" onClick={closeCredentialsModal} disabled={savingCredentials}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveCredentials}
              loading={savingCredentials}
            >
              {savingCredentials ? "Saving..." : "Save Credentials"}
            </Button>
          </div>
        }
      >
        {selectedDatasource && (
          <div className="credentials-form">
            <div className="form-grid">
              <div className="form-field">
                <label>Datasource</label>
                <input type="text" value={getDatasourceName(selectedDatasource.datasource)} readOnly />
              </div>
              <div className="form-field">
                <label>Datasource ID</label>
                <input type="text" value={getDatasourceId(selectedDatasource.datasource)} readOnly />
              </div>
              <div className="form-field">
                <label htmlFor="credentialType">Credential Type</label>
                <input
                  id="credentialType"
                  type="text"
                  value={credentialDetails.credentialType}
                  onChange={(event) =>
                    setCredentialDetails((prev) => ({
                      ...prev,
                      credentialType: event.target.value,
                    }))
                  }
                  placeholder="Basic, OAuth2, Key, Windows"
                />
              </div>
              <div className="form-field">
                <label htmlFor="privacyLevel">Privacy Level</label>
                <select
                  id="privacyLevel"
                  value={credentialDetails.privacyLevel || ""}
                  onChange={(event) =>
                    setCredentialDetails((prev) => ({
                      ...prev,
                      privacyLevel: event.target.value || undefined,
                    }))
                  }
                >
                  <option value="">(not set)</option>
                  <option value="None">None</option>
                  <option value="Public">Public</option>
                  <option value="Organizational">Organizational</option>
                  <option value="Private">Private</option>
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="encryptedConnection">Encrypted Connection</label>
                <select
                  id="encryptedConnection"
                  value={credentialDetails.encryptedConnection || ""}
                  onChange={(event) =>
                    setCredentialDetails((prev) => ({
                      ...prev,
                      encryptedConnection: event.target.value || undefined,
                    }))
                  }
                >
                  <option value="">(not set)</option>
                  <option value="Encrypted">Encrypted</option>
                  <option value="NotEncrypted">NotEncrypted</option>
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="encryptionAlgorithm">Encryption Algorithm</label>
                <input
                  id="encryptionAlgorithm"
                  type="text"
                  value={credentialDetails.encryptionAlgorithm || ""}
                  onChange={(event) =>
                    setCredentialDetails((prev) => ({
                      ...prev,
                      encryptionAlgorithm: event.target.value || undefined,
                    }))
                  }
                  placeholder="RSA-OAEP"
                />
              </div>
              <div className="form-field checkbox">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={credentialDetails.useEndUserOAuth2Credentials || false}
                    onChange={(event) =>
                      setCredentialDetails((prev) => ({
                        ...prev,
                        useEndUserOAuth2Credentials: event.target.checked,
                      }))
                    }
                  />
                  <span>Use end-user OAuth credentials</span>
                </label>
              </div>
            </div>
            <div className="form-field">
              <label htmlFor="credentialsJson">Credentials (JSON)</label>
              <textarea
                id="credentialsJson"
                rows={5}
                value={credentialDetails.credentials}
                onChange={(event) =>
                  setCredentialDetails((prev) => ({
                    ...prev,
                    credentials: event.target.value,
                  }))
                }
                placeholder='{"username":"user","password":"pass"}'
              />
              <span className="form-hint">
                Provide credentials JSON string required by the Power BI gateway API.
              </span>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!userModal}
        onClose={closeUsersModal}
        title="Datasource Users"
        size="lg"
      >
        {userModal && (
          <div className="datasource-users">
            <div className="datasource-users-header">
              <div>
                <div className="datasource-name">{userModal.datasourceName}</div>
                <div className="datasource-id">{userModal.datasourceId}</div>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="userEmail">User Email</label>
                <input
                  id="userEmail"
                  type="email"
                  value={userEmail}
                  onChange={(event) => setUserEmail(event.target.value)}
                  placeholder="user@company.com"
                />
              </div>
              <div className="form-field">
                <label htmlFor="accessRight">Access Right</label>
                <select
                  id="accessRight"
                  value={userAccessRight}
                  onChange={(event) => setUserAccessRight(event.target.value)}
                >
                  <option value="Read">Read</option>
                  <option value="ReadWrite">ReadWrite</option>
                </select>
              </div>
            </div>
            <div className="user-actions">
              <Button
                variant="primary"
                leftIcon={Plus}
                loading={addingUser}
                onClick={handleAddUser}
              >
                {addingUser ? "Adding..." : "Add User"}
              </Button>
            </div>

            <div className="datasource-users-list">
              {usersLoading ? (
                <Spinner size="md" label="Loading users..." />
              ) : users.length === 0 ? (
                <div className="empty-state">No users found for this datasource.</div>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Access</th>
                        <th className="align-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => {
                        const email = user.emailAddress || user.identifier || "unknown";
                        return (
                          <tr key={email}>
                            <td>
                              <div className="datasource-name">
                                {user.displayName || email}
                              </div>
                              <div className="datasource-id">{email}</div>
                            </td>
                            <td>{user.datasourceAccessRight || "-"}</td>
                            <td className="align-right">
                              <Button
                                variant="danger"
                                size="sm"
                                leftIcon={Trash2}
                                onClick={() =>
                                  setRemoveCandidate({
                                    gatewayId: userModal.gatewayId,
                                    datasourceId: userModal.datasourceId,
                                    email: String(user.emailAddress || ""),
                                    displayName: user.displayName || undefined,
                                  })
                                }
                                disabled={!user.emailAddress}
                              >
                                Remove
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={!!removeCandidate}
        onClose={() => setRemoveCandidate(null)}
        onConfirm={handleConfirmRemove}
        title="Remove user?"
        message={`Remove ${removeCandidate?.displayName || removeCandidate?.email} from this datasource?`}
        confirmLabel="Remove"
        variant="danger"
        loading={removingUser}
      />
    </div>
  );
};

export default GatewayConnectionsPage;
