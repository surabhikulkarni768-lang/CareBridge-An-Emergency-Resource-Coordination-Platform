import React, { useState, useEffect } from 'react';
import {
  Droplet,
  ShieldCheck,
  MapPin,
  Phone,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Minus,
  AlertTriangle,
  Building2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataStore, respondToRequestInFirestore, subscribeRequestsForProviderFromFirestore } from '../../services/dataService';
import type { BloodBankProfile, ResourceRequest, BloodGroup } from '../../types';

export const BloodBankDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState<BloodBankProfile | null>(null);
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [inventory, setInventory] = useState<Record<BloodGroup, number>>({
    'A+': 18, 'A-': 5, 'B+': 24, 'B-': 3, 'AB+': 9, 'AB-': 2, 'O+': 31, 'O-': 6
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [rejectingReqId, setRejectingReqId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('Selected blood group currently out of stock');

  const loadData = () => {
    if (!currentUser) return;
    const prof = dataStore.getBloodBankProfile(currentUser.uid);
    if (prof) {
      setProfile(prof);
      setInventory(prof.inventory);
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    loadData();
    const unsubscribeStore = dataStore.subscribe(loadData);
    const unsubscribeRequests = subscribeRequestsForProviderFromFirestore(currentUser.uid, setRequests);
    return () => {
      unsubscribeStore();
      unsubscribeRequests();
    };
  }, [currentUser]);

  const handleUnitChange = (group: BloodGroup, delta: number) => {
    setInventory((prev) => ({
      ...prev,
      [group]: Math.max(0, (prev[group] || 0) + delta)
    }));
  };

  const handleSaveInventory = () => {
    if (!currentUser) return;
    setIsUpdating(true);
    dataStore.updateBloodBankProfile(currentUser.uid, { inventory });
    setTimeout(() => {
      setIsUpdating(false);
      setSuccessMessage('Blood bank stock updated successfully.');
      setTimeout(() => setSuccessMessage(null), 3000);
    }, 400);
  };

  const isActionRequired = (status: string) => status === 'pending' || status === 'ASSIGNED' || status === 'REQUESTED';

  const handleAccept = async (reqId: string) => {
    const req = requests.find((r) => r.requestId === reqId);
    if (!req) return;
    const bg = req.details.bloodGroup as BloodGroup;
    const units = req.details.units || 1;

    if (bg && (inventory[bg] || 0) < units) {
      alert(`Critical Shortage Alert: Requested ${units} units of ${bg}, but only ${inventory[bg] || 0} units are currently available in inventory. Please replenish stock or reject to notify Central Coordinator.`);
      return;
    }

    try {
      await respondToRequestInFirestore(reqId, 'accepted');
      setSuccessMessage(`Blood request accepted. ${units} units of ${bg} reserved & deducted from stock.`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not respond to the request.');
    }
  };

  const handleReject = async (reqId: string) => {
    try {
      await respondToRequestInFirestore(reqId, 'rejected', rejectionReason);
      setRejectingReqId(null);
      setSuccessMessage('Blood request declined. Central Coordinator notified.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not respond to the request.');
    }
  };

  if (!profile) {
    return <div className="p-8 text-center text-slate-500">Loading Blood Bank Dashboard...</div>;
  }

  const bloodGroups: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const pendingRequests = requests.filter((r) => r.status === 'pending');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0 text-rose-600">
            <Droplet className="w-8 h-8 fill-rose-600/20" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{profile.bankName}</h1>
              {profile.isVerified && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  <ShieldCheck className="w-3.5 h-3.5" /> Licensed Center
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 mt-1.5 text-xs text-slate-500">
              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {profile.address}, {profile.city}</span>
              <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {profile.contactNumber}</span>
              <span className="text-slate-400">Lic: {profile.licenseNumber}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right text-xs">
            <div className="text-slate-500">Stock last updated:</div>
            <div className="font-semibold text-slate-700">
              {new Date(profile.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <button
            onClick={loadData}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          {successMessage}
        </div>
      )}

      {/* Grid: 8 Blood Group Inventory Management */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Droplet className="w-5 h-5 text-rose-600" /> All 8 Blood Groups Inventory
            </h2>
            <p className="text-xs text-slate-500">
              Units in refrigerated blood bank cold storage ready for cross-matching.
            </p>
          </div>
          <button
            onClick={handleSaveInventory}
            disabled={isUpdating}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
            {isUpdating ? 'Saving...' : 'Broadcast Stock Levels'}
          </button>
        </div>

        {/* 8 Group Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
          {bloodGroups.map((group) => {
            const count = inventory[group] || 0;
            const isLow = count < 5;
            const isModerate = count >= 5 && count < 10;
            return (
              <div
                key={group}
                className={`p-4 rounded-xl border transition-all text-center space-y-3 ${
                  isLow
                    ? 'border-red-200 bg-red-50/50'
                    : isModerate
                    ? 'border-amber-200 bg-amber-50/40'
                    : 'border-slate-200 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg font-black text-rose-600 font-mono">{group}</span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      isLow
                        ? 'bg-red-200 text-red-800'
                        : isModerate
                        ? 'bg-amber-200 text-amber-800'
                        : 'bg-emerald-200 text-emerald-800'
                    }`}
                  >
                    {isLow ? 'Critical Low' : isModerate ? 'Moderate' : 'Sufficient'}
                  </span>
                </div>

                <div className="text-3xl font-extrabold text-slate-900 font-sans">
                  {count} <span className="text-xs font-normal text-slate-500">units</span>
                </div>

                {/* Counter controls */}
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    onClick={() => handleUnitChange(group, -1)}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center justify-center font-bold text-sm shadow-2xs"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleUnitChange(group, 1)}
                    className="w-8 h-8 rounded-lg bg-rose-600 text-white hover:bg-rose-700 flex items-center justify-center font-bold text-sm shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Incoming Blood Requests Queue */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            Incoming Emergency Blood Requests
            {pendingRequests.length > 0 && (
              <span className="bg-rose-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                {pendingRequests.length} Pending
              </span>
            )}
          </h2>
        </div>

        {requests.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            No blood requests received yet.
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <div
                key={req.requestId}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">{req.patientName || 'Emergency Patient'}</span>
                    <span className="text-xs font-mono bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                      {req.caseId}
                    </span>
                    <span className="text-xs font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                      Group {req.details.bloodGroup} — {req.details.units || 1} Units
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {req.details.notes ? `Note: "${req.details.notes}"` : 'Emergency transfusion requested.'}
                  </p>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {isActionRequired(req.status) ? (
                    <>
                      <button
                        onClick={() => setRejectingReqId(req.requestId)}
                        className="px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg border border-red-200"
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => handleAccept(req.requestId)}
                        className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Accept & Reserve Units
                      </button>
                    </>
                  ) : req.status === 'accepted' ? (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Units Reserved & Ready
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-red-700 bg-red-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" /> Declined
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
