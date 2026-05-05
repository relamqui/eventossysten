import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { pagadorOriginal, docs } = data;

    if (docs && Array.isArray(docs)) {
      for (const doc of docs) {
        if (!doc) continue;
        try {
          await prisma.pagadorIgnorado.create({ data: { pagador: String(doc) } });
        } catch (e: any) {
          if (e.code !== 'P2002') console.error('Erro ao ignorar doc:', e);
        }
      }
      return NextResponse.json({ success: true, message: 'Documentos ignorados.' });
    }

    if (!pagadorOriginal) {
      return NextResponse.json({ error: 'Pagador ou documentos não informados' }, { status: 400 });
    }

    const ignorado = await prisma.pagadorIgnorado.create({
      data: {
        pagador: pagadorOriginal,
      }
    });

    return NextResponse.json({ success: true, ignorado });
  } catch (error: any) {
    console.error('Erro ao ignorar:', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ success: true, message: 'Já ignorado.' });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
