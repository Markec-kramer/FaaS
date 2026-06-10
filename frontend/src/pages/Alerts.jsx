import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAlerts, markAlertRead, markAllAlertsRead } from '../api/api';
import { formatDate } from '../utils/helpers';

const SEVERITY_STYLES = {
  info:     'bg-blue-100 text-blue-700 border-blue-200',
  warning:  'bg-amber-100 text-amber-700 border-amber-200',
  critical: 'bg-red-100 text-red-700 border-red-200',
};

const ALERT_TYPE_LABELS = {
  DEVICE_OFFLINE:         'Naprava offline',
  DEVICE_ONLINE:          'Naprava online',
  THRESHOLD_VIOLATION:    'Prekoračitev praga',
  AUTOMATION_TRIGGERED:   'Avtomatizacija',
  CAMERA_IMAGE_CAPTURED:  'Slika kamere',
};

export default function Alerts() {
  const { token } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [marking, setMarking] = useState(false);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const params = { limit: 50 };
      if (filter === 'unread') params.unreadOnly = true;
      const res = await getAlerts(token, params);
      setAlerts(res.alerts || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAlerts(); }, [token, filter]);

  const handleMarkRead = async (alertId) => {
    try {
      await markAlertRead(token, alertId);
      setAlerts((prev) => prev.map((a) => a.id === alertId ? { ...a, isRead: true } : a));
    } catch (e) {
      setError(e.message);
    }
  };

  const handleMarkAllRead = async () => {
    setMarking(true);
    try {
      await markAllAlertsRead(token);
      setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
    } catch (e) {
      setError(e.message);
    } finally {
      setMarking(false);
    }
  };

  const unreadCount = alerts.filter((a) => !a.isRead).length;

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Glava */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Opozorila 🔔</h1>
            <p className="text-slate-500 text-sm mt-1">
              {unreadCount > 0 ? `${unreadCount} neprebranih` : 'Ni neprebranih opozoril'}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={marking}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-4 py-2 rounded-lg text-sm transition-colors"
            >
              {marking ? 'Označujem...' : 'Označi vse kot prebrano'}
            </button>
          )}
        </div>

        {/* Filter zavihki */}
        <div className="flex gap-2 mb-6">
          {[
            { key: 'all',    label: 'Vsa opozorila' },
            { key: 'unread', label: 'Samo neprebrana' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {/* Seznam opozoril */}
        {loading ? (
          <div className="text-center py-12 text-slate-400">Nalagam opozorila...</div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-slate-100">
            <p className="text-4xl mb-3">✅</p>
            <p className="text-slate-500">
              {filter === 'unread' ? 'Ni neprebranih opozoril.' : 'Ni opozoril.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`bg-white rounded-xl border p-4 transition-all ${
                  alert.isRead ? 'border-slate-100 opacity-70' : 'border-slate-200 shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                        SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info
                      }`}>
                        {(alert.severity || 'INFO').toUpperCase()}
                      </span>
                      {alert.type && (
                        <span className="text-xs text-slate-400">
                          {ALERT_TYPE_LABELS[alert.type] || alert.type}
                        </span>
                      )}
                      {!alert.isRead && (
                        <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                      )}
                    </div>
                    <p className="text-sm text-slate-700">{alert.message}</p>
                    <div className="flex gap-3 text-xs text-slate-400">
                      {alert.deviceName && <span>Naprava: {alert.deviceName}</span>}
                      <span>{formatDate(alert.createdAt)}</span>
                    </div>
                  </div>
                  {!alert.isRead && (
                    <button
                      onClick={() => handleMarkRead(alert.id)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium whitespace-nowrap flex-shrink-0"
                    >
                      Označi prebrano
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
