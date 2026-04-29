import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const data = await req.json();

    console.log('========================================');
    console.log('[Webhook ZapSign] Evento recebido!');
    console.log('Event Type:', data.event_type);
    console.log('Doc Token (raiz):', data.token);
    console.log('Doc Name:', data.name);
    console.log('Doc Status:', data.status);
    if (data.signer_who_signed) {
      console.log('Quem assinou:', data.signer_who_signed.name, '| Status:', data.signer_who_signed.status);
    }
    console.log('========================================');

    // O token do documento vem direto na raiz do payload (data.token)
    // O status do documento vem em data.status ("signed" ou "pending")
    const docToken = data.token;
    const isSigned = data.event_type === "doc_signed" && data.status === "signed";

    if (docToken) {
      const solicitacao = await prisma.solicitacaoContrato.findFirst({
        where: { zapsignDocToken: docToken }
      });

      if (solicitacao) {
        if (isSigned) {
          await prisma.solicitacaoContrato.update({
            where: { id: solicitacao.id },
            data: {
              zapsignDocStatus: 'signed',
              status: 'APROVADO'
            }
          });
          console.log(`[Webhook ZapSign] ✅ Solicitação #${solicitacao.id} (${solicitacao.nomeFormando}) → ASSINADO e APROVADO!`);
        } else {
          // Atualizar status parcial (ex: um assinante assinou mas faltam outros)
          console.log(`[Webhook ZapSign] ℹ️ Solicitação #${solicitacao.id} recebeu evento mas doc status = "${data.status}"`);
        }
      } else {
        console.log(`[Webhook ZapSign] ⚠️ Nenhuma solicitação encontrada com docToken: ${docToken}`);
      }
    } else {
      console.log('[Webhook ZapSign] ⚠️ Payload sem token de documento');
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('[Webhook ZapSign] ❌ Erro:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}
