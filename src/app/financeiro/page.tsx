'use client';

import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, ArrowRightLeft, Users, Briefcase, Calendar as CalendarIcon,
  TrendingUp, TrendingDown, DollarSign, Plus, X, Loader2, ChevronLeft, ChevronRight, CheckCircle, Clock, ChevronDown, ChevronUp, Edit2, Check, Trash2
} from 'lucide-react';

export default function FinanceiroPage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'lancamentos' | 'calendario' | 'pessoas' | 'areas'>('dashboard');

  const [contas, setContas] = useState<any[]>([]);
  const [parcelas, setParcelas] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [pessoas, setPessoas] = useState<any[]>([]);
  const [eventos, setEventos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isModalContaOpen, setIsModalContaOpen] = useState(false);
  const [isModalPessoaOpen, setIsModalPessoaOpen] = useState(false);
  const [isModalAreaOpen, setIsModalAreaOpen] = useState(false);
  const [isModalDiaOpen, setIsModalDiaOpen] = useState(false);
  
  const [salvando, setSalvando] = useState(false);

  // Exclusao State
  const [contaParaExcluir, setContaParaExcluir] = useState<any>(null);
  const [valorConfirmacaoExclusao, setValorConfirmacaoExclusao] = useState('');

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [diaSelecionado, setDiaSelecionado] = useState('');
  const [parcelasDoDia, setParcelasDoDia] = useState<any[]>([]);

  // Lançamentos Accordion State
  const [expandedContaId, setExpandedContaId] = useState<number | null>(null);

  // Inline Edit State
  const [editingParcelaId, setEditingParcelaId] = useState<number | null>(null);
  const [editParcelaForm, setEditParcelaForm] = useState({ dataVencimento: '', valorEsperado: '' });

  // Forms
  const [formConta, setFormConta] = useState({
    tipo: 'PAGAR', descricao: '', valorTotal: '', eventoId: '', 
    areaEventoId: '', pessoaId: '', numParcelas: '1', primeiroVencimento: ''
  });
  const [formPessoa, setFormPessoa] = useState({ tipo: 'FORNECEDOR', nomeRazao: '', documento: '', contatoPrincipal: '' });
  const [formArea, setFormArea] = useState({ nome: '', descricao: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resContas, resParcelas, resAreas, resPessoas, resEventos] = await Promise.all([
        fetch('/api/financeiro/contas'),
        fetch('/api/financeiro/parcelas'),
        fetch('/api/financeiro/areas'),
        fetch('/api/financeiro/pessoas'),
        fetch('/api/eventos')
      ]);
      if(resContas.ok) setContas(await resContas.json());
      if(resParcelas.ok) setParcelas(await resParcelas.json());
      if(resAreas.ok) setAreas(await resAreas.json());
      if(resPessoas.ok) setPessoas(await resPessoas.json());
      if(resEventos.ok) setEventos(await resEventos.json());
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
    setLoading(false);
  };

  const handleSalvarConta = async (e: any) => {
    e.preventDefault();
    setSalvando(true);

    const valor = parseFloat(formConta.valorTotal.replace(',', '.'));
    const numParc = parseInt(formConta.numParcelas);
    const dataInicial = new Date(formConta.primeiroVencimento + 'T12:00:00Z');
    
    const parcelasGeradas = [];
    const valorParcela = (valor / numParc).toFixed(2);
    let soma = 0;

    for (let i = 0; i < numParc; i++) {
      const v = i === numParc - 1 ? (valor - soma).toFixed(2) : valorParcela;
      soma += parseFloat(v);
      
      const vencimento = new Date(dataInicial);
      vencimento.setMonth(vencimento.getMonth() + i);

      parcelasGeradas.push({
        valorEsperado: v,
        dataVencimento: vencimento.toISOString().split('T')[0]
      });
    }

    try {
      const res = await fetch('/api/financeiro/contas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formConta,
          valorTotal: valor,
          parcelas: parcelasGeradas
        })
      });

      if (res.ok) {
        setIsModalContaOpen(false);
        fetchData();
        setFormConta({
          tipo: 'PAGAR', descricao: '', valorTotal: '', eventoId: '', 
          areaEventoId: '', pessoaId: '', numParcelas: '1', primeiroVencimento: ''
        });
      } else {
        const err = await res.json();
        alert(err.error);
      }
    } catch (error) {
      alert('Erro na conexão');
    }
    setSalvando(false);
  };

  const handleSalvarPessoa = async (e: any) => {
    e.preventDefault();
    setSalvando(true);
    try {
      const res = await fetch('/api/financeiro/pessoas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formPessoa)
      });
      if (res.ok) { setIsModalPessoaOpen(false); fetchData(); setFormPessoa({ tipo: 'FORNECEDOR', nomeRazao: '', documento: '', contatoPrincipal: '' }); }
      else { alert((await res.json()).error); }
    } catch (error) { alert('Erro na conexão'); }
    setSalvando(false);
  };

  const handleSalvarArea = async (e: any) => {
    e.preventDefault();
    setSalvando(true);
    try {
      const res = await fetch('/api/financeiro/areas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formArea)
      });
      if (res.ok) { setIsModalAreaOpen(false); fetchData(); setFormArea({ nome: '', descricao: '' }); }
      else { alert((await res.json()).error); }
    } catch (error) { alert('Erro na conexão'); }
    setSalvando(false);
  };

  const handleDarBaixa = async (parcela: any) => {
    const isPaying = parcela.status === 'PENDENTE';
    const novoStatus = isPaying ? 'PAGO' : 'PENDENTE';
    const dataPgto = isPaying ? new Date().toISOString().split('T')[0] : null;
    const valor = isPaying ? parcela.valorEsperado : 0;
  
    try {
      const res = await fetch('/api/financeiro/parcelas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: parcela.id, status: novoStatus, dataPagamento: dataPgto, valorPago: valor })
      });
      if(res.ok) {
         fetchData(); 
         setParcelasDoDia(prev => prev.map(p => p.id === parcela.id ? {...p, status: novoStatus, dataPagamento: dataPgto, valorPago: valor} : p));
      } else {
         const err = await res.json();
         alert('Erro no servidor ao dar baixa: ' + (err.error || 'Desconhecido'));
      }
    } catch(e: any) { alert('Erro na conexão ao tentar dar baixa: ' + e.message); }
  };

  const startEditParcela = (p: any) => {
    setEditingParcelaId(p.id);
    setEditParcelaForm({ dataVencimento: p.dataVencimento, valorEsperado: p.valorEsperado });
  };

  const saveEditParcela = async () => {
    if(!editingParcelaId) return;
    try {
      const res = await fetch('/api/financeiro/parcelas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: editingParcelaId, 
          dataVencimento: editParcelaForm.dataVencimento, 
          valorEsperado: editParcelaForm.valorEsperado 
        })
      });
      if(res.ok) {
        setEditingParcelaId(null);
        fetchData();
        setParcelasDoDia(prev => prev.map(p => p.id === editingParcelaId ? {...p, dataVencimento: editParcelaForm.dataVencimento, valorEsperado: editParcelaForm.valorEsperado} : p));
      } else {
        const err = await res.json();
        alert('Erro no servidor ao editar: ' + (err.error || 'Desconhecido'));
      }
    } catch(e: any) { alert('Erro na conexão ao editar: ' + e.message); }
  };

  const confirmExclusao = async (e: any) => {
    e.preventDefault();
    if (!contaParaExcluir) return;

    const valorDigitado = parseFloat(valorConfirmacaoExclusao.replace(',', '.'));
    const valorCorreto = parseFloat(contaParaExcluir.valorTotal);

    if (valorDigitado !== valorCorreto) {
      alert('Valor incorreto. Exclusão abortada por segurança.');
      return;
    }

    try {
      setSalvando(true);
      const res = await fetch(`/api/financeiro/contas?id=${contaParaExcluir.id}`, { method: 'DELETE' });
      if(res.ok) {
         setExpandedContaId(null);
         setContaParaExcluir(null);
         setValorConfirmacaoExclusao('');
         fetchData();
      } else {
         const err = await res.json();
         alert('Erro no servidor ao cancelar: ' + (err.error || 'Desconhecido'));
      }
    } catch(e: any) { alert('Erro na conexão ao tentar cancelar: ' + e.message); }
    setSalvando(false);
  };

  // Dashboard Helpers
  const getDashboardData = () => {
    let aReceberMes = 0;
    let aPagarMes = 0;
    let saldoProjetado = 0; 
    
    const hoje = new Date();
    const curMonth = hoje.getMonth();
    const curYear = hoje.getFullYear();

    parcelas.forEach(p => {
      if (p.status === 'PENDENTE') {
        const [py, pm] = p.dataVencimento.split('-');
        const isThisMonth = parseInt(py) === curYear && parseInt(pm) - 1 === curMonth;
        
        if (p.conta?.tipo === 'RECEBER') {
          saldoProjetado += Number(p.valorEsperado);
          if (isThisMonth) aReceberMes += Number(p.valorEsperado);
        } else {
          saldoProjetado -= Number(p.valorEsperado);
          if (isThisMonth) aPagarMes += Number(p.valorEsperado);
        }
      }
    });

    const relatorioEventos: Record<number, { nome: string; recebido: number; pago: number; lucro: number }> = {};
    eventos.forEach(e => { relatorioEventos[e.id] = { nome: e.nome, recebido: 0, pago: 0, lucro: 0 }; });

    parcelas.forEach(p => {
      if (p.status === 'PAGO' && p.conta?.eventoId && relatorioEventos[p.conta.eventoId]) {
        const valorReal = Number(p.valorPago || p.valorEsperado);
        if (p.conta.tipo === 'RECEBER') {
          relatorioEventos[p.conta.eventoId].recebido += valorReal;
        } else {
          relatorioEventos[p.conta.eventoId].pago += valorReal;
        }
      }
    });

    const eventosArray = Object.values(relatorioEventos)
       .map(ev => ({ ...ev, lucro: ev.recebido - ev.pago }))
       .filter(ev => ev.recebido > 0 || ev.pago > 0)
       .sort((a, b) => b.lucro - a.lucro);

    return { aReceberMes, aPagarMes, saldoProjetado, eventosArray };
  };

  const { aReceberMes, aPagarMes, saldoProjetado, eventosArray } = getDashboardData();

  // Calendar Helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay }, (_, i) => i);
  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  const getParcelasDoDia = (day: number) => {
    const d = String(day).padStart(2, '0');
    const m = String(month + 1).padStart(2, '0');
    const dateStr = `${year}-${m}-${d}`;
    return parcelas.filter(p => p.dataVencimento === dateStr);
  };

  const handleDiaClick = (day: number) => {
    const ps = getParcelasDoDia(day);
    if(ps.length > 0) {
      const d = String(day).padStart(2, '0');
      const m = String(month + 1).padStart(2, '0');
      setDiaSelecionado(`${d}/${m}/${year}`);
      setParcelasDoDia(ps);
      setIsModalDiaOpen(true);
    }
  };

  const tabStyle = (isActive: boolean) => ({
    padding: '12px 24px', cursor: 'pointer', borderBottom: isActive ? '3px solid #10b981' : '3px solid transparent',
    color: isActive ? '#10b981' : 'var(--text-secondary)', fontWeight: isActive ? 'bold' : 'normal',
    display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s ease', whiteSpace: 'nowrap' as any
  });

  const inputStyle = {
    width: '100%', padding: '10px', backgroundColor: 'var(--background)', color: '#fff',
    border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.9rem'
  };

  const renderContaItem = (conta: any) => {
    const isExpanded = expandedContaId === conta.id;
    return (
      <div key={conta.id} style={{ backgroundColor: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: '12px' }}>
        {/* Header do Accordion */}
        <div onClick={() => setExpandedContaId(isExpanded ? null : conta.id)} style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', backgroundColor: isExpanded ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ backgroundColor: conta.tipo === 'PAGAR' ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)', color: conta.tipo === 'PAGAR' ? '#ef4444' : '#3b82f6', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                {conta.tipo === 'PAGAR' ? 'A PAGAR' : 'A RECEBER'}
              </span>
              <strong style={{ fontSize: '1.1rem' }}>{conta.descricao}</strong>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', gap: '12px' }}>
              <span><strong>Pessoa:</strong> {conta.pessoa?.nomeRazao}</span>
              <span><strong>Evento:</strong> {conta.evento?.nome}</span>
            </div>
            <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {conta.parcelas?.length} parcela(s) vinculadas.
            </div>
          </div>
          <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: conta.tipo === 'PAGAR' ? '#ef4444' : '#3b82f6' }}>
                R$ {conta.valorTotal.toFixed(2)}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{conta.statusGeral}</div>
            </div>
            
            <button onClick={(e) => { e.stopPropagation(); setContaParaExcluir(conta); setValorConfirmacaoExclusao(''); }} title="Cancelar Lançamento" style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}>
              <Trash2 size={18} />
            </button>

            {isExpanded ? <ChevronUp color="var(--text-secondary)"/> : <ChevronDown color="var(--text-secondary)"/>}
          </div>
        </div>

        {/* Corpo do Accordion (Parcelas) */}
        {isExpanded && (
          <div style={{ padding: '16px', borderTop: '1px solid var(--border)', backgroundColor: 'var(--background)' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-secondary)' }}>Detalhamento das Parcelas</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {conta.parcelas.map((p: any) => {
                const isEditing = editingParcelaId === p.id;
                return (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid var(--border)', borderRadius: '6px', backgroundColor: 'var(--surface)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 'bold', width: '80px', color: p.status === 'PAGO' ? '#10b981' : (conta.tipo === 'PAGAR' ? '#ef4444' : '#3b82f6') }}>Parc. {p.numeroParcela}</span>
                      
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input type="date" value={editParcelaForm.dataVencimento} onChange={e => setEditParcelaForm({...editParcelaForm, dataVencimento: e.target.value})} style={{...inputStyle, padding: '4px 8px'}} />
                          <input type="number" value={editParcelaForm.valorEsperado} onChange={e => setEditParcelaForm({...editParcelaForm, valorEsperado: e.target.value})} style={{...inputStyle, padding: '4px 8px', width: '100px'}} />
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '16px', fontSize: '0.9rem' }}>
                          <span>Vencimento: <strong>{p.dataVencimento.split('-').reverse().join('/')}</strong></span>
                          <span>Valor: <strong>R$ {Number(p.valorEsperado).toFixed(2)}</strong></span>
                        </div>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {p.status === 'PAGO' ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', fontSize: '0.8rem', fontWeight: 'bold' }}><CheckCircle size={14} /> CONCLUÍDO</span>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: conta.tipo === 'PAGAR' ? '#ef4444' : '#3b82f6', fontSize: '0.8rem', fontWeight: 'bold' }}><Clock size={14} /> PENDENTE</span>
                      )}

                      {isEditing ? (
                        <button onClick={saveEditParcela} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Check size={14}/></button>
                      ) : (
                        <button onClick={() => startEditParcela(p)} style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', padding: '6px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Edit2 size={14}/></button>
                      )}
                      <button onClick={() => handleDarBaixa(p)} style={{ background: p.status === 'PAGO' ? 'transparent' : '#10b981', color: p.status === 'PAGO' ? 'var(--text-secondary)' : '#fff', border: p.status === 'PAGO' ? '1px solid var(--border)' : 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>
                        {p.status === 'PAGO' ? 'Desfazer Baixa' : 'Dar Baixa'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const contasPagar = contas.filter(c => c.tipo === 'PAGAR');
  const contasReceber = contas.filter(c => c.tipo === 'RECEBER');

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>Gestão Financeira</h1>
        <button onClick={() => setIsModalContaOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
          <Plus size={18} /> Novo Lançamento
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', marginBottom: '24px', overflowX: 'auto' }}>
        <div style={tabStyle(activeTab === 'dashboard')} onClick={() => setActiveTab('dashboard')}><LayoutDashboard size={20} /> Dashboard</div>
        <div style={tabStyle(activeTab === 'calendario')} onClick={() => setActiveTab('calendario')}><CalendarIcon size={20} /> Calendário</div>
        <div style={tabStyle(activeTab === 'lancamentos')} onClick={() => setActiveTab('lancamentos')}><ArrowRightLeft size={20} /> Lançamentos</div>
        <div style={tabStyle(activeTab === 'pessoas')} onClick={() => setActiveTab('pessoas')}><Users size={20} /> Entidades</div>
        <div style={tabStyle(activeTab === 'areas')} onClick={() => setActiveTab('areas')}><Briefcase size={20} /> Áreas de Custo</div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}><Loader2 size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} /></div>
      ) : (
        <>
          {/* DASHBOARD */}
          {activeTab === 'dashboard' && (
             <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                 <div style={{ backgroundColor: 'var(--surface)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                   <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                     <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>A Receber (Neste Mês)</span>
                     <TrendingUp color="#3b82f6" size={24} />
                   </div>
                   <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3b82f6' }}>R$ {aReceberMes.toFixed(2)}</div>
                 </div>
                 
                 <div style={{ backgroundColor: 'var(--surface)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                   <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                     <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>A Pagar (Neste Mês)</span>
                     <TrendingDown color="#ef4444" size={24} />
                   </div>
                   <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ef4444' }}>R$ {aPagarMes.toFixed(2)}</div>
                 </div>

                 <div style={{ backgroundColor: 'var(--surface)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                   <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                     <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Saldo Pendente Projetado</span>
                     <DollarSign color="#10b981" size={24} />
                   </div>
                   <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>R$ {saldoProjetado.toFixed(2)}</div>
                 </div>
               </div>

               {/* TABELA DE EVENTOS */}
               <div style={{ backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                  <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Relatório por Evento (Realizado)</h2>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Calculado com base nas parcelas já confirmadas como "CONCLUÍDO".</p>
                  </div>
                  {eventosArray.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhum fluxo de caixa realizado ainda.</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
                          <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 'normal' }}>Evento</th>
                          <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 'normal' }}>Total Recebido</th>
                          <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 'normal' }}>Total Pago</th>
                          <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 'normal', textAlign: 'right' }}>Lucro Atual</th>
                        </tr>
                      </thead>
                      <tbody>
                        {eventosArray.map(ev => (
                          <tr key={ev.nome} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '16px 20px', fontWeight: 'bold' }}>{ev.nome}</td>
                            <td style={{ padding: '16px 20px', color: '#3b82f6' }}>R$ {ev.recebido.toFixed(2)}</td>
                            <td style={{ padding: '16px 20px', color: '#ef4444' }}>R$ {ev.pago.toFixed(2)}</td>
                            <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 'bold', color: ev.lucro >= 0 ? '#10b981' : '#ef4444' }}>
                              R$ {ev.lucro.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
               </div>

               {/* LOG DE LANÇAMENTOS NO DASHBOARD */}
               <div style={{ marginTop: '12px' }}>
                 <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '16px' }}>Visão Geral de Lançamentos</h2>
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    {/* Coluna A Pagar */}
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#ef4444', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <TrendingDown size={20} /> Lançamentos a Pagar
                      </h3>
                      {contasPagar.length === 0 ? (
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Nenhum lançamento pendente.</div>
                      ) : (
                        contasPagar.map(c => renderContaItem(c))
                      )}
                    </div>
                    {/* Coluna A Receber */}
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#3b82f6', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <TrendingUp size={20} /> Lançamentos a Receber
                      </h3>
                      {contasReceber.length === 0 ? (
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Nenhum lançamento pendente.</div>
                      ) : (
                        contasReceber.map(c => renderContaItem(c))
                      )}
                    </div>
                 </div>
               </div>
             </div>
          )}

          {/* CALENDARIO */}
          {activeTab === 'calendario' && (
            <div style={{ backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{monthNames[month]} {year}</h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '8px', borderRadius: '6px', cursor: 'pointer' }}><ChevronLeft size={20} /></button>
                  <button onClick={() => setCurrentDate(new Date())} style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>Hoje</button>
                  <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '8px', borderRadius: '6px', cursor: 'pointer' }}><ChevronRight size={20} /></button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', marginBottom: '8px' }}>
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                  <div key={d} style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--text-secondary)', padding: '10px 0' }}>{d}</div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
                {blanks.map(b => <div key={`blank-${b}`} style={{ minHeight: '100px', backgroundColor: 'transparent' }} />)}
                {days.map(day => {
                  const pDia = getParcelasDoDia(day);
                  const aReceberPendentes = pDia.filter(p => p.conta.tipo === 'RECEBER' && p.status === 'PENDENTE');
                  const aPagarPendentes = pDia.filter(p => p.conta.tipo === 'PAGAR' && p.status === 'PENDENTE');
                  const jaPagosOuRecebidos = pDia.filter(p => p.status === 'PAGO');
                  const temConteudo = pDia.length > 0;

                  return (
                    <div key={day} onClick={() => handleDiaClick(day)} style={{ minHeight: '100px', backgroundColor: 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px', cursor: temConteudo ? 'pointer' : 'default', transition: 'all 0.2s ease', position: 'relative' }}>
                      <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '8px' }}>{day}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {aReceberPendentes.length > 0 && (
                          <div style={{ fontSize: '0.7rem', backgroundColor: 'rgba(59,130,246,0.1)', color: '#3b82f6', padding: '4px', borderRadius: '4px', textAlign: 'center', fontWeight: 'bold' }}>
                            {aReceberPendentes.length} a Receber
                          </div>
                        )}
                        {aPagarPendentes.length > 0 && (
                          <div style={{ fontSize: '0.7rem', backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '4px', borderRadius: '4px', textAlign: 'center', fontWeight: 'bold' }}>
                            {aPagarPendentes.length} a Pagar
                          </div>
                        )}
                        {jaPagosOuRecebidos.length > 0 && (
                          <div style={{ fontSize: '0.7rem', backgroundColor: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '4px', borderRadius: '4px', textAlign: 'center', fontWeight: 'bold' }}>
                            {jaPagosOuRecebidos.length} Concluídos
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* LANÇAMENTOS (GRID DUPLA) */}
          {activeTab === 'lancamentos' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#ef4444', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingDown size={24} /> Lançamentos a Pagar
                </h3>
                {contasPagar.length === 0 ? (
                  <div style={{ color: 'var(--text-secondary)' }}>Nenhum lançamento.</div>
                ) : (
                  contasPagar.map(c => renderContaItem(c))
                )}
              </div>
              
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#3b82f6', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp size={24} /> Lançamentos a Receber
                </h3>
                {contasReceber.length === 0 ? (
                  <div style={{ color: 'var(--text-secondary)' }}>Nenhum lançamento.</div>
                ) : (
                  contasReceber.map(c => renderContaItem(c))
                )}
              </div>
            </div>
          )}

          {/* PESSOAS e AREAS */}
          {activeTab === 'pessoas' && (
            <div>
              <button onClick={() => setIsModalPessoaOpen(true)} style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer' }}><Plus size={16} /> Nova Pessoa</button>
              {pessoas.map(p => (
                <div key={p.id} style={{ padding: '12px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '16px' }}>
                  <span style={{ color: 'var(--text-secondary)', width: '100px' }}>{p.tipo}</span>
                  <strong style={{ flex: 1 }}>{p.nomeRazao}</strong>
                  <span style={{ color: 'var(--text-secondary)' }}>{p.documento || '-'}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'areas' && (
            <div>
              <button onClick={() => setIsModalAreaOpen(true)} style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer' }}><Plus size={16} /> Nova Área</button>
              {areas.map(a => (
                <div key={a.id} style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
                  <strong>{a.nome}</strong> <span style={{ color: 'var(--text-secondary)', marginLeft: '12px' }}>{a.descricao}</span>
                </div>
              ))}
            </div>
          )}

        </>
      )}

      {/* MODAL PARCELAS DO DIA (CALENDARIO) */}
      {isModalDiaOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--background)', width: '100%', maxWidth: '600px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Parcelas do dia {diaSelecionado}</h2>
              <button onClick={() => setIsModalDiaOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            
            <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {parcelasDoDia.map(p => {
                const isEditing = editingParcelaId === p.id;
                const corDestino = p.status === 'PAGO' ? '#10b981' : (p.conta.tipo === 'PAGAR' ? '#ef4444' : '#3b82f6');
                
                return (
                <div key={p.id} style={{ backgroundColor: 'var(--surface)', border: `1px solid ${corDestino}40`, borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <input type="date" value={editParcelaForm.dataVencimento} onChange={e => setEditParcelaForm({...editParcelaForm, dataVencimento: e.target.value})} style={{...inputStyle, padding: '4px 8px'}} />
                        <input type="number" value={editParcelaForm.valorEsperado} onChange={e => setEditParcelaForm({...editParcelaForm, valorEsperado: e.target.value})} style={{...inputStyle, padding: '4px 8px', width: '100px'}} />
                      </div>
                    ) : (
                      <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '4px', color: corDestino }}>
                         {p.conta.tipo === 'PAGAR' ? 'A Pagar' : 'A Receber'}: R$ {Number(p.valorEsperado).toFixed(2)}
                      </div>
                    )}
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{p.conta.descricao}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Pessoa: {p.conta.pessoa?.nomeRazao} | Parcela {p.numeroParcela}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    {p.status === 'PAGO' ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', fontSize: '0.85rem', fontWeight: 'bold' }}>
                        <CheckCircle size={16} /> Concluído
                      </span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: p.conta.tipo === 'PAGAR' ? '#ef4444' : '#3b82f6', fontSize: '0.85rem', fontWeight: 'bold' }}>
                        <Clock size={16} /> Pendente
                      </span>
                    )}
                    
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {isEditing ? (
                        <button onClick={saveEditParcela} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Check size={14}/></button>
                      ) : (
                        <button onClick={() => startEditParcela(p)} style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', padding: '6px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Edit2 size={14}/></button>
                      )}
                      
                      <button 
                        onClick={() => handleDarBaixa(p)}
                        style={{ 
                          padding: '6px 12px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer',
                          backgroundColor: p.status === 'PAGO' ? 'var(--background)' : '#10b981',
                          color: p.status === 'PAGO' ? 'var(--text-secondary)' : '#fff',
                          borderStyle: 'solid', borderWidth: '1px', borderColor: p.status === 'PAGO' ? 'var(--border)' : '#10b981'
                        }}>
                        {p.status === 'PAGO' ? 'Desfazer' : 'Dar Baixa'}
                      </button>
                    </div>
                  </div>
                </div>
              )})}
            </div>
          </div>
        </div>
      )}

      {/* OUTROS MODAIS MANTIDOS (Nova Conta, Nova Pessoa, Nova Area)... */}
      {isModalContaOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--background)', width: '100%', maxWidth: '600px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Novo Lançamento</h2>
              <button onClick={() => setIsModalContaOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSalvarConta} style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Tipo</label>
                  <select required value={formConta.tipo} onChange={e => setFormConta({...formConta, tipo: e.target.value})} style={inputStyle}>
                    <option value="PAGAR">A Pagar (Saída)</option>
                    <option value="RECEBER">A Receber (Entrada)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Valor Total (R$)</label>
                  <input required type="number" step="0.01" value={formConta.valorTotal} onChange={e => setFormConta({...formConta, valorTotal: e.target.value})} style={inputStyle} placeholder="1500.00" />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Descrição da Conta</label>
                <input required value={formConta.descricao} onChange={e => setFormConta({...formConta, descricao: e.target.value})} style={inputStyle} placeholder="Ex: Contrato Banda XYZ" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Evento Vinculado</label>
                  <select required value={formConta.eventoId} onChange={e => setFormConta({...formConta, eventoId: e.target.value})} style={inputStyle}>
                    <option value="">Selecione...</option>
                    {eventos.map(ev => <option key={ev.id} value={ev.id}>{ev.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Pessoa (Fornecedor/Cliente)</label>
                  <select required value={formConta.pessoaId} onChange={e => setFormConta({...formConta, pessoaId: e.target.value})} style={inputStyle}>
                    <option value="">Selecione...</option>
                    {pessoas.map(p => <option key={p.id} value={p.id}>{p.nomeRazao}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Área do Evento (Opcional)</label>
                <select value={formConta.areaEventoId} onChange={e => setFormConta({...formConta, areaEventoId: e.target.value})} style={inputStyle}>
                  <option value="">Nenhuma / Geral</option>
                  {areas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                </select>
              </div>

              <div style={{ backgroundColor: 'var(--surface)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '12px' }}>Parcelamento</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Nº de Parcelas</label>
                    <input required type="number" min="1" value={formConta.numParcelas} onChange={e => setFormConta({...formConta, numParcelas: e.target.value})} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>1º Vencimento</label>
                    <input required type="date" value={formConta.primeiroVencimento} onChange={e => setFormConta({...formConta, primeiroVencimento: e.target.value})} style={inputStyle} />
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => setIsModalContaOpen(false)} style={{ flex: 1, padding: '12px', backgroundColor: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={salvando} style={{ flex: 2, padding: '12px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: salvando ? 'wait' : 'pointer' }}>
                  {salvando ? 'Salvando...' : 'Salvar e Gerar Parcelas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isModalPessoaOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ backgroundColor: 'var(--background)', width: '100%', maxWidth: '400px', borderRadius: '12px', padding: '24px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '16px' }}>Nova Pessoa (Entidade)</h2>
            <form onSubmit={handleSalvarPessoa} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <select required value={formPessoa.tipo} onChange={e => setFormPessoa({...formPessoa, tipo: e.target.value})} style={inputStyle}>
                <option value="FORNECEDOR">Fornecedor</option>
                <option value="CLIENTE">Cliente</option>
                <option value="AMBOS">Ambos</option>
              </select>
              <input required placeholder="Nome ou Razão Social" value={formPessoa.nomeRazao} onChange={e => setFormPessoa({...formPessoa, nomeRazao: e.target.value})} style={inputStyle} />
              <input placeholder="CPF/CNPJ" value={formPessoa.documento} onChange={e => setFormPessoa({...formPessoa, documento: e.target.value})} style={inputStyle} />
              <input placeholder="Contato (Telefone/Email)" value={formPessoa.contatoPrincipal} onChange={e => setFormPessoa({...formPessoa, contatoPrincipal: e.target.value})} style={inputStyle} />
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button type="button" onClick={() => setIsModalPessoaOpen(false)} style={{ flex: 1, padding: '10px', background: 'transparent', color: '#fff', border: '1px solid var(--border)', borderRadius: '6px' }}>Cancelar</button>
                <button type="submit" disabled={salvando} style={{ flex: 1, padding: '10px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px' }}>Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isModalAreaOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ backgroundColor: 'var(--background)', width: '100%', maxWidth: '400px', borderRadius: '12px', padding: '24px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '16px' }}>Nova Área de Custo</h2>
            <form onSubmit={handleSalvarArea} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input required placeholder="Nome (Ex: Iluminação)" value={formArea.nome} onChange={e => setFormArea({...formArea, nome: e.target.value})} style={inputStyle} />
              <input placeholder="Descrição" value={formArea.descricao} onChange={e => setFormArea({...formArea, descricao: e.target.value})} style={inputStyle} />
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button type="button" onClick={() => setIsModalAreaOpen(false)} style={{ flex: 1, padding: '10px', background: 'transparent', color: '#fff', border: '1px solid var(--border)', borderRadius: '6px' }}>Cancelar</button>
                <button type="submit" disabled={salvando} style={{ flex: 1, padding: '10px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px' }}>Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {contaParaExcluir && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70, padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--background)', width: '100%', maxWidth: '400px', borderRadius: '12px', border: '1px solid #ef4444', padding: '24px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '16px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Trash2 size={24} /> Confirmar Cancelamento
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Você está prestes a excluir o lançamento <strong>{contaParaExcluir.descricao}</strong>. 
              Esta ação apagará a conta e todas as suas parcelas permanentemente.
            </p>
            <p style={{ fontSize: '0.9rem', marginBottom: '16px' }}>
              Para confirmar, digite o valor total exato: <strong style={{ color: '#fff' }}>{contaParaExcluir.valorTotal.toFixed(2)}</strong>
            </p>
            <form onSubmit={confirmExclusao} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input 
                autoFocus
                required 
                placeholder="Ex: 1500.00" 
                value={valorConfirmacaoExclusao} 
                onChange={e => setValorConfirmacaoExclusao(e.target.value)} 
                style={inputStyle} 
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setContaParaExcluir(null)} style={{ flex: 1, padding: '10px', background: 'transparent', color: '#fff', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer' }}>Voltar</button>
                <button type="submit" disabled={salvando} style={{ flex: 1, padding: '10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: salvando ? 'wait' : 'pointer' }}>
                  {salvando ? 'Excluindo...' : 'Excluir Lançamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
