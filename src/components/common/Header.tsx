import React, { useState, useEffect } from 'react';
import {
  Bell,
  LogOut,
  User,
  Shield,
  Activity,
  Building2,
  Droplet,
  Wind,
  Truck,
  Stethoscope,
  ChevronDown,
  Settings2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  markAllNotificationsReadInFirestore,
  markNotificationReadInFirestore,
  subscribeNotificationsForUserFromFirestore
} from '../../services/dataService';
import { NotificationPanel } from './NotificationPanel';
import { PushNotificationSettings } from './PushNotificationSettings';
import {
  DEFAULT_PUSH_PREFERENCES,
  disablePushNotifications,
  enablePushNotificationsAfterConsent,
  subscribeToPushNotificationPreferences,
  updatePushNotificationPreferences,
  type PushNotificationPreferences
} from '../../services/pushNotificationService';
import type { NotificationItem, UserRole } from '../../types';

interface HeaderProps {
  onNavigateLanding?: () => void;
  onOpenLogin?: () => void;
  onOpenSignup?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onNavigateLanding,
  onOpenLogin,
  onOpenSignup
}) => {
  const { currentUser, activeRole, logout, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [pushPreferences, setPushPreferences] = useState<PushNotificationPreferences>(DEFAULT_PUSH_PREFERENCES);
  const [isPushSettingsOpen, setIsPushSettingsOpen] = useState(false);
  const [pushSettingsError, setPushSettingsError] = useState<string | null>(null);
  const [isPushSettingsBusy, setIsPushSettingsBusy] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      setNotificationError(null);
      setPushPreferences(DEFAULT_PUSH_PREFERENCES);
      setPushSettingsError(null);
      return;
    }
    return subscribeNotificationsForUserFromFirestore(
      currentUser.uid,
      (items) => {
        setNotifications(items);
        setNotificationError(null);
      },
      setNotificationError
    );
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    return subscribeToPushNotificationPreferences(
      currentUser.uid,
      setPushPreferences,
      setPushSettingsError
    );
  }, [currentUser]);

  const enablePush = async () => {
    if (!currentUser) return;
    setIsPushSettingsBusy(true);
    setPushSettingsError(null);
    try {
      setPushPreferences(await enablePushNotificationsAfterConsent(currentUser.uid));
    } catch (error) {
      setPushSettingsError(error instanceof Error ? error.message : 'Browser alerts could not be enabled.');
    } finally {
      setIsPushSettingsBusy(false);
    }
  };

  const disablePush = async () => {
    if (!currentUser) return;
    setIsPushSettingsBusy(true);
    setPushSettingsError(null);
    try {
      await disablePushNotifications(currentUser.uid);
      setPushPreferences(DEFAULT_PUSH_PREFERENCES);
    } catch (error) {
      setPushSettingsError(error instanceof Error ? error.message : 'Browser alerts could not be disabled.');
    } finally {
      setIsPushSettingsBusy(false);
    }
  };

  const changePushPreference = async (
    key: 'emergencyStatus' | 'requestAssignments' | 'providerResponses',
    value: boolean
  ) => {
    if (!currentUser) return;
    const updated = { ...pushPreferences, [key]: value };
    setIsPushSettingsBusy(true);
    setPushSettingsError(null);
    try {
      await updatePushNotificationPreferences(currentUser.uid, updated);
      setPushPreferences(updated);
    } catch (error) {
      setPushSettingsError(error instanceof Error ? error.message : 'Notification preference could not be saved.');
    } finally {
      setIsPushSettingsBusy(false);
    }
  };

  const markRead = async (id: string) => {
    try {
      await markNotificationReadInFirestore(id);
      setNotificationError(null);
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : 'Notification could not be marked as read.');
    }
  };

  const markAllRead = async () => {
    if (!currentUser) return;
    try {
      await markAllNotificationsReadInFirestore(currentUser.uid);
      setNotificationError(null);
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : 'Notifications could not be marked as read.');
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const roleLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    patient: { label: 'Patient / Attendant', icon: <User className="w-3.5 h-3.5" />, color: 'bg-teal-600 text-white' },
    patientAttendant: { label: 'Patient Attendant', icon: <User className="w-3.5 h-3.5" />, color: 'bg-teal-600 text-white' },
    patient_attendant: { label: 'Patient Attendant', icon: <User className="w-3.5 h-3.5" />, color: 'bg-teal-600 text-white' },
    attendant: { label: 'Patient Attendant', icon: <User className="w-3.5 h-3.5" />, color: 'bg-teal-600 text-white' },
    hospital: { label: 'Hospital Facility', icon: <Building2 className="w-3.5 h-3.5" />, color: 'bg-blue-600 text-white' },
    bloodBank: { label: 'Blood Bank', icon: <Droplet className="w-3.5 h-3.5" />, color: 'bg-rose-600 text-white' },
    oxygenProvider: { label: 'Oxygen Depot', icon: <Wind className="w-3.5 h-3.5" />, color: 'bg-sky-600 text-white' },
    ambulanceProvider: { label: 'Ambulance Service', icon: <Truck className="w-3.5 h-3.5" />, color: 'bg-amber-600 text-white' },
    doctor: { label: 'Medical Staff / Physician', icon: <Stethoscope className="w-3.5 h-3.5" />, color: 'bg-emerald-600 text-white' },
    admin: { label: 'Central Coordinator / Admin', icon: <Shield className="w-3.5 h-3.5" />, color: 'bg-purple-600 text-white' }
  };

  const getEffectiveRoleBadge = () => {
    if (!activeRole) return null;
    const roleKey = String(activeRole);
    if (roleKey === 'patientAttendant' || roleKey === 'patient_attendant' || roleKey === 'attendant') {
      return { label: 'Patient Attendant', icon: <User className="w-3.5 h-3.5" />, color: 'bg-teal-600 text-white' };
    }
    return roleLabels[roleKey] || { label: 'Patient / Attendant', icon: <User className="w-3.5 h-3.5" />, color: 'bg-teal-600 text-white' };
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      {/* Main Header Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand & Logo */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={onNavigateLanding}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0D9488] to-[#0284C7] p-2 flex items-center justify-center shadow-xs">
            <Activity className="w-6 h-6 text-white stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-slate-900 font-sans">
                Care<span className="text-teal-600">Bridge</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-mono">
                Emergency
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-none">
              Healthcare Resource Coordination Platform
            </p>
          </div>
        </div>

        {/* Right Side: Authenticated Controls vs Public Sign In */}
        <div className="flex items-center gap-3">
          {isAuthenticated && currentUser && activeRole ? (
            <>
              {/* Role Badge Indicator (Derived strictly from authenticated profile) */}
              {(() => {
                const badge = getEffectiveRoleBadge();
                if (!badge) return null;
                return (
                  <div
                    className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs ${badge.color}`}
                  >
                    {badge.icon}
                    <span>{badge.label}</span>
                  </div>
                );
              })()}

              {/* Live Notifications Bell */}
              <div className="relative">
                <button
                  onClick={() => setIsNotifOpen(!isNotifOpen)}
                  className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors relative"
                  title="Notifications"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-orange-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
                      {unreadCount}
                    </span>
                  )}
                </button>

                <NotificationPanel
                  notifications={notifications}
                  isOpen={isNotifOpen}
                  onClose={() => setIsNotifOpen(false)}
                  onMarkRead={(id) => void markRead(id)}
                  onMarkAllRead={() => void markAllRead()}
                  error={notificationError}
                />
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsPushSettingsOpen(!isPushSettingsOpen)}
                  className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                  title="Push notification settings"
                  aria-label="Push notification settings"
                >
                  <Settings2 className="h-5 w-5" />
                </button>
                {isPushSettingsOpen && (
                  <PushNotificationSettings
                    preferences={pushPreferences}
                    error={pushSettingsError}
                    busy={isPushSettingsBusy}
                    onEnable={() => void enablePush()}
                    onDisable={() => void disablePush()}
                    onPreferenceChange={(key, value) => void changePushPreference(key, value)}
                  />
                )}
              </div>

              {/* User Profile Pill & Secure Sign Out */}
              <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
                <div className="text-right hidden md:block">
                  <div className="text-xs font-bold text-slate-900 leading-tight">
                    {currentUser.displayName}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono leading-tight">
                    {currentUser.email}
                  </div>
                </div>

                <button
                  onClick={() => logout()}
                  className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-red-700 hover:bg-red-50 rounded-lg border border-slate-200 transition-colors flex items-center gap-1.5"
                  title="Sign Out of Session"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenLogin}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Log In
              </button>
              <button
                onClick={onOpenSignup}
                className="px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-xs transition-colors"
              >
                Sign Up
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
