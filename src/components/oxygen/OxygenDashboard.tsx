import React, { useState, useEffect } from 'react';
import {
  Wind,
  ShieldCheck,
  MapPin,
  Phone,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Truck,
  Plus,
  Minus
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataStore, respondToRequestInFirestore, subscribeRequestsForProviderFromFirestore } from '../../services/dataService';
import type { OxygenProfile, ResourceRequest } from '../../types';

export const OxygenDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState<OxygenProfile | null>(null);
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [cylinders, setCylinders] = useState<number>(35);
  const [concentrators, setConcentrators] = useState<number>(12);
  const [deliveryAvailable, setDeliveryAvailable] = useState<boolean>(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadData = () => {
    if (!currentUser) return;
    const prof = dataStore.getOxygenProfile(currentUser.uid);
    if (prof) {
      setProfile(prof);
      setCylinders(prof.cylindersAvailable);
      setConcentrators(prof.concentratorsAvailable);
      setDeliveryAvailable(prof.deliveryAvailable);
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

  const handleSaveCapacity = () => {
    if (!currentUser) return;
    setIsUpdating(true);
    dataStore.updateOxygenProfile(currentUser.uid, {
      cylindersAvailable: Number(cylinders),
      concentratorsAvailable: Number(concentrators),
      deliveryAvailable
    });
    setTimeout(() => {
      setIsUpdating(false);
      setSuccessMessage('Oxygen inventory published to live coordinator network.');
      setTimeout(() => setSuccessMessage(null), 3000);
    }, 400);
  };

  const handleAccept = async (reqId: string) => {
    try {
      await respondToRequestInFirestore(reqId, 'accepted');
      setSuccessMessage('Oxygen request accepted. Cylinders allocated & patient notified.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not respond to the request.');
    }
  };

  const handleReject = async (reqId: string) => {
    try {
      await respondToRequestInFirestore(reqId, 'rejected', 'Zero cylinders currently pressurized');
      setSuccessMessage('Oxygen request declined.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not respond to the request.');
    }
  };

  if (!profile) {
    return <div className="p-8 text-center text-slate-500">Loading Oxygen Provider Dashboard...</div>;
  }

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center shrink-0 text-sky-600">
            <Wind className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{profile.providerName}</h1>
              {profile.isVerified && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  <ShieldCheck className="w-3.5 h-3.5" /> Certified Depot
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 mt-1.5 text-xs text-slate-500">
              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {profile.address}, {profile.city}</span>
              <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {profile.contactNumber}</span>
              <span className="text-slate-400">License: {profile.licenseNumber}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right text-xs">
            <div className="text-slate-500">Status updated:</div>
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

      {/* Grid: Oxygen Inventory + Incoming Requests */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Inventory Controls */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-5">
            <h2 className="font-bold text-slate-900 text-base flex items-center gap-2 border-b border-slate-100 pb-3">
              <Wind className="w-5 h-5 text-sky-600" /> Stock & Supply Levels
            </h2>

            {/* Cylinders */}
            <div className="p-4 bg-sky-50/50 rounded-xl space-y-2 border border-sky-100">
              <div className="flex items-center justify-between text-xs font-bold text-sky-950">
                <span>Medical D-Type Cylinders (46.7L)</span>
                <span className="text-sky-700 font-mono text-sm">{cylinders} Units</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCylinders((c) => Math.max(0, c - 1))}
                  className="w-9 h-9 bg-white border border-sky-200 rounded-lg flex items-center justify-center font-bold text-slate-700 hover:bg-sky-100"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  min="0"
                  value={cylinders}
                  onChange={(e) => setCylinders(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-center py-1.5 font-bold text-lg bg-white border border-sky-200 rounded-lg text-slate-900"
                />
                <button
                  onClick={() => setCylinders((c) => c + 1)}
                  className="w-9 h-9 bg-sky-600 text-white rounded-lg flex items-center justify-center font-bold hover:bg-sky-700"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Concentrators */}
            <div className="p-4 bg-slate-50 rounded-xl space-y-2 border border-slate-200">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span>Electric Oxygen Concentrators (10 LPM)</span>
                <span className="text-slate-600 font-mono text-sm">{concentrators} Units</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setConcentrators((c) => Math.max(0, c - 1))}
                  className="w-9 h-9 bg-white border border-slate-300 rounded-lg flex items-center justify-center font-bold text-slate-700 hover:bg-slate-100"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  min="0"
                  value={concentrators}
                  onChange={(e) => setConcentrators(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-center py-1.5 font-bold text-lg bg-white border border-slate-300 rounded-lg text-slate-900"
                />
                <button
                  onClick={() => setConcentrators((c) => c + 1)}
                  className="w-9 h-9 bg-slate-800 text-white rounded-lg flex items-center justify-center font-bold hover:bg-slate-900"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Delivery Toggle */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <Truck className="w-4 h-4 text-slate-600" /> Doorstep Cylinder Delivery
              </div>
              <input
                type="checkbox"
                checked={deliveryAvailable}
                onChange={(e) => setDeliveryAvailable(e.target.checked)}
                className="w-4 h-4 text-sky-600 rounded"
              />
            </div>

            <button
              onClick={handleSaveCapacity}
              disabled={isUpdating}
              className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
              {isUpdating ? 'Publishing...' : 'Broadcast Live Capacity'}
            </button>
          </div>
        </div>

        {/* Right: Incoming Requests */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Incoming Oxygen Requisitions
                {pendingCount > 0 && (
                  <span className="bg-sky-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                    {pendingCount} Pending
                  </span>
                )}
              </h2>
            </div>

            {requests.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No oxygen requests received yet.
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
                        <span className="text-xs font-bold text-sky-800 bg-sky-100 px-2 py-0.5 rounded">
                          {req.details.cylinders || 1} Cylinders Requested
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {req.details.notes ? `Note: "${req.details.notes}"` : 'Emergency respiratory support.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {req.status === 'pending' ? (
                        <>
                          <button
                            onClick={() => handleReject(req.requestId)}
                            className="px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg border border-red-200"
                          >
                            Decline
                          </button>
                          <button
                            onClick={() => handleAccept(req.requestId)}
                            className="px-4 py-1.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-xs flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Allocate & Dispatch
                          </button>
                        </>
                      ) : req.status === 'accepted' ? (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Cylinders Dispatched
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
      </div>
    </div>
  );
};
