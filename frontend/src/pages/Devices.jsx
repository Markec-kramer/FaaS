import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDevices, addDevice, deleteDevice, updateDevice, sendSensorData } from '../api/api';
import { DEVICE_TYPES, SENSOR_CONFIG } from '../utils/helpers';

const VALID_TYPES = Object.keys(DEVICE_TYPES);

function DeviceCard({ device, onDelete, onToggle }) {
  const [deleting, setDeleting]     = useState(false);
  const [toggling, setToggling]     = useState(false);
  const [showSim, setShowSim]       = useState(false);
  const [simValue, setSimValue]     = useState('');
  const [sending, setSending]       = useState(false);
  const [simStatus, setSimStatus]   = useState(null); // null | 'ok' | string (error)

  const typeInfo    = DEVICE_TYPES[device.type]   || { label: device.type, icon: '📦' };
  const sensorConf  = SENSOR_CONFIG[device.type];  // undefined za camera/light/lock

  const handleDelete = async () => {
    if (!window.confirm(`Izbriši napravo "${device.name}"?`)) return;
    setDeleting(true);
    try { await onDelete(device.id); } finally { setDeleting(false); }
  };

  const handleToggle = async () => {
    setToggling(true);
    try { await onToggle(device.id, !device.isActive); } finally { setToggling(false); }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    setSending(true);
    setSimStatus(null);
    try {
      await sendSensorData(device.id, sensorConf.dataType, parseFloat(simValue), sensorConf.unit);
      setSimStatus('ok');
      setSimValue('');
    } catch (err) {
      setSimStatus(err.message);
    } finally {
      setSending(false);
    }
  };

  const toggleSim = () => {
    setShowSim((v) => !v);
    setSimStatus(null);
    setSimValue('');
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col gap-3">
      {/* Glava kartice */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{typeInfo.icon}</span>
          <div>
            <h3 className="font-semibold text-slate-800 leading-tight">{device.name}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{typeInfo.label}</p>
          </div>
        </div>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 ${
          device.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {device.status === 'online' ? '● Online' : '● Offline'}
        </span>
      </div>

      {device.location && <p className="text-sm text-slate-500">📍 {device.location}</p>}
      {device.description && <p className="text-xs text-slate-400 italic">{device.description}</p>}

      {/* Zadnja vrednost */}
      {device.lastValue !== null && device.lastValue !== undefined && (
        <div className="bg-slate-50 rounded-lg px-3 py-2">
          <p className="text-xs text-slate-400">Zadnja vrednost</p>
          <p className="text-sm font-semibold text-slate-700">
            {device.lastValue} {device.lastValueUnit || ''}
          </p>
        </div>
      )}

      {/* Gumbi za upravljanje */}
      <div className="flex gap-2">
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={`flex-1 text-xs font-medium py-1.5 rounded-lg transition-colors ${
            device.isActive
              ? 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              : 'bg-green-100 hover:bg-green-200 text-green-700'
          }`}
        >
          {toggling ? '...' : device.isActive ? 'Deaktiviraj' : 'Aktiviraj'}
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex-1 text-xs font-medium py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
        >
          {deleting ? '...' : '🗑 Izbriši'}
        </button>
      </div>

      {/* ── Simulator senzorja (samo za senzorske naprave) ── */}
      {sensorConf && (
        <div className="border-t border-slate-100 pt-3">
          <button
            onClick={toggleSim}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            {showSim ? '▲ Skrij simulator' : '🔬 Simuliraj senzor'}
          </button>

          {showSim && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-slate-400">{sensorConf.hint}</p>

              {/* Hiter gumb za testno vrednost, ki sproži alarm */}
              <button
                type="button"
                onClick={() => setSimValue(String(sensorConf.alertExample))}
                className="text-xs px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded border border-amber-200 transition-colors"
              >
                ⚡ Nastavi vrednost za alarm ({sensorConf.alertExample}{sensorConf.unit})
              </button>

              <form onSubmit={handleSend} className="flex gap-2 items-center">
                <input
                  type="number"
                  value={simValue}
                  onChange={(e) => setSimValue(e.target.value)}
                  placeholder={String(sensorConf.defaultValue)}
                  className="flex-1 px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  step="any"
                  required
                />
                {sensorConf.unit && (
                  <span className="text-sm text-slate-500 flex-shrink-0">{sensorConf.unit}</span>
                )}
                <button
                  type="submit"
                  disabled={sending}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs rounded-lg font-medium transition-colors flex-shrink-0"
                >
                  {sending ? '...' : 'Pošlji'}
                </button>
              </form>

              {simStatus === 'ok' && (
                <p className="text-xs text-green-600">
                  ✓ Podatki poslani!{' '}
                  <Link to="/alerts" className="underline font-medium">Preveri opozorila →</Link>
                </p>
              )}
              {simStatus && simStatus !== 'ok' && (
                <p className="text-xs text-red-600">✗ {simStatus}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────

const EMPTY_FORM = { name: '', type: 'temperature_sensor', location: '', description: '' };

export default function Devices() {
  const { token } = useAuth();
  const [devices, setDevices]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [adding, setAdding]       = useState(false);
  const [formError, setFormError] = useState('');

  const loadDevices = async () => {
    try {
      const res = await getDevices(token);
      setDevices(res.devices || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDevices(); }, [token]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setFormError('');
    setAdding(true);
    try {
      await addDevice(token, form);
      setForm(EMPTY_FORM);
      setShowForm(false);
      await loadDevices();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (deviceId) => {
    try {
      await deleteDevice(token, deviceId);
      setDevices((prev) => prev.filter((d) => d.id !== deviceId));
    } catch (e) {
      setError(e.message);
    }
  };

  const handleToggle = async (deviceId, isActive) => {
    try {
      await updateDevice(token, deviceId, { isActive });
      setDevices((prev) => prev.map((d) => d.id === deviceId ? { ...d, isActive } : d));
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Glava */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Naprave 📱</h1>
            <p className="text-slate-500 text-sm mt-1">{devices.length} naprav skupaj</p>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setFormError(''); }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
          >
            {showForm ? 'Prekliči' : '+ Dodaj napravo'}
          </button>
        </div>

        {/* Obrazec za novo napravo */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 mb-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Nova naprava</h2>
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                {formError}
              </div>
            )}
            <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Ime naprave *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Npr. Termometer v dnevni sobi"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Tip naprave *</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  {VALID_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {DEVICE_TYPES[t].icon} {DEVICE_TYPES[t].label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Lokacija</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Npr. Dnevna soba"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Opis</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Neobvezni opis"
                />
              </div>
              <div className="sm:col-span-2 flex gap-3">
                <button
                  type="submit"
                  disabled={adding}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium px-6 py-2 rounded-lg text-sm transition-colors"
                >
                  {adding ? 'Dodajam...' : 'Dodaj napravo'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setFormError(''); setForm(EMPTY_FORM); }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-6 py-2 rounded-lg text-sm transition-colors"
                >
                  Prekliči
                </button>
              </div>
            </form>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {/* Mreža naprav */}
        {loading ? (
          <div className="text-center py-12 text-slate-400">Nalagam naprave...</div>
        ) : devices.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-slate-100">
            <p className="text-4xl mb-3">📱</p>
            <p className="text-slate-500">Nimate še nobene naprave.</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 text-indigo-600 hover:text-indigo-800 text-sm font-medium"
            >
              Dodaj prvo napravo →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                onDelete={handleDelete}
                onToggle={handleToggle}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
