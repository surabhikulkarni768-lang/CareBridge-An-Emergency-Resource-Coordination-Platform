import React, { useState, useEffect } from 'react';
import {
  Shield,
  Users,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Building2,
  Filter,
  Search,
  Check,
  X,
  RefreshCw,
  MapPin,
  Lock,
  Unlock,
  Truck,
  Droplet,
  Wind,
  Bed,
  FileText,
  ChevronRight,
  ExternalLink,
  Sliders,
  Send
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataStore } from '../../services/dataService';
import type {
  UserProfile,
  EmergencyCase,
  ResourceRequest,
  HospitalProfile,
  BloodBankProfile,
  OxygenProfile,
  AmbulanceProfile,
  CaseStatus,
  EmergencyPriority,
  ResourceAssignmentAudit
} from '../../types';
import type { EligibleResourceProvider } from '../../services/dataService';

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
  const [activeTab, setActiveTab] = useState<'emergencies' | 'providers' | 'users' | 'analytics' | 'coordinator'>('emergencies');

  // Core Data
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [cases, setCases] = useState<EmergencyCase[]>([]);
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [hospitals, setHospitals] = useState<HospitalProfile[]>([]);
  const [bloodBanks, setBloodBanks] = useState<BloodBankProfile[]>([]);
  const [oxygenDepots, setOxygenDepots] = useState<OxygenProfile[]>([]);
  const [ambulances, setAmbulances] = useState<AmbulanceProfile[]>([]);
  const [coordinatorCases, setCoordinatorCases] = useState<EmergencyCase[]>([]);
  const [coordinatorRequests, setCoordinatorRequests] = useState<ResourceRequest[]>([]);
  const [coordinatorLoading, setCoordinatorLoading] = useState(true);
  const [coordinatorError, setCoordinatorError] = useState<string | null>(null);
  const [coordinatorRefresh, setCoordinatorRefresh] = useState(0);
  const [coordinatorPriorityFilter, setCoordinatorPriorityFilter] = useState('all');
  const [coordinatorStatusFilter, setCoordinatorStatusFilter] = useState('all');
  const [resourceFilter, setResourceFilter] = useState<CoordinatorResourceFilter>('all');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verifyingUid, setVerifyingUid] = useState<string | null>(null);
  const [assignmentRequest, setAssignmentRequest] = useState<ResourceRequest | null>(null);
  const [eligibleAssignmentProviders, setEligibleAssignmentProviders] = useState<EligibleResourceProvider[]>([]);
  const [selectedAssignmentProviderUid, setSelectedAssignmentProviderUid] = useState('');
  const [assignmentReason, setAssignmentReason] = useState('');
  const [assignmentHistory, setAssignmentHistory] = useState<ResourceAssignmentAudit[]>([]);
  const [isLoadingAssignment, setIsLoadingAssignment] = useState(false);
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);

  // Selected Case for Details & Assignment Modal
  const [selectedCase, setSelectedCase] = useState<EmergencyCase | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // Assignment Drawer selections
  const [assignHospitalId, setAssignHospitalId] = useState('');
  const [assignBloodBankId, setAssignBloodBankId] = useState('');
  const [assignOxygenId, setAssignOxygenId] = useState('');
  const [assignAmbulanceId, setAssignAmbulanceId] = useState('');
  const [assignNote, setAssignNote] = useState('');
  const [isSubmittingAssignment, setIsSubmittingAssignment] = useState(false);

  const loadData = () => {
    setUsers(dataStore.getUsers());
    setCases(dataStore.getCases());
    setRequests(dataStore.getRequests());
    setHospitals(dataStore.getAllHospitalProfiles());
    setBloodBanks(dataStore.getAllBloodBankProfiles());
    setOxygenDepots(dataStore.getAllOxygenProfiles());
    setAmbulances(dataStore.getAllAmbulanceProfiles());
  };

  useEffect(() => {
    loadData();
    const unsubscribeLocal = dataStore.subscribe(loadData);
    if (!currentUser || currentUser.role !== 'admin') {
      setCoordinatorCases([]);
      setCoordinatorRequests([]);
      setCoordinatorLoading(false);
      setCoordinatorError('Coordinator data requires an authenticated admin account.');
      return unsubscribeLocal;
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
        setCoordinatorCases(records);
        receivedCases = true;
        if (receivedUsers && receivedRequests) setCoordinatorLoading(false);
      },
      (records) => {
        setCoordinatorRequests(records);
        receivedRequests = true;
        if (receivedUsers && receivedCases) setCoordinatorLoading(false);
      },
      (message) => {
        setCoordinatorError(message);
        setCoordinatorLoading(false);
      }
    );
    return () => {
      unsubscribe();
      unsubscribeLocal();
    };
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

  // Open assignment drawer for an emergency case
  const handleOpenAssignment = (c: EmergencyCase) => {
    setActiveTab('coordinator');
    setExpandedCaseId(c.caseId);
  };

  const openRequestAssignment = (request: ResourceRequest) => {
    setAssignmentRequest(request);
    setSelectedAssignmentProviderUid('');
    setAssignmentReason('');
    setAssignmentHistory([]);
    setAssignmentError(null);
  };

  useEffect(() => {
    if (!assignmentRequest) return;
    let active = true;
    setIsLoadingAssignment(true);
    const emergencyCase = coordinatorCases.find((item) => item.caseId === assignmentRequest.caseId);
    void dataStore.getEligibleResourceProviders(assignmentRequest.resourceType, {
      city: emergencyCase?.location?.city,
      state: emergencyCase?.location?.state
    }).then((providers) => {
      if (active) setEligibleAssignmentProviders(providers);
    }).catch((error) => {
      if (active) setAssignmentError(error instanceof Error ? error.message : 'Could not load eligible providers.');
    }).finally(() => {
      if (active) setIsLoadingAssignment(false);
    });

    const unsubscribe = dataStore.subscribeToRequestAssignmentHistory(
      assignmentRequest.requestId,
      (history) => setAssignmentHistory(history),
      (message) => setAssignmentError(message)
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [assignmentRequest, coordinatorCases]);

  const handleConfirmAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentRequest || !selectedAssignmentProviderUid) return;
    setIsSavingAssignment(true);
    setAssignmentError(null);
    setSuccessMessage(null);
    try {
      await dataStore.assignResourceRequest(
        assignmentRequest.requestId,
        selectedAssignmentProviderUid,
        assignmentReason
      );
      setAssignmentRequest(null);
      setSuccessMessage(`Provider assigned to ${assignmentRequest.resourceType} request ${assignmentRequest.requestId}.`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (error) {
      setAssignmentError(error instanceof Error ? error.message : 'The provider assignment failed.');
    } finally {
      setIsSavingAssignment(false);
    }
  };

  // Filtered cases list
  const filteredCases = cases.filter((c) => {
    const matchesSearch =
      c.caseId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.conditionSummary || c.patientCondition || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.location?.address.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && c.status !== 'COMPLETED' && c.status !== 'resolved' && c.status !== 'cancelled') ||
      c.status === statusFilter;

    const matchesPriority =
      priorityFilter === 'all' ||
      c.priority === priorityFilter ||
      (priorityFilter === 'Critical' && c.urgencyLevel === 'immediate');

    return matchesSearch && matchesStatus && matchesPriority;
  });

  const pendingVerificationProviders = users.filter(
    (u) => ['hospital', 'bloodBank', 'oxygenProvider', 'ambulanceProvider', 'doctor'].includes(u.role) && !u.isVerified
  );

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.city.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
    return matchesSearch && matchesRole;
  });

  const activeCasesCount = cases.filter(
    (c) => c.status !== 'COMPLETED' && c.status !== 'resolved' && c.status !== 'cancelled'
  ).length;

  const pendingRequestsCount = requests.filter(
    (r) => r.status === 'pending' || r.status === 'ASSIGNED' || r.status === 'REQUESTED'
  ).length;

  const coordinatorFilteredCases = coordinatorCases.filter((emergencyCase) => {
    const matchesPriority = coordinatorPriorityFilter === 'all' ||
      (emergencyCase.priority || emergencyCase.urgencyLevel) === coordinatorPriorityFilter;
    const matchesStatus = coordinatorStatusFilter === 'all' || emergencyCase.status === coordinatorStatusFilter;
    const createdDate = emergencyCase.createdAt.slice(0, 10);
    const matchesFrom = !dateFromFilter || createdDate >= dateFromFilter;
    const matchesTo = !dateToFilter || createdDate <= dateToFilter;
    const matchesResource = resourceFilter === 'all' || coordinatorRequests.some((request) =>
      request.caseId === emergencyCase.caseId &&
      resourceGroups.find((group) => group.id === resourceFilter)?.resourceTypes.includes(request.resourceType)
    );
    return matchesPriority && matchesStatus && matchesFrom && matchesTo && matchesResource;
  });
  const providerCount = users.filter((u) =>
    ['hospital', 'bloodBank', 'oxygenProvider', 'ambulanceProvider'].includes(u.role)
  ).length;

  const getPriorityBadge = (p?: EmergencyPriority, u?: string) => {
    if (p === 'Critical' || u === 'immediate') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-200">
          <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
          Critical (P1)
        </span>
      );
    }
    if (p === 'High' || u === 'emergency') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
          High (P2)
        </span>
      );
    }
    if (p === 'Medium' || u === 'urgent') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-yellow-100 text-yellow-800 border border-yellow-200">
          Medium (P3)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
        Low (P4)
      </span>
    );
  };

  const getStatusBadge = (status: CaseStatus) => {
    switch (status) {
      case 'REQUESTED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">REQUESTED</span>;
      case 'UNDER_REVIEW':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">UNDER REVIEW</span>;
      case 'ASSIGNED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">ASSIGNED</span>;
      case 'ACCEPTED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-teal-100 text-teal-800 border border-teal-200">ACCEPTED</span>;
      case 'RESOURCE_CONFIRMED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-200">RESOURCE CONFIRMED</span>;
      case 'DISPATCHED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">DISPATCHED</span>;
      case 'IN_PROGRESS':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-200">IN PROGRESS</span>;
      case 'COMPLETED':
      case 'resolved':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">COMPLETED</span>;
      case 'REJECTED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">REJECTED</span>;
      case 'cancelled':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-200 text-slate-700">CANCELLED</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800">ACTIVE</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center shrink-0 text-purple-600 shadow-xs">
            <Shield className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">CareBridge Central Coordinator Command</h1>
              <span className="text-[11px] font-semibold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-mono">
                Hubballi Regional Control
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Real-time incoming emergency triage, automated & manual provider dispatch, bed capacity telemetry, and full lifecycle tracking.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            loadData();
            setCoordinatorRefresh((value) => value + 1);
          }}
          className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 self-end sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
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
          <div className="text-slate-500 text-xs font-medium">Active Emergencies</div>
          <div className="text-2xl font-black text-red-600 mt-1">{activeCasesCount}</div>
          <div className="text-[11px] text-red-500 mt-0.5">Live emergency cases requiring coordination</div>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-slate-500 text-xs font-medium">Pending Provider Requisitions</div>
          <div className="text-2xl font-black text-amber-600 mt-1">{pendingRequestsCount}</div>
          <div className="text-[11px] text-amber-600 mt-0.5">Awaiting provider acceptance</div>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-slate-500 text-xs font-medium">Verified Facilities & Fleet</div>
          <div className="text-2xl font-black text-teal-600 mt-1">{providerCount}</div>
          <div className="text-[11px] text-teal-600 mt-0.5">Hospitals, Blood, Oxygen, Ambulances</div>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-slate-500 text-xs font-medium">Total Registered Users</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{users.length}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Authenticated stakeholders</div>
        </div>
      </div>

      {activeTab === 'coordinator' && (
      <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col gap-1 border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-red-600" /> Central Emergency Coordination
          </h2>
          <p className="text-xs text-slate-500">Live emergency cases and linked resource requests from Firestore.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          <select aria-label="Filter by priority" value={coordinatorPriorityFilter} onChange={(event) => setCoordinatorPriorityFilter(event.target.value)} className="text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg">
            <option value="all">All priorities</option>
            {Array.from(new Set(coordinatorCases.map((record) => record.priority || record.urgencyLevel))).filter(Boolean).map((priority) => (
              <option key={priority} value={priority}>{priority}</option>
            ))}
          </select>
          <select aria-label="Filter by emergency status" value={coordinatorStatusFilter} onChange={(event) => setCoordinatorStatusFilter(event.target.value)} className="text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg">
            <option value="all">All statuses</option>
            {Array.from(new Set(coordinatorCases.map((record) => record.status))).filter(Boolean).map((status) => (
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
        ) : !coordinatorError && coordinatorFilteredCases.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">
            {coordinatorCases.length === 0 ? 'No emergency cases are currently available.' : 'No cases match the selected filters.'}
          </div>
        ) : (
          <div className="space-y-4">
            {coordinatorFilteredCases.map((emergencyCase) => {
              const caseRequests = coordinatorRequests.filter((request) => request.caseId === emergencyCase.caseId);
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
                      <div className="text-xs font-semibold text-slate-800">{emergencyCase.category || emergencyCase.conditionSummary || 'Unspecified'} · {emergencyCase.priority || emergencyCase.urgencyLevel || 'Unspecified'}</div>
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
                                <div key={request.requestId} className="px-3 py-2 grid sm:grid-cols-5 gap-2 text-[11px] items-center">
                                  <div><span className="text-slate-400">Provider: </span><span className="font-semibold text-slate-700">{request.providerName || request.providerUid || 'Unassigned'}</span></div>
                                  <div><span className="text-slate-400">Type: </span><span className="text-slate-700 capitalize">{request.resourceType}</span></div>
                                  <div><span className="text-slate-400">Status: </span><span className="text-slate-700 capitalize">{request.status}</span></div>
                                  <div><span className="text-slate-400">Updated: </span><span className="text-slate-700">{request.updatedAt ? formatDate(request.updatedAt) : 'Not recorded'}</span></div>
                                  {currentUser?.role === 'admin' && (
                                    <button
                                      type="button"
                                      onClick={() => openRequestAssignment(request)}
                                      className="justify-self-start rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1.5 text-[10px] font-bold text-purple-800 hover:bg-purple-100"
                                    >
                                      {request.providerUid ? 'Reassign' : 'Assign provider'}
                                    </button>
                                  )}
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

      )}
      {/* Dashboard Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('emergencies')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'emergencies'
              ? 'bg-[#00707E] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Live Emergency Coordination ({filteredCases.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('providers')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'providers'
              ? 'bg-[#00707E] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Provider Capacities & Verification ({pendingVerificationProviders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'users'
              ? 'bg-[#00707E] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Access Control</span>
        </button>
        <button
          onClick={() => setActiveTab('coordinator')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'coordinator'
              ? 'bg-[#00707E] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Central Coordinator</span>
        </button>
      </div>

      {/* TAB 1: LIVE EMERGENCY COORDINATION */}
      {activeTab === 'emergencies' && (
        <div className="space-y-4">
          {/* Controls: Search, Status Filter, Priority Filter */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search emergency by ID, patient, condition, or address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00707E]"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <Filter className="w-3.5 h-3.5" />
                <span>Status:</span>
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="REQUESTED">REQUESTED</option>
                <option value="UNDER_REVIEW">UNDER REVIEW</option>
                <option value="ASSIGNED">ASSIGNED</option>
                <option value="ACCEPTED">ACCEPTED</option>
                <option value="RESOURCE_CONFIRMED">RESOURCE CONFIRMED</option>
                <option value="DISPATCHED">DISPATCHED</option>
                <option value="IN_PROGRESS">IN PROGRESS</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="REJECTED">REJECTED</option>
              </select>

              <div className="flex items-center gap-1 text-xs text-slate-500 ml-2">
                <span>Priority:</span>
              </div>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
              >
                <option value="all">All Priorities</option>
                <option value="Critical">Critical (P1)</option>
                <option value="High">High (P2)</option>
                <option value="Medium">Medium (P3)</option>
                <option value="Low">Low (P4)</option>
              </select>
            </div>
          </div>

          {/* Emergency Cases List */}
          {filteredCases.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs">
              <Activity className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <div className="font-bold text-slate-700">No emergency requests found</div>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                No active or historical emergency requests match the current search filters.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCases.map((c) => (
                <div
                  key={c.caseId}
                  className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-sm text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-md">
                        {c.caseId}
                      </span>
                      {getPriorityBadge(c.priority, c.urgencyLevel)}
                      {getStatusBadge(c.status)}
                      {c.category && (
                        <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {c.category}
                        </span>
                      )}
                      <span className="text-xs text-slate-400 flex items-center gap-1 ml-auto lg:ml-0">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                        {new Date(c.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-700">
                      <div>
                        <span className="font-semibold text-slate-900">{c.patientName}</span>
                        <span className="text-slate-400"> ({c.patientAge}y, {c.patientGender}, {c.patientBloodGroup || 'Blood Unknown'})</span>
                      </div>
                      <div className="text-slate-400">•</div>
                      <div className="flex items-center gap-1 text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-red-500" />
                        <span>{c.location?.address || 'Hubballi'}</span>
                      </div>
                      {c.attendant && (
                        <>
                          <div className="text-slate-400">•</div>
                          <div className="text-slate-600">
                            Attendant: <span className="font-medium text-slate-800">{c.attendant.name}</span> ({c.attendant.phone})
                          </div>
                        </>
                      )}
                    </div>

                    <div className="text-xs text-slate-600 bg-slate-50/70 p-2 rounded-xl border border-slate-100">
                      <span className="font-semibold text-slate-800">Complaint:</span> {c.conditionSummary}
                    </div>

                    {/* Assigned Providers Summary */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                      <span className="text-slate-400 font-semibold uppercase text-[10px]">Assigned:</span>
                      <span className={`px-2 py-0.5 rounded font-medium ${c.assignedHospitalName ? 'bg-blue-50 text-blue-800 border border-blue-200' : 'bg-slate-100 text-slate-400'}`}>
                        Hosp: {c.assignedHospitalName || 'Not Assigned'}
                      </span>
                      <span className={`px-2 py-0.5 rounded font-medium ${c.assignedAmbulanceName ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-400'}`}>
                        Amb: {c.assignedAmbulanceName || 'Not Assigned'}
                      </span>
                      {(c.resourcesNeeded || []).some((r) => r.toLowerCase().includes('blood')) && (
                        <span className={`px-2 py-0.5 rounded font-medium ${c.assignedBloodBankName ? 'bg-rose-50 text-rose-800 border border-rose-200' : 'bg-slate-100 text-slate-400'}`}>
                          Blood: {c.assignedBloodBankName || 'Not Assigned'}
                        </span>
                      )}
                      {(c.resourcesNeeded || []).some((r) => r.toLowerCase().includes('oxygen')) && (
                        <span className={`px-2 py-0.5 rounded font-medium ${c.assignedOxygenName ? 'bg-sky-50 text-sky-800 border border-sky-200' : 'bg-slate-100 text-slate-400'}`}>
                          Oxygen: {c.assignedOxygenName || 'Not Assigned'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex sm:flex-col items-center justify-end gap-2 shrink-0 border-t sm:border-t-0 sm:border-l border-slate-100 pt-3 sm:pt-0 sm:pl-4">
                    <button
                      onClick={() => handleOpenAssignment(c)}
                      className="w-full px-3.5 py-2 rounded-xl bg-[#00707E] hover:bg-[#005B66] text-white text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>{c.assignedHospitalUid ? 'Reassign Providers' : 'Assign & Dispatch'}</span>
                    </button>

                    <button
                      onClick={() => setSelectedCase(c)}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Audit Trail</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PROVIDER CAPACITIES & VERIFICATION */}
      {activeTab === 'providers' && (
        <div className="space-y-6">
          {/* Pending Verification Banner */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-purple-600" /> Healthcare Provider Verification Queue
                  {pendingVerificationProviders.length > 0 && (
                    <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {pendingVerificationProviders.length} Pending Approval
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-500">
                  Hospitals, blood banks, oxygen depots, and ambulance fleets require coordinator approval prior to accepting emergency dispatches.
                </p>
              </div>
            </div>

            {pendingVerificationProviders.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1 opacity-70" />
                All active registered healthcare providers have been authenticated and verified.
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
                        onClick={() => handleVerify(prov.uid, false)}
                        className="px-3.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg border border-red-200"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleVerify(prov.uid, true)}
                        className="px-4 py-1.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-xs flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" /> Approve & Verify
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Real-Time Live Capacities Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Hospitals Telemetry */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Bed className="w-4 h-4 text-blue-600" />
                <span>Hospital Bed & ICU Telemetry</span>
              </h3>
              <div className="space-y-2">
                {hospitals.map((h) => (
                  <div key={h.uid} className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-xs text-slate-900">{h.hospitalName}</div>
                      <div className="text-[11px] text-slate-500">{h.address}</div>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <div className="text-xs font-black text-blue-600">{h.availableBeds} / {h.totalBeds}</div>
                        <div className="text-[10px] text-slate-400">Gen Beds</div>
                      </div>
                      <div>
                        <div className="text-xs font-black text-purple-600">{h.availableICU} / {h.totalICU}</div>
                        <div className="text-[10px] text-slate-400">ICU Beds</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Blood Bank Telemetry */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Droplet className="w-4 h-4 text-rose-600" />
                <span>Blood Bank Inventory Telemetry</span>
              </h3>
              <div className="space-y-2">
                {bloodBanks.map((b) => (
                  <div key={b.uid} className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                    <div className="font-bold text-xs text-slate-900">{b.bankName}</div>
                    <div className="grid grid-cols-4 gap-1.5 text-center">
                      {Object.entries(b.inventory || {}).map(([grp, units]) => (
                        <div key={grp} className="bg-white p-1 rounded border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-500">{grp}</span>
                          <div className={`text-xs font-extrabold ${Number(units) < 5 ? 'text-red-600' : 'text-slate-800'}`}>
                            {units}u
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Oxygen Depot Telemetry */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Wind className="w-4 h-4 text-sky-600" />
                <span>Oxygen Depot Capacity Telemetry</span>
              </h3>
              <div className="space-y-2">
                {oxygenDepots.map((o) => (
                  <div key={o.uid} className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-xs text-slate-900">{o.providerName}</div>
                      <div className="text-[11px] text-slate-500">{o.address}</div>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <div className="text-xs font-black text-sky-600">{o.cylindersAvailable}</div>
                        <div className="text-[10px] text-slate-400">Cylinders</div>
                      </div>
                      <div>
                        <div className="text-xs font-black text-teal-600">{o.concentratorsAvailable}</div>
                        <div className="text-[10px] text-slate-400">Concentrators</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ambulance Dispatch Telemetry */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Truck className="w-4 h-4 text-amber-600" />
                <span>Emergency Ambulance Fleet</span>
              </h3>
              <div className="space-y-2">
                {ambulances.map((a) => (
                  <div key={a.uid} className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-xs text-slate-900">{a.providerName}</div>
                      <span className="text-[11px] text-slate-500">{a.vehicles?.length || 0} Vehicles</span>
                    </div>
                    <div className="space-y-1">
                      {(a.vehicles || []).map((v) => (
                        <div key={v.vehicleId} className="flex items-center justify-between text-[11px] bg-white p-1.5 rounded border border-slate-200">
                          <span className="font-mono font-bold text-slate-700">{v.vehicleId} ({v.vehicleType})</span>
                          <span className={`px-2 py-0.2 rounded font-bold ${v.isAvailable ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'}`}>
                            {v.isAvailable ? 'Available' : 'Dispatched / In-Transit'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: USER ACCESS CONTROL */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-slate-700" /> User & Role Management Directory
              </h2>
              <p className="text-xs text-slate-500">
                Inspect registered user accounts, roles, verification status, and toggle account activation.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search user..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg w-48 sm:w-60"
                />
              </div>
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="text-xs p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
              >
                <option value="all">All Roles</option>
                <option value="patient">Patient</option>
                <option value="patientAttendant">Patient Attendant</option>
                <option value="hospital">Hospital</option>
                <option value="bloodBank">Blood Bank</option>
                <option value="oxygenProvider">Oxygen</option>
                <option value="ambulanceProvider">Ambulance</option>
                <option value="doctor">Doctor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3">User / Organization</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Location</th>
                  <th className="p-3">Verification</th>
                  <th className="p-3">Status</th>
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
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                          <CheckCircle2 className="w-3 h-3" /> Verified
                        </span>
                      ) : (
                        <button
                          onClick={() => handleVerify(u.uid, true)}
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
                        onClick={() => handleToggleActive(u.uid, u.isActive)}
                        className={`p-1.5 rounded-lg text-xs font-semibold transition-colors ${
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
      )}

      {assignmentRequest && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-5 sm:p-6 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {assignmentRequest.providerUid ? 'Reassign resource request' : 'Assign resource request'}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {assignmentRequest.caseId} · {assignmentRequest.resourceType} · Status remains {assignmentRequest.status}
                </p>
                <p className="text-[11px] text-slate-500">Current provider: {assignmentRequest.providerName || assignmentRequest.providerUid || 'Unassigned'}</p>
              </div>
              <button
                type="button"
                onClick={() => setAssignmentRequest(null)}
                aria-label="Close provider assignment"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {assignmentError && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                {assignmentError}
              </div>
            )}

            <form onSubmit={handleConfirmAssignment} className="space-y-3">
              <label className="block text-xs font-semibold text-slate-700">
                Eligible provider
                <select
                  required
                  value={selectedAssignmentProviderUid}
                  onChange={(event) => setSelectedAssignmentProviderUid(event.target.value)}
                  disabled={isLoadingAssignment || isSavingAssignment}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                >
                  <option value="">{isLoadingAssignment ? 'Loading eligible providers…' : 'Select a provider'}</option>
                  {eligibleAssignmentProviders.map((provider) => {
                    const emergencyCase = coordinatorCases.find((item) => item.caseId === assignmentRequest.caseId);
                    const location = [provider.city, provider.state].filter(Boolean).join(', ');
                    const sameCity = Boolean(provider.city && emergencyCase?.location?.city &&
                      provider.city.trim().toLowerCase() === emergencyCase.location.city.trim().toLowerCase());
                    return (
                      <option key={provider.uid} value={provider.uid}>
                        {provider.displayName}{location ? ` · ${location}` : ''}{sameCity ? ' · Same city' : ''}
                      </option>
                    );
                  })}
                </select>
                {!isLoadingAssignment && eligibleAssignmentProviders.length === 0 && (
                  <span className="mt-1 block font-normal text-amber-700">No active and verified eligible providers were found.</span>
                )}
              </label>

              <label className="block text-xs font-semibold text-slate-700">
                Reassignment reason {assignmentRequest.providerUid ? '(required)' : '(optional for initial assignment)'}
                <textarea
                  value={assignmentReason}
                  onChange={(event) => setAssignmentReason(event.target.value)}
                  required={Boolean(assignmentRequest.providerUid)}
                  minLength={assignmentRequest.providerUid ? 5 : undefined}
                  maxLength={500}
                  rows={3}
                  disabled={isSavingAssignment}
                  placeholder="Explain why this request needs a new provider."
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAssignmentRequest(null)}
                  disabled={isSavingAssignment}
                  className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingAssignment || isLoadingAssignment || !selectedAssignmentProviderUid || eligibleAssignmentProviders.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#00707E] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  {isSavingAssignment ? 'Saving assignment…' : assignmentRequest.providerUid ? 'Confirm reassignment' : 'Assign provider'}
                </button>
              </div>
            </form>

            <section className="border-t border-slate-100 pt-3">
              <h4 className="text-xs font-bold text-slate-800">Immutable assignment history</h4>
              {assignmentHistory.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">No assignment changes recorded.</p>
              ) : (
                <ol className="mt-2 space-y-2">
                  {assignmentHistory.map((audit) => (
                    <li key={audit.auditId} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                      <p className="font-semibold text-slate-800">{audit.previousProviderName || 'Unassigned'} → {audit.newProviderName}</p>
                      <p className="mt-1 text-slate-500">{formatDate(audit.timestamp)} · Coordinator {audit.coordinatorUid}</p>
                      <p className="mt-1 text-slate-600">Reason: {audit.reason}</p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        </div>
      )}

      {/* ASSIGNMENT MODAL / DRAWER */}
      {isAssignModalOpen && selectedCase && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">
                    Dispatch Healthcare Providers
                  </h3>
                  <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                    {selectedCase.caseId}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Patient: <span className="font-semibold text-slate-800">{selectedCase.patientName}</span> • Urgency: {selectedCase.urgencyLevel}
                </p>
              </div>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmAssignment} className="space-y-4">
              {/* Hospital Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span>Designated Receiving Hospital</span>
                </label>
                <select
                  value={assignHospitalId}
                  onChange={(e) => setAssignHospitalId(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium"
                >
                  <option value="">Do Not Assign Hospital</option>
                  {hospitals.map((h) => (
                    <option key={h.uid} value={h.uid}>
                      {h.hospitalName} ({h.availableBeds} beds, {h.availableICU} ICU available)
                    </option>
                  ))}
                </select>
              </div>

              {/* Ambulance Fleet Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-amber-600" />
                  <span>Ambulance Dispatch Service</span>
                </label>
                <select
                  value={assignAmbulanceId}
                  onChange={(e) => setAssignAmbulanceId(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium"
                >
                  <option value="">Do Not Assign Ambulance</option>
                  {ambulances.map((a) => (
                    <option key={a.uid} value={a.uid}>
                      {a.providerName} ({a.vehicles.filter((v) => v.isAvailable).length} idle units)
                    </option>
                  ))}
                </select>
              </div>

              {/* Blood Bank Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Droplet className="w-4 h-4 text-rose-600" />
                  <span>Blood Bank Requisition</span>
                </label>
                <select
                  value={assignBloodBankId}
                  onChange={(e) => setAssignBloodBankId(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium"
                >
                  <option value="">Do Not Assign Blood Bank</option>
                  {bloodBanks.map((b) => {
                    const groupKey = (selectedCase.patientBloodGroup || 'O+') as any;
                    const availableUnits = (b.inventory as Record<string, number>)?.[groupKey] ?? 0;
                    return (
                      <option key={b.uid} value={b.uid}>
                        {b.bankName} (Group {selectedCase.patientBloodGroup || 'O+'}: {availableUnits} units)
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Oxygen Depot Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Wind className="w-4 h-4 text-sky-600" />
                  <span>Oxygen Supplier Allocation</span>
                </label>
                <select
                  value={assignOxygenId}
                  onChange={(e) => setAssignOxygenId(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium"
                >
                  <option value="">Do Not Assign Oxygen Supplier</option>
                  {oxygenDepots.map((o) => (
                    <option key={o.uid} value={o.uid}>
                      {o.providerName} ({o.cylindersAvailable} cylinders available)
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAssignment}
                  className="px-5 py-2.5 bg-[#00707E] hover:bg-[#005B66] text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Dispatch & Notify Providers</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AUDIT TRAIL / TIMELINE MODAL */}
      {selectedCase && !isAssignModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Emergency Audit History & Telemetry
                </h3>
                <span className="font-mono text-xs text-purple-700 font-bold">
                  {selectedCase.caseId}
                </span>
              </div>
              <button
                onClick={() => setSelectedCase(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {(selectedCase.auditHistory || []).length === 0 ? (
                <div className="text-xs text-slate-500 py-4 text-center">No audit records logged yet.</div>
              ) : (
                (selectedCase.auditHistory || []).map((audit, idx) => (
                  <div key={audit.id || idx} className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">{audit.status}</span>
                      <span className="text-[11px] text-slate-400">
                        {new Date(audit.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(audit.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600">{audit.note || 'Status transitioned'}</div>
                    <div className="text-[11px] text-slate-400">
                      Updated by: <span className="font-medium text-slate-700">{audit.updatedByName}</span> ({audit.role})
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
