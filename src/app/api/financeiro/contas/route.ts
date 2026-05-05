import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const contas = await prisma.contaFinanceira.findMany({
      include: {
        evento: true,
        areaEvento: true,
        pessoa: true,
        parcelas: {
          orderBy: { numeroParcela: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(contas);
  } catch (error: any) {
    console.error('Erro ao buscar contas:', error);
    return NextResponse.json({ error: 'Erro ao buscar contas financeiras.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tipo, descricao, valorTotal, eventoId, areaEventoId, pessoaId, parcelas } = body;

    if (!tipo || !descricao || !valorTotal || !eventoId || !pessoaId || !parcelas || parcelas.length === 0) {
      return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 });
    }

    if (!['PAGAR', 'RECEBER'].includes(tipo)) {
      return NextResponse.json({ error: 'Tipo de conta inválido.' }, { status: 400 });
    }

    // Calcular o total das parcelas para garantir que bate com o valor total
    const totalParcelas = parcelas.reduce((acc: number, p: any) => acc + Number(p.valorEsperado), 0);
    // Tolerância de 1 centavo
    if (Math.abs(totalParcelas - valorTotal) > 0.01) {
      return NextResponse.json({ error: 'A soma das parcelas não bate com o valor total.' }, { status: 400 });
    }

    // Criar a Conta e as Parcelas em uma transação
    const conta = await prisma.contaFinanceira.create({
      data: {
        tipo,
        descricao,
        valorTotal,
        eventoId: Number(eventoId),
        areaEventoId: areaEventoId ? Number(areaEventoId) : null,
        pessoaId: Number(pessoaId),
        statusGeral: 'PENDENTE',
        parcelas: {
          create: parcelas.map((p: any, index: number) => ({
            numeroParcela: index + 1,
            valorEsperado: Number(p.valorEsperado),
            dataVencimento: p.dataVencimento,
            status: 'PENDENTE'
          }))
        }
      },
      include: {
        parcelas: true,
        pessoa: true,
        areaEvento: true
      }
    });

    return NextResponse.json(conta);
  } catch (error: any) {
    console.error('Erro ao criar conta:', error);
    return NextResponse.json({ error: 'Erro ao criar conta financeira.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID da conta é obrigatório.' }, { status: 400 });
    }

    await prisma.contaFinanceira.delete({
      where: { id: Number(id) }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao deletar conta:', error);
    return NextResponse.json({ error: 'Erro ao deletar conta financeira.' }, { status: 500 });
  }
}
