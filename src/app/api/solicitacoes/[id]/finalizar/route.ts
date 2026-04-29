import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const id = parseInt(params.id, 10);
    const body = await req.json();

    // Buscar a solicitação
    const solicitacao = await prisma.solicitacaoContrato.findUnique({
      where: { id }
    });

    if (!solicitacao) {
      return NextResponse.json({ error: 'Solicitação não encontrada' }, { status: 404 });
    }

    // Conferir que os dados batem com o que o operador confirmou
    if (body.pagador !== body.confirmPagador ||
        body.valor !== body.confirmValor ||
        body.parcelas !== body.confirmParcelas ||
        body.quantidade !== body.confirmQuantidade ||
        body.codigo !== body.confirmCodigo) {
      return NextResponse.json({ error: 'Os dados confirmados não conferem. Verifique as informações.' }, { status: 400 });
    }

    // Buscar evento para pegar a temporada
    const evento = await prisma.evento.findFirst({
      where: { nome: solicitacao.evento || '' }
    });

    const numParcelas = solicitacao.parcelas || 1;

    // Criar o boleto automaticamente
    const boleto = await prisma.boleto.create({
      data: {
        nomeFormando: solicitacao.nomeFormando,
        telefoneFormando: solicitacao.telefoneFormando,
        cpfFormando: solicitacao.cpfFormando,
        nomeResponsavel: solicitacao.nomeResponsavel,
        telefoneResponsavel: solicitacao.telefoneResponsavel,
        cpfResponsavel: solicitacao.cpfResponsavel,
        evento: solicitacao.evento,
        temporada: evento?.temporada || '',
        produto: solicitacao.produto,
        quantidade: String(solicitacao.quantidade || 1),
        numeroParcelas: String(numParcelas),
        pagadorOriginal: body.codigo,
        parcelas: {
          create: Array.from({ length: numParcelas > 12 ? 12 : numParcelas }).map((_, i) => ({
            mesIndex: i,
            status: 'PENDENTE',
            dataVencimento: body.datasParcelas?.[i] || null
          }))
        }
      },
      include: { parcelas: true }
    });

    // Atualizar a solicitação para FINALIZADO
    await prisma.solicitacaoContrato.update({
      where: { id },
      data: { status: 'FINALIZADO' }
    });

    return NextResponse.json({ boleto, message: 'Boleto criado com sucesso!' });

  } catch (error: any) {
    console.error('Error finalizing solicitacao:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
