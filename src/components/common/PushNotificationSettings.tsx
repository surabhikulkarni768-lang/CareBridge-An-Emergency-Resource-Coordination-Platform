import React from 'react';
import { BellRing, LoaderCircle } from 'lucide-react';
import type { PushNotificationPreferences } from '../../services/pushNotificationService';

interface PushNotificationSettingsProps {
  preferences: PushNotificationPreferences;
  error: string | null;
  busy: boolean;
  onEnable: () => void;
  onDisable: () => void;
  onPreferenceChange: (key: 'emergencyStatus' | 'requestAssignments' | 'providerResponses', value: boolean) => void;
}

export const PushNotificationSettings: React.FC<PushNotificationSettingsProps> = ({
  preferences,
  error,
  busy,
  onEnable,
  onDisable,
  onPreferenceChange
}) => (
  <section className="absolute right-0 top-12 z-50 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-2xl">
    <div className="mb-3 flex items-center gap-2">
      <BellRing className="h-4 w-4 text-teal-700" />
      <h3 className="text-sm font-semibold text-slate-800">Push notification settings</h3>
    </div>
    <p className="mb-3 text-xs leading-relaxed text-slate-600">
      In-app notifications stay available. Browser alerts are sent to this device after you opt in.
    </p>
    {!preferences.pushEnabled ? (
      <button
        type="button"
        disabled={busy}
        onClick={onEnable}
        className="w-full rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
      >
        {busy ? 'Enabling…' : 'Enable browser alerts'}
      </button>
    ) : (
      <>
        <p className="mb-3 text-xs font-medium text-emerald-700">Browser alerts are enabled for this account.</p>
        <div className="space-y-2">
          {([
            ['emergencyStatus', 'Emergency status changes'],
            ['requestAssignments', 'New or reassigned requests'],
            ['providerResponses', 'Provider acceptances and rejections']
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-3 text-xs text-slate-700">
              <span>{label}</span>
              <input
                type="checkbox"
                checked={preferences[key]}
                disabled={busy}
                onChange={(event) => onPreferenceChange(key, event.target.checked)}
                className="h-4 w-4 accent-teal-700"
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={onDisable}
          className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {busy ? <LoaderCircle className="mx-auto h-4 w-4 animate-spin" /> : 'Turn off browser alerts'}
        </button>
      </>
    )}
    {error && <p role="alert" className="mt-3 text-xs text-red-700">{error}</p>}
  </section>
);
