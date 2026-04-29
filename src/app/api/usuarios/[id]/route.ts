import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const id = parseInt(params.id, 10);
    const data = await req.json();

    // Se a senha foi enviada vazia, não atualiza ela
    const updateData: any = {
      nome: data.nome,
      username: data.username,
      isAdmin: data.isAdmin,
      permBoletos: data.permBoletos,
      permContratos: data.permContratos,
      permFinanceiro: data.permFinanceiro,
    };

    if (data.password && data.password.trim() !== '') {
      updateData.password = data.password;
    }

    const updated = await prisma.usuario.update({
      where: { id },
      data: updateData
    });

    const { password: _, ...userData } = updated;
    return NextResponse.json(userData);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const id = parseInt(params.id, 10);

    await prisma.usuario.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
