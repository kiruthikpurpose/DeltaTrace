import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { DEFAULT_CONFIG, cloneConfig, type Config } from '../engine';
import { PageHeader } from '../components/shell/PageHeader';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Segmented } from '../components/ui/Segmented';
import { Slider } from '../components/ui/Slider';
import { runner } from '../state/runner';
import { clearAll } from '../state/persist';
import { useConfigStore } from '../state/configStore';
import { useLogStore } from '../state/logStore';
import { useUiStore } from '../state/uiStore';
import { toast } from '../state/toastStore';

type NumKey = Exclude<{ [K in keyof Config]: Config[K] extends number ? K : never }[keyof Config], never>;

function Field({ k, label, min, max, step, unit, draft, setDraft, fixed }: { k: NumKey; label: string; min: number; max: number; step: number; unit?: string; draft: Config; setDraft: (c: Config) => void; fixed?: boolean }) {
  const changed = draft[k] !== DEFAULT_CONFIG[k];
  return (
    <div className="setting-field">
      <Slider label={label} value={draft[k] as number} min={min} max={max} step={step} unit={unit} onChange={(v) => !fixed && setDraft({ ...draft, [k]: v })} />
      <button className="btn ghost sm" disabled={!changed} onClick={() => setDraft({ ...draft, [k]: DEFAULT_CONFIG[k] })} aria-label={`Restore default for ${label}`} title={`Default ${DEFAULT_CONFIG[k]}`}>
        <RotateCcw size={13} />
      </button>
    </div>
  );
}

export default function Settings() {
  const live = useConfigStore((s) => s.cfg);
  const [draft, setDraft] = useState<Config>(() => cloneConfig(live));
  const [confirm, setConfirm] = useState(false);
  const [wipe, setWipe] = useState(false);
  const theme = useUiStore((s) => s.theme);
  const seed = useConfigStore((s) => s.seed);
  const dirty = JSON.stringify({ ...draft, engineEnabled: 0 }) !== JSON.stringify({ ...live, engineEnabled: 0 });
  const apply = () => {
    const { alarms, engineEnabled, groupingMode, trustGating, clockSkew, ...rest } = draft;
    void alarms; void engineEnabled; void groupingMode; void trustGating; void clockSkew;
    runner.setConfig({ ...rest });
    setConfirm(false);
    toast('Settings applied to the live engine', 'ok');
  };
  const props = { draft, setDraft };
  return (
    <div className="page">
      <PageHeader title="Settings" purpose="Engine parameters. Changes apply to the live engine after you confirm; every field has a default to return to." info={['Wave speed and clock tolerance set the delay window: delay = distance ÷ wave speed + tolerance + scan interval.', 'Trust weights λ control how strongly each check lowers a sensor’s trust.', 'Demotion needs trust below the limit AND corroboration below the limit AND a non-critical alarm.']} actions={<><button className="btn" onClick={() => setDraft(cloneConfig(DEFAULT_CONFIG))}><RotateCcw size={14} /> Reset all settings</button><button className="btn primary" disabled={!dirty} onClick={() => setConfirm(true)}>Apply to live engine…</button></>} />
      <div className="settings-grid">
        <Card title="Pressure wave & grouping" accent="group">
          <div className="stack">
            <Field k="waveSpeed" label="Wave speed c" min={400} max={1200} step={10} unit=" m/s" {...props} />
            <Field k="clockTol" label="Clock tolerance" min={0} max={5} step={0.5} unit=" s" {...props} />
            <Field k="scanInterval" label="Scan interval (fixed)" min={5} max={5} step={1} unit=" s" fixed {...props} />
            <Field k="hopLimit" label="Hop limit H" min={1} max={6} step={1} {...props} />
            <Field k="incidentQuiet" label="Incident closes after quiet" min={30} max={300} step={10} unit=" s" {...props} />
            <Field k="fixedWindow" label="Fixed window (comparison mode)" min={10} max={180} step={5} unit=" s" {...props} />
            <Field k="advisoryRetention" label="Advisory retention" min={600} max={7200} step={300} unit=" s" {...props} />
          </div>
        </Card>
        <Card title="Trust engine" accent="trust">
          <div className="stack">
            <Field k="lambdaR" label="λ neighbour residual (z²)" min={0} max={0.5} step={0.01} {...props} />
            <Field k="lambdaS" label="λ signal behaviour (S)" min={0} max={2} step={0.1} {...props} />
            <Field k="lambdaC" label="λ communication (C)" min={0} max={2} step={0.1} {...props} />
            <Field k="lambdaM" label="λ mass balance (M)" min={0} max={2} step={0.1} {...props} />
            <Field k="goodThreshold" label="GOOD at or above" min={0.5} max={0.95} step={0.01} {...props} />
            <Field k="badThreshold" label="BAD below" min={0.1} max={0.6} step={0.01} {...props} />
            <Field k="tMin" label="Tuner gate Tmin" min={0.3} max={0.9} step={0.05} {...props} />
          </div>
        </Card>
        <Card title="Classification & demotion" accent="tune">
          <div className="stack">
            <Field k="corrProcess" label="Process event: corroboration ≥" min={0.3} max={0.95} step={0.05} {...props} />
            <Field k="corrFault" label="Instrument fault: corroboration <" min={0.05} max={0.5} step={0.05} {...props} />
            <Field k="demoteTrust" label="Demote only if trust <" min={0.1} max={0.6} step={0.05} {...props} />
            <Field k="demoteCorr" label="…and corroboration <" min={0.05} max={0.5} step={0.05} {...props} />
          </div>
        </Card>
        <Card title="Application">
          <div className="stack">
            <div className="field">
              <span className="lbl">Theme</span>
              <Segmented label="Theme" value={theme} onChange={(v) => useUiStore.getState().setTheme(v)} options={[{ id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }]} />
            </div>
            <div className="field">
              <label htmlFor="seed">Random seed</label>
              <div className="row">
                <input id="seed" className="input" type="number" defaultValue={seed} onBlur={(e) => runner.reset(Number(e.target.value) || 1)} aria-label="Seed (applies on blur and resets)" />
                <span className="muted">Resets the simulation when changed.</span>
              </div>
            </div>
            <div className="hr" />
            <button className="btn danger" onClick={() => setWipe(true)}>Clear saved data…</button>
            <p className="muted" style={{ fontSize: 12 }}>Saved data lives only in this browser (localStorage, namespaced <code>deltatrace.v1.*</code>): theme, sidebar, config, change log, dispositions. The app works fully if storage is unavailable.</p>
          </div>
        </Card>
      </div>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Apply settings to the live engine?" footer={<><button className="btn" onClick={() => setConfirm(false)}>Cancel</button><button className="btn primary" onClick={apply}>Apply</button></>}>
        <p>The running simulation continues with the new parameters immediately. Previously raised alarms and incidents are not rewritten.</p>
      </Modal>
      <Modal open={wipe} onClose={() => setWipe(false)} title="Clear all saved data?" footer={<><button className="btn" onClick={() => setWipe(false)}>Cancel</button><button className="btn danger" onClick={() => { clearAll(); useLogStore.getState().clear(); useConfigStore.getState().reset(); setDraft(cloneConfig(DEFAULT_CONFIG)); runner.reset(); setWipe(false); toast('Saved data cleared', 'ok'); }}>Clear and reset</button></>}>
        <p>This removes the saved config, change log, dispositions and preferences from this browser and resets the simulation.</p>
      </Modal>
    </div>
  );
}
