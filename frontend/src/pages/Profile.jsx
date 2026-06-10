import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUserProfile, updateUserProfile } from '../api/api';

export default function Profile() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ displayName: '', phoneNumber: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getUserProfile(token)
      .then((res) => {
        const p = res.user || {};
        setProfile(p);
        setForm({ displayName: p.displayName || '', phoneNumber: p.phoneNumber || '' });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setSaving(true);
    try {
      await updateUserProfile(token, form);
      setMessage('Profil uspešno posodobljen!');
      setProfile((prev) => ({ ...prev, ...form }));
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-400">Nalagam...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-2xl font-bold text-slate-800 mb-6">Profil 👤</h1>

        {/* Kartica profila */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 mb-6">
          {/* Povzetek uporabnika */}
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100">
            <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-2xl">
              👤
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-lg">
                {profile?.displayName || 'Brez imena'}
              </p>
              <p className="text-slate-500 text-sm">{user?.email}</p>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">UID: {user?.uid}</p>
            </div>
          </div>

          {message && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {message}
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          {/* Obrazec za urejanje */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Ime in priimek
              </label>
              <input
                type="text"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Janez Novak"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Telefonska številka
              </label>
              <input
                type="tel"
                value={form.phoneNumber}
                onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="+386 41 123 456"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium px-6 py-2.5 rounded-lg text-sm transition-colors"
            >
              {saving ? 'Shranjujem...' : 'Shrani spremembe'}
            </button>
          </form>
        </div>

        {/* Odjava */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-1">Odjava iz sistema</h2>
          <p className="text-slate-500 text-sm mb-4">
            Po odjavi boste preusmerjeni na stran za prijavo.
          </p>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="bg-red-50 hover:bg-red-100 text-red-600 font-medium px-6 py-2.5 rounded-lg text-sm transition-colors border border-red-100"
          >
            Odjava
          </button>
        </div>
      </div>
    </div>
  );
}
