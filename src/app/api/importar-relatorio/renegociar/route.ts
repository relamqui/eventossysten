import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { boletoOriginalId, novoProduto, novaQuantidade, novasParcelas, novoCodigo, dbParcelaIds } = data;

    if (!boletoOriginalId || !novoCodigo) {
      return NextResponse.json({ error: 'Faltam dados obrigatórios' }, { status: 400 });
    }

    const oldBoleto = await prisma.boleto.findUnique({
      where: { id: boletoOriginalId }
    });

    if (!oldBoleto) {
      return NextResponse.json({ error: 'Boleto original não encontrado' }, { status: 404 });
    }

    // 1. Encontrar as parcelas históricas (PAGO, BAIXADO, QUITADO) que devem ser preservadas
    const parcelasAntigas = await prisma.parcela.findMany({
      where: { boletoId: boletoOriginalId },
      orderBy: { mesIndex: 'asc' }
    });

    const historico = parcelasAntigas.filter(p => p.status === 'PAGO' || p.status === 'BAIXADO' || p.status === 'QUITADO');
    const idsParaDeletar = parcelasAntigas.filter(p => !(p.status === 'PAGO' || p.status === 'BAIXADO' || p.status === 'QUITADO')).map(p => p.id);

    // 2. Apagar as parcelas não pagas antigas
    if (idsParaDeletar.length > 0) {
      await prisma.parcela.deleteMany({
        where: { id: { in: idsParaDeletar } }
      });
    }

    // 3. Criar as novas parcelas "PENDENTE"
    const startIndex = historico.length;
    const parcelasRestantes = Math.max(0, parseInt(novasParcelas) - historico.length);
    
    const novasParcelasArray = Array.from({ length: parcelasRestantes }).map((_, i) => ({
      boletoId: boletoOriginalId,
      mesIndex: startIndex + i,
      status: 'PENDENTE',
      observacao: `Nova emissão (${novoCodigo})`
    }));

    if (novasParcelasArray.length > 0) {
      await prisma.parcela.createMany({
        data: novasParcelasArray
      });
    }

    // 4. Atualizar o Boleto original para carregar a nova configuração e manter a linha no painel
    const boletoAtualizado = await prisma.boleto.update({
      where: { id: boletoOriginalId },
      data: {
        produto: novoProduto,
        quantidade: novaQuantidade.toString(),
        numeroParcelas: parseInt(novasParcelas).toString(),
        pagadorOriginal: novoCodigo
      }
    });

    return NextResponse.json({ success: true, boletoAtualizado });
  } catch (error: any) {
    console.error('Erro na renegociação:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
