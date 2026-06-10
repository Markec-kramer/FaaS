import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDevices, getAlerts, getUserProfile } from '../api/api';
import { formatDate } from '../utils/helpers';

const SEVERITY_STYLES = {
  info:     'bg-blue-100 text-blue-700',
  warning:  'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
};

function StatCard({ icon, label, value, color, linkTo }) {
  const inner = (
    <div className={`bg-white rounded-xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow ${linkTo ? 'cursor-pointer' : ''}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  );
  return linkTo ? <Link to={linkTo}>{inner}</Link> : inner;
}

export default function Dashboard() {
  const { token } = useAuth();
  const [devices, setDevices] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      getDevices(token),
      getAlerts(token, { limit: 5 }),
      getUserProfile(token),
    ])
      .then(([dRes, aRes, pRes]) => {
        setDevices(dRes.devices || []);
        setAlerts(aRes.alerts || []);
        setProfile(pRes.user || null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const onlineCount = devices.filter((d) => d.status === 'online').length;
  const unreadCount = alerts.filter((a) => !a.isRead).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-400 text-lg">Nalagam...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800">
            Dobrodošli{profile?.displayName ? `, ${profile.displayName}` : ''}! 👋
          </h1>
          <p className="text-slate-500 mt-1">Pregled vašega pametnega doma</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {/* Statistike */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatCard icon="📱" label="Skupaj naprav"        value={devices.length} color="text-slate-800"  linkTo="/devices" />
          <StatCard icon="✅" label="Naprave online"       value={onlineCount}    color="text-green-600"  linkTo="/devices" />
          <StatCard icon="🔔" label="Neprebrana opozorila" value={unreadCount}    color="text-amber-600"  linkTo="/alerts"  />
        </div>

        {/* Zadnja opozorila */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">Zadnja opozorila</h2>
            <Link to="/alerts" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
              Vsa opozorila →
            </Link>
          </div>

          {alerts.length === 0 ? (
            <p className="text-slate-400 text-sm py-4 text-center">Ni opozoril</p>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-start justify-between p-3 rounded-lg ${
                    alert.isRead ? 'bg-slate-50' : 'bg-white border border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info}`}>
                      {(alert.severity || 'INFO').toUpperCase()}
                    </span>
                    <div>
                      <p className="text-sm text-slate-700">{alert.message}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{formatDate(alert.createdAt)}</p>
                    </div>
                  </div>
                  {!alert.isRead && <span className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Hitre akcije */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link to="/devices" className="flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl p-5 transition-colors">
            <span className="text-2xl">📱</span>
            <div>
              <p className="font-semibold">Upravljanje naprav</p>
              <p className="text-indigo-200 text-sm">Dodaj, uredi ali izbriši naprave</p>
            </div>
          </Link>
          <Link to="/alerts" className="flex items-center gap-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl p-5 transition-colors">
            <span className="text-2xl">🔔</span>
            <div>
              <p className="font-semibold">Opozorila</p>
              <p className="text-amber-100 text-sm">Preglej in upravljaj opozorila</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
