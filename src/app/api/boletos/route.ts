import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Configuração de CORS para permitir que o site externo acesse os dados
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Em produção você pode trocar '*' pelo domínio do site
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET() {
  try {
    const boletos = await prisma.boleto.findMany({
      include: {
        parcelas: true,
      },
      orderBy: {
        id: 'desc'
      }
    });

    return NextResponse.json(boletos, { headers: corsHeaders });
  } catch (error: any) {
    console.error('Error fetching boletos:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    
    const numParcelasStr = data.numeroParcelas || '0';
    const numParcelas = parseInt(numParcelasStr, 10) || 0;

    const boleto = await prisma.boleto.create({
      data: {
        nomeFormando: data.nomeFormando,
        nomeResponsavel: data.nomeResponsavel,
        evento: data.evento,
        temporada: data.temporada,
        produto: data.produto,
        quantidade: data.quantidade,
        numeroParcelas: numParcelasStr,
        pagadorOriginal: data.pagadorOriginal || null,
        parcelas: {
          create: Array.from({ length: numParcelas > 12 ? 12 : numParcelas }).map((_, i) => ({
            mesIndex: i,
            status: 'PENDENTE',
            dataVencimento: data.datasParcelas?.[i] || null
          }))
        }
      },
      include: {
        parcelas: true
      }
    });

    return NextResponse.json(boleto, { status: 201 });
  } catch (error: any) {
    console.error('Error creating boleto:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
