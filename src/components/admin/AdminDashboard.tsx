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
  Unlock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataStore } from '../../services/dataService';
import type { UserProfile, UserRole, EmergencyCase, ResourceRequest } from '../../types';

export const AdminDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [cases, setCases] = useState<EmergencyCase[]>([]);
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadData = () => {
    setUsers(dataStore.getUsers());
    setCases(dataStore.getCases());
    setRequests(dataStore.getRequests());
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

  const pendingVerificationProviders = users.filter(
    (u) => ['hospital', 'bloodBank', 'oxygenProvider', 'ambulanceProvider'].includes(u.role) && !u.isVerified
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
          onClick={loadData}
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
    </div>
  );
};

