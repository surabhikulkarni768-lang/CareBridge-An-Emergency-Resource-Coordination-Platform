import React, { useState, useEffect } from 'react';
import {
  Shield,
  Users,
  Building2,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Check,
  X,
  RefreshCw,
  Phone,
  MapPin,
  Clock,
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
  EmergencyPriority
} from '../../types';

export const AdminDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'emergencies' | 'providers' | 'users' | 'analytics'>('emergencies');

  // Core Data
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [cases, setCases] = useState<EmergencyCase[]>([]);
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [hospitals, setHospitals] = useState<HospitalProfile[]>([]);
  const [bloodBanks, setBloodBanks] = useState<BloodBankProfile[]>([]);
  const [oxygenDepots, setOxygenDepots] = useState<OxygenProfile[]>([]);
  const [ambulances, setAmbulances] = useState<AmbulanceProfile[]>([]);

  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
    const unsub = dataStore.subscribe(loadData);
    return () => unsub();
  }, [currentUser]);

  const handleVerify = (uid: string, verify: boolean) => {
    dataStore.verifyProvider(uid, verify);
    setSuccessMessage(verify ? 'Provider organization verified successfully.' : 'Verification revoked.');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleToggleActive = (uid: string, currentActive: boolean) => {
    dataStore.toggleUserActive(uid, !currentActive);
    setSuccessMessage(!currentActive ? 'Account activated.' : 'Account suspended.');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Open assignment drawer for an emergency case
  const handleOpenAssignment = (c: EmergencyCase) => {
    setSelectedCase(c);
    setAssignHospitalId(c.assignedHospitalUid || hospitals[0]?.uid || '');
    setAssignBloodBankId(c.assignedBloodBankUid || bloodBanks[0]?.uid || '');
    setAssignOxygenId(c.assignedOxygenUid || oxygenDepots[0]?.uid || '');
    setAssignAmbulanceId(c.assignedAmbulanceUid || ambulances[0]?.uid || '');
    setAssignNote('');
    setIsAssignModalOpen(true);
  };

  const handleConfirmAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !currentUser) return;
    setIsSubmittingAssignment(true);

    const selHosp = hospitals.find((h) => h.uid === assignHospitalId);
    const selBlood = bloodBanks.find((b) => b.uid === assignBloodBankId);
    const selOxy = oxygenDepots.find((o) => o.uid === assignOxygenId);
    const selAmb = ambulances.find((a) => a.uid === assignAmbulanceId);

    dataStore.assignProvidersToCase(
      selectedCase.caseId,
      {
        hospital: selHosp ? { uid: selHosp.uid, name: selHosp.hospitalName } : undefined,
        bloodBank: selBlood ? { uid: selBlood.uid, name: selBlood.bankName } : undefined,
        oxygenProvider: selOxy ? { uid: selOxy.uid, name: selOxy.providerName } : undefined,
        ambulanceProvider: selAmb ? { uid: selAmb.uid, name: selAmb.providerName } : undefined
      },
      {
        uid: currentUser.uid,
        name: currentUser.displayName || 'Central Coordinator'
      }
    );

    setIsSubmittingAssignment(false);
    setIsAssignModalOpen(false);
    setSuccessMessage(`Providers successfully dispatched for emergency ${selectedCase.caseId}.`);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Filtered cases list
  const filteredCases = cases.filter((c) => {
    const matchesSearch =
      c.caseId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.conditionSummary.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
    (u) => ['hospital', 'bloodBank', 'oxygenProvider', 'ambulanceProvider'].includes(u.role) && !u.isVerified
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

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={loadData}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-2xs flex items-center gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Sync Live</span>
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
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
                      {c.resourcesNeeded.some((r) => r.toLowerCase().includes('blood')) && (
                        <span className={`px-2 py-0.5 rounded font-medium ${c.assignedBloodBankName ? 'bg-rose-50 text-rose-800 border border-rose-200' : 'bg-slate-100 text-slate-400'}`}>
                          Blood: {c.assignedBloodBankName || 'Not Assigned'}
                        </span>
                      )}
                      {c.resourcesNeeded.some((r) => r.toLowerCase().includes('oxygen')) && (
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
                  {bloodBanks.map((b) => (
                    <option key={b.uid} value={b.uid}>
                      {b.bankName} (Group {selectedCase.patientBloodGroup || 'O+'}: {b.inventory[selectedCase.patientBloodGroup as any] || 0} units)
                    </option>
                  ))}
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
