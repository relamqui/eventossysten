import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const id = parseInt(params.id, 10);
    
    let data: any = {};
    let contratoCaminho = undefined;
    let zapsignTemplateId = undefined;

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      formData.forEach((value, key) => {
        if (key !== 'contratoFile') {
          data[key] = value;
        }
      });

      const file = formData.get('contratoFile') as File | null;
      if (file && file.size > 0) {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        
        const uploadDir = join(process.cwd(), 'public', 'uploads', 'contratos');
        try {
          await mkdir(uploadDir, { recursive: true });
        } catch (e) {}

        const uniqueName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const path = join(uploadDir, uniqueName);
        await writeFile(path, buffer);
        
        contratoCaminho = `/uploads/contratos/${uniqueName}`;

        // Call ZapSign
        const { createTemplate } = await import('@/lib/zapsign');
        try {
          zapsignTemplateId = await createTemplate(data.nome, contratoCaminho);
        } catch (e: any) {
          console.error("ZapSign Error:", e.message);
        }
      }
    } else {
      data = await req.json();
    }

    const updateData: any = {
      nome: data.nome,
      dataEvento: data.dataEvento || null,
      temporada: data.temporada || null,
      tipo: data.tipo || null,
      curso: data.curso || null,
      valorPacoteAVista: data.valorPacoteAVista ? parseFloat(data.valorPacoteAVista) : null,
      valorPacoteParcelado: data.valorPacoteParcelado ? parseFloat(data.valorPacoteParcelado) : null,
      valorIndispAdultoAVista: data.valorIndispAdultoAVista ? parseFloat(data.valorIndispAdultoAVista) : null,
      valorIndispAdultoParcelado: data.valorIndispAdultoParcelado ? parseFloat(data.valorIndispAdultoParcelado) : null,
      valorIndispInfantilAVista: data.valorIndispInfantilAVista ? parseFloat(data.valorIndispInfantilAVista) : null,
      valorIndispInfantilParcelado: data.valorIndispInfantilParcelado ? parseFloat(data.valorIndispInfantilParcelado) : null,
      informacoes: data.informacoes || null,
    };

    if (contratoCaminho !== undefined) {
      updateData.contratoCaminho = contratoCaminho;
      updateData.zapsignTemplateId = zapsignTemplateId;
    }

    const eventoAtualizado = await prisma.evento.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json(eventoAtualizado);
  } catch (error: any) {
    console.error('Error updating evento:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
