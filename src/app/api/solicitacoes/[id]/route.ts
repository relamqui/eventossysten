import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const id = parseInt(params.id, 10);
    const data = await req.json();

    const updated = await prisma.solicitacaoContrato.update({
      where: { id },
      data: {
        ...(data.status !== undefined && { status: data.status }),
        ...(data.nomeFormando !== undefined && { nomeFormando: data.nomeFormando }),
        ...(data.cpfFormando !== undefined && { cpfFormando: data.cpfFormando }),
        ...(data.telefoneFormando !== undefined && { telefoneFormando: data.telefoneFormando }),
        ...(data.nomeResponsavel !== undefined && { nomeResponsavel: data.nomeResponsavel }),
        ...(data.cpfResponsavel !== undefined && { cpfResponsavel: data.cpfResponsavel }),
        ...(data.telefoneResponsavel !== undefined && { telefoneResponsavel: data.telefoneResponsavel }),
        ...(data.evento !== undefined && { evento: data.evento }),
        ...(data.produto !== undefined && { produto: data.produto }),
        ...(data.quantidade !== undefined && { quantidade: Number(data.quantidade) }),
        ...(data.parcelas !== undefined && { parcelas: Number(data.parcelas) }),
        ...(data.formaPagamento !== undefined && { formaPagamento: data.formaPagamento }),
        ...(data.zapsignDocToken !== undefined && { zapsignDocToken: data.zapsignDocToken }),
        ...(data.zapsignDocStatus !== undefined && { zapsignDocStatus: data.zapsignDocStatus }),
      }
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating solicitacao:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
