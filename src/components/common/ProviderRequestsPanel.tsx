import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, LoaderCircle, XCircle } from 'lucide-react';
import { respondToRequestInFirestore, subscribeRequestsForProviderFromFirestore } from '../../services/dataService';
import type { ResourceRequest } from '../../types';

interface ProviderRequestsPanelProps {
  providerUid: string;
  title?: string;
  onRequestsChange?: (requests: ResourceRequest[]) => void;
}

const isActionRequired = (status: string) =>
  ['pending', 'assigned', 'requested'].includes(status.toLowerCase());

const formatLabel = (key: string) =>
  key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());

const formatTimestamp = (value?: string) => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleString();
};

export const ProviderRequestsPanel: React.FC<ProviderRequestsPanelProps> = ({
  providerUid,
  title = 'Assigned Emergency Requests',
  onRequestsChange
}) => {
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [respondingRequestId, setRespondingRequestId] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setLoadError(null);
    setRequests([]);
    onRequestsChange?.([]);
    if (!providerUid) {
      setLoadError('Sign in with a provider account to view assigned requests.');
      setIsLoading(false);
      return;
    }

    return subscribeRequestsForProviderFromFirestore(
      providerUid,
      (nextRequests) => {
        setRequests(nextRequests);
        onRequestsChange?.(nextRequests);
        setIsLoading(false);
        setLoadError(null);
      },
      (message) => {
        setLoadError(message);
        onRequestsChange?.([]);
        setIsLoading(false);
      }
    );
  }, [onRequestsChange, providerUid]);

  const respond = async (request: ResourceRequest, decision: 'accepted' | 'rejected') => {
    setActionError(null);
    setSuccessMessage(null);
    if (decision === 'rejected' && rejectionReason.trim().length < 5) {
      setActionError('Enter a rejection reason of at least five characters.');
      return;
    }
    setRespondingRequestId(request.requestId);
    try {
      const coordinatorNotified = await respondToRequestInFirestore(
        request.requestId,
        decision,
        decision === 'rejected' ? rejectionReason.trim() : undefined
      );
      setRejectingRequestId(null);
      setRejectionReason('');
      const responseLabel = decision === 'accepted' ? 'Request accepted.' : 'Request rejected.';
      setSuccessMessage(coordinatorNotified
        ? `${responseLabel} Coordinator notified.`
        : `${responseLabel} Status is visible in the coordinator live request list.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not respond to the assigned request.');
    } finally {
      setRespondingRequestId(null);
    }
  };

  return (
    <section className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {!isLoading && !loadError && (
          <span className="text-xs text-slate-500">{requests.length} assigned</span>
        )}
      </div>

      {loadError && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <AlertCircle className="mr-1 inline h-4 w-4" />
          {loadError}
        </div>
      )}
      {actionError && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <AlertCircle className="mr-1 inline h-4 w-4" />
          {actionError}
        </div>
      )}
      {successMessage && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
          <CheckCircle2 className="mr-1 inline h-4 w-4" />
          {successMessage}
        </div>
      )}

      {isLoading ? (
        <div className="py-8 text-center text-sm text-slate-500">
          <LoaderCircle className="mx-auto mb-2 h-5 w-5 animate-spin" />
          Loading assigned requests...
        </div>
      ) : !loadError && requests.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500">
          No resource requests are currently assigned to this account.
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <article key={request.requestId} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-bold text-slate-900">{request.patientName || 'Patient information unavailable'}</p>
                  <p className="font-mono text-xs text-slate-600">Emergency ID: {request.caseId}</p>
                  <p className="text-xs text-slate-600">
                    Priority: <span className="font-semibold text-slate-800">{request.details.urgency || 'Not specified'}</span>
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                  isActionRequired(String(request.status))
                    ? 'bg-amber-100 text-amber-800'
                    : String(request.status).toLowerCase() === 'accepted'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-red-100 text-red-800'
                }`}>
                  {String(request.status).replace(/_/g, ' ')}
                </span>
              </div>

              <div className="grid gap-2 rounded-lg border border-slate-100 bg-white p-3 text-xs sm:grid-cols-2">
                <p>
                  <span className="font-semibold text-slate-700">Resource:</span>{' '}
                  {formatLabel(request.resourceType)}
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Assigned:</span>{' '}
                  {formatTimestamp(request.assignedAt || request.createdAt)}
                </p>
                {Object.entries(request.details).filter(([, value]) => value !== undefined && value !== '').map(([key, value]) => (
                  <p key={key} className={key === 'notes' || key.toLowerCase().includes('address') ? 'sm:col-span-2' : ''}>
                    <span className="font-semibold text-slate-700">{formatLabel(key)}:</span> {String(value)}
                  </p>
                ))}
              </div>

              {request.respondedAt && (
                <div className="text-xs text-slate-600">
                  <Clock className="mr-1 inline h-3.5 w-3.5" />
                  Response recorded {formatTimestamp(request.respondedAt)}
                  {request.respondedByUid && ` by provider ${request.respondedByUid}`}
                  {request.responseDetails && <p className="mt-1">{request.responseDetails}</p>}
                </div>
              )}

              {isActionRequired(String(request.status)) && (
                <div className="space-y-2 border-t border-slate-200 pt-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      disabled={respondingRequestId !== null}
                      onClick={() => {
                        setActionError(null);
                        setRejectingRequestId(rejectingRequestId === request.requestId ? null : request.requestId);
                      }}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      disabled={respondingRequestId !== null}
                      onClick={() => void respond(request, 'accepted')}
                      className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {respondingRequestId === request.requestId ? 'Saving...' : 'Accept'}
                    </button>
                  </div>
                  {rejectingRequestId === request.requestId && (
                    <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
                      <label htmlFor={`rejection-${request.requestId}`} className="block text-xs font-semibold text-red-900">
                        Rejection reason (required)
                      </label>
                      <textarea
                        id={`rejection-${request.requestId}`}
                        required
                        minLength={5}
                        rows={2}
                        value={rejectionReason}
                        onChange={(event) => setRejectionReason(event.target.value)}
                        className="w-full rounded-lg border border-red-200 bg-white p-2 text-xs text-slate-900"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={respondingRequestId !== null}
                          onClick={() => setRejectingRequestId(null)}
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={respondingRequestId !== null || rejectionReason.trim().length < 5}
                          onClick={() => void respond(request, 'rejected')}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {respondingRequestId === request.requestId ? 'Saving...' : 'Confirm rejection'}
                        </button>
                      </div>
                    </div>
                  )}
                  {respondingRequestId === request.requestId && (
                    <p className="text-right text-xs text-slate-500">Saving response...</p>
                  )}
                </div>
              )}
              {String(request.status).toLowerCase() === 'rejected' && request.rejectionReason && (
                <p className="flex items-start gap-1 text-xs text-red-800">
                  <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Rejection reason: {request.rejectionReason}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
