import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * POST /api/importar-relatorio/confirmar-baixados
 *
 * Recebe a confirmação do operador sobre parcelas baixadas por solicitação
 * e atualiza o banco com status BAIXADO + observação.
 *
 * Body: {
 *   pagadorOriginal: string,
 *   tipo: "AMORTIZACAO" | "QUITACAO_ATRASO" | "INDEFINIDO",
 *   dbParcelaIds: number[],         // IDs das parcelas do banco a marcar
 *   observacao: string              // texto livre do operador
 * }
 */
export async function POST(req: Request) {
  try {
    const { pagadorOriginal, tipo, dbParcelaIds, observacao } = await req.json();

    if (!pagadorOriginal || !tipo) {
      return NextResponse.json({ error: 'Dados inválidos: pagadorOriginal e tipo são obrigatórios' }, { status: 400 });
    }
    if (!Array.isArray(dbParcelaIds) || dbParcelaIds.length === 0) {
      // Nenhuma parcela encontrada no banco para os baixados do XLS — retorna sucesso sem alterações
      return NextResponse.json({ success: true, parcelasAtualizadas: 0, observacaoAplicada: '', aviso: 'Nenhuma parcela do banco correspondeu às datas dos baixados do XLS' });
    }

    const tipoLabel: Record<string, string> = {
      AMORTIZACAO: 'Amortização antecipada',
      QUITACAO_ATRASO: 'Quitação de atraso em lote',
      INDEFINIDO: 'Baixado por solicitação (motivo indefinido)',
    };

    const observacaoFinal = observacao?.trim()
      ? `${tipoLabel[tipo] || tipo} — ${observacao.trim()}`
      : tipoLabel[tipo] || tipo;

    // AMORTIZACAO → BAIXADO (azul)  |  QUITACAO_ATRASO → QUITADO (amarelo)
    const statusPorTipo: Record<string, string> = {
      AMORTIZACAO:    'BAIXADO',
      QUITACAO_ATRASO:'QUITADO',
      INDEFINIDO:     'BAIXADO', // conservador — operador pode corrigir depois
    };
    const novoStatus = statusPorTipo[tipo] || 'BAIXADO';

    // Atualiza cada parcela indicada com o status correto + observação
    const updates = await Promise.all(
      dbParcelaIds.map((id: number) =>
        prisma.parcela.update({
          where: { id },
          data: {
            status: novoStatus,
            observacao: observacaoFinal,
          },
        })
      )
    );

    return NextResponse.json({
      success: true,
      parcelasAtualizadas: updates.length,
      observacaoAplicada: observacaoFinal,
    });

  } catch (error: any) {
    console.error('Erro ao confirmar baixados:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
