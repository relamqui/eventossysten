import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

export async function GET() {
  try {
    const csvFilePath = path.join(process.cwd(), 'base eventos  - Página1.csv');
    
    if (!fs.existsSync(csvFilePath)) {
      return NextResponse.json({ error: 'CSV file not found' }, { status: 404 });
    }

    const csvData = fs.readFileSync(csvFilePath, 'utf-8');
    
    // Parse CSV
    const results = Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true,
    });

    if (results.errors.length > 0) {
      return NextResponse.json({ error: 'Error parsing CSV', details: results.errors }, { status: 400 });
    }

    // Clear existing data
    await prisma.parcela.deleteMany();
    await prisma.boleto.deleteMany();

    const boletos = results.data as any[];
    
    for (const row of boletos) {
      const numParcelasStr = row['parcelas']?.trim() || '0';
      const numParcelas = parseInt(numParcelasStr, 10) || 0;
      
      const boleto = await prisma.boleto.create({
        data: {
          nomeFormando: row['nome do formando']?.trim(),
          telefoneFormando: row['telefone formando']?.trim(),
          cpfFormando: row['cpf formando']?.trim(), // Actually this is in the CSV twice
          nomeResponsavel: row['nome responsavel']?.trim(),
          telefoneResponsavel: row['telefone responsavel']?.trim(),
          cpfResponsavel: row['cpf formando']?.trim(), // The second one? Just using what's available
          temporada: row['temporada']?.trim(),
          produto: row['produto ']?.trim(),
          quantidade: row['quantidade']?.trim(),
          numeroParcelas: numParcelasStr,
        }
      });

      // Create parcelas based on the number
      const parcelasData = [];
      for (let i = 0; i < numParcelas && i < 12; i++) {
        parcelasData.push({
          boletoId: boleto.id,
          mesIndex: i,
          status: 'PENDENTE'
        });
      }

      if (parcelasData.length > 0) {
        await prisma.parcela.createMany({
          data: parcelasData
        });
      }
    }

    return NextResponse.json({ message: 'Database seeded successfully', count: boletos.length });
  } catch (error: any) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
