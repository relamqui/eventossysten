'use client';

import { Construction } from 'lucide-react';

export default function FinanceiroPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', textAlign: 'center' }}>
      <div style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', padding: '24px', borderRadius: '50%', marginBottom: '24px' }}>
        <Construction size={64} color="var(--primary)" />
      </div>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '16px', color: 'var(--text-primary)' }}>Financeiro</h1>
      <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', maxWidth: '500px' }}>
        Módulo sendo construído. Em breve você terá acesso a todo o controle financeiro por aqui.
      </p>
    </div>
  );
}
