import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_LINKS = [
  { to: '/',        label: 'Nadzorna plošča' },
  { to: '/devices', label: 'Naprave' },
  { to: '/alerts',  label: 'Opozorila' },
  { to: '/profile', label: 'Profil' },
];

export default function Navbar() {
  const { logout, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg text-slate-800">
          <span className="text-2xl">🏠</span>
          <span>SmartDOM</span>
        </Link>

        <div className="flex items-center gap-1">
          {NAV_LINKS.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === to
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400 hidden md:block truncate max-w-[160px]">
            {user?.email}
          </span>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
          >
            Odjava
          </button>
        </div>
      </div>
    </nav>
  );
}
