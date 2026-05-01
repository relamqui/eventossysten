import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { pagadorOriginal } = data;

    if (!pagadorOriginal) {
      return NextResponse.json({ error: 'Pagador não informado' }, { status: 400 });
    }

    const ignorado = await prisma.pagadorIgnorado.create({
      data: {
        pagador: pagadorOriginal,
      }
    });

    return NextResponse.json({ success: true, ignorado });
  } catch (error: any) {
    console.error('Erro ao ignorar pagador:', error);
    // Tratar erro de duplicidade se já existir
    if (error.code === 'P2002') {
      return NextResponse.json({ success: true, message: 'Pagador já ignorado.' });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
