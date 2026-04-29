import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    const user = await prisma.usuario.findUnique({
      where: { username }
    });

    if (!user || user.password !== password) {
      return NextResponse.json({ error: 'Usuário ou senha incorretos' }, { status: 401 });
    }

    // Retorna os dados do usuário omitindo a senha
    const { password: _, ...userData } = user;
    return NextResponse.json(userData);

  } catch (error: any) {
    console.error('Error logging in:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
