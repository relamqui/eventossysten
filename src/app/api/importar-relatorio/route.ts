import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import * as XLSX from 'xlsx';

function detectProduct(totalValue: number): { produto: string; confianca: string } {
  if (totalValue >= 1800 && totalValue <= 2100) return { produto: 'Pacote Formando', confianca: 'alta' };
  if (totalValue >= 380 && totalValue <= 430) return { produto: 'Indispensável Adulto', confianca: 'alta' };
  if (totalValue >= 180 && totalValue <= 270) return { produto: 'Indispensável Infantil', confianca: 'alta' };
  if (totalValue >= 1500 && totalValue <= 2200) return { produto: 'Pacote Formando', confianca: 'média' };
  if (totalValue >= 350 && totalValue <= 500) return { produto: 'Indispensável Adulto', confianca: 'média' };
  if (totalValue >= 150 && totalValue <= 300) return { produto: 'Indispensável Infantil', confianca: 'média' };
  return { produto: 'Indefinido', confianca: 'baixa' };
}

function mapStatus(situacao: string): string {
  const s = situacao.toUpperCase();
  if (s.includes('LIQUIDADO')) return 'PAGO';
  if (s.includes('VENCIDO')) return 'VENCIDO';
  if (s.includes('BAIXADO')) return 'CANCELADO';
  return 'PENDENTE';
}

function parseValue(val: any): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseFloat(val.replace(/\./g, '').replace(',', '.')) || 0;
  return 0;
}

/**
 * Tenta interpretar uma string de data no formato DD/MM/YYYY ou YYYY-MM para um objeto Date.
 */
function parseVencimento(venc: string): Date | null {
  if (!venc) return null;
  // formato DD/MM/YYYY
  const dmy = venc.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return new Date(parseInt(dmy[3]), parseInt(dmy[2]) - 1, parseInt(dmy[1]));
  // formato YYYY-MM
  const ym = venc.match(/^(\d{4})-(\d{2})$/);
  if (ym) return new Date(parseInt(ym[1]), parseInt(ym[2]) - 1, 1);
  return null;
}

/**
 * Para um determinado pagador existente no banco, detecta se os boletos BAIXADOS
 * no XLS configuram Amortização ou Quitação de Atraso.
 *
 * Regra:
 *   - Parcelas BAIXADAS com vencimento FUTURO  → AMORTIZACAO
 *   - Parcelas BAIXADAS com vencimento PASSADO → QUITACAO_ATRASO
 *   - Misto ou indefinido                      → INDEFINIDO
 */
function classificarBaixados(
  pagadorOriginal: string,
  parcelasXls: any[],
  boletosDb: any[]
): any | null {
  // Pega apenas as parcelas do XLS com status CANCELADO (Baixado por Solicitação)
  const baixados = parcelasXls.filter(p => p.status === 'CANCELADO');
  if (baixados.length === 0) return null;

  // Verifica se existe pelo menos uma parcela ativa no banco (boleto ainda ativo)
  const temParcelasAtivas = boletosDb.some(b =>
    b.parcelas?.some((p: any) => p.status === 'PENDENTE' || p.status === 'PAGO' || p.status === 'VENCIDO')
  );
  if (!temParcelasAtivas) return null;

  // ─── Match preciso: para cada parcela BAIXADO no XLS, encontra a parcela
  // correspondente no banco pela data de vencimento (YYYY-MM).
  const dbParcelasCorrespondentes: { id: number; mesIndex: number; status: string; dataVencimento: string }[] = [];

  for (const xlsBaixado of baixados) {
    const dt = parseVencimento(xlsBaixado.vencimento);
    if (!dt) continue;

    const anoMes = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;

    let encontrou = false;
    for (const boleto of boletosDb) {
      for (const dbParcela of (boleto.parcelas || [])) {
        if (dbParcela.dataVencimento === anoMes) {
          dbParcelasCorrespondentes.push({
            id: dbParcela.id,
            mesIndex: dbParcela.mesIndex,
            status: dbParcela.status,       // status ATUAL no banco
            dataVencimento: dbParcela.dataVencimento,
          });
          encontrou = true;
          break;
        }
      }
      if (encontrou) break;
    }
  }

  // ─── Se TODOS os matches já estão confirmados no banco (BAIXADO = amortização
  // ou QUITADO = quitação de atraso), o operador já tratou esta situação.
  // Não gerar novo alerta independente do que o XLS diz.
  const CONFIRMADOS = new Set(['BAIXADO', 'QUITADO']);
  const todasJaConfirmadas = dbParcelasCorrespondentes.length > 0 &&
    dbParcelasCorrespondentes.every(p => CONFIRMADOS.has(p.status));
  if (todasJaConfirmadas) return null;

  // ─── FIX 2: Classificar pelo STATUS DO BANCO das parcelas correspondentes,
  // não pela data de vencimento futura/passada.
  //
  // Raciocínio:
  //   - Parcela era VENCIDO no banco → cliente estava em atraso → QUITACAO_ATRASO
  //   - Parcela era PENDENTE no banco → cliente pagou antes do vencimento → AMORTIZACAO
  //   - Misto → INDEFINIDO
  const pendentesNoBanco = dbParcelasCorrespondentes.filter(p => p.status === 'PENDENTE').length;
  const vencidosNoBanco  = dbParcelasCorrespondentes.filter(p => p.status === 'VENCIDO').length;
  // Parcelas sem match no banco → usar data como fallback
  const semMatch = baixados.length - dbParcelasCorrespondentes.length;

  let tipo: 'AMORTIZACAO' | 'QUITACAO_ATRASO' | 'INDEFINIDO';
  if (vencidosNoBanco > 0 && pendentesNoBanco === 0 && semMatch === 0) {
    tipo = 'QUITACAO_ATRASO';
  } else if (pendentesNoBanco > 0 && vencidosNoBanco === 0 && semMatch === 0) {
    tipo = 'AMORTIZACAO';
  } else {
    tipo = 'INDEFINIDO';
  }

  const totalBaixado = Math.round(baixados.reduce((s, p) => s + p.valor, 0) * 100) / 100;

  const sugestaoMap: Record<string, string> = {
    AMORTIZACAO:    `${baixados.length} parcela(s) pendentes baixadas. Provável amortização antecipada. Total: R$ ${totalBaixado.toFixed(2)}`,
    QUITACAO_ATRASO:`${baixados.length} parcela(s) vencidas baixadas. Provável quitação de parcelas em atraso. Total: R$ ${totalBaixado.toFixed(2)}`,
    INDEFINIDO:     `${baixados.length} parcela(s) baixadas com situações mistas. Verificar manualmente. Total: R$ ${totalBaixado.toFixed(2)}`,
  };

  // Tenta identificar a parcela "quitadora" — parcelas PAGO com valor maior que o unitário médio
  const pagas = parcelasXls.filter(p => p.status === 'PAGO');
  const valorMedioBaixado = baixados.reduce((s, p) => s + p.valor, 0) / baixados.length;
  const parcelaLiquidada = pagas.find(p => p.valor > valorMedioBaixado * 1.5) || null;

  const boletoOriginal = boletosDb[0];
  const valorParcela = parcelasXls.length > 0 ? parcelasXls[0].valor : 0;
  let pagasNoBanco = 0;
  if (boletoOriginal && boletoOriginal.parcelas) {
    pagasNoBanco = boletoOriginal.parcelas.filter((p: any) => 
      p.status === 'PAGO' || p.status === 'BAIXADO' || p.status === 'QUITADO'
    ).length;
  }
  const valorJaPago = pagasNoBanco * valorParcela;

  return {
    tipo,
    pagador: pagadorOriginal,
    sugestao: sugestaoMap[tipo],
    parcelasBaixadas: baixados,
    parcelaLiquidada,
    totalBaixado,
    dbParcelaIds: dbParcelasCorrespondentes,
    boletoOriginal,
    valorJaPago,
  };
}


export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    let headerIdx = -1;
    for (let i = 0; i < Math.min(30, data.length); i++) {
      if (data[i]?.some((c: any) => String(c).includes('Pagador'))) { headerIdx = i; break; }
    }
    if (headerIdx < 0) return NextResponse.json({ error: 'Cabeçalho não encontrado no XLS' }, { status: 400 });

    const rows = data.slice(headerIdx + 1).filter(r => r && r.length > 5 && r[4]);

    // Agrupar por Pagador
    const byPagador: Record<string, any[]> = {};
    rows.forEach(r => {
      const pagador = String(r[4] || '').trim();
      if (!pagador) return;
      if (!byPagador[pagador]) byPagador[pagador] = [];
      byPagador[pagador].push({
        numDoc: String(r[1] || ''),
        nossoNum: String(r[2] || ''),
        vencimento: String(r[6] || ''),
        valor: parseValue(r[7]),
        liquidacao: parseValue(r[8]),
        situacaoOriginal: String(r[9] || '').trim(),
        status: mapStatus(String(r[9] || '')),
      });
    });

    // Buscar boletos existentes no banco
    const existingBoletos = await prisma.boleto.findMany({
      where: { pagadorOriginal: { not: null } },
      include: { parcelas: true }
    });
    const existingMap: Record<string, any[]> = {};
    existingBoletos.forEach(b => {
      if (b.pagadorOriginal) {
        if (!existingMap[b.pagadorOriginal]) existingMap[b.pagadorOriginal] = [];
        existingMap[b.pagadorOriginal].push(b);
      }
    });

    const novos: any[] = [];
    const atualizados: any[] = [];
    const alertasBaixados: any[] = [];

    // ════════════════════════════════════════════════════════════════════════
    // PASSO 1 — VALIDAÇÃO PRÉVIA (leitura apenas, sem escrever no banco)
    // Verifica se o arquivo causaria alguma retroação de status em qualquer
    // parcela de qualquer pagador existente.
    //
    // Transições VÁLIDAS:
    //   EM CARTEIRA (PENDENTE) → LIQUIDADO (PAGO)    ✅
    //   EM CARTEIRA (PENDENTE) → VENCIDO              ✅
    //   VENCIDO                → LIQUIDADO (PAGO)    ✅
    //   VENCIDO                → BAIXADO             ✅ (via confirmação manual)
    //
    // Transições INVÁLIDAS — arquivo está desatualizado:
    //   PAGO    → PENDENTE   ❌
    //   PAGO    → VENCIDO    ❌
    //   VENCIDO → PENDENTE   ❌
    // ════════════════════════════════════════════════════════════════════════
    const STATUS_NIVEL: Record<string, number> = {
      PENDENTE: 0,
      VENCIDO:  1,
      PAGO:     2,
      BAIXADO:  3,  // amortização antecipada
      QUITADO:  3,  // quitação de parcelas em atraso (mesmo nível que BAIXADO)
    };

    // Pré-processamento: se o pagador do XLS não for encontrado diretamente,
    // verifica se o 'numDoc' (Nº Doc) da primeira parcela corresponde a um 'pagadorOriginal' no banco
    // (Isso ocorre quando o Controle de Contratos gera o boleto com o ID (ex: 10101027), mas o banco preenche a coluna Pagador com o nome)
    const codigosNaoEncontrados: string[] = [];
    
    for (const [pagadorXls, parcelas] of Object.entries(byPagador)) {
      if (!existingMap[pagadorXls]) {
        // O padrão exato gerado pelo Controle de Contratos é:
        // Produto (1, 2 ou 3) + '0' + Quantidade + '0' + Parcelas + '0' + Temporada (2 dígitos)
        // Exemplo: 10101027
        const regexContrato = /^[123]0\d+0\d+0\d{2}$/;
        
        // Pega os numDocs deste grupo que são códigos do sistema únicos
        const possibleDocs = Array.from(new Set(parcelas.map(p => p.numDoc).filter(d => d && regexContrato.test(d))));
        let foundBoletos: any[] = [];
        
        for (const doc of possibleDocs) {
          if (existingMap[doc]) {
            foundBoletos.push(...existingMap[doc]);
          }
        }
        
        if (foundBoletos.length > 0) {
          // Bingo! Os boletos existem no banco sob os códigos (ex: 101015026, 2010012026), vinculamos.
          existingMap[pagadorXls] = foundBoletos;
        } else {
          // Se não encontrou, e tem um doc que se parece muito com um código do Controle de Contratos,
          // ou se o PRÓPRIO nome do pagador é um código no padrão.
          const isPagadorCode = regexContrato.test(pagadorXls);
          if (possibleDocs.length > 0 || isPagadorCode) {
            // Adicionamos os docs puramente numéricos (ou o próprio pagador se for numérico) à lista de bloqueio
            const codeToBlock = isPagadorCode ? pagadorXls : possibleDocs[0];
            if (!codigosNaoEncontrados.includes(codeToBlock)) {
              codigosNaoEncontrados.push(codeToBlock);
            }
          }
        }
      }
    }

    const conflitos: { pagador: string; dataVencimento: string; statusBanco: string; statusXls: string }[] = [];

    for (const [pagadorOriginal, parcelas] of Object.entries(byPagador)) {
      if (!existingMap[pagadorOriginal]) {
        continue;
      }

      for (const boleto of existingMap[pagadorOriginal]) {
        for (const dbParcela of (boleto.parcelas || [])) {
          if (dbParcela.status === 'BAIXADO') continue; // imutável, não verifica

          // Filtramos as parcelas relevantes para este boleto específico
          let parcelasDoBoleto = parcelas;
          if (boleto.pagadorOriginal && /^[123]0\d+0\d+0\d{2}$/.test(boleto.pagadorOriginal)) {
             parcelasDoBoleto = parcelas.filter((p: any) => p.numDoc === boleto.pagadorOriginal);
          }

          const xlsParcela = parcelasDoBoleto.find((p: any) => {
            const dt = parseVencimento(p.vencimento);
            if (!dt) return false;
            const anoMes = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
            return anoMes === dbParcela.dataVencimento;
          });

          if (!xlsParcela || xlsParcela.status === 'CANCELADO') continue;

          const newStatus =
            xlsParcela.status === 'PAGO'    ? 'PAGO' :
            xlsParcela.status === 'VENCIDO' ? 'VENCIDO' : 'PENDENTE';

          const nivelAtual = STATUS_NIVEL[dbParcela.status] ?? 0;
          const nivelNovo  = STATUS_NIVEL[newStatus] ?? 0;

          if (nivelNovo < nivelAtual) {
            conflitos.push({
              pagador: pagadorOriginal,
              dataVencimento: dbParcela.dataVencimento || 'N/A',
              statusBanco: dbParcela.status,
              statusXls: newStatus,
            });
          }
        }
      }
    }

    // REMOVIDO: Bloqueio do arquivo por código não encontrado.
    // Agora o arquivo passa, mas esses códigos são ignorados e avisados no frontend.

    // Se houver qualquer conflito → bloquear o arquivo inteiro
    if (conflitos.length > 0) {
      return NextResponse.json({
        erro: 'RELATORIO_DESATUALIZADO',
        mensagem: `Este arquivo contém ${conflitos.length} parcela(s) que estão desatualizadas em relação ao banco. O arquivo não foi processado. Envie o relatório mais recente emitido pelo banco.`,
        conflitos,
      }, { status: 422 });
    }

    // ════════════════════════════════════════════════════════════════════════
    // PASSO 2 — PROCESSAMENTO (arquivo validado, pode escrever)
    // ════════════════════════════════════════════════════════════════════════


    for (const [pagadorOriginal, parcelas] of Object.entries(byPagador)) {
      // Ignorar os que foram classificados como códigos do sistema não encontrados
      if (codigosNaoEncontrados.includes(pagadorOriginal) || parcelas.some(p => codigosNaoEncontrados.includes(p.numDoc))) {
        continue;
      }

      const parts = pagadorOriginal.split(/\s*[-–]\s*/);
      let nomeResponsavel = parts[0]?.trim() || pagadorOriginal;
      let nomeFormandoRaw = parts.slice(1).join(' - ').trim();
      let eventoDetectado = '';
      const words = pagadorOriginal.split(/\s+/);
      const lastWord = words[words.length - 1];
      if (lastWord && lastWord.length >= 2 && lastWord === lastWord.toUpperCase() && !/^\d+$/.test(lastWord)) {
        eventoDetectado = lastWord;
        nomeFormandoRaw = nomeFormandoRaw.replace(new RegExp(`\\s*${lastWord}\\s*$`), '').trim();
      }

      if (existingMap[pagadorOriginal]) {
        // ─── Pagador JÁ EXISTE no banco ────────────────────────────────────────
        const boletosDb = existingMap[pagadorOriginal];

        // ── Atualização de status por dataVencimento ──────────────────────────
        // Cruza cada parcela do XLS (não-CANCELADO) com a parcela do banco pela data.
        // As parcelas CANCELADO são tratadas separadamente via alerta (acima).
        //
        // REGRA ANTI-DOWNGRADE: o sistema só avança status, nunca retrocede.
        // Hierarquia: PENDENTE(0) < VENCIDO(1) < PAGO(2) < BAIXADO/QUITADO(3)
        const STATUS_NIVEL: Record<string, number> = {
          PENDENTE: 0,
          VENCIDO:  1,
          PAGO:     2,
          BAIXADO:  3,  // amortização — imutável
          QUITADO:  3,  // quitação de atraso — imutável
        };

        let parcelasAtualizadas = 0;
        for (const boleto of boletosDb) {
          // Filtramos as parcelas relevantes para este boleto específico
          let parcelasDoBoleto = parcelas;
          if (boleto.pagadorOriginal && /^[123]0\d+0\d+0\d{2}$/.test(boleto.pagadorOriginal)) {
             parcelasDoBoleto = parcelas.filter((p: any) => p.numDoc === boleto.pagadorOriginal);
          }

          // Detectar cenário de baixado com boleto ativo e gerar alerta para confirmação ESPECÍFICA deste boleto
          const temBaixadosBoleto = parcelasDoBoleto.some((p: any) => p.status === 'CANCELADO');
          if (temBaixadosBoleto) {
            const alerta = classificarBaixados(pagadorOriginal, parcelasDoBoleto, [boleto]);
            if (alerta) {
              alertasBaixados.push(alerta);
            }
          }

          // Ordena as parcelas específicas deste boleto para fallback de vínculo
          const xlsParcelasOrdenadas = [...parcelasDoBoleto].sort((a, b) => {
            const dtA = parseVencimento(a.vencimento);
            const dtB = parseVencimento(b.vencimento);
            if (dtA && dtB) return dtA.getTime() - dtB.getTime();
            return 0;
          });

          // Limpar flag de _matched temporária
          xlsParcelasOrdenadas.forEach((p: any) => p._matched = false);

          const processUpdate = async (dbParcela: any, xlsParcela: any) => {
            // Parcelas CANCELADO no XLS aguardam confirmação — não atualizar agora
            if (xlsParcela.status === 'CANCELADO') return;

            const newStatus =
              xlsParcela.status === 'PAGO'    ? 'PAGO' :
              xlsParcela.status === 'VENCIDO' ? 'VENCIDO' : 'PENDENTE';

            const nivelAtual = STATUS_NIVEL[dbParcela.status] ?? 0;
            const nivelNovo  = STATUS_NIVEL[newStatus] ?? 0;
            
            const updateData: any = {};
            let isAtualizado = false;

            // Bloquear downgrade: só atualiza se o novo status for MAIOR na hierarquia
            if (nivelNovo > nivelAtual) {
              updateData.status = newStatus;
              isAtualizado = true;
            }

            // Auto-heal: preencher dataVencimento no banco se estiver nula
            if (!dbParcela.dataVencimento && xlsParcela.vencimento) {
              const dt = parseVencimento(xlsParcela.vencimento);
              if (dt) {
                const newAnoMes = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
                updateData.dataVencimento = newAnoMes;
                isAtualizado = true;
              }
            }

            if (isAtualizado) {
              await prisma.parcela.update({
                where: { id: dbParcela.id },
                data: updateData,
              });
              if (updateData.status) parcelasAtualizadas++;
            }
          };

          // PASS 1: Cruzamento exato por data de vencimento
          for (const dbParcela of (boleto.parcelas || [])) {
            if (dbParcela.status === 'BAIXADO' || dbParcela.status === 'QUITADO') continue;

            let xlsParcela = xlsParcelasOrdenadas.find((p: any) => {
              if (p._matched) return false;
              const dt = parseVencimento(p.vencimento);
              if (!dt) return false;
              const anoMes = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
              return anoMes === dbParcela.dataVencimento;
            });

            if (xlsParcela) {
              xlsParcela._matched = true;
              await processUpdate(dbParcela, xlsParcela);
            }
          }

          // PASS 2: Fallback sequencial para parcelas no banco SEM dataVencimento
          for (const dbParcela of (boleto.parcelas || [])) {
            if (dbParcela.status === 'BAIXADO' || dbParcela.status === 'QUITADO') continue;
            if (dbParcela.dataVencimento) continue; // já tem data (processada ou não bateu, mas tem data)

            // Pega a primeira parcela do XLS ordenada que ainda NÃO foi vinculada
            let xlsParcela = xlsParcelasOrdenadas.find((p: any) => !p._matched);

            if (xlsParcela) {
              xlsParcela._matched = true;
              await processUpdate(dbParcela, xlsParcela);
            }
          }
        }

        atualizados.push({
          pagador: pagadorOriginal,
          boletosAtualizados: boletosDb.length,
          parcelasAtualizadas,
        });

      } else {
        // ─── Pagador NOVO — precisa classificação ────────────────────────────────
        // Se tem baixados, fica separado aguardando justificativa (conforme decisão do usuário)
        const valueGroups: Record<string, any[]> = {};
        parcelas.forEach(p => {
          const key = String(Math.round(p.valor));
          if (!valueGroups[key]) valueGroups[key] = [];
          valueGroups[key].push(p);
        });

        const grupos = Object.entries(valueGroups).map(([valorBase, groupParcelas]) => {
          const totalValor = groupParcelas.reduce((sum, p) => sum + p.valor, 0);
          const detection = detectProduct(totalValor);
          return {
            valorParcela: parseFloat(valorBase),
            totalValor: Math.round(totalValor * 100) / 100,
            numParcelas: groupParcelas.length,
            produtoSugerido: detection.produto,
            confianca: detection.confianca,
            pagos: groupParcelas.filter(p => p.status === 'PAGO').length,
            pendentes: groupParcelas.filter(p => p.status === 'PENDENTE').length,
            vencidos: groupParcelas.filter(p => p.status === 'VENCIDO').length,
            cancelados: groupParcelas.filter(p => p.status === 'CANCELADO').length,
            parcelas: groupParcelas,
          };
        });

        novos.push({
          pagadorOriginal,
          nomeResponsavel,
          nomeFormando: nomeFormandoRaw,
          eventoDetectado,
          totalParcelas: parcelas.length,
          temBaixados: parcelas.some((p: any) => p.status === 'CANCELADO'),
          grupos,
        });
      }
    }

    return NextResponse.json({
      totalPagadores: Object.keys(byPagador).length,
      totalBoletos: rows.length,
      novos,
      atualizados,
      alertasBaixados, // ← novo campo na resposta
      codigosNaoEncontrados, // ← códigos ignorados
    });

  } catch (error: any) {
    console.error('Error parsing XLS:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
