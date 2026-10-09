import { DEFAULT_SPECS, SPEC_DEFS, type SpecDef, type SpecKey, type Specs } from '../sim/specs';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function control(d: SpecDef, v: number | boolean | string): string {
  if (d.kind === 'bool') return `<input type="checkbox" data-spec="${d.key}" ${v ? 'checked' : ''} aria-label="${esc(d.label)}">`;
  if (d.kind === 'select') return `<select data-spec="${d.key}" aria-label="${esc(d.label)}">${d.options!.map((o) => `<option value="${o.value}" ${o.value === v ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
  return `<input type="range" data-spec="${d.key}" min="${d.min}" max="${d.max}" step="${d.step}" value="${v}" aria-label="${esc(d.label)}"><span class="val" data-val="${d.key}"></span>`;
}

export function buildSpecLab(root: HTMLElement, specs: Specs, onChange: () => void) {
  const groups = [...new Set(SPEC_DEFS.map((d) => d.group))];
  root.innerHTML = `<div class="card"><h3>Spec Lab</h3><div class="small muted">These are the requirements the controller is built from. Change them while the game runs and watch the consequences in the scene, the violations list and the debrief. <span class="badge">GAP</span> marks something the course decks left open, with our default.</div>
    <div class="actions"><button data-spec-reset-all>Reset all to defaults</button></div></div>` +
    groups.map((gname) => `<h3>${gname}</h3>` + SPEC_DEFS.filter((d) => d.group === gname).map((d) => `
      <div class="spec" data-def="${d.key}">
        <div class="row"><span class="name">${esc(d.label)}${d.gap ? '<span class="badge">GAP</span>' : ''}<span class="badge mod" data-mod="${d.key}" hidden>changed</span></div>
        <div class="row">${control(d, specs[d.key])}<button data-spec-reset="${d.key}" title="Reset to default" aria-label="Reset ${esc(d.label)}">↺</button></div>
        <details><summary>Why it matters · ${esc(d.source)}</summary><div class="small">${esc(d.help)} <span class="muted">Default: ${d.kind === 'bool' ? (DEFAULT_SPECS[d.key] ? 'on' : 'off') : DEFAULT_SPECS[d.key]}${d.unit ? ' ' + d.unit : ''}.</span></div></details>
      </div>`).join('')).join('');
  const refresh = () => {
    for (const d of SPEC_DEFS) {
      const v = specs[d.key];
      const val = root.querySelector<HTMLElement>(`[data-val="${d.key}"]`);
      if (val) val.textContent = `${v}${d.unit ? ' ' + d.unit : ''}`;
      const mod = root.querySelector<HTMLElement>(`[data-mod="${d.key}"]`);
      if (mod) mod.hidden = v === DEFAULT_SPECS[d.key];
      const ctl = root.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-spec="${d.key}"]`);
      if (ctl) { if (d.kind === 'bool') (ctl as HTMLInputElement).checked = !!v; else ctl.value = String(v); }
    }
  };
  const set = <K extends SpecKey>(k: K, v: Specs[K]) => { specs[k] = v; refresh(); onChange(); };
  root.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    const key = el.dataset.spec as SpecKey | undefined;
    if (!key) return;
    const d = SPEC_DEFS.find((x) => x.key === key)!;
    if (d.kind === 'bool') set(key, el.checked as never);
    else if (d.kind === 'select') set(key, el.value as never);
    else set(key, parseFloat(el.value) as never);
  });
  root.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest('button');
    if (!el) return;
    if (el.hasAttribute('data-spec-reset-all')) { Object.assign(specs, DEFAULT_SPECS); refresh(); onChange(); }
    const k = el.getAttribute('data-spec-reset') as SpecKey | null;
    if (k) set(k, DEFAULT_SPECS[k] as never);
  });
  refresh();
  return refresh;
}

/** Share-link encoding: only specs that differ from the defaults. */
export function encodeSpecs(specs: Specs): string {
  const diff: Record<string, unknown> = {};
  for (const k of Object.keys(DEFAULT_SPECS) as SpecKey[]) if (specs[k] !== DEFAULT_SPECS[k]) diff[k] = specs[k];
  return btoa(JSON.stringify(diff));
}

export function decodeSpecs(text: string | null | undefined): Partial<Specs> {
  if (!text) return {};
  try {
    const raw = JSON.parse(atob(text)) as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const d of SPEC_DEFS) {
      const v = raw[d.key];
      if (v === undefined) continue;
      if (d.kind === 'bool' && typeof v === 'boolean') out[d.key] = v;
      else if (d.kind === 'select' && d.options!.some((o) => o.value === v)) out[d.key] = v;
      else if (d.kind === 'number' && typeof v === 'number' && isFinite(v)) out[d.key] = Math.min(d.max!, Math.max(d.min!, v));
    }
    return out as Partial<Specs>;
  } catch { return {}; }
}
