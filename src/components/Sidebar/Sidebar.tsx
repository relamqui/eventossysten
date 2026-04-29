'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, FileText, FileSignature, Wallet, Users, LogOut } from 'lucide-react';
import styles from './Sidebar.module.css';
import { useAuth } from '@/contexts/AuthContext';

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();

  useEffect(() => {
    if (collapsed) {
      document.body.classList.add('sidebar-collapsed');
    } else {
      document.body.classList.remove('sidebar-collapsed');
    }
  }, [collapsed]);

  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };

  const navItems = [];
  if (user?.permBoletos || user?.isAdmin) {
    navItems.push({ name: 'Controle Boletos', path: '/controle-boletos', icon: <FileText size={24} /> });
  }
  if (user?.permContratos || user?.isAdmin) {
    navItems.push({ name: 'Controle Contratos', path: '/controle-contratos', icon: <FileSignature size={24} /> });
  }
  if (user?.permFinanceiro || user?.isAdmin) {
    navItems.push({ name: 'Financeiro', path: '/financeiro', icon: <Wallet size={24} /> });
  }

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`} style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div className={styles.header}>
        <button onClick={toggleSidebar} className={styles.toggleBtn}>
          <Menu size={28} />
        </button>
      </div>
      <nav className={styles.nav} style={{ flexGrow: 1 }}>
        {navItems.map((item) => (
          <Link
            href={item.path}
            key={item.path}
            className={`${styles.navItem} ${pathname.startsWith(item.path) ? styles.active : ''}`}
            title={collapsed ? item.name : ''}
          >
            <div className={styles.icon}>{item.icon}</div>
            <span className={styles.label}>{item.name}</span>
          </Link>
        ))}
      </nav>

      <div style={{ padding: '16px 8px', borderTop: '1px solid var(--border)' }}>
        {user?.isAdmin && (
          <Link
            href="/gestao-usuarios"
            className={`${styles.navItem} ${pathname === '/gestao-usuarios' ? styles.active : ''}`}
            title={collapsed ? 'Gestão de Usuários' : ''}
            style={{ marginBottom: '8px' }}
          >
            <div className={styles.icon}><Users size={24} /></div>
            <span className={styles.label}>Gestão de Usuários</span>
          </Link>
        )}
        <button
          onClick={logout}
          className={styles.navItem}
          title={collapsed ? 'Sair' : ''}
          style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--status-overdue)' }}
        >
          <div className={styles.icon}><LogOut size={24} /></div>
          <span className={styles.label} style={{ color: 'var(--status-overdue)', fontWeight: 'bold' }}>Sair</span>
        </button>
      </div>
    </aside>
  );
}
