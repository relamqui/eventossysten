'use client';

import { useState, useEffect } from 'react';
import { ClipboardList, CheckCircle, XCircle, Clock, FileSignature, Loader2, ExternalLink, FileText, Landmark, Copy, Check, Pencil } from 'lucide-react';

export default function ControleContratosPage() {
  const [solicitacoes, setSolicitacoes] = useState<any[]>([]);
  const [eventos, setEventos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [gerandoContrato, setGerandoContrato] = useState<number | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [finalizando, setFinalizando] = useState<number | null>(null);
  const [modalFinalizar, setModalFinalizar] = useState<any | null>(null);
  const [confirmInputs, setConfirmInputs] = useState({ pagador: '', valor: '', parcelas: '', quantidade: '', codigo: '' });
  const [confirmError, setConfirmError] = useState('');
  const [modalEditar, setModalEditar] = useState<any | null>(null);
  const [editInputs, setEditInputs] = useState<any>({});

  useEffect(() => {
    fetchSolicitacoes();
    fetchEventos();
  }, []);

  const fetchSolicitacoes = async () => {
    try {
      const res = await fetch('/api/solicitacoes');
      if (res.ok) {
        const data = await res.json();
        setSolicitacoes(data);
      }
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  const fetchEventos = async () => {
    try {
      const res = await fetch('/api/eventos');
      if (res.ok) {
        const data = await res.json();
        setEventos(data);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const formatarData = (dataIso: string) => {
    const data = new Date(dataIso);
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(data);
  };

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Gera o código do boleto
  const gerarCodigo = (sol: any) => {
    let prodNum = '1';
    if (sol.produto === 'Indispensável Adulto') prodNum = '2';
    if (sol.produto === 'Indispensável Infantil') prodNum = '3';
    const qtd = sol.quantidade || 1;
    const parc = sol.parcelas || 1;
    const evento = eventos.find(e => e.nome === sol.evento);
    let temp = '00';
    if (evento && evento.temporada) {
      temp = evento.temporada.toString().slice(-2);
    }
    return `${prodNum}0${qtd}0${parc}0${temp}`;
  };

  // Calcula valor total
  const calcularValor = (sol: any) => {
    const evento = eventos.find(e => e.nome === sol.evento);
    if (!evento) return 'N/A';
    let valor = 0;
    const isParcelado = sol.formaPagamento === 'Parcelado';
    if (sol.produto === 'Pacote Formando') {
      valor = isParcelado ? (evento.valorPacoteParcelado || 0) : (evento.valorPacoteAVista || 0);
    } else if (sol.produto === 'Indispensável Adulto') {
      valor = isParcelado ? (evento.valorIndispAdultoParcelado || 0) : (evento.valorIndispAdultoAVista || 0);
      valor *= (sol.quantidade || 1);
    } else if (sol.produto === 'Indispensável Infantil') {
      valor = isParcelado ? (evento.valorIndispInfantilParcelado || 0) : (evento.valorIndispInfantilAVista || 0);
      valor *= (sol.quantidade || 1);
    }
    return `R$ ${valor.toFixed(2).replace('.', ',')}`;
  };

  const handleGerarContrato = async (sol: any) => {
    const evento = eventos.find(e => e.nome === sol.evento);
    if (!evento) { alert(`Evento "${sol.evento || 'N/A'}" não encontrado.`); return; }
    if (!evento.zapsignTemplateId) { alert(`O evento "${evento.nome}" não possui template de contrato.`); return; }
    setGerandoContrato(sol.id);
    try {
      const res = await fetch('/api/zapsign/criar-contrato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: evento.zapsignTemplateId, solicitacaoId: sol.id,
          nome_formando: sol.nomeFormando || '', cpf_formando: sol.cpfFormando || '',
          curso_formando: evento.curso || '', turma_formando: evento.tipo || '',
          nome_responsavel: sol.nomeResponsavel || '', cpf_responsavel: sol.cpfResponsavel || '',
          email_responsavel: '', telefone_responsavel: sol.telefoneResponsavel || '',
          nome_evento: evento.nome, data_evento: evento.dataEvento || '',
          valor_contrato: calcularValor(sol), data_contrato: new Date().toLocaleDateString('pt-BR')
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSolicitacoes(prev => prev.map(s => s.id === sol.id ? { ...s, zapsignDocStatus: 'pending', zapsignSignUrl: data.signUrl, zapsignDocToken: data.docToken } : s));
      } else {
        const err = await res.json();
        alert(`Erro ao gerar contrato: ${err.error}`);
      }
    } catch (error) { alert('Falha na conexão com a API'); }
    setGerandoContrato(null);
  };

  const handleRecusar = async (sol: any) => {
    if (!confirm(`Tem certeza que deseja recusar a solicitação de ${sol.nomeFormando || sol.cpfFormando}?`)) return;
    try {
      const res = await fetch(`/api/solicitacoes/${sol.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'REJEITADO' }) });
      if (res.ok) { setSolicitacoes(prev => prev.filter(s => s.id !== sol.id)); }
    } catch (error) { alert('Falha na conexão'); }
  };

  const abrirModalEditar = (sol: any) => {
    setModalEditar(sol);
    setEditInputs({
      nomeFormando: sol.nomeFormando || '',
      cpfFormando: sol.cpfFormando || '',
      telefoneFormando: sol.telefoneFormando || '',
      nomeResponsavel: sol.nomeResponsavel || '',
      cpfResponsavel: sol.cpfResponsavel || '',
      telefoneResponsavel: sol.telefoneResponsavel || '',
      evento: sol.evento || '',
      produto: sol.produto || 'Pacote Formando',
      quantidade: sol.quantidade || 1,
      parcelas: sol.parcelas || 1,
      formaPagamento: sol.formaPagamento || 'À Vista',
    });
  };

  const handleSalvarEdicao = async () => {
    if (!modalEditar) return;
    try {
      const res = await fetch(`/api/solicitacoes/${modalEditar.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editInputs)
      });
      if (res.ok) {
        const updated = await res.json();
        setSolicitacoes(prev => prev.map(s => s.id === modalEditar.id ? updated : s));
        setModalEditar(null);
      } else {
        const err = await res.json();
        alert(`Erro: ${err.error}`);
      }
    } catch (e) { alert('Falha na conexão'); }
  };

  const abrirModalFinalizar = (sol: any) => {
    setModalFinalizar(sol);
    setConfirmInputs({ pagador: '', valor: '', parcelas: '', quantidade: '', codigo: '' });
    setConfirmError('');
  };

  const executarFinalizar = async () => {
    const sol = modalFinalizar;
    if (!sol) return;

    const codigoCorreto = gerarCodigo(sol);
    const valorCorreto = calcularValor(sol);
    const pagadorCorreto = `${sol.nomeResponsavel || 'N/A'} - ${sol.nomeFormando || 'N/A'} - ${sol.evento || 'N/A'}`;
    const parcCorreto = `${sol.parcelas || 1}`;
    const qtdCorreto = `${sol.quantidade || 1}`;

    if (confirmInputs.pagador.trim() !== pagadorCorreto) { setConfirmError('PAGADOR não confere.'); return; }
    if (confirmInputs.valor.trim() !== valorCorreto) { setConfirmError('VALOR não confere.'); return; }
    if (confirmInputs.parcelas.trim() !== parcCorreto) { setConfirmError('PARCELAS não confere.'); return; }
    if (confirmInputs.quantidade.trim() !== qtdCorreto) { setConfirmError('QUANTIDADE não confere.'); return; }
    if (confirmInputs.codigo.trim() !== codigoCorreto) { setConfirmError('CÓDIGO não confere.'); return; }

    setFinalizando(sol.id);
    setConfirmError('');
    try {
      const res = await fetch(`/api/solicitacoes/${sol.id}/finalizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pagador: pagadorCorreto, valor: valorCorreto, parcelas: parcCorreto, quantidade: qtdCorreto, codigo: codigoCorreto,
          confirmPagador: confirmInputs.pagador.trim(), confirmValor: confirmInputs.valor.trim(),
          confirmParcelas: confirmInputs.parcelas.trim(), confirmQuantidade: confirmInputs.quantidade.trim(),
          confirmCodigo: confirmInputs.codigo.trim()
        })
      });
      if (res.ok) {
        alert('✅ Boleto criado com sucesso no Controle de Boletos!');
        setSolicitacoes(prev => prev.map(s => s.id === sol.id ? { ...s, status: 'FINALIZADO' } : s));
        setModalFinalizar(null);
      } else {
        const err = await res.json();
        setConfirmError(err.error);
      }
    } catch (e) { setConfirmError('Falha na conexão'); }
    setFinalizando(null);
  };

  // Filtros
  const pendentes = solicitacoes.filter(s => s.status === 'PENDENTE' && !s.zapsignDocStatus);
  const pacotesPendentes = pendentes.filter(s => s.produto === 'Pacote Formando');
  const indispensaveisPendentes = pendentes.filter(s => s.produto !== 'Pacote Formando');
  const emContrato = solicitacoes.filter(s => s.zapsignDocStatus === 'pending');
  const assinados = solicitacoes.filter(s => (s.zapsignDocStatus === 'signed' || (s.status === 'APROVADO' && s.zapsignDocToken)) && s.status !== 'FINALIZADO');

  // Componente de campo copiável
  const CopyField = ({ label, value, id }: { label: string; value: string; id: string }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <div>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 'bold' }}>{value}</div>
      </div>
      <button onClick={() => copyToClipboard(value, id)}
        style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', color: copiedField === id ? '#10b981' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', transition: 'all 0.2s' }}>
        {copiedField === id ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
      </button>
    </div>
  );

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '8px' }}>Fila de Solicitações</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Gerencie as intenções de compras feitas pelos clientes no portal.</p>
      </div>

      {/* LINHA 1: Solicitações Pendentes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        
        {/* Pacotes Pendentes */}
        <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px', backgroundColor: 'var(--surface-hover)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--primary)' }}>Solicitações de Pacote Formando</h2>
            <span style={{ backgroundColor: 'rgba(139, 92, 246, 0.2)', color: 'var(--primary)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' }}>{pacotesPendentes.length}</span>
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Carregando...</div>
          ) : pacotesPendentes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
              <ClipboardList size={32} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
              <p>Nenhum pacote pendente.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--background)', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Clientes</th>
                    <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Evento</th>
                    <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Pgto</th>
                    <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pacotesPendentes.map(sol => (
                    <tr key={sol.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '0.9rem' }}>F: {sol.nomeFormando || 'N/A'}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>CPF: {sol.cpfFormando}</div>
                        <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '0.9rem', marginTop: '4px' }}>R: {sol.nomeResponsavel || 'N/A'}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>CPF: {sol.cpfResponsavel}</div>
                      </td>
                      <td style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{sol.evento || 'N/A'}</td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{sol.formaPagamento || 'N/A'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{sol.parcelas || 1}x</div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button onClick={() => abrirModalEditar(sol)}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', backgroundColor: 'var(--surface-hover)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>
                            <Pencil size={14} /> Editar
                          </button>
                          <button onClick={() => handleGerarContrato(sol)} disabled={gerandoContrato === sol.id}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', backgroundColor: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', cursor: gerandoContrato === sol.id ? 'wait' : 'pointer', fontSize: '0.8rem', fontWeight: 'bold', opacity: gerandoContrato === sol.id ? 0.7 : 1 }}>
                            {gerandoContrato === sol.id ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <FileSignature size={14} />}
                            {gerandoContrato === sol.id ? 'Gerando...' : 'Gerar Contrato'}
                          </button>
                          <button onClick={() => handleRecusar(sol)}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', backgroundColor: 'transparent', color: 'var(--status-overdue)', border: '1px solid var(--status-overdue)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>
                            <XCircle size={14} /> Recusar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Indispensáveis Pendentes */}
        <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px', backgroundColor: 'var(--surface-hover)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#10b981' }}>Solicitações de Indispensáveis</h2>
            <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' }}>{indispensaveisPendentes.length}</span>
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Carregando...</div>
          ) : indispensaveisPendentes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
              <ClipboardList size={32} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
              <p>Nenhum item indispensável pendente.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--background)', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Pedido</th>
                    <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>CPFs</th>
                    <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Pgto</th>
                    <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {indispensaveisPendentes.map(sol => (
                    <tr key={sol.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '0.9rem' }}>{sol.produto}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Qtd: {sol.quantidade} | {sol.evento || 'N/A'}</div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>F: {sol.cpfFormando}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>R: {sol.cpfResponsavel}</div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{sol.formaPagamento || 'N/A'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{sol.parcelas || 1}x</div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button onClick={() => abrirModalEditar(sol)}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', backgroundColor: 'var(--surface-hover)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>
                            <Pencil size={14} /> Editar
                          </button>
                          <button onClick={() => handleGerarContrato(sol)} disabled={gerandoContrato === sol.id}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', backgroundColor: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', cursor: gerandoContrato === sol.id ? 'wait' : 'pointer', fontSize: '0.8rem', fontWeight: 'bold', opacity: gerandoContrato === sol.id ? 0.7 : 1 }}>
                            {gerandoContrato === sol.id ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <FileSignature size={14} />}
                            {gerandoContrato === sol.id ? 'Gerando...' : 'Gerar Contrato'}
                          </button>
                          <button onClick={() => handleRecusar(sol)}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', backgroundColor: 'transparent', color: 'var(--status-overdue)', border: '1px solid var(--status-overdue)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>
                            <XCircle size={14} /> Recusar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* LINHA 2: Contratos e Banco */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        
        {/* Contratos - Aguardando Assinatura */}
        <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px', backgroundColor: 'var(--surface-hover)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={20} style={{ color: '#f59e0b' }} />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#f59e0b' }}>Contratos</h2>
            </div>
            <span style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' }}>{emContrato.length}</span>
          </div>
          {emContrato.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
              <FileText size={32} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
              <p>Nenhum contrato aguardando assinatura.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--background)', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Cliente</th>
                    <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Produto</th>
                    <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Link do Contrato</th>
                  </tr>
                </thead>
                <tbody>
                  {emContrato.map(sol => (
                    <tr key={sol.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '0.9rem' }}>{sol.nomeFormando || sol.cpfFormando}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Resp: {sol.nomeResponsavel || sol.cpfResponsavel}</div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{sol.produto}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{sol.evento || 'N/A'} | {sol.parcelas || 1}x</div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        {sol.zapsignSignUrl ? (
                          <a href={sol.zapsignSignUrl} target="_blank" rel="noopener noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold', textDecoration: 'none', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                            <ExternalLink size={14} /> Abrir Contrato
                          </a>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Link indisponível</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Banco - Contratos Assinados */}
        <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px', backgroundColor: 'var(--surface-hover)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Landmark size={20} style={{ color: '#10b981' }} />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#10b981' }}>Banco</h2>
            </div>
            <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' }}>{assinados.length}</span>
          </div>
          {assinados.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
              <Landmark size={32} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
              <p>Nenhum contrato assinado ainda.</p>
            </div>
          ) : (
            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {assinados.map(sol => {
                const codigo = gerarCodigo(sol);
                const valor = calcularValor(sol);
                const pagador = `${sol.nomeResponsavel || 'N/A'} - ${sol.nomeFormando || 'N/A'} - ${sol.evento || 'N/A'}`;
                const uniquePrefix = `banco-${sol.id}`;

                return (
                  <div key={sol.id} style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                      <CheckCircle size={16} style={{ color: '#10b981' }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#10b981' }}>Assinado</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>{sol.produto}</span>
                    </div>
                    <CopyField label="PAGADOR" value={pagador} id={`${uniquePrefix}-pagador`} />
                    <CopyField label="VALOR" value={valor} id={`${uniquePrefix}-valor`} />
                    <CopyField label="PARCELAS" value={`${sol.parcelas || 1}`} id={`${uniquePrefix}-parcelas`} />
                    <CopyField label="QUANTIDADE" value={`${sol.quantidade || 1}`} id={`${uniquePrefix}-qtd`} />
                    <CopyField label="CÓDIGO" value={codigo} id={`${uniquePrefix}-codigo`} />
                    <button onClick={() => abrirModalFinalizar(sol)}
                      style={{ marginTop: '12px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>
                      <CheckCircle size={14} /> Finalizar Solicitação
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE CONFIRMAÇÃO */}
      {modalFinalizar && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', maxWidth: '500px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '4px', color: '#f59e0b' }}>⚠️ Confirmação de Segurança</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Digite manualmente cada campo para confirmar que os dados estão corretos antes de gerar o boleto.
            </p>

            {[
              { key: 'pagador', label: 'PAGADOR' },
              { key: 'valor', label: 'VALOR' },
              { key: 'parcelas', label: 'PARCELAS' },
              { key: 'quantidade', label: 'QUANTIDADE' },
              { key: 'codigo', label: 'CÓDIGO' },
            ].map(field => (
              <div key={field.key} style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px' }}>{field.label}</label>
                <input
                  type="text"
                  value={(confirmInputs as any)[field.key]}
                  onChange={e => setConfirmInputs(prev => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={`Digite o ${field.label.toLowerCase()} exatamente como aparece`}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: '#fff', fontSize: '0.9rem' }}
                />
              </div>
            ))}

            {confirmError && (
              <div style={{ padding: '10px', backgroundColor: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#ef4444', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '12px' }}>
                ❌ {confirmError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button onClick={() => setModalFinalizar(null)}
                style={{ flex: 1, padding: '10px', backgroundColor: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>
                Cancelar
              </button>
              <button onClick={executarFinalizar} disabled={finalizando !== null}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: finalizando ? 'wait' : 'pointer', fontSize: '0.85rem', fontWeight: 'bold', opacity: finalizando ? 0.7 : 1 }}>
                {finalizando ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Finalizando...</> : <><CheckCircle size={14} /> Confirmar e Gerar Boleto</>}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL DE EDIÇÃO */}
      {modalEditar && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', maxWidth: '550px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '16px' }}>✏️ Editar Solicitação #{modalEditar.id}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[
                { key: 'nomeFormando', label: 'Nome Formando', full: true },
                { key: 'cpfFormando', label: 'CPF Formando' },
                { key: 'telefoneFormando', label: 'Tel. Formando' },
                { key: 'nomeResponsavel', label: 'Nome Responsável', full: true },
                { key: 'cpfResponsavel', label: 'CPF Responsável' },
                { key: 'telefoneResponsavel', label: 'Tel. Responsável' },
                { key: 'evento', label: 'Evento', full: true },
                { key: 'formaPagamento', label: 'Forma Pgto' },
                { key: 'parcelas', label: 'Parcelas' },
                { key: 'quantidade', label: 'Quantidade' },
              ].map(f => (
                <div key={f.key} style={{ gridColumn: (f as any).full ? '1 / -1' : undefined }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>{f.label}</label>
                  {f.key === 'formaPagamento' ? (
                    <select value={editInputs[f.key]} onChange={e => setEditInputs((p: any) => ({ ...p, [f.key]: e.target.value }))}
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: '#fff' }}>
                      <option value="À Vista">À Vista</option>
                      <option value="Parcelado">Parcelado</option>
                    </select>
                  ) : f.key === 'evento' ? (
                    <select value={editInputs[f.key]} onChange={e => setEditInputs((p: any) => ({ ...p, [f.key]: e.target.value }))}
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: '#fff' }}>
                      <option value="">Selecione...</option>
                      {eventos.map(ev => <option key={ev.id} value={ev.nome}>{ev.nome}</option>)}
                    </select>
                  ) : (
                    <input type={f.key === 'parcelas' || f.key === 'quantidade' ? 'number' : 'text'}
                      value={editInputs[f.key]} onChange={e => setEditInputs((p: any) => ({ ...p, [f.key]: f.key === 'parcelas' || f.key === 'quantidade' ? Number(e.target.value) : e.target.value }))}
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: '#fff' }} />
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button onClick={() => setModalEditar(null)}
                style={{ flex: 1, padding: '10px', backgroundColor: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                Cancelar
              </button>
              <button onClick={handleSalvarEdicao}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', backgroundColor: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                <CheckCircle size={14} /> Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

