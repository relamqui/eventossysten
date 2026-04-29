import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const id = parseInt(params.id, 10);
    const data = await req.json();

    const updated = await prisma.boleto.update({
      where: { id },
      data: {
        nomeFormando: data.nomeFormando,
        telefoneFormando: data.telefoneFormando,
        cpfFormando: data.cpfFormando,
        nomeResponsavel: data.nomeResponsavel,
        telefoneResponsavel: data.telefoneResponsavel,
        cpfResponsavel: data.cpfResponsavel,
        evento: data.evento,
        temporada: data.temporada,
        produto: data.produto,
        quantidade: data.quantidade,
        numeroParcelas: data.numeroParcelas,
        pagadorOriginal: data.pagadorOriginal || null,
      }
    });

    if (data.parcelas && Array.isArray(data.parcelas)) {
      for (const p of data.parcelas) {
        await prisma.parcela.update({
          where: { id: p.id },
          data: { status: p.status }
        });
      }
    }

    const updatedWithParcelas = await prisma.boleto.findUnique({
      where: { id },
      include: { parcelas: true }
    });

    return NextResponse.json(updatedWithParcelas);
  } catch (error: any) {
    console.error('Error updating boleto:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const id = parseInt(params.id, 10);

    await prisma.boleto.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting boleto:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
