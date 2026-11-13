import React, { useState, useEffect } from 'react';
import {
  Truck,
  ShieldCheck,
  MapPin,
  Phone,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Plus,
  Play,
  Navigation,
  Clock,
  User,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataStore, respondToRequestInFirestore, subscribeRequestsForProviderFromFirestore } from '../../services/dataService';
import { ProviderRequestsPanel } from '../common/ProviderRequestsPanel';
import type { AmbulanceProfile, ResourceRequest, AmbulanceTrip, AmbulanceTripStatus, AmbulanceVehicle } from '../../types';

export const AmbulanceDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState<AmbulanceProfile | null>(null);
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [trips, setTrips] = useState<AmbulanceTrip[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [rejectingReqId, setRejectingReqId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [respondingReqId, setRespondingReqId] = useState<string | null>(null);
  const isActionRequired = (status: string) => ['pending', 'assigned', 'requested'].includes(status.toLowerCase());

  // New vehicle form state
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [newVehicleId, setNewVehicleId] = useState('KA-25-EM-1084');
  const [newVehicleType, setNewVehicleType] = useState<'BLS' | 'ALS' | 'Patient Transport'>('ALS');
  const [newDriverName, setNewDriverName] = useState('Anand Hiremath');
  const [newDriverPhone, setNewDriverPhone] = useState('+91 98452 11084');

  const loadData = () => {
    if (!currentUser) return;
    const prof = dataStore.getAmbulanceProfile(currentUser.uid);
    if (prof) setProfile(prof);
    setTrips(dataStore.getTrips().filter((t) => t.providerUid === currentUser.uid));
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

  const handleAddVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !profile) return;
    const vehicle: AmbulanceVehicle = {
      vehicleId: newVehicleId,
      vehicleType: newVehicleType,
      driverName: newDriverName,
      driverPhone: newDriverPhone,
      isAvailable: true,
      currentStatus: 'idle'
    };
    const updatedVehicles = [...profile.vehicles, vehicle];
    dataStore.updateAmbulanceProfile(currentUser.uid, { vehicles: updatedVehicles });
    setShowAddVehicle(false);
    setSuccessMessage(`Vehicle ${newVehicleId} added to active dispatch fleet.`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleAcceptRequest = async (reqId: string) => {
    setRespondingReqId(reqId);
    try {
      const coordinatorNotified = await respondToRequestInFirestore(reqId, 'accepted');
      setSuccessMessage(coordinatorNotified
        ? 'Ambulance request accepted. The coordinator was notified.'
        : 'Ambulance request accepted. The status is visible in the coordinator live request list.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not respond to the request.');
    } finally {
      setRespondingReqId(null);
    }
  };

  const handleRejectRequest = async (reqId: string) => {
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
        ? 'Ambulance request declined. The coordinator was notified.'
        : 'Ambulance request declined. The status is visible in the coordinator live request list.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not respond to the request.');
    } finally {
      setRespondingReqId(null);
    }
  };

  const tripStatuses: AmbulanceTripStatus[] = [
    'dispatched',
    'en_route',
    'arrived',
    'picked_up',
    'in_transit',
    'delivered',
    'completed'
  ];

  const handleAdvanceTrip = (trip: AmbulanceTrip) => {
    const currentIndex = tripStatuses.indexOf(trip.status);
    if (currentIndex < tripStatuses.length - 1) {
      const nextStatus = tripStatuses[currentIndex + 1];
      dataStore.updateTripStatus(trip.tripId, nextStatus);
      setSuccessMessage(`Trip status advanced to ${nextStatus.toUpperCase().replace('_', ' ')}.`);
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  if (!profile) {
    return (
      <div className="max-w-7xl mx-auto p-8 space-y-4 text-center text-slate-500">
        Loading Ambulance Provider Dashboard...
        {requestsError && <p role="alert" className="text-sm text-red-700">{requestsError}</p>}
        {currentUser && <ProviderRequestsPanel providerUid={currentUser.uid} title="Assigned Ambulance Requests" />}
      </div>
    );
  }

  const pendingRequests = requests.filter((r) => isActionRequired(String(r.status)));
  const activeTrips = trips.filter((t) => t.status !== 'completed');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0 text-amber-600">
            <Truck className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{profile.providerName}</h1>
              {profile.isVerified && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  <ShieldCheck className="w-3.5 h-3.5" /> Certified Fleet
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
          <button
            onClick={() => setShowAddVehicle(true)}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add Vehicle
          </button>
          <button
            onClick={loadData}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
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

      {/* ACTIVE AMBULANCE TRIPS LIFECYCLE (Task 14) */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Navigation className="w-5 h-5 text-amber-600" /> Active Emergency Trips (Live Stepper)
            </h2>
            <p className="text-xs text-slate-500">
              Manage the 7-step lifecycle: Dispatched → En Route → Arrived → Picked Up → In Transit → Delivered → Completed.
            </p>
          </div>
          <span className="text-xs font-bold bg-amber-100 text-amber-900 px-2.5 py-1 rounded-full">
            {activeTrips.length} In Progress
          </span>
        </div>

        {activeTrips.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-xs">
            No trips currently in transit. Dispatched emergency requests appear here.
          </div>
        ) : (
          <div className="space-y-4">
            {activeTrips.map((trip) => {
              const currentStepIndex = tripStatuses.indexOf(trip.status);
              const isFinal = trip.status === 'completed';
              return (
                <div key={trip.tripId} className="p-5 rounded-xl border-2 border-amber-200 bg-amber-50/20 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-base text-slate-900 font-mono">{trip.tripId}</span>
                        <span className="text-xs bg-slate-200 font-mono px-2 py-0.5 rounded text-slate-800">
                          Case: {trip.caseId}
                        </span>
                        <span className="text-xs font-bold uppercase px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900">
                          {trip.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-600">
                        <span>Vehicle: <strong>{trip.vehicleId}</strong> ({trip.vehicleType})</span>
                        <span>Driver: <strong>{trip.driverName}</strong> ({trip.driverPhone})</span>
                      </div>
                    </div>

                    {!isFinal && (
                      <button
                        onClick={() => handleAdvanceTrip(trip)}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        Advance Status: {tripStatuses[currentStepIndex + 1]?.toUpperCase().replace('_', ' ')}
                      </button>
                    )}
                  </div>

                  {/* Locations */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-white rounded-xl border border-amber-100 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400">Pickup Location</span>
                      <p className="font-medium text-slate-800 mt-0.5">{trip.pickupLocation.address}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400">Destination</span>
                      <p className="font-medium text-slate-800 mt-0.5">{trip.destinationLocation.address}</p>
                    </div>
                  </div>

                  {/* 7-Step Visual Stepper */}
                  <div className="pt-2">
                    <div className="grid grid-cols-2 sm:grid-cols-7 gap-1">
                      {tripStatuses.map((st, i) => {
                        const isDone = i <= currentStepIndex;
                        const isCurrent = i === currentStepIndex;
                        return (
                          <div
                            key={st}
                            className={`p-2 rounded-lg text-center transition-all ${
                              isCurrent
                                ? 'bg-amber-500 text-white font-bold shadow-xs'
                                : isDone
                                ? 'bg-amber-100 text-amber-900 font-semibold'
                                : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            <div className="text-[10px] tracking-tight truncate">
                              {i + 1}. {st.replace('_', ' ')}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Grid: Vehicle Fleet + Incoming Requests */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Registered Vehicles */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <h2 className="font-bold text-slate-900 text-base flex items-center gap-2 border-b border-slate-100 pb-3">
              <Truck className="w-5 h-5 text-amber-600" /> Fleet Vehicles ({profile.vehicles.length})
            </h2>

            <div className="space-y-3">
              {profile.vehicles.map((v) => (
                <div key={v.vehicleId} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 font-mono">{v.vehicleId}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        v.isAvailable
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {v.isAvailable ? 'Available' : 'On Active Trip'}
                    </span>
                  </div>
                  <div className="text-slate-600">Type: <span className="font-semibold text-slate-800">{v.vehicleType}</span></div>
                  <div className="text-slate-600">Driver: <span className="font-semibold text-slate-800">{v.driverName}</span> ({v.driverPhone})</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Incoming Requests Queue */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Incoming Trip Requests
                {pendingRequests.length > 0 && (
                  <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                    {pendingRequests.length} Pending
                  </span>
                )}
              </h2>
            </div>

            {requestsError ? (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">{requestsError}</div>
            ) : requestsLoading ? (
              <div className="py-8 text-center text-slate-500 text-xs">Loading assigned ambulance requests...</div>
            ) : requests.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No ambulance trip requests received yet.
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
                        <span className="text-xs font-bold text-red-800 bg-red-100 px-2 py-0.5 rounded">
                          Priority: {req.details.urgency || 'Not specified'}
                        </span>
                        <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                          {req.details.vehicleType || 'ALS Ambulance'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        Pickup: <strong>{req.details.pickupAddress || 'Patient Incident Location'}</strong>
                      </p>
                      <p className="text-xs text-slate-600">
                        Destination: <strong>{req.details.destinationAddress || 'Assigned Hospital'}</strong>
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
                            onClick={() => handleAcceptRequest(req.requestId)}
                            className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs flex items-center gap-1"
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
                        <label htmlFor={`ambulance-rejection-${req.requestId}`} className="block text-xs font-semibold text-red-900">
                          Rejection reason (required)
                        </label>
                        <textarea
                          id={`ambulance-rejection-${req.requestId}`}
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
                          <button type="button" disabled={respondingReqId !== null || rejectionReason.trim().length < 5} onClick={() => handleRejectRequest(req.requestId)} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
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

      {/* Add Vehicle Modal */}
      {showAddVehicle && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form onSubmit={handleAddVehicle} className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-slate-900 text-base">Register New Fleet Ambulance</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Registration / Plate Number</label>
                <input
                  type="text"
                  required
                  value={newVehicleId}
                  onChange={(e) => setNewVehicleId(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Vehicle Classification</label>
                <select
                  value={newVehicleType}
                  onChange={(e) => setNewVehicleType(e.target.value as any)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                >
                  <option value="ALS">Advanced Life Support (ALS) with Defibrillator</option>
                  <option value="BLS">Basic Life Support (BLS)</option>
                  <option value="Patient Transport">Patient Transport / Non-Critical</option>
                </select>
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Driver Name</label>
                <input
                  type="text"
                  required
                  value={newDriverName}
                  onChange={(e) => setNewDriverName(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Driver Emergency Phone</label>
                <input
                  type="text"
                  required
                  value={newDriverPhone}
                  onChange={(e) => setNewDriverPhone(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddVehicle(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs"
              >
                Add to Dispatch Fleet
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
