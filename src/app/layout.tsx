'use client';

import './globals.css';
import Sidebar from '@/components/Sidebar/Sidebar';
import { useState } from 'react';

import { AuthProvider } from '@/contexts/AuthContext';
import LayoutWrapper from './LayoutWrapper';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthProvider>
          <LayoutWrapper>{children}</LayoutWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}
