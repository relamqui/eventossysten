import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Configuração de CORS para permitir que o site externo acesse os dados
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', 
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET() {
  try {
    const eventos = await prisma.evento.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(eventos, { headers: corsHeaders });
  } catch (error: any) {
    console.error('Error fetching eventos:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function POST(req: Request) {
  try {
    let data: any = {};
    let contratoCaminho = null;
    let zapsignTemplateId = null;

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

    const novoEvento = await prisma.evento.create({
      data: {
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
        contratoCaminho,
        zapsignTemplateId,
      }
    });

    return NextResponse.json(novoEvento);
  } catch (error: any) {
    console.error('Error creating evento:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
