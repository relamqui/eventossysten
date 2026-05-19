import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const areas = await prisma.areaEvento.findMany({
      orderBy: { nome: 'asc' }
    });
    return NextResponse.json(areas);
  } catch (error: any) {
    console.error('Erro ao buscar áreas:', error);
    return NextResponse.json({ error: 'Erro ao buscar áreas de custo.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { nome, descricao } = body;

    if (!nome) {
      return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });
    }

    const area = await prisma.areaEvento.create({
      data: {
        nome,
        descricao
      }
    });

    return NextResponse.json(area);
  } catch (error: any) {
    console.error('Erro ao criar área:', error);
    return NextResponse.json({ error: 'Erro ao criar área de custo.' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, nome, descricao } = body;

    if (!id || !nome) {
      return NextResponse.json({ error: 'ID e Nome são obrigatórios.' }, { status: 400 });
    }

    const area = await prisma.areaEvento.update({
      where: { id: Number(id) },
      data: { nome, descricao }
    });

    return NextResponse.json(area);
  } catch (error: any) {
    console.error('Erro ao atualizar área:', error);
    return NextResponse.json({ error: 'Erro ao atualizar área de custo.' }, { status: 500 });
  }
}
