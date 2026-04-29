import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const boletoId = parseInt(params.id, 10);
    const { mesIndex, status } = await req.json();

    if (isNaN(boletoId) || mesIndex === undefined || !status) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Upsert the parcela for this boleto and mesIndex
    const parcela = await prisma.parcela.upsert({
      where: {
        boletoId_mesIndex: {
          boletoId,
          mesIndex
        }
      },
      update: {
        status
      },
      create: {
        boletoId,
        mesIndex,
        status
      }
    });

    return NextResponse.json(parcela);
  } catch (error: any) {
    console.error('Error updating parcela:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
