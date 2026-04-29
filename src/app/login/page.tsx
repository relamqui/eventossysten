'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (res.ok) {
        const userData = await res.json();
        login(userData);
      } else {
        const data = await res.json();
        setError(data.error || 'Credenciais inválidas');
      }
    } catch (err) {
      setError('Falha de conexão com o servidor');
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--background)',
      backgroundImage: 'radial-gradient(circle at top right, rgba(139, 92, 246, 0.1), transparent 40%), radial-gradient(circle at bottom left, rgba(139, 92, 246, 0.05), transparent 40%)',
    }}>
      <div style={{
        backgroundColor: 'var(--surface)',
        padding: '48px',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        border: '1px solid var(--border)',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '8px' }}>Eventos Systen</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Acesse sua conta para continuar</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Usuário</label>
            <input 
              type="text" 
              required
              value={username}
              onChange={e => setUsername(e.target.value)}
              style={{ 
                width: '100%', padding: '14px', borderRadius: '12px', 
                border: '1px solid var(--border)', backgroundColor: 'var(--background)', 
                color: '#fff', fontSize: '1rem', transition: 'border-color 0.2s'
              }} 
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Senha</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ 
                width: '100%', padding: '14px', borderRadius: '12px', 
                border: '1px solid var(--border)', backgroundColor: 'var(--background)', 
                color: '#fff', fontSize: '1rem', transition: 'border-color 0.2s'
              }} 
            />
          </div>

          {error && <div style={{ color: 'var(--status-overdue)', fontSize: '0.9rem', textAlign: 'center' }}>{error}</div>}

          <button 
            type="submit" 
            disabled={loading}
            style={{ 
              width: '100%', padding: '14px', borderRadius: '12px', 
              backgroundColor: 'var(--primary)', color: '#fff', 
              fontWeight: 'bold', fontSize: '1rem', marginTop: '8px',
              transition: 'background-color 0.2s', boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
              opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
