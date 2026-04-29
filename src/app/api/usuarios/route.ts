import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const usuarios = await prisma.usuario.findMany({
      orderBy: { createdAt: 'asc' }
    });
    
    // Omitir senhas na listagem
    const usuariosSafe = usuarios.map(u => {
      const { password, ...rest } = u;
      return rest;
    });

    return NextResponse.json(usuariosSafe);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();

    const existingUser = await prisma.usuario.findUnique({
      where: { username: data.username }
    });

    if (existingUser) {
      return NextResponse.json({ error: 'Nome de usuário já existe' }, { status: 400 });
    }

    const novoUsuario = await prisma.usuario.create({
      data: {
        nome: data.nome,
        username: data.username,
        password: data.password,
        isAdmin: data.isAdmin,
        permBoletos: data.permBoletos,
        permContratos: data.permContratos,
        permFinanceiro: data.permFinanceiro,
      }
    });

    const { password: _, ...userData } = novoUsuario;
    return NextResponse.json(userData);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
