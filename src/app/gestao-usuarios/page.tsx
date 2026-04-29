'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Edit2, Trash2 } from 'lucide-react';

export default function GestaoUsuariosPage() {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const [currentUserData, setCurrentUserData] = useState({
    id: 0, nome: '', username: '', password: '', 
    isAdmin: false, permBoletos: false, permContratos: false, permFinanceiro: false
  });

  const [apiConfig, setApiConfig] = useState({ zapsignToken: '', zapsignAmbiente: 'TESTE', urlPublica: '' });
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    if (user?.isAdmin) {
      fetchUsuarios();
      fetchConfig();
    }
  }, [user]);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/configuracoes');
      if (res.ok) {
        const data = await res.json();
        if (data) setApiConfig({ zapsignToken: data.zapsignToken || '', zapsignAmbiente: data.zapsignAmbiente || 'TESTE', urlPublica: data.urlPublica || '' });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUsuarios = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/usuarios');
      if (res.ok) {
        const data = await res.json();
        setUsuarios(data);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing) {
        const res = await fetch(`/api/usuarios/${currentUserData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currentUserData)
        });
        if (res.ok) {
          const updated = await res.json();
          setUsuarios(prev => prev.map(u => u.id === updated.id ? updated : u));
          setIsModalOpen(false);
        } else {
          alert('Erro ao atualizar usuário');
        }
      } else {
        const res = await fetch('/api/usuarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currentUserData)
        });
        if (res.ok) {
          const created = await res.json();
          setUsuarios([...usuarios, created]);
          setIsModalOpen(false);
        } else {
          const err = await res.json();
          alert(err.error || 'Erro ao criar usuário');
        }
      }
    } catch (err) {
      alert('Falha na conexão');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja deletar este usuário?')) return;
    try {
      const res = await fetch(`/api/usuarios/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setUsuarios(prev => prev.filter(u => u.id !== id));
      } else {
        alert('Erro ao deletar');
      }
    } catch (err) {
      alert('Falha na conexão');
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const res = await fetch('/api/configuracoes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiConfig)
      });
      if (res.ok) {
        alert('Configurações salvas com sucesso!');
      } else {
        alert('Erro ao salvar configurações');
      }
    } catch (err) {
      alert('Falha na conexão');
    }
    setSavingConfig(false);
  };

  const openModal = (u?: any) => {
    if (u) {
      setIsEditing(true);
      setCurrentUserData({ ...u, password: '' }); // Não mostrar senha atual, campo para nova senha
    } else {
      setIsEditing(false);
      setCurrentUserData({
        id: 0, nome: '', username: '', password: '', 
        isAdmin: false, permBoletos: false, permContratos: false, permFinanceiro: false
      });
    }
    setIsModalOpen(true);
  };

  if (!user?.isAdmin) {
    return <div style={{ padding: '40px', color: 'var(--status-overdue)' }}>Acesso Negado</div>;
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '8px' }}>Gestão de Usuários</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Crie contas e gerencie permissões de acesso ao sistema.</p>
        </div>
        <button 
          onClick={() => openModal()}
          style={{ 
            display: 'flex', alignItems: 'center', gap: '8px', 
            backgroundColor: 'var(--primary)', color: '#fff', 
            padding: '12px 24px', borderRadius: '8px', fontWeight: '600',
            transition: 'background-color 0.2s', boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
          }}
        >
          <Plus size={20} />
          Novo Usuário
        </button>
      </div>

      <div style={{ backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '16px', color: 'var(--text-secondary)' }}>Nome</th>
              <th style={{ padding: '16px', color: 'var(--text-secondary)' }}>Usuário</th>
              <th style={{ padding: '16px', color: 'var(--text-secondary)' }}>Tipo</th>
              <th style={{ padding: '16px', color: 'var(--text-secondary)' }}>Permissões</th>
              <th style={{ padding: '16px', color: 'var(--text-secondary)', textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '16px', color: 'var(--text-primary)', fontWeight: 'bold' }}>{u.nome}</td>
                <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>{u.username}</td>
                <td style={{ padding: '16px' }}>
                  <span style={{ 
                    padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold',
                    backgroundColor: u.isAdmin ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255,255,255,0.1)',
                    color: u.isAdmin ? 'var(--primary)' : 'var(--text-secondary)'
                  }}>
                    {u.isAdmin ? 'Admin' : 'Operador'}
                  </span>
                </td>
                <td style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  {u.isAdmin ? 'Acesso Total' : [
                    u.permBoletos && 'Boletos',
                    u.permContratos && 'Contratos',
                    u.permFinanceiro && 'Financeiro'
                  ].filter(Boolean).join(', ') || 'Nenhuma'}
                </td>
                <td style={{ padding: '16px', textAlign: 'right' }}>
                  <button onClick={() => openModal(u)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginRight: '16px' }}>
                    <Edit2 size={18} />
                  </button>
                  {u.username !== 'admin' && ( // Evitar deletar admin principal
                    <button onClick={() => handleDelete(u.id)} style={{ background: 'none', border: 'none', color: 'var(--status-overdue)', cursor: 'pointer' }}>
                      <Trash2 size={18} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>Carregando...</div>}
      </div>

      <div style={{ marginTop: '48px', backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', padding: '32px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          Configurações de API (ZapSign)
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
          Configure a integração com a ZapSign para automação de contratos de eventos.
        </p>

        <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '600px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Ambiente da ZapSign *</label>
            <select 
              value={apiConfig.zapsignAmbiente}
              onChange={e => setApiConfig({...apiConfig, zapsignAmbiente: e.target.value})}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: '#fff' }}
            >
              <option value="TESTE">Teste (sandbox.zapsign.com.br)</option>
              <option value="PRODUCAO">Produção (api.zapsign.com.br)</option>
            </select>
            <small style={{ display: 'block', marginTop: '6px', color: 'var(--text-secondary)' }}>
              Defina se a integração criará documentos reais ou documentos de teste que não têm validade jurídica.
            </small>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Token de Acesso (API Token) *</label>
            <input 
              type="text" 
              required
              value={apiConfig.zapsignToken}
              onChange={e => setApiConfig({...apiConfig, zapsignToken: e.target.value})}
              placeholder="Ex: 8a7b6c5d4e3f..."
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: '#fff' }} 
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>URL Pública Base do Sistema (Opcional - Ex: ngrok)</label>
            <input 
              type="text" 
              value={apiConfig.urlPublica}
              onChange={e => setApiConfig({...apiConfig, urlPublica: e.target.value})}
              placeholder="Ex: https://ab12-34-56.ngrok-free.app"
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: '#fff' }} 
            />
            <small style={{ display: 'block', marginTop: '6px', color: 'var(--status-overdue)' }}>
              Se o sistema estiver rodando localmente (localhost), você precisa fornecer a URL do ngrok para que a ZapSign consiga baixar os arquivos DOCX dos contratos.
            </small>
          </div>

          <div style={{ marginTop: '8px' }}>
            <button 
              type="submit" 
              disabled={savingConfig}
              style={{ 
                padding: '12px 24px', borderRadius: '8px', backgroundColor: 'var(--primary)', color: '#fff', 
                fontWeight: 'bold', border: 'none', cursor: savingConfig ? 'not-allowed' : 'pointer', opacity: savingConfig ? 0.7 : 1
              }}
            >
              {savingConfig ? 'Salvando...' : 'Salvar Configurações API'}
            </button>
          </div>
        </form>
      </div>

      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: 'var(--surface)', padding: '32px', borderRadius: '12px',
            width: '100%', maxWidth: '500px', border: '1px solid var(--border)'
          }}>
            <h2 style={{ marginBottom: '24px', fontSize: '1.5rem' }}>{isEditing ? 'Editar Usuário' : 'Novo Usuário'}</h2>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Nome *</label>
                <input required type="text" value={currentUserData.nome} onChange={e => setCurrentUserData({...currentUserData, nome: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: '#fff' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Nome de Usuário (Login) *</label>
                <input required type="text" value={currentUserData.username} onChange={e => setCurrentUserData({...currentUserData, username: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: '#fff' }} disabled={isEditing && currentUserData.username === 'admin'} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                  {isEditing ? 'Nova Senha (deixe em branco para não alterar)' : 'Senha *'}
                </label>
                <input 
                  type="password" 
                  required={!isEditing} 
                  value={currentUserData.password} 
                  onChange={e => setCurrentUserData({...currentUserData, password: e.target.value})} 
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: '#fff' }} 
                />
              </div>

              {currentUserData.username !== 'admin' && (
                <div style={{ marginTop: '16px', padding: '16px', border: '1px solid var(--border)', borderRadius: '8px', backgroundColor: 'var(--background)' }}>
                  <h3 style={{ marginBottom: '16px', fontSize: '1rem', color: 'var(--text-primary)' }}>Nível de Acesso</h3>
                  
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={currentUserData.isAdmin} onChange={e => setCurrentUserData({...currentUserData, isAdmin: e.target.checked})} style={{ width: '18px', height: '18px' }} />
                    <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Acesso Total (Administrador)</span>
                  </label>

                  {!currentUserData.isAdmin && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginLeft: '28px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={currentUserData.permBoletos} onChange={e => setCurrentUserData({...currentUserData, permBoletos: e.target.checked})} style={{ width: '16px', height: '16px' }} />
                        <span style={{ color: 'var(--text-secondary)' }}>Módulo: Controle de Boletos</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={currentUserData.permContratos} onChange={e => setCurrentUserData({...currentUserData, permContratos: e.target.checked})} style={{ width: '16px', height: '16px' }} />
                        <span style={{ color: 'var(--text-secondary)' }}>Módulo: Controle de Contratos</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={currentUserData.permFinanceiro} onChange={e => setCurrentUserData({...currentUserData, permFinanceiro: e.target.checked})} style={{ width: '16px', height: '16px' }} />
                        <span style={{ color: 'var(--text-secondary)' }}>Módulo: Financeiro</span>
                      </label>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '12px 24px', borderRadius: '8px', backgroundColor: 'var(--surface-hover)', color: 'var(--text-primary)' }}>Cancelar</button>
                <button type="submit" style={{ padding: '12px 24px', borderRadius: '8px', backgroundColor: 'var(--primary)', color: '#fff', fontWeight: 'bold' }}>Salvar Usuário</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
