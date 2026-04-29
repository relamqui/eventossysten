import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

function extractYearMonth(vencimento: string): string | null {
  if (!vencimento) return null;
  // Formato esperado: "DD/MM/YYYY" ou "DD/MM/YY"
  const parts = vencimento.split('/');
  if (parts.length >= 3) {
    let year = parts[2].trim();
    if (year.length === 2) year = '20' + year;
    const month = parts[1].trim().padStart(2, '0');
    return `${year}-${month}`;
  }
  return null;
}

function parseDateBR(vencimento: string): Date | null {
  if (!vencimento) return null;
  const parts = vencimento.split('/');
  if (parts.length >= 3) {
    let year = parts[2].trim();
    if (year.length === 2) year = '20' + year;
    const month = parseInt(parts[1].trim(), 10) - 1;
    const day = parseInt(parts[0].trim(), 10);
    return new Date(parseInt(year, 10), month, day);
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { pagadorOriginal, nomeResponsavel, nomeFormando, evento, grupos } = body;

    const eventoDb = await prisma.evento.findFirst({ where: { nome: evento || '' } });
    const createdBoletos = [];

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    for (const grupo of grupos) {
      const { produto, parcelas } = grupo;
      if (!produto || produto === 'Ignorar') continue;

      const todosCancelados = parcelas.every((p: any) => p.status === 'CANCELADO');

      const boleto = await prisma.boleto.create({
        data: {
          nomeFormando: nomeFormando || null,
          nomeResponsavel: nomeResponsavel || null,
          evento: evento || null,
          temporada: eventoDb?.temporada || '',
          produto: produto,
          quantidade: '1',
          numeroParcelas: String(parcelas.length),
          pagadorOriginal: pagadorOriginal,
          parcelas: {
            create: parcelas.map((p: any, i: number) => {
              let novoStatus = p.status === 'PAGO' ? 'PAGO' : p.status === 'VENCIDO' ? 'VENCIDO' : 'PENDENTE';
              let observacao = null;

              if (p.status === 'CANCELADO') {
                if (todosCancelados) {
                  novoStatus = 'CANCELADO';
                  observacao = 'Boleto cancelado no banco';
                } else {
                  const dt = parseDateBR(p.vencimento);
                  if (dt && dt > hoje) {
                    novoStatus = 'BAIXADO';
                    observacao = 'Amortização detectada na importação';
                  } else {
                    novoStatus = 'QUITADO';
                    observacao = 'Quitação de atraso detectada na importação';
                  }
                }
              }

              return {
                mesIndex: i,
                status: novoStatus,
                dataVencimento: extractYearMonth(p.vencimento),
                observacao,
              };
            })
          }
        },
        include: { parcelas: true }
      });
      createdBoletos.push(boleto);
    }

    return NextResponse.json({ 
      message: `${createdBoletos.length} boleto(s) criado(s)!`,
      boletos: createdBoletos 
    });
  } catch (error: any) {
    console.error('Error confirming import:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
