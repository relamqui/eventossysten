'use client';

import styles from './BoletoRow.module.css';
import { Edit2 } from 'lucide-react';

export type Status = 'PAGO' | 'VENCIDO' | 'PENDENTE' | 'BAIXADO' | 'QUITADO' | 'CANCELADO' | 'NONE';

export interface ParcelaData {
  id: number;
  mesIndex: number;
  status: Status;
  dataVencimento?: string; // "2026-05"
}

export interface BoletoData {
  id: number;
  nomeFormando: string;
  telefoneFormando?: string;
  cpfFormando?: string;
  nomeResponsavel: string;
  telefoneResponsavel?: string;
  cpfResponsavel?: string;
  temporada?: string;
  produto: string;
  quantidade: string;
  numeroParcelas: string;
  parcelas: ParcelaData[];
  evento?: string;
  pagadorOriginal?: string;
}

interface BoletoRowProps {
  boleto: BoletoData;
  onStatusChange?: (boletoId: number, mesIndex: number, newStatus: Status) => void;
  onEdit?: (boleto: BoletoData) => void;
}

const MONTH_LABELS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTH_NAMES_PT: Record<string, string> = {
  '01': 'jan', '02': 'fev', '03': 'mar', '04': 'abr',
  '05': 'mai', '06': 'jun', '07': 'jul', '08': 'ago',
  '09': 'set', '10': 'out', '11': 'nov', '12': 'dez',
};

function formatDataVencimento(dataVencimento?: string): string | null {
  if (!dataVencimento) return null;
  // "2026-05" → "mai/2026"
  const parts = dataVencimento.split('-');
  if (parts.length >= 2) {
    const year = parts[0];
    const month = parts[1].padStart(2, '0');
    const monthName = MONTH_NAMES_PT[month] || month;
    return `${monthName}/${year}`;
  }
  return null;
}

export default function BoletoRow({ boleto, onStatusChange, onEdit }: BoletoRowProps) {
  const totalParcelas = parseInt(boleto.numeroParcelas || '0', 10);
  // BAIXADO (amortizado) e QUITADO (quitação de atraso) contam como efetivamente pagos
  const paidParcelas = boleto.parcelas?.filter(p => p.status === 'PAGO' || p.status === 'BAIXADO' || p.status === 'QUITADO').length || 0;
  const baixadosParcelas = boleto.parcelas?.filter(p => p.status === 'BAIXADO').length || 0;
  const quitadosParcelas = boleto.parcelas?.filter(p => p.status === 'QUITADO').length || 0;

  // Check if any parcela has dataVencimento
  const hasRealDates = boleto.parcelas?.some(p => p.dataVencimento);

  // Build display parcels: if has real dates, show only actual parcelas; otherwise show 12 months
  const displayParcelas = hasRealDates
    ? (boleto.parcelas || []).sort((a, b) => {
        // Sort by dataVencimento chronologically
        if (a.dataVencimento && b.dataVencimento) return a.dataVencimento.localeCompare(b.dataVencimento);
        return a.mesIndex - b.mesIndex;
      })
    : Array.from({ length: 12 }, (_, i) => {
        const p = boleto.parcelas?.find(p => p.mesIndex === i);
        return {
          id: p?.id || 0,
          mesIndex: i,
          status: (p ? p.status : 'NONE') as Status,
          dataVencimento: p?.dataVencimento,
        };
      });

  return (
    <div className={styles.row}>
      <div className={styles.infoGrid} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
        <div className={styles.infoGroup}>
          <span className={styles.infoLabel}>Responsável</span>
          <span className={styles.infoValue}>{boleto.nomeResponsavel || '-'}</span>
        </div>
        <div className={styles.infoGroup}>
          <span className={styles.infoLabel}>Tel. Responsável</span>
          <span className={styles.infoValue}>{boleto.telefoneResponsavel || '-'}</span>
        </div>
        <div className={styles.infoGroup}>
          <span className={styles.infoLabel}>CPF Resp.</span>
          <span className={styles.infoValue}>{boleto.cpfResponsavel || '-'}</span>
        </div>
        
        <div className={styles.infoGroup}>
          <span className={styles.infoLabel}>Formando</span>
          <span className={styles.infoValue}>{boleto.nomeFormando || '-'}</span>
        </div>
        <div className={styles.infoGroup}>
          <span className={styles.infoLabel}>Tel. Formando</span>
          <span className={styles.infoValue}>{boleto.telefoneFormando || '-'}</span>
        </div>
        <div className={styles.infoGroup}>
          <span className={styles.infoLabel}>CPF Formando</span>
          <span className={styles.infoValue}>{boleto.cpfFormando || '-'}</span>
        </div>

        <div className={styles.infoGroup}>
          <span className={styles.infoLabel}>Evento / Temporada</span>
          <span className={styles.infoValue}>{boleto.evento ? `${boleto.evento} / ` : ''}{boleto.temporada || '-'}</span>
        </div>
        <div className={styles.infoGroup}>
          <span className={styles.infoLabel}>Produto</span>
          <span className={styles.infoValue}>{boleto.produto || '-'}</span>
        </div>
        <div className={styles.infoGroup}>
          <span className={styles.infoLabel}>Quantidade</span>
          <span className={styles.infoValue}>{boleto.quantidade || '-'}</span>
        </div>
        <div className={styles.infoGroup}>
          <span className={styles.infoLabel}>Parcelas Pagas</span>
          <span className={styles.infoValue}>
            {paidParcelas} de {totalParcelas}
            {baixadosParcelas > 0 && (
              <span style={{ marginLeft: '6px', fontSize: '0.72rem', color: '#3b82f6', fontWeight: 'bold' }}>
                (incl. {baixadosParcelas} amort.)
              </span>
            )}
            {quitadosParcelas > 0 && (
              <span style={{ marginLeft: '6px', fontSize: '0.72rem', color: '#f59e0b', fontWeight: 'bold' }}>
                (incl. {quitadosParcelas} quit.)
              </span>
            )}
          </span>
        </div>
      </div>

      <div className={styles.monthsContainer}>
        <span className={styles.monthsLabel}>Status Mensal:</span>
        <div className={styles.monthsList}>
          {displayParcelas.map((parcela, index) => {
            const dateLabel = formatDataVencimento(parcela.dataVencimento);
            const fallbackLabel = MONTH_LABELS[parcela.mesIndex] || (parcela.mesIndex + 1).toString();

            return (
              <div key={parcela.id || index} className={styles.monthItem}>
                {dateLabel && (
                  <span className={styles.monthDateLabel}>{dateLabel}</span>
                )}
                <div
                  className={`${styles.monthIndicator} ${styles[`status-${parcela.status}`]}`}
                  title={`${dateLabel || `Mês ${parcela.mesIndex + 1}`} - ${parcela.status}`}
                >
                  {dateLabel ? dateLabel.split('/')[0]?.substring(0, 3).toUpperCase() : fallbackLabel}
                </div>
              </div>
            );
          })}
        </div>
        
        {onEdit && (
          <button className={styles.editBtn} onClick={() => onEdit(boleto)}>
            <Edit2 size={14} /> Editar
          </button>
        )}
      </div>
    </div>
  );
}
