'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export interface User {
  id: number;
  nome: string;
  username: string;
  isAdmin: boolean;
  permBoletos: boolean;
  permContratos: boolean;
  permFinanceiro: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const storedUser = localStorage.getItem('eventosUser');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      checkPermissions(parsedUser, pathname);
    } else {
      if (pathname !== '/login') {
        router.push('/login');
      }
    }
    setLoading(false);
  }, [pathname]);

  const checkPermissions = (currentUser: User, path: string) => {
    if (path === '/login') {
      router.push('/controle-boletos');
      return;
    }
    if (path === '/controle-boletos' && !currentUser.permBoletos && !currentUser.isAdmin) {
      router.push('/');
    }
    if (path === '/controle-contratos' && !currentUser.permContratos && !currentUser.isAdmin) {
      router.push('/');
    }
    if (path === '/financeiro' && !currentUser.permFinanceiro && !currentUser.isAdmin) {
      router.push('/');
    }
    if (path === '/gestao-usuarios' && !currentUser.isAdmin) {
      router.push('/');
    }
  };

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem('eventosUser', JSON.stringify(userData));
    router.push('/controle-boletos');
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('eventosUser');
    router.push('/login');
  };

  if (loading) {
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--background)' }}><h2 style={{ color: 'var(--text-secondary)' }}>Carregando...</h2></div>;
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
