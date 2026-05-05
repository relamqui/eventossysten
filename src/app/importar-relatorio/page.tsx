'use client';

import { useState, useEffect } from 'react';
import { Upload, ChevronDown, ChevronUp, CheckCircle, AlertTriangle, HelpCircle, Loader2, FileText, XCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

type Parcela = { numDoc: string; nossoNum: string; vencimento: string; valor: number; liquidacao: number; situacaoOriginal: string; status: string };
type Grupo = { valorParcela: number; totalValor: number; numParcelas: number; produtoSugerido: string; confianca: string; pagos: number; pendentes: number; vencidos: number; cancelados: number; parcelas: Parcela[] };
type PagadorNovo = { pagadorOriginal: string; nomeResponsavel: string; nomeFormando: string; eventoDetectado: string; totalParcelas: number; temBaixados: boolean; grupos: Grupo[]; isCodigoSistema?: boolean; codigoInfo?: { codigo: string; produto: string; quantidade: number; parcelas: number; temporada: string } };
type Atualizado = { pagador: string; boletosAtualizados: number; parcelasAtualizadas: number };
type Alerta = { tipo: string; pagador: string; mensagem: string; parcelas: Parcela[] };
type DbParcelaRef = { id: number; mesIndex: number; status: string };
type AlertaBaixado = {
  tipo: 'AMORTIZACAO' | 'QUITACAO_ATRASO' | 'INDEFINIDO';
  pagador: string;
  sugestao: string;
  parcelasBaixadas: Parcela[];
  parcelaLiquidada: Parcela | null;
  totalBaixado: number;
  dbParcelaIds: DbParcelaRef[];
  boletoOriginal?: any;
  valorJaPago?: number;
};
type Conflito = { pagador: string; dataVencimento: string; statusBanco: string; statusXls: string };
type ErroRelatorio = { 
  mensagem: string; 
  conflitos: Conflito[];
  codigosNaoEncontrados?: string[];
};

export default function ImportarRelatorioPage() {
  const router = useRouter();
  const [novos, setNovos] = useState<PagadorNovo[]>([]);
  const [atualizados, setAtualizados] = useState<Atualizado[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [alertasBaixados, setAlertasBaixados] = useState<AlertaBaixado[]>([]);
  const [eventos, setEventos] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [stats, setStats] = useState({ totalPagadores: 0, totalBoletos: 0 });
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [editState, setEditState] = useState<Record<number, any>>({});
  const [importando, setImportando] = useState<number | null>(null);
  const [ignorandoIdx, setIgnorandoIdx] = useState<number | null>(null);
  const [importados, setImportados] = useState<Set<number>>(new Set());
  const [alertaMotivos, setAlertaMotivos] = useState<Record<number, string>>({});
  const [alertaResolvidos, setAlertaResolvidos] = useState<Set<number>>(new Set());
  // Estados para os alertas de baixados por solicitação
  const [baixadoMotivos, setBaixadoMotivos] = useState<Record<number, string>>({});
  const [baixadoConfirmando, setBaixadoConfirmando] = useState<number | null>(null);
  const [baixadoResolvidos, setBaixadoResolvidos] = useState<Set<number>>(new Set());
  const [codigosIgnorados, setCodigosIgnorados] = useState<string[]>([]);
  
  // Estados para renegociação
  const [renegociandoIdx, setRenegociandoIdx] = useState<number | null>(null);
  const [renegociacaoInputs, setRenegociacaoInputs] = useState<any>({});
  const [renegociandoLoader, setRenegociandoLoader] = useState(false);

  // Erro de relatório desatualizado (HTTP 422)
  const [erroRelatorio, setErroRelatorio] = useState<ErroRelatorio | null>(null);

  useEffect(() => { fetchEventos(); }, []);

  const fetchEventos = async () => {
    try { const res = await fetch('/api/eventos'); if (res.ok) setEventos(await res.json()); } catch (e) { console.error(e); }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setErroRelatorio(null); // limpa erro anterior
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/importar-relatorio', { method: 'POST', body: formData });

      if (res.status === 422) {
        // Erro de validação bloqueante (ex: desatualizado ou código não encontrado)
        const errData = await res.json();
        setErroRelatorio({ 
          mensagem: errData.mensagem, 
          conflitos: errData.conflitos || [],
          codigosNaoEncontrados: errData.codigosNaoEncontrados || []
        });
        setUploading(false);
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setNovos(data.novos || []);
        setAtualizados(data.atualizados || []);
        setAlertas(data.alertas || []);
        setAlertasBaixados(data.alertasBaixados || []);
        setCodigosIgnorados(data.codigosNaoEncontrados || []);
        setStats({ totalPagadores: data.totalPagadores, totalBoletos: data.totalBoletos });
        setUploaded(true);
        const es: Record<number, any> = {};
        (data.novos || []).forEach((p: PagadorNovo, i: number) => {
          es[i] = { 
            nomeResponsavel: p.nomeResponsavel, 
            nomeFormando: p.nomeFormando, 
            evento: '', 
            grupos: p.grupos.map((g: Grupo) => ({ 
              produto: (p.isCodigoSistema && p.codigoInfo) ? p.codigoInfo.produto : g.produtoSugerido,
              qtdAdulto: 0,
              qtdInfantil: 0,
              qtdPacote: 0
            })) 
          };
        });
        setEditState(es);
        setImportados(new Set());
        setAlertaResolvidos(new Set());
        setAlertaMotivos({});
        setBaixadoMotivos({});
        setBaixadoResolvidos(new Set());
      } else { const err = await res.json(); alert(`Erro: ${err.error}`); }
    } catch (e) { alert('Falha no upload'); }
    setUploading(false);
  };

  const handleConfirmarBaixado = async (idx: number, tipo: AlertaBaixado['tipo']) => {
    const alerta = alertasBaixados[idx];
    if (!alerta) return;
    setBaixadoConfirmando(idx);
    try {
      // dbParcelaIds já contém apenas as parcelas que correspondem exatamente
      // aos baixados do XLS (match por dataVencimento), sem filtro extra necessário
      const idsParaAtualizar = alerta.dbParcelaIds.map(p => p.id);
      const res = await fetch('/api/importar-relatorio/confirmar-baixados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pagadorOriginal: alerta.pagador,
          tipo,
          dbParcelaIds: idsParaAtualizar,
          observacao: baixadoMotivos[idx] || '',
        }),
      });
      if (res.ok) {
        setBaixadoResolvidos(prev => new Set([...prev, idx]));
      } else {
        const err = await res.json();
        alert(`Erro: ${err.error}`);
      }
    } catch (e) {
      alert('Falha na conexão');
    }
    setBaixadoConfirmando(null);
  };

  const handleMultiploChange = (idx: number, gi: number, field: string, value: number) => {
    setEditState(prev => {
      const newGrupos = [...(prev[idx]?.grupos || [])];
      newGrupos[gi] = { ...newGrupos[gi], [field]: value };
      return { ...prev, [idx]: { ...prev[idx], grupos: newGrupos } };
    });
  };

  const handleConfirmar = async (idx: number) => {
    const p = novos[idx];
    const es = editState[idx];
    if (!es) return;
    setImportando(idx);
    try {
      const gruposPayload = p.grupos.map((g, gi) => {
        const eg = es.grupos[gi];
        let finalProd = eg?.produto || g.produtoSugerido;
        let finalQtd = "1";
        
        if (finalProd === 'Múltiplos Produtos') {
          const parts = [];
          if (eg.qtdAdulto > 0) parts.push(`Indispensável Adulto (x${eg.qtdAdulto})`);
          if (eg.qtdInfantil > 0) parts.push(`Indispensável Infantil (x${eg.qtdInfantil})`);
          if (eg.qtdPacote > 0) parts.push(`Pacote Formando (x${eg.qtdPacote})`);
          finalProd = parts.length > 0 ? parts.join(' + ') : 'Produto Misto Indefinido';
          finalQtd = "Misto";
        }
        
        return { produto: finalProd, quantidade: finalQtd, parcelas: g.parcelas };
      });
      const res = await fetch('/api/importar-relatorio/confirmar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pagadorOriginal: p.pagadorOriginal, nomeResponsavel: es.nomeResponsavel, nomeFormando: es.nomeFormando, evento: es.evento, grupos: gruposPayload })
      });
      if (res.ok) { setImportados(prev => new Set([...prev, idx])); }
      else { const err = await res.json(); alert(`Erro: ${err.error}`); }
    } catch (e) { alert('Falha na conexão'); }
    setImportando(null);
  };

  const handleIgnorar = async (idx: number) => {
    const p = novos[idx];
    if (!confirm(`Tem certeza que deseja ignorar permanentemente os boletos deste grupo? Eles não aparecerão mais em importações futuras.`)) return;
    
    setIgnorandoIdx(idx);
    try {
      const docsToIgnore: string[] = [];
      p.grupos.forEach((g: Grupo) => {
        g.parcelas.forEach((parc: any) => {
          if (parc.numDoc) docsToIgnore.push(parc.numDoc);
        });
      });
      const uniqueDocs = Array.from(new Set(docsToIgnore));

      const res = await fetch('/api/importar-relatorio/ignorar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docs: uniqueDocs.length > 0 ? uniqueDocs : undefined, pagadorOriginal: uniqueDocs.length === 0 ? p.pagadorOriginal : undefined })
      });
      if (res.ok) {
        setImportados(prev => new Set([...prev, idx])); // Esconde da lista
        if (uniqueDocs.length === 0) setCodigosIgnorados(prev => [...prev, p.pagadorOriginal]); 
      } else {
        const err = await res.json();
        alert(`Erro: ${err.error}`);
      }
    } catch (e) {
      alert('Falha na conexão');
    }
    setIgnorandoIdx(null);
  };

  const handleAbrirRenegociacao = (idx: number) => {
    const alerta = alertasBaixados[idx];
    if (!alerta || !alerta.boletoOriginal) return;
    
    setRenegociandoIdx(idx);
    setRenegociacaoInputs({
      produto: alerta.boletoOriginal.produto || 'Indispensável Adulto',
      quantidade: alerta.boletoOriginal.quantidade ? parseInt(alerta.boletoOriginal.quantidade) : 1,
      parcelas: alerta.boletoOriginal.numeroParcelas ? parseInt(alerta.boletoOriginal.numeroParcelas) : 1,
    });
  };

  const getCalculoRenegociacao = (alerta: AlertaBaixado, inputs: any) => {
    if (!alerta || !alerta.boletoOriginal) return { totalProduto: 0, novoValorEmitir: 0, codigo: '' };
    const evento = eventos.find(e => e.nome === alerta.boletoOriginal.evento);
    if (!evento) return { totalProduto: 0, novoValorEmitir: 0, codigo: '' };

    let valorProduto = 0;
    if (inputs.produto === 'Indispensável Adulto') {
      valorProduto = evento.valorIndispAdultoParcelado || 0;
    } else if (inputs.produto === 'Indispensável Infantil') {
      valorProduto = evento.valorIndispInfantilParcelado || 0;
    }

    const novoTotalProduto = valorProduto * (parseInt(inputs.quantidade) || 1);
    const novoValorEmitir = Math.max(0, novoTotalProduto - (alerta.valorJaPago || 0));

    let prodNum = '1';
    if (inputs.produto === 'Indispensável Adulto') prodNum = '2';
    if (inputs.produto === 'Indispensável Infantil') prodNum = '3';
    
    let temp = '00';
    if (evento.temporada) temp = evento.temporada.toString().slice(-2);
    
    const qtdStr = inputs.quantidade || 1;
    const parcStr = inputs.parcelas || 1;
    
    const codigo = `${prodNum}0${qtdStr}0${parcStr}0${temp}`;

    return { totalProduto: novoTotalProduto, novoValorEmitir, codigo };
  };

  const handleExecutarRenegociacao = async (idx: number) => {
    const alerta = alertasBaixados[idx];
    if (!alerta || !alerta.boletoOriginal) return;
    const calc = getCalculoRenegociacao(alerta, renegociacaoInputs);
    
    setRenegociandoLoader(true);
    try {
      const res = await fetch('/api/importar-relatorio/renegociar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boletoOriginalId: alerta.boletoOriginal.id,
          novoProduto: renegociacaoInputs.produto,
          novaQuantidade: renegociacaoInputs.quantidade,
          novasParcelas: renegociacaoInputs.parcelas,
          novoTotal: calc.novoValorEmitir,
          novoCodigo: calc.codigo,
          dbParcelaIds: alerta.dbParcelaIds
        })
      });
      if (res.ok) {
        setBaixadoResolvidos(prev => new Set([...prev, idx]));
        setRenegociandoIdx(null);
      } else {
        const err = await res.json();
        alert(`Erro: ${err.error}`);
      }
    } catch (e) {
      alert('Falha na conexão');
    }
    setRenegociandoLoader(false);
  };

  const confiancaIcon = (c: string) => {
    if (c === 'alta') return <CheckCircle size={14} style={{ color: '#10b981' }} />;
    if (c === 'média') return <AlertTriangle size={14} style={{ color: '#f59e0b' }} />;
    return <HelpCircle size={14} style={{ color: '#ef4444' }} />;
  };

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = { PAGO: '#10b981', PENDENTE: '#f59e0b', VENCIDO: '#ef4444', CANCELADO: '#6b7280' };
    return <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: `${colors[s] || '#6b7280'}22`, color: colors[s] || '#6b7280', fontWeight: 'bold' }}>{s}</span>;
  };

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: '#fff', fontSize: '0.85rem' };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button onClick={() => router.push('/controle-boletos')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <ArrowLeft size={20} /> Voltar
        </button>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Importar Relatório de Títulos</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Upload mensal do relatório do banco para sincronizar status dos boletos.</p>
        </div>
      </div>

      {/* Upload */}
      <div style={{ backgroundColor: 'var(--surface)', border: '2px dashed var(--border)', borderRadius: '12px', padding: '32px', textAlign: 'center', marginBottom: '24px', cursor: 'pointer' }}
        onClick={() => document.getElementById('xls-input')?.click()}>
        <input id="xls-input" type="file" accept=".xls,.xlsx" hidden onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); }} />
        {uploading ? (
          <><Loader2 size={40} style={{ margin: '0 auto 12px', animation: 'spin 1s linear infinite', color: 'var(--primary)' }} /><p style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Processando arquivo...</p></>
        ) : (
          <><Upload size={40} style={{ margin: '0 auto 12px', color: 'var(--text-secondary)' }} /><p style={{ color: 'var(--text-secondary)' }}>Clique para selecionar o arquivo <strong>.xls</strong></p></>
        )}
      </div>

      {/* ─── ERRO: RELATÓRIO DESATUALIZADO OU BOLETO NÃO ENCONTRADO ─── */}
      {erroRelatorio && (
        <div style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '2px solid rgba(239,68,68,0.5)', borderRadius: '12px', padding: '24px', marginBottom: '24px', borderLeft: '6px solid #ef4444' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '20px' }}>
            <XCircle size={36} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#ef4444', marginBottom: '6px' }}>
                {erroRelatorio.codigosNaoEncontrados && erroRelatorio.codigosNaoEncontrados.length > 0 
                  ? '⛔ Arquivo Rejeitado — Código(s) de Contrato Pendente(s)'
                  : '⛔ Arquivo Rejeitado — Relatório Desatualizado'
                }
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                {erroRelatorio.mensagem}
              </p>
            </div>
          </div>

          {erroRelatorio.codigosNaoEncontrados && erroRelatorio.codigosNaoEncontrados.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                Códigos pendentes no Controle de Contratos ({erroRelatorio.codigosNaoEncontrados.length}):
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {erroRelatorio.codigosNaoEncontrados.map(codigo => (
                  <span key={codigo} style={{ padding: '6px 12px', backgroundColor: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#ef4444', fontWeight: 'bold', fontFamily: 'monospace' }}>
                    {codigo}
                  </span>
                ))}
              </div>
            </div>
          )}

          {erroRelatorio.conflitos.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                Parcelas que causaram o bloqueio ({erroRelatorio.conflitos.length}):
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(239,68,68,0.3)' }}>
                      <th style={{ textAlign: 'left', padding: '6px 12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Pagador</th>
                      <th style={{ textAlign: 'left', padding: '6px 12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Vencimento</th>
                      <th style={{ textAlign: 'left', padding: '6px 12px', color: 'var(--text-secondary)', fontWeight: '600' }}>No Banco</th>
                      <th style={{ textAlign: 'left', padding: '6px 12px', color: 'var(--text-secondary)', fontWeight: '600' }}>No Arquivo XLS</th>
                      <th style={{ textAlign: 'left', padding: '6px 12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Problema</th>
                    </tr>
                  </thead>
                  <tbody>
                    {erroRelatorio.conflitos.map((c, ci) => (
                      <tr key={ci} style={{ borderBottom: '1px solid rgba(239,68,68,0.15)', backgroundColor: ci % 2 === 0 ? 'rgba(239,68,68,0.04)' : 'transparent' }}>
                        <td style={{ padding: '8px 12px', color: 'var(--text-primary)', fontWeight: '500' }}>{c.pagador}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-primary)' }}>{c.dataVencimento}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: '#10b98122', color: '#10b981', fontWeight: 'bold', fontSize: '0.75rem' }}>{c.statusBanco}</span>
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: '#f59e0b22', color: '#f59e0b', fontWeight: 'bold', fontSize: '0.75rem' }}>{c.statusXls}</span>
                        </td>
                        <td style={{ padding: '8px 12px', color: '#ef4444', fontSize: '0.78rem' }}>
                          {c.statusBanco} → {c.statusXls} não é permitido
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}


          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px 16px', backgroundColor: 'rgba(239,68,68,0.06)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertTriangle size={18} style={{ color: '#f59e0b', flexShrink: 0 }} />
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
              <strong style={{ color: 'var(--text-primary)' }}>O que fazer:</strong> acesse o internet banking, gere o relatório mais recente de títulos e envie novamente. O arquivo deve refletir o estado atual das cobranças.
            </p>
            <button
              onClick={() => { setErroRelatorio(null); document.getElementById('xls-input')?.click(); }}
              style={{ marginLeft: 'auto', padding: '8px 16px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.82rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}
            >
              <RefreshCw size={14} /> Enviar Novo Arquivo
            </button>
          </div>
        </div>
      )}

      {uploaded && (
        <>
          {/* Stats */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
            <div style={{ flex: 1, backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--primary)' }}>{stats.totalPagadores}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Pagadores</div>
            </div>
            <div style={{ flex: 1, backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#10b981' }}>{atualizados.length}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Atualizados</div>
            </div>
            <div style={{ flex: 1, backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#f59e0b' }}>{novos.length}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Novos</div>
            </div>
            <div style={{ flex: 1, backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#3b82f6' }}>{alertasBaixados.length}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Baixados</div>
            </div>
            <div style={{ flex: 1, backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#ef4444' }}>{alertas.length}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Alertas</div>
            </div>
          </div>

          {/* CÓDIGOS IGNORADOS */}
          {codigosIgnorados.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#ef4444', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <XCircle size={20} /> Códigos Ignorados — Não Encontrados ({codigosIgnorados.length})
              </h2>
              <div style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '16px', borderLeft: '4px solid #ef4444' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '12px' }}>
                  Os seguintes códigos do sistema não foram encontrados no banco de dados e foram ignorados na importação. Verifique se os contratos já foram gerados.
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {codigosIgnorados.map(codigo => (
                    <span key={codigo} style={{ padding: '6px 12px', backgroundColor: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#ef4444', fontWeight: 'bold', fontFamily: 'monospace' }}>
                      {codigo}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ─── BAIXADOS POR SOLICITAÇÃO ─── */}
          {alertasBaixados.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#3b82f6', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={20} /> Baixados por Solicitação — Requerem Justificativa ({alertasBaixados.length - baixadoResolvidos.size})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {alertasBaixados.map((a, ai) => {
                  const isResolvido = baixadoResolvidos.has(ai);
                  const isConfirmando = baixadoConfirmando === ai;

                  const tipoConfig = {
                    AMORTIZACAO:     { cor: '#3b82f6', corBg: 'rgba(59,130,246,0.08)', corBorder: 'rgba(59,130,246,0.3)', label: '🔵 AMORTIZAÇÃO DETECTADA' },
                    QUITACAO_ATRASO: { cor: '#f59e0b', corBg: 'rgba(245,158,11,0.08)', corBorder: 'rgba(245,158,11,0.3)', label: '🟡 QUITAÇÃO DE ATRASO DETECTADA' },
                    INDEFINIDO:      { cor: '#8b5cf6', corBg: 'rgba(139,92,246,0.08)', corBorder: 'rgba(139,92,246,0.3)', label: '🟣 BAIXADO — TIPO INDEFINIDO' },
                  }[a.tipo];

                  if (isResolvido) {
                    return (
                      <div key={ai} style={{ backgroundColor: 'var(--surface)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', opacity: 0.7 }}>
                        <CheckCircle size={18} style={{ color: '#10b981', flexShrink: 0 }} />
                        <div>
                          <span style={{ fontWeight: 'bold', color: '#10b981', fontSize: '0.85rem' }}>Resolvido </span>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{a.pagador}</span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={ai} style={{ backgroundColor: tipoConfig.corBg, border: `1px solid ${tipoConfig.corBorder}`, borderRadius: '10px', padding: '16px', borderLeft: `4px solid ${tipoConfig.cor}` }}>
                      {/* Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <div>
                          <div style={{ fontWeight: 'bold', color: tipoConfig.cor, fontSize: '0.85rem', marginBottom: '2px' }}>{tipoConfig.label}</div>
                          <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '0.95rem' }}>{a.pagador}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{a.sugestao}</div>
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: tipoConfig.cor, whiteSpace: 'nowrap', marginLeft: '16px' }}>
                          R$ {a.totalBaixado.toFixed(2)}
                        </div>
                      </div>

                      {/* Parcelas baixadas */}
                      <div style={{ marginBottom: '10px' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'bold', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Parcelas Baixadas:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {a.parcelasBaixadas.map((p, pi) => (
                            <div key={pi} style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.2)', border: `1px solid ${tipoConfig.corBorder}`, color: 'var(--text-primary)' }}>
                              Doc {p.numDoc} | {p.vencimento} | <strong>R$ {p.valor.toFixed(2)}</strong>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Parcela liquidada detectada */}
                      {a.parcelaLiquidada && (
                        <div style={{ marginBottom: '10px', padding: '8px 12px', borderRadius: '6px', backgroundColor: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', fontSize: '0.8rem' }}>
                          <span style={{ color: '#10b981', fontWeight: 'bold' }}>✅ Boleto de quitação detectado: </span>
                          <span style={{ color: 'var(--text-primary)' }}>Doc {a.parcelaLiquidada.numDoc} | {a.parcelaLiquidada.vencimento} | R$ {a.parcelaLiquidada.valor.toFixed(2)} PAGO</span>
                        </div>
                      )}

                      {/* Observação + botões */}
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          placeholder="Observação opcional (ex: cliente pediu amortização)..."
                          value={baixadoMotivos[ai] || ''}
                          onChange={e => setBaixadoMotivos(prev => ({ ...prev, [ai]: e.target.value }))}
                          style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: `1px solid ${tipoConfig.corBorder}`, backgroundColor: 'var(--background)', color: '#fff', fontSize: '0.85rem' }}
                        />
                        <button
                          onClick={() => handleConfirmarBaixado(ai, a.tipo)}
                          disabled={isConfirmando}
                          style={{ padding: '8px 16px', backgroundColor: tipoConfig.cor, color: '#fff', border: 'none', borderRadius: '6px', cursor: isConfirmando ? 'wait' : 'pointer', fontWeight: 'bold', fontSize: '0.8rem', whiteSpace: 'nowrap', opacity: isConfirmando ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          {isConfirmando ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Confirmando...</> : <><CheckCircle size={14} /> Confirmar {a.tipo === 'AMORTIZACAO' ? 'Amortização' : a.tipo === 'QUITACAO_ATRASO' ? 'Quitação' : 'Baixa'}</>}
                        </button>
                        
                        <button
                          onClick={() => handleAbrirRenegociacao(ai)}
                          disabled={isConfirmando}
                          style={{ padding: '8px 16px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: isConfirmando ? 'wait' : 'pointer', fontWeight: 'bold', fontSize: '0.8rem', whiteSpace: 'nowrap', opacity: isConfirmando ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <FileText size={14} /> Nova Emissão / Redução
                        </button>
                      </div>

                      {renegociandoIdx === ai && (
                        <div style={{ marginTop: '16px', padding: '16px', backgroundColor: 'var(--background)', border: '1px solid #3b82f6', borderRadius: '8px' }}>
                          <h4 style={{ fontSize: '0.9rem', color: '#3b82f6', marginBottom: '12px', fontWeight: 'bold' }}>Renegociação de Indispensáveis</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Produto</label>
                              <select value={renegociacaoInputs.produto || ''} onChange={e => setRenegociacaoInputs((prev: any) => ({ ...prev, produto: e.target.value }))} style={inputStyle}>
                                <option value="Indispensável Adulto">Indispensável Adulto</option>
                                <option value="Indispensável Infantil">Indispensável Infantil</option>
                                <option value="Pacote Formando">Pacote Formando</option>
                              </select>
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Nova Quantidade</label>
                              <input type="number" min="1" value={renegociacaoInputs.quantidade || 1} onChange={e => setRenegociacaoInputs((prev: any) => ({ ...prev, quantidade: parseInt(e.target.value) || 1 }))} style={inputStyle} />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Novas Parcelas</label>
                              <input type="number" min="1" value={renegociacaoInputs.parcelas || 1} onChange={e => setRenegociacaoInputs((prev: any) => ({ ...prev, parcelas: parseInt(e.target.value) || 1 }))} style={inputStyle} />
                            </div>
                          </div>
                          
                          {(() => {
                            const calc = getCalculoRenegociacao(a, renegociacaoInputs);
                            return (
                              <div style={{ backgroundColor: 'rgba(59,130,246,0.1)', padding: '12px', borderRadius: '6px', fontSize: '0.85rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                  <span style={{ color: 'var(--text-secondary)' }}>Valor Já Pago:</span>
                                  <span style={{ fontWeight: 'bold' }}>R$ {a.valorJaPago?.toFixed(2) || '0.00'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                  <span style={{ color: 'var(--text-secondary)' }}>Novo Total do Produto:</span>
                                  <span style={{ fontWeight: 'bold' }}>R$ {calc.totalProduto.toFixed(2)}</span>
                                </div>
                                <hr style={{ border: 'none', borderTop: '1px solid rgba(59,130,246,0.2)', margin: '8px 0' }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: '#3b82f6', fontSize: '0.95rem' }}>
                                  <span>Nova Quantia Total (Para Emitir):</span>
                                  <span style={{ fontWeight: 'bold' }}>R$ {calc.novoValorEmitir.toFixed(2)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981', fontSize: '0.95rem' }}>
                                  <span>Novo Código (Nº Documento):</span>
                                  <span style={{ fontWeight: 'bold' }}>{calc.codigo}</span>
                                </div>
                              </div>
                            );
                          })()}

                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                            <button onClick={() => setRenegociandoIdx(null)} style={{ padding: '8px 16px', backgroundColor: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>Cancelar</button>
                            <button onClick={() => handleExecutarRenegociacao(ai)} disabled={renegociandoLoader} style={{ padding: '8px 16px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: renegociandoLoader ? 'wait' : 'pointer', fontWeight: 'bold', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', opacity: renegociandoLoader ? 0.7 : 1 }}>
                              {renegociandoLoader ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={14} />} Confirmar Nova Emissão
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ALERTAS — Baixados */}
          {alertas.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#ef4444', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={20} /> Alertas — Boletos Baixados ({alertas.length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {alertas.map((a, ai) => (
                  <div key={ai} style={{ backgroundColor: 'var(--surface)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div>
                        <div style={{ fontWeight: 'bold', color: '#ef4444', fontSize: '0.9rem' }}>{a.pagador}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{a.mensagem}</div>
                      </div>
                      {alertaResolvidos.has(ai) && <CheckCircle size={18} style={{ color: '#10b981' }} />}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      Parcelas: {a.parcelas.map(p => `Doc ${p.numDoc} (${p.vencimento})`).join(' | ')}
                    </div>
                    {!alertaResolvidos.has(ai) && (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input placeholder="Informe o motivo da baixa..." value={alertaMotivos[ai] || ''}
                          onChange={e => setAlertaMotivos(prev => ({ ...prev, [ai]: e.target.value }))}
                          style={{ ...inputStyle, flex: 1 }} />
                        <button onClick={() => {
                          if (!alertaMotivos[ai]?.trim()) { alert('Informe o motivo antes de resolver.'); return; }
                          setAlertaResolvidos(prev => new Set([...prev, ai]));
                        }}
                          style={{ padding: '8px 16px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                          Resolver
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ATUALIZADOS */}
          {atualizados.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#10b981', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RefreshCw size={20} /> Boletos Atualizados ({atualizados.length})
              </h2>
              <div style={{ backgroundColor: 'var(--surface)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--background)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left' }}>Pagador</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center' }}>Boletos</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center' }}>Parcelas Atualizadas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {atualizados.map((a, ai) => (
                      <tr key={ai} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 14px', color: 'var(--text-primary)' }}>{a.pagador}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>{a.boletosAtualizados}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          {a.parcelasAtualizadas > 0 ? (
                            <span style={{ color: '#10b981', fontWeight: 'bold' }}>{a.parcelasAtualizadas} atualizada(s)</span>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>Sem alterações</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* NOVOS — CÓDIGOS DE SISTEMA */}
          {novos.filter(n => n.isCodigoSistema).length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#10b981', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={20} /> Novos Contratos via Código do Sistema ({novos.filter(n => n.isCodigoSistema && !importados.has(novos.indexOf(n))).length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {novos.map((p, idx) => {
                  if (!p.isCodigoSistema) return null;
                  const isExpanded = expandedIdx === idx;
                  const isImportado = importados.has(idx);
                  const es = editState[idx] || {};

                  if (isImportado) {
                    return (
                      <div key={idx} style={{ backgroundColor: 'var(--surface)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', padding: '14px', opacity: 0.6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <CheckCircle size={18} style={{ color: '#10b981' }} />
                          <span style={{ fontWeight: 'bold', color: '#10b981' }}>Importado</span>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{p.pagadorOriginal}</span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={idx} style={{ backgroundColor: 'rgba(16,185,129,0.05)', border: '1px solid #10b981', borderRadius: '8px', overflow: 'hidden' }}>
                      <button onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', textAlign: 'left' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                          <CheckCircle size={18} style={{ color: '#10b981', flexShrink: 0 }} />
                          <div>
                            <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#10b981' }}>{p.pagadorOriginal} (Código: {p.codigoInfo?.codigo})</div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', marginTop: '2px' }}>
                              <strong style={{color: '#10b981'}}>Produto:</strong> {p.codigoInfo?.produto} | 
                              <strong style={{color: '#10b981', marginLeft: '6px'}}>Qtd:</strong> {p.codigoInfo?.quantidade} | 
                              <strong style={{color: '#10b981', marginLeft: '6px'}}>Parcelas:</strong> {p.codigoInfo?.parcelas}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '0.8rem' }}>Confirmar Evento</span>
                          {isExpanded ? <ChevronUp size={18} color="#10b981" /> : <ChevronDown size={18} color="#10b981" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(16,185,129,0.3)' }}>
                          <div style={{ padding: '12px 0', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                            Por favor, confirme se os dados estão corretos e <strong>informe o Evento</strong>:
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Nome Responsável</label>
                              <input value={es.nomeResponsavel || ''} onChange={e => setEditState(prev => ({ ...prev, [idx]: { ...prev[idx], nomeResponsavel: e.target.value } }))} style={inputStyle} />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Nome Formando</label>
                              <input value={es.nomeFormando || ''} onChange={e => setEditState(prev => ({ ...prev, [idx]: { ...prev[idx], nomeFormando: e.target.value } }))} style={inputStyle} />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Evento (Obrigatório)</label>
                              <select value={es.evento || ''} onChange={e => setEditState(prev => ({ ...prev, [idx]: { ...prev[idx], evento: e.target.value } }))} style={{...inputStyle, borderColor: '#10b981', borderWidth: '2px'}}>
                                <option value="">Selecione o Evento...</option>
                                {eventos.map(ev => <option key={ev.id} value={ev.nome}>{ev.nome}</option>)}
                              </select>
                            </div>
                          </div>

                          {p.grupos.map((g, gi) => (
                            <div key={gi} style={{ marginBottom: '16px', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: 'var(--background)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {confiancaIcon(g.confianca)}
                                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Grupo {gi + 1}: {g.numParcelas}x R${g.valorParcela.toFixed(2)} = R${g.totalValor.toFixed(2)}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Produto Confirmado:</span>
                                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#10b981' }}>{es.grupos?.[gi]?.produto}</span>
                                </div>
                              </div>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                <thead>
                                  <tr style={{ color: 'var(--text-secondary)' }}>
                                    <th style={{ padding: '6px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Doc</th>
                                    <th style={{ padding: '6px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Vencimento</th>
                                    <th style={{ padding: '6px 12px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Valor</th>
                                    <th style={{ padding: '6px 12px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Liquidação</th>
                                    <th style={{ padding: '6px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {g.parcelas.map((par: any, pi: number) => (
                                    <tr key={pi} style={{ borderBottom: '1px solid var(--border)' }}>
                                      <td style={{ padding: '6px 12px' }}>{par.numDoc}</td>
                                      <td style={{ padding: '6px 12px', color: 'var(--text-secondary)' }}>{par.vencimento}</td>
                                      <td style={{ padding: '6px 12px', textAlign: 'right' }}>R$ {par.valor.toFixed(2)}</td>
                                      <td style={{ padding: '6px 12px', textAlign: 'right', color: par.liquidacao > 0 ? '#10b981' : 'var(--text-secondary)' }}>R$ {par.liquidacao.toFixed(2)}</td>
                                      <td style={{ padding: '6px 12px', textAlign: 'center' }}>{statusBadge(par.status)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ))}

                          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                            <button onClick={() => handleIgnorar(idx)} disabled={importando === idx || ignorandoIdx === idx}
                              style={{ flex: 1, padding: '12px', backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '8px', cursor: (importando === idx || ignorandoIdx === idx) ? 'wait' : 'pointer', fontWeight: 'bold', fontSize: '0.9rem', opacity: (importando === idx || ignorandoIdx === idx) ? 0.7 : 1 }}>
                              {ignorandoIdx === idx ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Ignorar Grupo'}
                            </button>
                            <button onClick={() => {
                                if (!es.evento) { alert('Você precisa selecionar o evento para confirmar.'); return; }
                                handleConfirmar(idx);
                              }} disabled={importando === idx || ignorandoIdx === idx}
                              style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', cursor: (importando === idx || ignorandoIdx === idx) ? 'wait' : 'pointer', fontWeight: 'bold', fontSize: '0.9rem', opacity: (importando === idx || ignorandoIdx === idx) ? 0.7 : 1 }}>
                              {importando === idx ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Importando...</> : <><CheckCircle size={16} /> Confirmar e Importar</>}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* NOVOS — Precisam classificação */}
          {novos.filter(n => !n.isCodigoSistema).length > 0 && (
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#f59e0b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={20} /> Novos Pagadores — Precisam Classificação ({novos.filter(n => !n.isCodigoSistema && !importados.has(novos.indexOf(n))).length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {novos.map((p, idx) => {
                  if (p.isCodigoSistema) return null;
                  const isExpanded = expandedIdx === idx;
                  const isImportado = importados.has(idx);
                  const es = editState[idx] || {};

                  if (isImportado) {
                    return (
                      <div key={idx} style={{ backgroundColor: 'var(--surface)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', padding: '14px', opacity: 0.6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <CheckCircle size={18} style={{ color: '#10b981' }} />
                          <span style={{ fontWeight: 'bold', color: '#10b981' }}>Importado</span>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{p.pagadorOriginal}</span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={idx} style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                      <button onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', textAlign: 'left' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                          <FileText size={18} style={{ color: '#f59e0b', flexShrink: 0 }} />
                          <div>
                            <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{p.pagadorOriginal}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', gap: '12px', marginTop: '2px' }}>
                              <span>{p.totalParcelas} parcelas</span>
                              <span>{p.grupos.length} grupo(s)</span>
                              {p.eventoDetectado && <span style={{ color: 'var(--primary)' }}>Evento: {p.eventoDetectado}</span>}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {p.grupos.map((g, gi) => (
                            <span key={gi} style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {confiancaIcon(g.confianca)} {g.produtoSugerido} (R${g.totalValor.toFixed(0)})
                            </span>
                          ))}
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', padding: '16px 0' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Nome Responsável</label>
                              <input value={es.nomeResponsavel || ''} onChange={e => setEditState(prev => ({ ...prev, [idx]: { ...prev[idx], nomeResponsavel: e.target.value } }))} style={inputStyle} />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Nome Formando</label>
                              <input value={es.nomeFormando || ''} onChange={e => setEditState(prev => ({ ...prev, [idx]: { ...prev[idx], nomeFormando: e.target.value } }))} style={inputStyle} />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Evento</label>
                              <select value={es.evento || ''} onChange={e => setEditState(prev => ({ ...prev, [idx]: { ...prev[idx], evento: e.target.value } }))} style={inputStyle}>
                                <option value="">Selecione...</option>
                                {eventos.map(ev => <option key={ev.id} value={ev.nome}>{ev.nome}</option>)}
                              </select>
                            </div>
                          </div>

                          {p.grupos.map((g, gi) => (
                            <div key={gi} style={{ marginBottom: '16px', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: 'var(--background)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {confiancaIcon(g.confianca)}
                                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Grupo {gi + 1}: {g.numParcelas}x R${g.valorParcela.toFixed(2)} = R${g.totalValor.toFixed(2)}</span>
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>({g.pagos} pagos, {g.pendentes} pendentes, {g.vencidos} vencidos)</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Produto:</span>
                                  <select value={es.grupos?.[gi]?.produto || g.produtoSugerido}
                                    onChange={e => {
                                      const newGrupos = [...(es.grupos || [])];
                                      newGrupos[gi] = { ...newGrupos[gi], produto: e.target.value };
                                      setEditState(prev => ({ ...prev, [idx]: { ...prev[idx], grupos: newGrupos } }));
                                    }}
                                    style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: '#fff', fontSize: '0.8rem' }}>
                                    <option value="Pacote Formando">Pacote Formando</option>
                                    <option value="Indispensável Adulto">Indispensável Adulto</option>
                                    <option value="Indispensável Infantil">Indispensável Infantil</option>
                                    <option value="Múltiplos Produtos">Múltiplos Produtos</option>
                                    <option value="Ignorar">Ignorar</option>
                                  </select>
                                </div>
                              </div>
                              
                              {es.grupos?.[gi]?.produto === 'Múltiplos Produtos' && (
                                <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', backgroundColor: 'rgba(139,92,246,0.05)' }}>
                                  <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#8b5cf6', marginBottom: '12px' }}>Configuração de Boleto Misto</h4>
                                  
                                  {!es.evento ? (
                                     <div style={{ color: '#ef4444', fontSize: '0.8rem', padding: '8px', backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: '6px' }}>
                                       ⚠️ Selecione o Evento acima para carregar os preços e calcular.
                                     </div>
                                  ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                                         <div>
                                           <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Adulto (Qtd)</label>
                                           <input type="number" min="0" value={es.grupos[gi]?.qtdAdulto || 0} onChange={e => handleMultiploChange(idx, gi, 'qtdAdulto', parseInt(e.target.value) || 0)} style={inputStyle} />
                                         </div>
                                         <div>
                                           <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Infantil (Qtd)</label>
                                           <input type="number" min="0" value={es.grupos[gi]?.qtdInfantil || 0} onChange={e => handleMultiploChange(idx, gi, 'qtdInfantil', parseInt(e.target.value) || 0)} style={inputStyle} />
                                         </div>
                                         <div>
                                           <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Pacote (Qtd)</label>
                                           <input type="number" min="0" value={es.grupos[gi]?.qtdPacote || 0} onChange={e => handleMultiploChange(idx, gi, 'qtdPacote', parseInt(e.target.value) || 0)} style={inputStyle} />
                                         </div>
                                      </div>
                                      
                                      {(() => {
                                         const eventoObj = eventos.find(e => e.nome === es.evento);
                                         const pAdulto = eventoObj?.valorIndispAdultoParcelado || 0;
                                         const pInfantil = eventoObj?.valorIndispInfantilParcelado || 0;
                                         const pPacote = eventoObj?.valorPacoteParcelado || 0;
                                         const calc = (es.grupos[gi]?.qtdAdulto || 0) * pAdulto + (es.grupos[gi]?.qtdInfantil || 0) * pInfantil + (es.grupos[gi]?.qtdPacote || 0) * pPacote;
                                         const target = g.totalValor;
                                         const diff = Math.abs(calc - target);
                                         const isMatch = diff < 1; // tolerância de R$ 1,00
                              
                                         return (
                                           <div style={{ padding: '12px', borderRadius: '6px', border: isMatch ? '1px solid #10b981' : '1px solid #ef4444', backgroundColor: isMatch ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }}>
                                             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                               <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Calculado:</span>
                                               <strong style={{ color: isMatch ? '#10b981' : '#ef4444' }}>R$ {calc.toFixed(2)}</strong>
                                             </div>
                                             <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                               <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Valor Esperado (Boleto):</span>
                                               <strong style={{ color: 'var(--text-primary)' }}>R$ {target.toFixed(2)}</strong>
                                             </div>
                                             {!isMatch && (
                                               <div style={{ fontSize: '0.7rem', color: '#ef4444', marginTop: '6px' }}>⚠️ A soma difere do boleto em R$ {diff.toFixed(2)}</div>
                                             )}
                                           </div>
                                         );
                                      })()}
                                    </div>
                                  )}
                                </div>
                              )}
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                <thead>
                                  <tr style={{ color: 'var(--text-secondary)' }}>
                                    <th style={{ padding: '6px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Doc</th>
                                    <th style={{ padding: '6px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Vencimento</th>
                                    <th style={{ padding: '6px 12px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Valor</th>
                                    <th style={{ padding: '6px 12px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Liquidação</th>
                                    <th style={{ padding: '6px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {g.parcelas.map((par, pi) => (
                                    <tr key={pi} style={{ borderBottom: '1px solid var(--border)' }}>
                                      <td style={{ padding: '6px 12px' }}>{par.numDoc}</td>
                                      <td style={{ padding: '6px 12px', color: 'var(--text-secondary)' }}>{par.vencimento}</td>
                                      <td style={{ padding: '6px 12px', textAlign: 'right' }}>R$ {par.valor.toFixed(2)}</td>
                                      <td style={{ padding: '6px 12px', textAlign: 'right', color: par.liquidacao > 0 ? '#10b981' : 'var(--text-secondary)' }}>R$ {par.liquidacao.toFixed(2)}</td>
                                      <td style={{ padding: '6px 12px', textAlign: 'center' }}>{statusBadge(par.status)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ))}

                          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                            <button onClick={() => handleIgnorar(idx)} disabled={importando === idx || ignorandoIdx === idx}
                              style={{ flex: 1, padding: '12px', backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '8px', cursor: (importando === idx || ignorandoIdx === idx) ? 'wait' : 'pointer', fontWeight: 'bold', fontSize: '0.9rem', opacity: (importando === idx || ignorandoIdx === idx) ? 0.7 : 1 }}>
                              {ignorandoIdx === idx ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Ignorar Grupo'}
                            </button>
                            <button onClick={() => handleConfirmar(idx)} disabled={importando === idx || ignorandoIdx === idx}
                              style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', backgroundColor: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', cursor: (importando === idx || ignorandoIdx === idx) ? 'wait' : 'pointer', fontWeight: 'bold', fontSize: '0.9rem', opacity: (importando === idx || ignorandoIdx === idx) ? 0.7 : 1 }}>
                              {importando === idx ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Importando...</> : <><CheckCircle size={16} /> Confirmar e Importar</>}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* All done message */}
          {novos.length === 0 && alertas.length === 0 && atualizados.length > 0 && (
            <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'var(--surface)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '12px' }}>
              <CheckCircle size={48} style={{ color: '#10b981', margin: '0 auto 16px' }} />
              <h3 style={{ color: '#10b981', marginBottom: '8px' }}>Todos os boletos já estão cadastrados!</h3>
              <p style={{ color: 'var(--text-secondary)' }}>Os status de {atualizados.length} pagador(es) foram atualizados automaticamente.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
