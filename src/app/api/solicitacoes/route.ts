import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// CORS config for external portal
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', 
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET() {
  try {
    const solicitacoes = await prisma.solicitacaoContrato.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(solicitacoes, { headers: corsHeaders });
  } catch (error: any) {
    console.error('Error fetching solicitacoes:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();

    const { cpfFormando, cpfResponsavel, produto = 'Pacote Formando', quantidade = 1, evento = null, formaPagamento = null } = data;

    // Coletar todos os CPFs válidos informados
    const cpfsInformados = [cpfFormando, cpfResponsavel].filter(Boolean);

    if (cpfsInformados.length === 0) {
      return NextResponse.json({ error: 'Forneça ao menos um CPF para validação.' }, { status: 400, headers: corsHeaders });
    }

    // Buscar se existe algum Pacote Formando aprovado (Boleto) para os CPFs informados
    const existingPacoteBoleto = await prisma.boleto.findFirst({
      where: {
        produto: 'Pacote Formando',
        OR: [
          { cpfFormando: { in: cpfsInformados } },
          { cpfResponsavel: { in: cpfsInformados } }
        ]
      }
    });

    if (produto === 'Pacote Formando') {
      // Regra 1: Para pedir um PACOTE, ele NÃO pode já ter um PACOTE aprovado
      if (existingPacoteBoleto) {
        return NextResponse.json({ error: 'Já existe um Pacote Formando cadastrado para um destes CPFs. Só é permitido um por formando.' }, { status: 400, headers: corsHeaders });
      }

      // Regra 2: Para pedir um PACOTE, ele NÃO pode já ter uma SOLICITAÇÃO pendente/aprovada de PACOTE
      const existingSolicitacaoPacote = await prisma.solicitacaoContrato.findFirst({
        where: {
          produto: 'Pacote Formando',
          status: { in: ['PENDENTE', 'APROVADO'] },
          OR: [
            { cpfFormando: { in: cpfsInformados } },
            { cpfResponsavel: { in: cpfsInformados } }
          ]
        }
      });

      if (existingSolicitacaoPacote) {
        return NextResponse.json({ error: 'Já existe uma solicitação de pacote em andamento para este CPF.' }, { status: 400, headers: corsHeaders });
      }
    } else {
      // Regra para Indispensáveis: Ele DEVE ter um PACOTE APROVADO para poder pedir um indispensável!
      if (!existingPacoteBoleto) {
        return NextResponse.json({ error: 'Nenhum Pacote Formando encontrado para este CPF. É necessário adquirir o pacote antes de solicitar itens indispensáveis.' }, { status: 400, headers: corsHeaders });
      }
    }

    // Criar a solicitação
    const solicitacao = await prisma.solicitacaoContrato.create({
      data: {
        nomeResponsavel: data.nomeResponsavel || null,
        telefoneResponsavel: data.telefoneResponsavel || null,
        cpfResponsavel: data.cpfResponsavel || null,
        nomeFormando: data.nomeFormando || null,
        telefoneFormando: data.telefoneFormando || null,
        cpfFormando: data.cpfFormando || null,
        produto: produto,
        quantidade: Number(quantidade),
        evento: evento,
        formaPagamento: formaPagamento,
        parcelas: Number(data.parcelas) || 1,
        status: 'PENDENTE'
      }
    });

    return NextResponse.json(solicitacao, { status: 201, headers: corsHeaders });
  } catch (error: any) {
    console.error('Error creating solicitacao:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}
