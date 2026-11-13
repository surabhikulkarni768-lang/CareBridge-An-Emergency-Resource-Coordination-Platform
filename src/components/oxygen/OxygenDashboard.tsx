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
import { ProviderRequestsPanel } from '../common/ProviderRequestsPanel';
import type { OxygenProfile, ResourceRequest } from '../../types';

export const OxygenDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState<OxygenProfile | null>(null);
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [rejectingReqId, setRejectingReqId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [respondingReqId, setRespondingReqId] = useState<string | null>(null);
  const isActionRequired = (status: string) => ['pending', 'assigned', 'requested'].includes(status.toLowerCase());
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
    const unsubscribeRequests = subscribeRequestsForProviderFromFirestore(
      currentUser.uid,
      (nextRequests) => {
        setRequests(nextRequests);
        setRequestsLoading(false);
        setRequestsError(null);
      },
      (message) => {
        setRequests([]);
        setRequestsError(message);
        setRequestsLoading(false);
      }
    );
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
    setRespondingReqId(reqId);
    try {
      const coordinatorNotified = await respondToRequestInFirestore(reqId, 'accepted');
      setSuccessMessage(coordinatorNotified
        ? 'Oxygen request accepted. The coordinator was notified.'
        : 'Oxygen request accepted. The status is visible in the coordinator live request list.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not respond to the request.');
    } finally {
      setRespondingReqId(null);
    }
  };

  const handleReject = async (reqId: string) => {
    if (rejectionReason.trim().length < 5) {
      window.alert('Enter a rejection reason of at least five characters.');
      return;
    }
    setRespondingReqId(reqId);
    try {
      const coordinatorNotified = await respondToRequestInFirestore(reqId, 'rejected', rejectionReason.trim());
      setRejectingReqId(null);
      setRejectionReason('');
      setSuccessMessage(coordinatorNotified
        ? 'Oxygen request declined. The coordinator was notified.'
        : 'Oxygen request declined. The status is visible in the coordinator live request list.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not respond to the request.');
    } finally {
      setRespondingReqId(null);
    }
  };

  if (!profile) {
    return (
      <div className="max-w-7xl mx-auto p-8 space-y-4 text-center text-slate-500">
        Loading Oxygen Provider Dashboard...
        {requestsError && <p role="alert" className="text-sm text-red-700">{requestsError}</p>}
        {currentUser && <ProviderRequestsPanel providerUid={currentUser.uid} title="Assigned Oxygen Requests" />}
      </div>
    );
  }

  const pendingCount = requests.filter((r) => isActionRequired(String(r.status))).length;

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

            {requestsError ? (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">{requestsError}</div>
            ) : requestsLoading ? (
              <div className="py-8 text-center text-slate-500 text-xs">Loading assigned oxygen requests...</div>
            ) : requests.length === 0 ? (
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
                        <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                          Priority: {req.details.urgency || 'Not specified'}
                        </span>
                        <span className="text-xs font-bold text-sky-800 bg-sky-100 px-2 py-0.5 rounded">
                          {req.details.cylinders || 1} Cylinders Requested
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {req.details.notes ? `Note: "${req.details.notes}"` : 'Emergency respiratory support.'}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Assigned: {new Date(req.assignedAt || req.createdAt).toLocaleString()}
                      </p>
                      {req.respondedAt && (
                        <p className="mt-1 text-[11px] text-slate-500">
                          Response {new Date(req.respondedAt).toLocaleString()} by {req.respondedByUid || 'provider'}
                          {req.responseDetails ? ` - ${req.responseDetails}` : ''}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {isActionRequired(String(req.status)) ? (
                        <>
                          <button
                            disabled={respondingReqId !== null}
                            onClick={() => {
                              setRejectionReason('');
                              setRejectingReqId(req.requestId);
                            }}
                            className="px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg border border-red-200"
                          >
                            Decline
                          </button>
                          <button
                            disabled={respondingReqId !== null}
                            onClick={() => handleAccept(req.requestId)}
                            className="px-4 py-1.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-xs flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Accept Request
                          </button>
                        </>
                      ) : req.status === 'accepted' ? (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Accepted
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-red-700 bg-red-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> Declined
                        </span>
                      )}
                    </div>
                    {rejectingReqId === req.requestId && (
                      <div className="w-full space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
                        <label htmlFor={`oxygen-rejection-${req.requestId}`} className="block text-xs font-semibold text-red-900">
                          Rejection reason (required)
                        </label>
                        <textarea
                          id={`oxygen-rejection-${req.requestId}`}
                          required
                          minLength={5}
                          rows={2}
                          value={rejectionReason}
                          onChange={(event) => setRejectionReason(event.target.value)}
                          className="w-full rounded-lg border border-red-200 bg-white p-2 text-xs"
                        />
                        <div className="flex justify-end gap-2">
                          <button type="button" disabled={respondingReqId !== null} onClick={() => setRejectingReqId(null)} className="rounded-lg px-3 py-1.5 text-xs text-slate-600 hover:bg-white">
                            Cancel
                          </button>
                          <button type="button" disabled={respondingReqId !== null || rejectionReason.trim().length < 5} onClick={() => handleReject(req.requestId)} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
                            {respondingReqId === req.requestId ? 'Saving...' : 'Confirm rejection'}
                          </button>
                        </div>
                      </div>
                    )}
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
