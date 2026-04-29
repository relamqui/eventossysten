import { NextResponse } from 'next/server';
import { createDocument } from '@/lib/zapsign';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const data = await req.json();

    const { templateId, solicitacaoId, ...contractData } = data;

    if (!templateId) {
      return NextResponse.json({ error: "templateId é obrigatório" }, { status: 400 });
    }

    const docResult = await createDocument(templateId, contractData);

    if (solicitacaoId) {
      await prisma.solicitacaoContrato.update({
        where: { id: solicitacaoId },
        data: {
          zapsignDocToken: docResult.docToken,
          zapsignDocStatus: 'pending',
          zapsignSignUrl: docResult.signUrl
        }
      });
    }

    return NextResponse.json({ 
      signUrl: docResult.signUrl, 
      docToken: docResult.docToken 
    });

  } catch (error: any) {
    console.error('Error creating contract:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
