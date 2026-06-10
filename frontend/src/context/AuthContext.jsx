import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('sdToken'));
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sdUser')); } catch { return null; }
  });

  const login = (idToken, userData) => {
    setToken(idToken);
    setUser(userData);
    localStorage.setItem('sdToken', idToken);
    localStorage.setItem('sdUser', JSON.stringify(userData));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('sdToken');
    localStorage.removeItem('sdUser');
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
