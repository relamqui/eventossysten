import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    let config = await prisma.configuracaoSistema.findUnique({
      where: { id: 1 }
    });

    if (!config) {
      config = await prisma.configuracaoSistema.create({
        data: { id: 1, zapsignAmbiente: 'TESTE' }
      });
    }

    return NextResponse.json(config);
  } catch (error: any) {
    console.error('Error fetching config:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const data = await req.json();

    const config = await prisma.configuracaoSistema.upsert({
      where: { id: 1 },
      update: {
        zapsignToken: data.zapsignToken,
        zapsignAmbiente: data.zapsignAmbiente,
        urlPublica: data.urlPublica
      },
      create: {
        id: 1,
        zapsignToken: data.zapsignToken,
        zapsignAmbiente: data.zapsignAmbiente || 'TESTE',
        urlPublica: data.urlPublica
      }
    });

    return NextResponse.json(config);
  } catch (error: any) {
    console.error('Error updating config:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
