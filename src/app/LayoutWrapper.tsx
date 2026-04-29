'use client';

import Sidebar from '@/components/Sidebar/Sidebar';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  
  const isLoginPage = pathname === '/login';

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (!user) {
    return null; // Will redirect in AuthContext
  }

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main className="main-content">
        <div style={{ padding: '32px' }}>
          {children}
        </div>
      </main>
    </div>
  );
}
