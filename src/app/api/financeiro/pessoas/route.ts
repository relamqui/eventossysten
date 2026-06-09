import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const pessoas = await prisma.pessoaFinanceira.findMany({
      orderBy: { nomeRazao: 'asc' }
    });
    return NextResponse.json(pessoas);
  } catch (error: any) {
    console.error('Erro ao buscar pessoas:', error);
    return NextResponse.json({ error: 'Erro ao buscar fornecedores e clientes.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tipo, nomeRazao, documento, contatoPrincipal } = body;

    if (!tipo || !nomeRazao) {
      return NextResponse.json({ error: 'Tipo e Nome são obrigatórios.' }, { status: 400 });
    }

    if (!['CLIENTE', 'FORNECEDOR', 'AMBOS'].includes(tipo)) {
      return NextResponse.json({ error: 'Tipo inválido.' }, { status: 400 });
    }

    const pessoa = await prisma.pessoaFinanceira.create({
      data: {
        tipo,
        nomeRazao,
        documento,
        contatoPrincipal
      }
    });

    return NextResponse.json(pessoa);
  } catch (error: any) {
    console.error('Erro ao criar pessoa:', error);
    return NextResponse.json({ error: 'Erro ao criar fornecedor/cliente.' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, tipo, nomeRazao, documento, contatoPrincipal } = body;

    if (!id || !tipo || !nomeRazao) {
      return NextResponse.json({ error: 'ID, Tipo e Nome são obrigatórios.' }, { status: 400 });
    }

    if (!['CLIENTE', 'FORNECEDOR', 'AMBOS'].includes(tipo)) {
      return NextResponse.json({ error: 'Tipo inválido.' }, { status: 400 });
    }

    const pessoa = await prisma.pessoaFinanceira.update({
      where: { id: Number(id) },
      data: {
        tipo,
        nomeRazao,
        documento,
        contatoPrincipal
      }
    });

    return NextResponse.json(pessoa);
  } catch (error: any) {
    console.error('Erro ao atualizar pessoa:', error);
    return NextResponse.json({ error: 'Erro ao atualizar fornecedor/cliente.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório para exclusão.' }, { status: 400 });
    }

    await prisma.pessoaFinanceira.delete({
      where: { id: Number(id) }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao deletar pessoa:', error);
    return NextResponse.json({ error: 'Erro ao deletar entidade. Pode haver lançamentos vinculados a ela.' }, { status: 500 });
  }
}
