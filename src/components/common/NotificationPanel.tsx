import React from 'react';
import { Bell, CheckCheck, X, Clock, ExternalLink, AlertTriangle, ShieldCheck, Truck, Activity } from 'lucide-react';
import type { NotificationItem } from '../../types';

interface NotificationPanelProps {
  notifications: NotificationItem[];
  isOpen: boolean;
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onSelectNotification?: (notif: NotificationItem) => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  notifications,
  isOpen,
  onClose,
  onMarkRead,
  onMarkAllRead,
  onSelectNotification
}) => {
  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'ambulance_dispatched':
      case 'ambulance_updated':
        return <Truck className="w-4 h-4 text-amber-500" />;
      case 'request_accepted':
        return <CheckCheck className="w-4 h-4 text-emerald-500" />;
      case 'request_rejected':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'provider_verified':
        return <ShieldCheck className="w-4 h-4 text-teal-500" />;
      default:
        return <Activity className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="absolute right-0 top-12 w-84 sm:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-slate-700" />
          <h3 className="font-semibold text-slate-800 text-sm">Notifications</h3>
          {unreadCount > 0 && (
            <span className="bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {unreadCount} new
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              className="text-[11px] text-teal-700 hover:text-teal-900 font-medium hover:underline"
            >
              Mark all read
            </button>
          )}
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-200/60"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
        {notifications.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-300" />
            No notifications yet.
          </div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => {
                onMarkRead(notif.id);
                if (onSelectNotification) onSelectNotification(notif);
              }}
              className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer text-left ${
                notif.isRead ? 'bg-white hover:bg-slate-50/80' : 'bg-teal-50/50 hover:bg-teal-50/90'
              }`}
            >
              <div className="mt-0.5 p-1.5 rounded-lg bg-slate-100 shrink-0">
                {getIcon(notif.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <p className={`text-xs ${notif.isRead ? 'font-medium text-slate-700' : 'font-bold text-slate-900'}`}>
                    {notif.title}
                  </p>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">
                    {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {notif.message}
                </p>
                {notif.relatedCaseId && (
                  <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-mono text-teal-700 bg-teal-100/60 px-1.5 py-0.5 rounded">
                    Case: {notif.relatedCaseId}
                  </span>
                )}
              </div>
              {!notif.isRead && (
                <span className="w-2 h-2 rounded-full bg-teal-600 mt-1.5 shrink-0" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

