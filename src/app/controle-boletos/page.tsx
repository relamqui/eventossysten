'use client';

import { useState, useEffect } from 'react';
import BoletoRow, { BoletoData, Status } from '@/components/BoletoRow/BoletoRow';
import { Plus, Search, CalendarPlus, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';

// Mask Functions
const maskCPF = (value: string) => {
  return value
    .replace(/\D/g, '') // remove non-digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1'); // max 14 chars
};

const maskPhone = (value: string) => {
  let v = value.replace(/\D/g, '');
  if (v.length > 11) v = v.substring(0, 11);
  if (v.length > 10) {
    return v.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
  } else if (v.length > 6) {
    return v.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
  } else if (v.length > 2) {
    return v.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
  } else if (v.length > 0) {
    return v.replace(/^(\d{0,2})/, '($1');
  }
  return v;
};

export default function ControleBoletosPage() {
  const router = useRouter();
  const [boletos, setBoletos] = useState<BoletoData[]>([]);
  const [eventos, setEventos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [filterEvento, setFilterEvento] = useState('TODOS');
  const [searchQuery, setSearchQuery] = useState('');

  // Boleto Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentBoleto, setCurrentBoleto] = useState<any>({
    id: 0, nomeResponsavel: '', telefoneResponsavel: '', cpfResponsavel: '',
    nomeFormando: '', telefoneFormando: '', cpfFormando: '',
    evento: '', temporada: '', produto: 'Pacote Formando', quantidade: '1', numeroParcelas: '1'
  });

  // Indispensável Modal State
  const [isIndispensavelModalOpen, setIsIndispensavelModalOpen] = useState(false);

  // Evento Modal State
  const [isEventoModalOpen, setIsEventoModalOpen] = useState(false);
  const [isEventosDropdownOpen, setIsEventosDropdownOpen] = useState(false);
  const [isEditingEvento, setIsEditingEvento] = useState(false);
  const [contratoFile, setContratoFile] = useState<File | null>(null);
  const [novoEvento, setNovoEvento] = useState({ 
    id: 0, nome: '', dataEvento: '', temporada: '', 
    tipo: '9°', curso: '', 
    valorPacoteAVista: '', valorPacoteParcelado: '', 
    valorIndispAdultoAVista: '', valorIndispAdultoParcelado: '', 
    valorIndispInfantilAVista: '', valorIndispInfantilParcelado: '', 
    informacoes: '', contratoCaminho: '', zapsignTemplateId: ''
  });

  useEffect(() => {
    fetchEventos();
    fetchBoletos();
  }, []);

  const fetchEventos = async () => {
    try {
      const res = await fetch('/api/eventos');
      if (res.ok) {
        const data = await res.json();
        setEventos(data);
      }
    } catch (error) {
      console.error('Failed to fetch eventos', error);
    }
  };

  const fetchBoletos = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/boletos');
      if (res.ok) {
        const data = await res.json();
        setBoletos(data);
      } else {
        setBoletos([]);
      }
    } catch (error) {
      setBoletos([]);
    }
    setLoading(false);
  };

  const handleStatusChange = async (boletoId: number, mesIndex: number, newStatus: Status) => {
    setBoletos(prev => prev.map(b => {
      if (b.id !== boletoId) return b;
      return {
        ...b,
        parcelas: b.parcelas.map(p => p.mesIndex === mesIndex ? { ...p, status: newStatus } : p)
      };
    }));

    try {
      await fetch(`/api/boletos/${boletoId}/parcela`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mesIndex, status: newStatus })
      });
    } catch (e) {
      console.error('Failed to update status');
    }
  };

  const handleSaveBoleto = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing) {
        const res = await fetch(`/api/boletos/${currentBoleto.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currentBoleto)
        });
        if (res.ok) {
          const updated = await res.json();
          setBoletos(prev => prev.map(b => b.id === updated.id ? updated : b));
          setIsModalOpen(false);
          setIsIndispensavelModalOpen(false);
        } else {
          alert('Erro ao atualizar boleto');
        }
      } else {
        const res = await fetch('/api/boletos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currentBoleto)
        });
        if (res.ok) {
          const created = await res.json();
          setBoletos([created, ...boletos]);
          setIsModalOpen(false);
          setIsIndispensavelModalOpen(false);
        } else {
          alert('Erro ao criar boleto');
        }
      }
    } catch (error) {
      console.error('Failed to save boleto', error);
      alert('Falha na conexão com a API');
    }
  };

  const handleDeleteBoleto = async () => {
    if (!currentBoleto.id) return;
    if (!confirm('Tem certeza que deseja deletar este boleto? Essa ação não pode ser desfeita.')) return;

    try {
      const res = await fetch(`/api/boletos/${currentBoleto.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setBoletos(prev => prev.filter(b => b.id !== currentBoleto.id));
        setIsModalOpen(false);
      } else {
        alert('Erro ao deletar boleto');
      }
    } catch (error) {
      console.error('Failed to delete boleto', error);
      alert('Falha na conexão com a API');
    }
  };

  const handleSaveEvento = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      Object.keys(novoEvento).forEach(key => {
        formData.append(key, (novoEvento as any)[key]);
      });
      if (contratoFile) {
        formData.append('contratoFile', contratoFile);
      }

      if (isEditingEvento && novoEvento.id) {
        const res = await fetch(`/api/eventos/${novoEvento.id}`, {
          method: 'PUT',
          body: formData
        });
        if (res.ok) {
          const updated = await res.json();
          setEventos(prev => prev.map(ev => ev.id === updated.id ? updated : ev));
          setIsEventoModalOpen(false);
          setContratoFile(null);
        } else {
          alert('Erro ao atualizar evento');
        }
      } else {
        const res = await fetch('/api/eventos', {
          method: 'POST',
          body: formData
        });
        if (res.ok) {
          const created = await res.json();
          setEventos([created, ...eventos]);
          setIsEventoModalOpen(false);
          setContratoFile(null);
          setNovoEvento({ 
            id: 0, nome: '', dataEvento: '', temporada: '', 
            tipo: '9°', curso: '', 
            valorPacoteAVista: '', valorPacoteParcelado: '', 
            valorIndispAdultoAVista: '', valorIndispAdultoParcelado: '', 
            valorIndispInfantilAVista: '', valorIndispInfantilParcelado: '', 
            informacoes: '', contratoCaminho: '', zapsignTemplateId: ''
          });
        } else {
          alert('Erro ao criar evento');
        }
      }
    } catch (error) {
      alert('Falha na conexão com a API');
    }
  };

  const openBoletoModal = (boleto?: BoletoData) => {
    if (boleto) {
      setIsEditing(true);
      setCurrentBoleto(boleto);
    } else {
      setIsEditing(false);
      setCurrentBoleto({
        id: 0, nomeResponsavel: '', telefoneResponsavel: '', cpfResponsavel: '',
        nomeFormando: '', telefoneFormando: '', cpfFormando: '',
        evento: eventos.length > 0 ? eventos[0].nome : '', temporada: '', produto: 'Pacote Formando', quantidade: '1', numeroParcelas: '1'
      });
    }
    setIsModalOpen(true);
  };

  const openIndispensavelModal = () => {
    setIsEditing(false);
    setCurrentBoleto({
      id: 0, nomeResponsavel: '', telefoneResponsavel: '', cpfResponsavel: '',
      nomeFormando: '', telefoneFormando: '', cpfFormando: '',
      evento: eventos.length > 0 ? eventos[0].nome : '', temporada: '', produto: 'Indispensável Adulto', quantidade: '1', numeroParcelas: '1'
    });
    setIsIndispensavelModalOpen(true);
  };

  const handleFormandoSelect = (nomeSelecionado: string) => {
    const formandoEncontrado = boletos.find(b => b.nomeFormando === nomeSelecionado);
    if (formandoEncontrado) {
      setCurrentBoleto({
        ...currentBoleto,
        nomeFormando: formandoEncontrado.nomeFormando,
        telefoneFormando: formandoEncontrado.telefoneFormando,
        cpfFormando: formandoEncontrado.cpfFormando,
        nomeResponsavel: formandoEncontrado.nomeResponsavel,
        telefoneResponsavel: formandoEncontrado.telefoneResponsavel,
        cpfResponsavel: formandoEncontrado.cpfResponsavel,
        evento: formandoEncontrado.evento,
        temporada: formandoEncontrado.temporada,
      });
    }
  };

  // Helper for filtering
  const filteredBoletos = boletos.filter(b => {
    const matchesEvento = filterEvento === 'TODOS' || b.evento === filterEvento;
    const searchLow = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || 
      (b.nomeFormando?.toLowerCase().includes(searchLow) || false) ||
      (b.nomeResponsavel?.toLowerCase().includes(searchLow) || false) ||
      (b.cpfFormando?.includes(searchLow) || false) ||
      (b.cpfResponsavel?.includes(searchLow) || false);

    return matchesEvento && matchesSearch;
  });

  // Unique Formandos para o select do Indispensável
  const uniqueFormandos = Array.from(new Map(
    boletos.filter(b => b.nomeFormando).map(b => [b.nomeFormando, b])
  ).values());

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '8px' }}>Controle de Boletos</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Gerencie os pagamentos e parcelas de todos os formandos.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setIsEventosDropdownOpen(!isEventosDropdownOpen)}
              style={{ 
                display: 'flex', alignItems: 'center', gap: '8px', 
                backgroundColor: 'var(--surface-hover)', color: 'var(--text-primary)', 
                padding: '12px 24px', borderRadius: '8px', fontWeight: '600',
                border: '1px solid var(--border)', transition: 'background-color 0.2s'
              }}
            >
              <CalendarPlus size={20} />
              Eventos
            </button>
            {isEventosDropdownOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '8px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', zIndex: 10, width: 'max-content' }}>
                <button onClick={() => { setIsEditingEvento(false); setIsEventoModalOpen(true); setIsEventosDropdownOpen(false); setNovoEvento({ id: 0, nome: '', dataEvento: '', temporada: '', tipo: '9°', curso: '', valorPacoteAVista: '', valorPacoteParcelado: '', valorIndispAdultoAVista: '', valorIndispAdultoParcelado: '', valorIndispInfantilAVista: '', valorIndispInfantilParcelado: '', informacoes: '', contratoCaminho: '', zapsignTemplateId: '' }); }} style={{ display: 'block', width: '100%', padding: '12px 24px', textAlign: 'left', backgroundColor: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>Criar Evento</button>
                <button onClick={() => { setIsEditingEvento(true); setIsEventoModalOpen(true); setIsEventosDropdownOpen(false); setNovoEvento({ id: 0, nome: '', dataEvento: '', temporada: '', tipo: '9°', curso: '', valorPacoteAVista: '', valorPacoteParcelado: '', valorIndispAdultoAVista: '', valorIndispAdultoParcelado: '', valorIndispInfantilAVista: '', valorIndispInfantilParcelado: '', informacoes: '', contratoCaminho: '', zapsignTemplateId: '' }); }} style={{ display: 'block', width: '100%', padding: '12px 24px', textAlign: 'left', backgroundColor: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', borderTop: '1px solid var(--border)' }}>Editar Eventos</button>
              </div>
            )}
          </div>
          <button 
            onClick={() => router.push('/importar-relatorio')}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '8px', 
              backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', 
              padding: '12px 24px', borderRadius: '8px', fontWeight: '600',
              border: '1px solid rgba(16, 185, 129, 0.3)', transition: 'background-color 0.2s'
            }}
          >
            <Upload size={20} />
            Importar Relatório
          </button>
          <button 
            onClick={() => openIndispensavelModal()}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '8px', 
              backgroundColor: 'var(--surface-hover)', color: 'var(--text-primary)', 
              padding: '12px 24px', borderRadius: '8px', fontWeight: '600',
              border: '1px solid var(--border)', transition: 'background-color 0.2s'
            }}
          >
            <Plus size={20} />
            Criar Indispensável
          </button>
          <button 
            onClick={() => openBoletoModal()}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '8px', 
              backgroundColor: 'var(--primary)', color: '#fff', 
              padding: '12px 24px', borderRadius: '8px', fontWeight: '600',
              transition: 'background-color 0.2s', boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--primary-hover)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--primary)'}
          >
            <Plus size={20} />
            Criar Pacote
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
          <button
            onClick={() => setFilterEvento('TODOS')}
            style={{
              padding: '8px 16px', borderRadius: '8px', whiteSpace: 'nowrap',
              backgroundColor: filterEvento === 'TODOS' ? 'var(--primary)' : 'var(--surface)',
              color: filterEvento === 'TODOS' ? '#fff' : 'var(--text-primary)',
              border: `1px solid ${filterEvento === 'TODOS' ? 'var(--primary)' : 'var(--border)'}`,
              fontWeight: filterEvento === 'TODOS' ? 'bold' : 'normal',
              transition: 'all 0.2s'
            }}
          >
            Todos os Eventos
          </button>
          {eventos.map(ev => (
            <button
              key={ev.id}
              onClick={() => setFilterEvento(ev.nome)}
              style={{
                padding: '8px 16px', borderRadius: '8px', whiteSpace: 'nowrap',
                backgroundColor: filterEvento === ev.nome ? 'var(--primary)' : 'var(--surface)',
                color: filterEvento === ev.nome ? '#fff' : 'var(--text-primary)',
                border: `1px solid ${filterEvento === ev.nome ? 'var(--primary)' : 'var(--border)'}`,
                fontWeight: filterEvento === ev.nome ? 'bold' : 'normal',
                transition: 'all 0.2s'
              }}
            >
              {ev.nome}
            </button>
          ))}
        </div>

        {/* Global Search */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input 
            type="text" 
            placeholder="Buscar Nome ou CPF..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ 
              width: '100%', padding: '10px 10px 10px 38px', 
              borderRadius: '8px', border: '1px solid var(--border)', 
              backgroundColor: 'var(--surface)', color: 'var(--text-primary)' 
            }}
          />
        </div>
      </div>

      {/* BOLETO MODAL */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: 'var(--surface)', padding: '32px', borderRadius: '12px',
            width: '100%', maxWidth: '800px', border: '1px solid var(--border)',
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            <h2 style={{ marginBottom: '24px', fontSize: '1.5rem' }}>{isEditing ? 'Editar Pacote' : 'Criar Pacote'}</h2>
            <form onSubmit={handleSaveBoleto} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Responsável *</label>
                  <input required type="text" value={currentBoleto.nomeResponsavel || ''} onChange={e => setCurrentBoleto({...currentBoleto, nomeResponsavel: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: '#fff' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Formando *</label>
                  <input required type="text" value={currentBoleto.nomeFormando || ''} onChange={e => setCurrentBoleto({...currentBoleto, nomeFormando: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: '#fff' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Telefone Responsável</label>
                  <input type="text" value={currentBoleto.telefoneResponsavel || ''} onChange={e => setCurrentBoleto({...currentBoleto, telefoneResponsavel: maskPhone(e.target.value)})} placeholder="(11) 99999-9999" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: '#fff' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Telefone Formando</label>
                  <input type="text" value={currentBoleto.telefoneFormando || ''} onChange={e => setCurrentBoleto({...currentBoleto, telefoneFormando: maskPhone(e.target.value)})} placeholder="(11) 99999-9999" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: '#fff' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>CPF Responsável</label>
                  <input type="text" value={currentBoleto.cpfResponsavel || ''} onChange={e => setCurrentBoleto({...currentBoleto, cpfResponsavel: maskCPF(e.target.value)})} placeholder="111.111.111-11" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: '#fff' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>CPF Formando</label>
                  <input type="text" value={currentBoleto.cpfFormando || ''} onChange={e => setCurrentBoleto({...currentBoleto, cpfFormando: maskCPF(e.target.value)})} placeholder="111.111.111-11" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: '#fff' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Evento</label>
                  <select value={currentBoleto.evento || ''} onChange={e => setCurrentBoleto({...currentBoleto, evento: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: '#fff' }}>
                    <option value="">Selecione um Evento...</option>
                    {eventos.map(ev => (
                      <option key={ev.id} value={ev.nome}>{ev.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Temporada</label>
                  <input type="text" value={currentBoleto.temporada || ''} onChange={e => setCurrentBoleto({...currentBoleto, temporada: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: '#fff' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Produto *</label>
                  <input required type="text" value={currentBoleto.produto || 'Pacote Formando'} readOnly={!isEditing} onChange={e => setCurrentBoleto({...currentBoleto, produto: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-hover)', color: 'var(--text-secondary)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Quantidade *</label>
                  <input required type="number" min="1" value={currentBoleto.quantidade || ''} onChange={e => setCurrentBoleto({...currentBoleto, quantidade: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: '#fff' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Parcelas *</label>
                  <input required type="number" min="1" max="24" value={currentBoleto.numeroParcelas || ''} onChange={e => setCurrentBoleto({...currentBoleto, numeroParcelas: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: '#fff' }} disabled={isEditing} title={isEditing ? "Não é possível alterar o número de parcelas na edição" : ""} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Nº Documento (Vínculo)</label>
                  <input type="text" value={currentBoleto.pagadorOriginal || ''} onChange={e => setCurrentBoleto({...currentBoleto, pagadorOriginal: e.target.value})} placeholder="Ex: 10101027" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: '#fff' }} />
                </div>
              </div>
              
              {isEditing && currentBoleto.parcelas && currentBoleto.parcelas.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  <h3 style={{ marginBottom: '12px', color: 'var(--text-primary)', fontSize: '1rem', fontWeight: '600' }}>Status Mensal</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '8px' }}>
                    {currentBoleto.parcelas.map((p: any, idx: number) => (
                      <div key={p.id || idx}>
                        <label style={{ display: 'block', marginBottom: '4px', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Mês {p.mesIndex + 1}</label>
                        <select 
                          value={p.status} 
                          onChange={(e) => {
                            const newParcelas = [...currentBoleto.parcelas];
                            newParcelas[idx].status = e.target.value;
                            setCurrentBoleto({...currentBoleto, parcelas: newParcelas});
                          }}
                          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: '#fff' }}
                        >
                          <option value="PENDENTE">Pendente</option>
                          <option value="PAGO">Pago</option>
                          <option value="VENCIDO">Vencido</option>
                          <option value="BAIXADO">Amortizado</option>
                          <option value="QUITADO">Quitado</option>
                          <option value="CANCELADO">Cancelado</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                {isEditing ? (
                  <button type="button" onClick={handleDeleteBoleto} style={{ padding: '12px 24px', borderRadius: '8px', backgroundColor: 'var(--status-overdue)', color: '#fff', fontWeight: 'bold' }}>Excluir Linha</button>
                ) : <div></div>}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '12px 24px', borderRadius: '8px', backgroundColor: 'var(--surface-hover)', color: 'var(--text-primary)' }}>Cancelar</button>
                  <button type="submit" style={{ padding: '12px 24px', borderRadius: '8px', backgroundColor: 'var(--primary)', color: '#fff', fontWeight: 'bold' }}>Salvar</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EVENTO MODAL */}
      {isEventoModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: 'var(--surface)', padding: '32px', borderRadius: '12px',
            width: '100%', maxWidth: '600px', border: '1px solid var(--border)',
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            <h2 style={{ marginBottom: '24px', fontSize: '1.5rem' }}>{isEditingEvento ? 'Editar Evento' : 'Criar Evento'}</h2>
            <form onSubmit={handleSaveEvento} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {isEditingEvento && (
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Selecione o Evento *</label>
                  <select 
                    required
                    onChange={(e) => {
                      const ev = eventos.find(x => x.id === parseInt(e.target.value));
                      if (ev) setNovoEvento({...ev});
                    }}
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: '#fff', marginBottom: '8px' }}
                  >
                    <option value="">Selecione um evento cadastrado...</option>
                    {eventos.map(ev => <option key={ev.id} value={ev.id}>{ev.nome}</option>)}
                  </select>
                </div>
              )}
              
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Nome do Evento *</label>
                <input required type="text" value={novoEvento.nome} onChange={e => setNovoEvento({...novoEvento, nome: e.target.value})} placeholder="Ex: DJV" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: '#fff' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Data do Evento</label>
                  <input type="date" value={novoEvento.dataEvento} onChange={e => setNovoEvento({...novoEvento, dataEvento: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: '#fff', colorScheme: 'dark' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Temporada</label>
                  <input type="text" value={novoEvento.temporada} onChange={e => setNovoEvento({...novoEvento, temporada: e.target.value})} placeholder="Ex: 2026" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: '#fff' }} />
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Tipo *</label>
                  <select value={novoEvento.tipo} onChange={e => setNovoEvento({...novoEvento, tipo: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: '#fff' }}>
                    <option value="9°">9° Ano</option>
                    <option value="3°">3° Ano</option>
                    <option value="faculdade">Faculdade</option>
                  </select>
                </div>

                {novoEvento.tipo === 'faculdade' && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Curso *</label>
                    <input required type="text" value={novoEvento.curso} onChange={e => setNovoEvento({...novoEvento, curso: e.target.value})} placeholder="Ex: Direito" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: '#fff' }} />
                  </div>
                )}
              </div>

              <h3 style={{ fontSize: '1.1rem', marginTop: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>Pacote Formando</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Valor À Vista (R$)</label>
                  <input type="number" step="0.01" value={novoEvento.valorPacoteAVista} onChange={e => setNovoEvento({...novoEvento, valorPacoteAVista: e.target.value})} placeholder="0.00" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: '#fff' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Valor Parcelado (R$)</label>
                  <input type="number" step="0.01" value={novoEvento.valorPacoteParcelado} onChange={e => setNovoEvento({...novoEvento, valorPacoteParcelado: e.target.value})} placeholder="0.00" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: '#fff' }} />
                </div>
              </div>
              
              <h3 style={{ fontSize: '1.1rem', marginTop: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>Indispensável Adulto</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Valor À Vista (R$)</label>
                  <input type="number" step="0.01" value={novoEvento.valorIndispAdultoAVista} onChange={e => setNovoEvento({...novoEvento, valorIndispAdultoAVista: e.target.value})} placeholder="0.00" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: '#fff' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Valor Parcelado (R$)</label>
                  <input type="number" step="0.01" value={novoEvento.valorIndispAdultoParcelado} onChange={e => setNovoEvento({...novoEvento, valorIndispAdultoParcelado: e.target.value})} placeholder="0.00" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: '#fff' }} />
                </div>
              </div>

              <h3 style={{ fontSize: '1.1rem', marginTop: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>Indispensável Infantil</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Valor À Vista (R$)</label>
                  <input type="number" step="0.01" value={novoEvento.valorIndispInfantilAVista} onChange={e => setNovoEvento({...novoEvento, valorIndispInfantilAVista: e.target.value})} placeholder="0.00" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: '#fff' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Valor Parcelado (R$)</label>
                  <input type="number" step="0.01" value={novoEvento.valorIndispInfantilParcelado} onChange={e => setNovoEvento({...novoEvento, valorIndispInfantilParcelado: e.target.value})} placeholder="0.00" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: '#fff' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Informações Adicionais</label>
                <textarea value={novoEvento.informacoes} onChange={e => setNovoEvento({...novoEvento, informacoes: e.target.value})} placeholder="Observações..." style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: '#fff', minHeight: '80px', resize: 'vertical' }} />
              </div>

              <div style={{ marginTop: '16px', padding: '16px', border: '1px dashed var(--primary)', borderRadius: '8px', backgroundColor: 'rgba(139, 92, 246, 0.05)' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Contrato Base (ZapSign)
                </h3>

                {/* Preview do documento atual */}
                {novoEvento.id > 0 && (
                  <div style={{ marginBottom: '12px', padding: '10px', borderRadius: '6px', backgroundColor: novoEvento.zapsignTemplateId ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', border: `1px solid ${novoEvento.zapsignTemplateId ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: novoEvento.zapsignTemplateId ? '#10b981' : '#ef4444', flexShrink: 0 }} />
                    {novoEvento.zapsignTemplateId ? (
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#10b981' }}>✅ Contrato configurado</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          Template ID: {novoEvento.zapsignTemplateId}
                          {novoEvento.contratoCaminho && <> | Arquivo: {novoEvento.contratoCaminho.split('/').pop()}</>}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#ef4444' }}>❌ Nenhum contrato enviado</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Faça o upload de um .docx abaixo para habilitar a geração de contratos.</div>
                      </div>
                    )}
                  </div>
                )}

                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  {novoEvento.zapsignTemplateId ? 'Envie um novo .docx para substituir o contrato atual.' : 'Faça o upload do documento modelo do contrato (.docx) para que o sistema crie o Template na ZapSign automaticamente.'}
                </p>
                <input 
                  type="file" 
                  accept=".docx"
                  onChange={e => {
                    if (e.target.files && e.target.files.length > 0) {
                      setContratoFile(e.target.files[0]);
                    }
                  }}
                  style={{ width: '100%', padding: '8px', color: 'var(--text-primary)' }}
                />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button type="button" onClick={() => setIsEventoModalOpen(false)} style={{ padding: '12px 24px', borderRadius: '8px', backgroundColor: 'var(--surface-hover)', color: 'var(--text-primary)' }}>Cancelar</button>
                <button type="submit" style={{ padding: '12px 24px', borderRadius: '8px', backgroundColor: 'var(--primary)', color: '#fff', fontWeight: 'bold' }}>Salvar Evento</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INDISPENSAVEL MODAL */}
      {isIndispensavelModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: 'var(--surface)', padding: '32px', borderRadius: '12px',
            width: '100%', maxWidth: '800px', border: '1px solid var(--border)',
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            <h2 style={{ marginBottom: '24px', fontSize: '1.5rem' }}>Criar Indispensável</h2>
            <form onSubmit={(e) => { 
                e.preventDefault(); 
                setIsIndispensavelModalOpen(false); 
                handleSaveBoleto(e); 
            }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Selecionar Formando Existente *</label>
                  <select 
                    required 
                    value={currentBoleto.nomeFormando || ''} 
                    onChange={e => handleFormandoSelect(e.target.value)} 
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: '#fff' }}
                  >
                    <option value="">Selecione um Formando...</option>
                    {uniqueFormandos.map(f => (
                      <option key={f.id} value={f.nomeFormando}>{f.nomeFormando}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Responsável *</label>
                  <input required type="text" value={currentBoleto.nomeResponsavel || ''} disabled style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-hover)', color: 'var(--text-secondary)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Telefone Responsável</label>
                  <input type="text" value={currentBoleto.telefoneResponsavel || ''} disabled style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-hover)', color: 'var(--text-secondary)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Telefone Formando</label>
                  <input type="text" value={currentBoleto.telefoneFormando || ''} disabled style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-hover)', color: 'var(--text-secondary)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>CPF Responsável</label>
                  <input type="text" value={currentBoleto.cpfResponsavel || ''} disabled style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-hover)', color: 'var(--text-secondary)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>CPF Formando</label>
                  <input type="text" value={currentBoleto.cpfFormando || ''} disabled style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-hover)', color: 'var(--text-secondary)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Evento</label>
                  <input type="text" value={currentBoleto.evento || ''} disabled style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-hover)', color: 'var(--text-secondary)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Temporada</label>
                  <input type="text" value={currentBoleto.temporada || ''} disabled style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-hover)', color: 'var(--text-secondary)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Produto *</label>
                  <select required value={currentBoleto.produto || ''} onChange={e => setCurrentBoleto({...currentBoleto, produto: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: '#fff' }}>
                    <option value="Indispensável Adulto">Indispensável Adulto</option>
                    <option value="Indispensável Infantil">Indispensável Infantil</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Quantidade *</label>
                  <input required type="number" min="1" value={currentBoleto.quantidade || ''} onChange={e => setCurrentBoleto({...currentBoleto, quantidade: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: '#fff' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Parcelas *</label>
                  <input required type="number" min="1" max="24" value={currentBoleto.numeroParcelas || ''} onChange={e => setCurrentBoleto({...currentBoleto, numeroParcelas: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: '#fff' }} />
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '16px' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="button" onClick={() => setIsIndispensavelModalOpen(false)} style={{ padding: '12px 24px', borderRadius: '8px', backgroundColor: 'var(--surface-hover)', color: 'var(--text-primary)' }}>Cancelar</button>
                  <button type="submit" style={{ padding: '12px 24px', borderRadius: '8px', backgroundColor: 'var(--primary)', color: '#fff', fontWeight: 'bold' }}>Salvar</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Carregando dados...</div>
      ) : filteredBoletos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Nenhum boleto encontrado com os filtros atuais.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {filteredBoletos.map(boleto => (
            <BoletoRow key={boleto.id} boleto={boleto} onStatusChange={handleStatusChange} onEdit={openBoletoModal} />
          ))}
        </div>
      )}
    </div>
  );
}
