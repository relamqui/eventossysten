import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const usersCount = await prisma.usuario.count();
    
    if (usersCount === 0) {
      const admin = await prisma.usuario.create({
        data: {
          nome: 'Administrador',
          username: 'admin',
          password: '123', // Em prod idealmente seria hasheada com bcrypt
          isAdmin: true,
          permBoletos: true,
          permContratos: true,
          permFinanceiro: true,
        }
      });
      return NextResponse.json({ message: 'Admin user created successfully', admin });
    }

    return NextResponse.json({ message: 'Users already exist. Setup not needed.' });
  } catch (error: any) {
    console.error('Error in setup:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
