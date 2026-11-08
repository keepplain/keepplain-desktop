// The Plan limits screen's HTML (app.js viewLimits): `keepplain limits status --json` and `limits fit --json`, shown
// as numbers and bars. Pure functions of their arguments; everything shown is escaped. Bars carry their length in
// data-grow (the window's CSP forbids inline styles; render() sets them).

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const PLANS = { pro: 'Pro', max_5x: 'Max 5x', max_20x: 'Max 20x', max: 'Max', ultra: 'Ultra', team: 'Team', enterprise: 'Enterprise' };
const KINDS = { input: 'Uncached input', write: 'Cache writes', read: 'Cache reads', output: 'Output' };
const MODELS = { fable: 'Fable', opus: 'Opus', sonnet: 'Sonnet', haiku: 'Haiku' };

export const money = (v) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : v >= 100 ? `$${Math.round(v).toLocaleString('en-US')}` : `$${v.toFixed(2)}`);
export const tokens = (v) => (!v ? '—' : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1e3)}K`);
const pct = (v) => (v === null || v === undefined ? '—' : `${Math.round(v * 100)}%`);

/** "in 3 h 20 min", "in 2 days": when a window resets, from its epoch seconds. */
export function resetsIn(seconds, now = Date.now()) {
    if (!Number.isFinite(seconds)) return '';
    const min = Math.max(0, Math.round((seconds * 1000 - now) / 60_000));
    if (min < 60) return `resets in ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 48) return `resets in ${h} h${min % 60 ? ` ${min % 60} min` : ''}`;

    return `resets in ${Math.round(h / 24)} days`;
}

/** The two windows now, from the last sample: [percent, resets_at]. */
export function nowHtml(status, now = Date.now()) {
    const one = (title, w) =>
        `<div class="lm-now"><div class="small muted">${title}</div>${
            w ? `<div class="lm-big">${esc(w[0])}%</div><div class="lm-meter"><span data-grow="${Math.min(100, Math.max(0, w[0]))}"></span><span data-grow="${Math.max(0, 100 - w[0])}"></span></div><div class="small faint">${esc(resetsIn(w[1], now))}</div>` : '<div class="lm-big faint">—</div>'
        }</div>`;

    return `<div class="lm-grid">${one('This week', status.week)}${one('Five hours', status.fiveHour)}</div>`;
}

/** A weight's bar on a track where 1.00 (counted as priced) is the middle and 2.00 the end. */
function weightRow(label, v) {
    const w = v.thin ? 0 : Math.min(2, Math.max(0.02, v.relative));

    return `<div class="lm-weight"><span>${esc(label)}</span><span class="lm-track${v.thin ? ' thin' : ''}"><span data-grow="${w.toFixed(3)}"></span><span data-grow="${(2 - w).toFixed(3)}"></span><i></i></span><span class="mono small">${v.thin ? '—' : v.relative.toFixed(2)} <span class="faint">${v.thin ? 'too little to tell' : `${pct(v.share)} of spend`}</span></span></div>`;
}

function partHtml(title, part, names) {
    if (!part) return '';
    const rows = Object.entries(names)
        .filter(([id]) => part.weights[id])
        .map(([id, label]) => weightRow(label, part.weights[id]));

    return `<div class="lm-part"><div class="small muted">${title} against list price · 1.00 = counted as priced</div>${rows.join('')}</div>`;
}

/** One window's fit (fit.mjs analyze): what a percent is worth, how well it fits, and the weights. */
export function windowHtml(title, w) {
    if (w?.absent) return `<div class="card"><h2>${title}</h2><p class="small muted m0">None: Claude Code got no such window for this account, so your plan has none now.</p></div>`;
    if (!w?.enough) {
        return `<div class="card"><h2>${title}</h2><p class="small muted m0">Not enough yet: ${esc(w?.intervals ?? 0)} step(s) of the size needed. It takes a few days of ordinary work in Claude Code.</p></div>`;
    }
    const stat = (label, value, sub = '') => `<div><div class="small muted">${label}</div><div class="lm-big">${value}</div>${sub ? `<div class="small faint">${sub}</div>` : ''}</div>`;

    return `<div class="card"><h2>${title}</h2>
        <div class="lm-grid four">
            ${stat('1% is worth', money(w.m0.dollarsPerPercent), `${money(w.m0.low)} to ${money(w.m0.high)}`)}
            ${stat('The whole window', money(w.m0.dollarsPerPercent * 100), 'at API list price')}
            ${stat('1% in tokens', tokens(w.tokensPerPercent), 'at your mix')}
            ${stat('Typical miss', pct(w.m0.error), `${esc(w.kept)} steps, ${esc(w.risen.toFixed(1))}%`)}
        </div>
        ${w.weightSteps && w.kept < w.weightSteps ? `<p class="small muted mt-s m0">Token kinds and models show from ${esc(w.weightSteps)} steps (${esc(w.kept)} so far): fewer fit noise.</p>` : ''}
        ${partHtml('Token kinds', w.kinds, KINDS)}
        ${partHtml('Models', w.families, MODELS)}
        <p class="small faint m0 mt-s">Left out: ${esc(w.outside ?? 0)} with no work on this computer (use elsewhere), ${esc(w.outliers ?? 0)} far off.${w.falls ? ` The percent fell ${esc(w.falls)} time(s) without a reset: the window may roll rather than reset.` : ''}</p>
    </div>`;
}

/** The sharing card: the switch, when it last went, and the two pages on the site. */
export function shareHtml(status, { site, signedIn, busy }) {
    const s = status.share ?? {};
    const when = s.sentAt ? `Last sent ${new Date(s.sentAt).toLocaleString()}.` : 'Nothing sent yet.';
    const mine = s.url ?? `${site}/limits/mine`;

    return `<div class="card">
        <div class="setting"><div class="grow"><strong>Send my numbers to KeepPlain once a day</strong>
            <div class="small muted">Only the fitted numbers, the plan and their dates go to your account, never a session. ${signedIn ? esc(when) : 'Sign in from Home first.'}${s.on && s.error ? ` The last try failed: ${esc(s.error)}` : ''}</div></div>
            <label class="switch"><input type="checkbox" aria-label="Send my numbers" data-action="limits-share" ${s.on ? 'checked' : ''} ${!signedIn || busy ? 'disabled' : ''}><span></span></label></div>
        <div class="row small mt-s"><button class="link" data-action="open" data-url="${esc(mine)}">Your page on ${esc(new URL(site).host)}</button><button class="link" data-action="open" data-url="${esc(`${site}/limits`)}">Everyone's medians by plan</button></div>
    </div>`;
}
