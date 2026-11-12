import React, { useState, useEffect } from 'react';
import {
  Shield,
  Users,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Search,
  Check,
  X,
  RefreshCw,
  MapPin,
  Lock,
  Unlock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataStore } from '../../services/dataService';
import type { UserProfile, UserRole, EmergencyCase, ResourceRequest } from '../../types';

type CoordinatorResourceFilter = 'all' | 'hospital' | 'blood' | 'oxygen' | 'ambulance' | 'doctor';

const resourceGroups: { id: Exclude<CoordinatorResourceFilter, 'all'>; label: string; resourceTypes: ResourceRequest['resourceType'][] }[] = [
  { id: 'hospital', label: 'Hospital', resourceTypes: ['bed', 'icu'] },
  { id: 'blood', label: 'Blood', resourceTypes: ['blood'] },
  { id: 'oxygen', label: 'Oxygen', resourceTypes: ['oxygen'] },
  { id: 'ambulance', label: 'Ambulance', resourceTypes: ['ambulance'] },
  { id: 'doctor', label: 'Doctor', resourceTypes: ['doctor'] }
];

const formatDate = (date: string) => {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? 'Date unavailable' : parsed.toLocaleString();
};

export const AdminDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [cases, setCases] = useState<EmergencyCase[]>([]);
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [coordinatorLoading, setCoordinatorLoading] = useState(true);
  const [coordinatorError, setCoordinatorError] = useState<string | null>(null);
  const [coordinatorRefresh, setCoordinatorRefresh] = useState(0);
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [resourceFilter, setResourceFilter] = useState<CoordinatorResourceFilter>('all');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verifyingUid, setVerifyingUid] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin') {
      setCases([]);
      setRequests([]);
      setCoordinatorLoading(false);
      setCoordinatorError('Coordinator data requires an authenticated admin account.');
      return;
    }

    let receivedUsers = false;
    let receivedCases = false;
    let receivedRequests = false;
    setCoordinatorLoading(true);
    setCoordinatorError(null);
    const unsubscribe = dataStore.subscribeToCoordinatorCasesAndRequests(
      (records) => {
        setUsers(records);
        receivedUsers = true;
        if (receivedCases && receivedRequests) setCoordinatorLoading(false);
      },
      (records) => {
        setCases(records);
        receivedCases = true;
        if (receivedUsers && receivedRequests) setCoordinatorLoading(false);
      },
      (records) => {
        setRequests(records);
        receivedRequests = true;
        if (receivedUsers && receivedCases) setCoordinatorLoading(false);
      },
      (message) => {
        setCoordinatorError(message);
        setCoordinatorLoading(false);
      }
    );
    return unsubscribe;
  }, [currentUser?.uid, currentUser?.role, coordinatorRefresh]);

  const handleVerify = async (uid: string, verify: boolean) => {
    setSuccessMessage(null);
    setErrorMessage(null);
    setVerifyingUid(uid);
    try {
      await dataStore.verifyProvider(uid, verify);
      setSuccessMessage(verify ? 'Provider organization verified successfully.' : 'Verification revoked.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('[CareBridge Admin] Provider verification update failed:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Provider verification could not be updated.');
    } finally {
      setVerifyingUid(null);
    }
  };

  const handleToggleActive = async (uid: string, currentActive: boolean) => {
    setSuccessMessage(null);
    setErrorMessage(null);
    setVerifyingUid(uid);
    try {
      await dataStore.toggleUserActive(uid, !currentActive);
      setSuccessMessage(!currentActive ? 'Account activated.' : 'Account suspended.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('[CareBridge Admin] Account status update failed:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Account status could not be updated.');
    } finally {
      setVerifyingUid(null);
    }
  };

  const pendingVerificationProviders = users.filter(
    (u) => ['hospital', 'bloodBank', 'oxygenProvider', 'ambulanceProvider', 'doctor'].includes(u.role) && !u.isVerified
  );

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.city.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const activeCasesCount = cases.filter((c) => c.status === 'active').length;
  const pendingRequestsCount = requests.filter((r) => r.status === 'pending').length;
  const filteredCases = cases.filter((emergencyCase) => {
    const matchesPriority = priorityFilter === 'all' || emergencyCase.urgencyLevel === priorityFilter;
    const matchesStatus = statusFilter === 'all' || emergencyCase.status === statusFilter;
    const createdDate = emergencyCase.createdAt.slice(0, 10);
    const matchesFrom = !dateFromFilter || createdDate >= dateFromFilter;
    const matchesTo = !dateToFilter || createdDate <= dateToFilter;
    const matchesResource = resourceFilter === 'all' || requests.some((request) =>
      request.caseId === emergencyCase.caseId &&
      resourceGroups.find((group) => group.id === resourceFilter)?.resourceTypes.includes(request.resourceType)
    );
    return matchesPriority && matchesStatus && matchesFrom && matchesTo && matchesResource;
  });
  const providerCount = users.filter((u) =>
    ['hospital', 'bloodBank', 'oxygenProvider', 'ambulanceProvider'].includes(u.role)
  ).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center shrink-0 text-purple-600">
            <Shield className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Coordinator Admin Command</h1>
              <span className="text-[11px] font-semibold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-mono">
                System Oversight
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Live verification queue, user access control, and cross-facility resource health metrics.
            </p>
          </div>
        </div>

        <button
          onClick={() => setCoordinatorRefresh((value) => value + 1)}
          className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 self-end sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs font-semibold rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          {errorMessage}
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-slate-500 text-xs font-medium">Total Registered Users</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{users.length}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Across all 7 roles</div>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-slate-500 text-xs font-medium">Active Emergencies</div>
          <div className="text-2xl font-black text-red-600 mt-1">{activeCasesCount}</div>
          <div className="text-[11px] text-red-400 mt-0.5">Live coordination</div>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-slate-500 text-xs font-medium">Pending Requisitions</div>
          <div className="text-2xl font-black text-amber-600 mt-1">{pendingRequestsCount}</div>
          <div className="text-[11px] text-amber-500 mt-0.5">Awaiting provider action</div>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-slate-500 text-xs font-medium">Verified Providers</div>
          <div className="text-2xl font-black text-teal-600 mt-1">{providerCount}</div>
          <div className="text-[11px] text-teal-500 mt-0.5">Hospitals, Banks, Oxygen, Fleet</div>
        </div>
      </div>

      <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col gap-1 border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-red-600" /> Central Emergency Coordination
          </h2>
          <p className="text-xs text-slate-500">Live emergency cases and linked resource requests from Firestore.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          <select aria-label="Filter by priority" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg">
            <option value="all">All priorities</option>
            {Array.from(new Set(cases.map((record) => record.urgencyLevel))).filter(Boolean).map((priority) => (
              <option key={priority} value={priority}>{priority}</option>
            ))}
          </select>
          <select aria-label="Filter by emergency status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg">
            <option value="all">All statuses</option>
            {Array.from(new Set(cases.map((record) => record.status))).filter(Boolean).map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <select aria-label="Filter by resource type" value={resourceFilter} onChange={(event) => setResourceFilter(event.target.value as CoordinatorResourceFilter)} className="text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg">
            <option value="all">All resource types</option>
            {resourceGroups.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}
          </select>
          <label className="text-[11px] text-slate-500">
            From
            <input aria-label="Filter emergencies from date" type="date" value={dateFromFilter} onChange={(event) => setDateFromFilter(event.target.value)} className="block w-full text-xs p-1.5 bg-slate-50 border border-slate-200 rounded-lg" />
          </label>
          <label className="text-[11px] text-slate-500">
            To
            <input aria-label="Filter emergencies through date" type="date" value={dateToFilter} onChange={(event) => setDateToFilter(event.target.value)} className="block w-full text-xs p-1.5 bg-slate-50 border border-slate-200 rounded-lg" />
          </label>
        </div>

        {coordinatorError && (
          <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {coordinatorError}
          </div>
        )}
        {coordinatorLoading ? (
          <div className="py-8 text-center text-slate-500 text-sm">Loading Firestore emergency data...</div>
        ) : !coordinatorError && filteredCases.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">
            {cases.length === 0 ? 'No emergency cases are currently available.' : 'No cases match the selected filters.'}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCases.map((emergencyCase) => {
              const caseRequests = requests.filter((request) => request.caseId === emergencyCase.caseId);
              const groups = resourceFilter === 'all'
                ? resourceGroups
                : resourceGroups.filter((group) => group.id === resourceFilter);
              return (
                <article key={emergencyCase.caseId} className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="p-4 bg-slate-50/70 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">Emergency ID</div>
                      <div className="text-xs font-bold font-mono text-slate-900">{emergencyCase.caseId}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">Patient</div>
                      <div className="text-xs font-semibold text-slate-900">{emergencyCase.patientName || 'Patient details unavailable'}</div>
                      <div className="text-[11px] text-slate-500">
                        {[emergencyCase.patientAge && `${emergencyCase.patientAge} years`, emergencyCase.patientGender].filter(Boolean).join(' · ') || 'Details unavailable'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">{emergencyCase.patientUid}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">Category / Priority</div>
                      <div className="text-xs font-semibold text-slate-800">{emergencyCase.conditionSummary || 'Unspecified'} · {emergencyCase.urgencyLevel || 'Unspecified'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">Status / Created</div>
                      <div className="text-xs font-semibold capitalize text-slate-800">{emergencyCase.status}</div>
                      <div className="text-[11px] text-slate-500">{formatDate(emergencyCase.createdAt)}</div>
                    </div>
                    <div className="sm:col-span-2 lg:col-span-4 flex items-start gap-1.5 text-xs text-slate-600">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      {emergencyCase.location?.address || emergencyCase.location?.city || 'Location unavailable'}
                    </div>
                    <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setExpandedCaseId((current) => current === emergencyCase.caseId ? null : emergencyCase.caseId)}
                        aria-expanded={expandedCaseId === emergencyCase.caseId}
                        className="text-xs font-semibold text-purple-700 hover:text-purple-900"
                      >
                        {expandedCaseId === emergencyCase.caseId ? 'Hide emergency details' : 'Open emergency details'}
                      </button>
                    </div>
                  </div>

                  {expandedCaseId === emergencyCase.caseId && (
                    <div className="px-4 py-3 bg-purple-50/50 border-t border-purple-100 grid sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-400">Emergency description</div>
                        <p className="text-slate-700 mt-1">{emergencyCase.conditionSummary || 'No description provided.'}</p>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-400">Resources requested</div>
                        <p className="text-slate-700 mt-1">{emergencyCase.resourcesNeeded?.join(', ') || 'None specified'}</p>
                      </div>
                      {emergencyCase.attendant && (
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-slate-400">Attendant</div>
                          <p className="text-slate-700 mt-1">{emergencyCase.attendant.name} ({emergencyCase.attendant.relation}) · {emergencyCase.attendant.phone}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="p-4 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">Resource requests</h3>
                    {groups.map((group) => {
                      const groupRequests = caseRequests.filter((request) => group.resourceTypes.includes(request.resourceType));
                      return (
                        <div key={group.id} className="rounded-lg border border-slate-100">
                          <div className="px-3 py-2 bg-slate-50 text-xs font-bold text-slate-700">
                            {group.label} <span className="text-slate-400 font-medium">({groupRequests.length})</span>
                          </div>
                          {groupRequests.length === 0 ? (
                            <div className="px-3 py-2 text-[11px] text-slate-400">No {group.label.toLowerCase()} request for this case.</div>
                          ) : (
                            <div className="divide-y divide-slate-100">
                              {groupRequests.map((request) => (
                                <div key={request.requestId} className="px-3 py-2 grid sm:grid-cols-4 gap-2 text-[11px]">
                                  <div><span className="text-slate-400">Provider: </span><span className="font-semibold text-slate-700">{request.providerName || request.providerUid || 'Unassigned'}</span></div>
                                  <div><span className="text-slate-400">Type: </span><span className="text-slate-700 capitalize">{request.resourceType}</span></div>
                                  <div><span className="text-slate-400">Status: </span><span className="text-slate-700 capitalize">{request.status}</span></div>
                                  <div><span className="text-slate-400">Updated: </span><span className="text-slate-700">{request.updatedAt ? formatDate(request.updatedAt) : 'Not recorded'}</span></div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Provider Verification Queue (Task 16 Requirement) */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-600" /> Provider Verification Queue
              {pendingVerificationProviders.length > 0 && (
                <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {pendingVerificationProviders.length} Pending
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500">
              Healthcare providers require coordinator approval prior to accepting emergency dispatches.
            </p>
          </div>
        </div>

        {pendingVerificationProviders.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-xs">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1 opacity-70" />
            Verification queue clear. All active healthcare providers have been authenticated.
          </div>
        ) : (
          <div className="space-y-3">
            {pendingVerificationProviders.map((prov) => (
              <div
                key={prov.uid}
                className="p-4 rounded-xl border border-amber-200 bg-amber-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">{prov.displayName}</span>
                    <span className="text-[11px] uppercase font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                      {prov.role}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
                    <span>Email: {prov.email}</span>
                    <span>City: {prov.city}, {prov.state}</span>
                    <span>Phone: {prov.phone || 'N/A'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void handleVerify(prov.uid, false)}
                    disabled={verifyingUid === prov.uid}
                    className="px-3.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 rounded-lg border border-red-200"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => void handleVerify(prov.uid, true)}
                    disabled={verifyingUid === prov.uid}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-lg shadow-xs flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" /> Approve & Verify
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User Management Directory (Task 16 Requirement) */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-slate-700" /> User & Provider Directory
            </h2>
            <p className="text-xs text-slate-500">
              Inspect user roles, verification credentials, and toggle account activation.
            </p>
          </div>

          {/* Search & Role Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search user or city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg w-48 sm:w-60"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="text-xs p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
            >
              <option value="all">All Roles</option>
              <option value="patient">Patient</option>
              <option value="hospital">Hospital</option>
              <option value="bloodBank">Blood Bank</option>
              <option value="oxygenProvider">Oxygen</option>
              <option value="ambulanceProvider">Ambulance</option>
              <option value="doctor">Doctor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3">User / Provider</th>
                <th className="p-3">Role</th>
                <th className="p-3">Location</th>
                <th className="p-3">Verification</th>
                <th className="p-3">Account Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((u) => (
                <tr key={u.uid} className="hover:bg-slate-50/60">
                  <td className="p-3">
                    <div className="font-bold text-slate-900">{u.displayName}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                  </td>
                  <td className="p-3">
                    <span className="font-semibold text-slate-700 capitalize">{u.role}</span>
                  </td>
                  <td className="p-3 text-slate-600">
                    {u.city}, {u.state}
                  </td>
                  <td className="p-3">
                    {u.isVerified ? (
                      <div className="inline-flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                          <CheckCircle2 className="w-3 h-3" /> Verified
                        </span>
                        {['hospital', 'bloodBank', 'oxygenProvider', 'ambulanceProvider', 'doctor'].includes(u.role) && (
                          <button
                            onClick={() => void handleVerify(u.uid, false)}
                            disabled={verifyingUid === u.uid}
                            className="text-[11px] font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => void handleVerify(u.uid, true)}
                        disabled={verifyingUid === u.uid}
                        className="text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded"
                      >
                        Pending (Verify)
                      </button>
                    )}
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-[11px] ${
                        u.isActive ? 'text-slate-800 bg-slate-100' : 'text-red-700 bg-red-100'
                      }`}
                    >
                      {u.isActive ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => void handleToggleActive(u.uid, u.isActive)}
                      disabled={verifyingUid === u.uid}
                      className={`p-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
                        u.isActive
                          ? 'text-red-600 hover:bg-red-50'
                          : 'text-emerald-600 hover:bg-emerald-50'
                      }`}
                      title={u.isActive ? 'Suspend User' : 'Activate User'}
                    >
                      {u.isActive ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
