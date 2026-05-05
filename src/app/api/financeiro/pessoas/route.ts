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
