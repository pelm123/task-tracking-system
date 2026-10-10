import { createContext, useContext, useState, useCallback } from 'react';
import * as authApi from '../api/auth';
import { useLang } from './LanguageContext';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { setLang } = useLang();
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  const login = useCallback(async (email, password) => {
    const data = await authApi.login({ email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    // the account's saved language wins over whatever the login page was showing
    if (data.user.language) setLang(data.user.language, { sync: false });
    return data.user;
  }, [setLang]);

  // Sign-up no longer logs you in: the account has to be approved by an admin
  // first, so there's no token or user to store here.
  const register = useCallback(async (name, email, password, confirmPassword, role) => {
    return authApi.register({ name, email, password, confirmPassword, role });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  const updateUser = useCallback((patch) => {
    setUser((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem('user', JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
