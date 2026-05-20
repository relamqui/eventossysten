import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * POST /api/importar-relatorio/cancelar-alerta
 *
 * Cancela um alerta de baixado, adicionando o pagador à lista de ignorados
 * para que o boleto não apareça em relatórios futuros.
 *
 * Body: {
 *   pagadorOriginal: string,   // chave do pagador no XLS
 *   boletoOriginalId?: number  // ID do boleto no banco (opcional, para log)
 * }
 */
export async function POST(req: Request) {
  try {
    const { pagadorOriginal, boletoOriginalId } = await req.json();

    if (!pagadorOriginal) {
      return NextResponse.json(
        { error: 'pagadorOriginal é obrigatório' },
        { status: 400 }
      );
    }

    // Adiciona à lista de ignorados (upsert para evitar duplicata)
    const ignorado = await prisma.pagadorIgnorado.upsert({
      where: { pagador: pagadorOriginal },
      create: { pagador: pagadorOriginal },
      update: {}, // já existe, nada a alterar
    });

    return NextResponse.json({
      success: true,
      ignorado,
      mensagem: `Boleto de "${pagadorOriginal}" cancelado e ignorado em relatórios futuros.`,
    });
  } catch (error: any) {
    console.error('Erro ao cancelar alerta:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
