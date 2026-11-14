import { memo } from 'react';
import type { Incident } from '../../engine';
import { CLASS_COLOR } from '../../utils/colors';
import { incId } from '../../utils/format';
import { ClassBadge, ClassIcon } from '../ui/Badge';

export const IncidentCard = memo(function IncidentCard({ inc, onOpen, selected }: { inc: Incident; onOpen: (id: number) => void; selected?: boolean }) {
  const flash = inc.reclassifiedAt !== undefined;
  return (
    <button type="button" className={`inc-card${selected ? ' sel' : ''}`} onClick={() => onOpen(inc.id)} style={{ borderLeftColor: CLASS_COLOR[inc.cls] }} aria-label={`${incId(inc.id)} ${inc.summary}`}>
      <div className="row" style={{ gap: 8 }}>
        <span style={{ color: CLASS_COLOR[inc.cls], display: 'inline-flex' }}>
          <ClassIcon cls={inc.cls} size={18} />
        </span>
        <b className="mono">{incId(inc.id)}</b>
        <ClassBadge cls={inc.cls} provisional={inc.provisional} />
        {inc.critical && <span className="badge bad">CRITICAL</span>}
        <span className="grow" />
        <span className="badge neutral">rank #{inc.rank || '–'}</span>
        <span className={`badge ${inc.status === 'open' ? 'ok' : 'neutral'}`}>{inc.status}</span>
      </div>
      <p key={inc.cls + (inc.reclassifiedAt ?? '')} className={flash ? 'flash' : undefined} style={{ margin: '8px 0 8px', lineHeight: 1.4 }}>
        {inc.summary || 'Assessing…'}
      </p>
      <div className="row" style={{ gap: 14, fontSize: 12 }}>
        <span>
          <b className="num">{inc.alarmIds.length}</b> alarms grouped
        </span>
        <span>
          <b className="num">{inc.channels.length}</b> sources
        </span>
        <span>
          corroboration <b className="num">{inc.corroboration.toFixed(2)}</b>
        </span>
        <span className="grow" />
        <span className="row" style={{ gap: 6 }} title={`Mean trust ${inc.meanTrust.toFixed(2)}`}>
          trust
          <span className="bar" style={{ width: 64 }}>
            <i style={{ width: `${inc.meanTrust * 100}%`, background: inc.meanTrust >= 0.7 ? 'var(--ok)' : inc.meanTrust >= 0.4 ? 'var(--warn)' : 'var(--bad)' }} />
          </span>
        </span>
      </div>
    </button>
  );
});
