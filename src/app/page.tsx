'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    
    if (user.isAdmin || user.permBoletos) {
      router.push('/controle-boletos');
    } else if (user.permContratos) {
      router.push('/controle-contratos');
    } else if (user.permFinanceiro) {
      router.push('/financeiro');
    }
  }, [user, router]);

  return <div style={{ padding: '40px', color: 'var(--text-secondary)' }}>Carregando módulos...</div>;
}
