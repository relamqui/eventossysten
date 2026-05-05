import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const parcelas = await prisma.parcelaFinanceira.findMany({
      include: {
        conta: {
          include: {
            pessoa: true,
            evento: true,
            areaEvento: true
          }
        }
      },
      orderBy: { dataVencimento: 'asc' }
    });
    return NextResponse.json(parcelas);
  } catch (error: any) {
    console.error('Erro ao buscar parcelas:', error);
    return NextResponse.json({ error: 'Erro ao buscar parcelas financeiras.' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, status, dataPagamento, valorPago, dataVencimento, valorEsperado } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório.' }, { status: 400 });
    }

    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (dataPagamento !== undefined) updateData.dataPagamento = dataPagamento;
    if (valorPago !== undefined) updateData.valorPago = Number(valorPago);
    if (dataVencimento !== undefined) updateData.dataVencimento = dataVencimento;
    if (valorEsperado !== undefined) updateData.valorEsperado = Number(valorEsperado);

    const parcela = await prisma.parcelaFinanceira.update({
      where: { id: Number(id) },
      data: updateData
    });

    return NextResponse.json(parcela);
  } catch (error: any) {
    console.error('Erro ao atualizar parcela:', error);
    return NextResponse.json({ error: 'Erro ao atualizar parcela.' }, { status: 500 });
  }
}
