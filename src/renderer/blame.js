// The Blame screen's parts that need no window: the file's code with the gutter of sessions, as `keepplain blame --json`
// gives it (the plugin's lib/blame.mjs), the panel of one commit, and a small highlighter. The code is the person's own
// file and the names are the sessions', so everything is escaped.

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const NAMES = { 'claude-code': 'Claude Code', codex: 'Codex', cursor: 'Cursor', pi: 'Pi', antigravity: 'Antigravity' };
const UNCOMMITTED = '0'.repeat(40);

/** The class that gives an agent its colour (style.css, --ag-*): the five the app knows, any other, or none. */
export const agentClass = (agent) => (NAMES[agent] ? `ag-${agent}` : agent ? 'ag-other' : 'ag-none');

const KEYWORDS = 'import|from|export|default|const|let|var|async|function|fn|func|def|await|return|yield|if|else|elif|for|foreach|while|do|switch|match|case|break|continue|new|null|nil|None|true|false|True|False|class|interface|trait|enum|struct|type|extends|implements|public|private|protected|static|readonly|abstract|final|use|namespace|package|try|catch|finally|throw|throws|this|self|in|of|as|is|not|and|or';
const TOKENS = new RegExp(
    `(^\\s*(?:\\/\\/|#(?!\\[)|--|\\/\\*|\\*).*$|\\/\\/.*$)|("(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'|\`(?:[^\`\\\\]|\\\\.)*\`)|\\b(${KEYWORDS})\\b|\\b(\\d[\\d_.]*)\\b|([A-Za-z_$][\\w$]*)(?=\\()`,
    'g',
);

/**
 * One line of code as HTML: comments, strings, keywords, numbers and called names in spans (tok-c, tok-s, tok-k,
 * tok-n, tok-f), the rest escaped. A line at a time, so a comment or a string over several lines is plain after its
 * first; a line that starts a comment's own way (//, #, --, /*, a docblock's *) is a comment.
 */
export function highlight(line) {
    let out = '';
    let last = 0;
    for (const m of String(line).matchAll(TOKENS)) {
        out += esc(line.slice(last, m.index));
        const kind = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'k' : m[4] ? 'n' : 'f';
        out += `<span class="tok-${kind}">${esc(m[0])}</span>`;
        last = m.index + m[0].length;
    }

    return out + esc(String(line).slice(last));
}

const day = (iso) => (iso ? new Date(iso).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }) : '');

/** What the gutter says of a commit: in KeepPlain's mode the session (the CLI's words), in git's the author and day. */
function gutterOf(sha, commit, mode) {
    if (mode === 'git') {
        return { key: sha, cls: 'ag-none', mark: '', text: sha === UNCOMMITTED ? 'Not committed yet' : `${commit.author ?? '?'} · ${day(commit.author_time)}` };
    }
    const shown = commit.shown ?? { agent: null, mark: ' ', text: commit.short, more: 0 };
    const text = `${shown.text}${shown.more ? ` +${shown.more}` : ''}`;

    return { key: `${shown.agent}|${shown.mark}|${text}`, cls: agentClass(shown.agent), mark: shown.mark.trim(), text };
}

/**
 * The code with its gutter: the words on the first line of each run of one session's lines (of one commit's, in git's
 * mode), the agent's colour along the whole run. Each gutter opens its commit (data-action blame-open).
 */
export function codeHtml(data, { mode = 'sessions', open = null } = {}) {
    let previous = null;
    const rows = data.lines.map((line) => {
        const commit = data.commits[line.commit] ?? { short: line.commit.slice(0, 7) };
        const g = gutterOf(line.commit, commit, mode);
        const first = g.key !== previous;
        previous = g.key;
        const title = line.commit === UNCOMMITTED ? 'Not committed yet' : `${commit.short} ${commit.subject ?? ''}`;

        return `<div class="bl-row ${g.cls}${first ? ' first' : ''}${open === line.commit ? ' open' : ''}">`
            + `<button class="bl-gutter" data-action="blame-open" data-sha="${esc(line.commit)}" title="${esc(title)}">${first ? `<span class="bl-mark">${esc(g.mark)}</span><span class="bl-words">${esc(g.text)}</span>` : ''}</button>`
            + `<span class="bl-n">${line.n}</span><code class="bl-code">${highlight(line.text) || ' '}</code></div>`;
    });

    return `<div class="bl-code-view">${rows.join('')}</div>`;
}

/** The lines by agent as one bar (each part's share in data-grow, which app.js turns into its width) and a legend. */
export function summaryHtml(data) {
    const total = data.lines.length || 1;
    const label = (kind) => NAMES[kind] ?? ({ none: 'No session', uncommitted: 'Not committed', other: 'Other agents' })[kind] ?? kind;
    const parts = data.summary ?? [];

    return `<div class="bl-summary"><div class="bl-bar">${parts.map((p) => `<span class="${agentClass(['none', 'uncommitted'].includes(p.kind) ? null : p.kind)}${p.kind === 'uncommitted' ? ' dashed' : ''}" data-grow="${p.lines}" title="${esc(label(p.kind))}: ${p.lines}"></span>`).join('')}</div>`
        + `<div class="bl-legend">${parts.map((p) => `<span class="${agentClass(['none', 'uncommitted'].includes(p.kind) ? null : p.kind)}"><i></i>${esc(label(p.kind))} <span class="faint">${Math.round((p.lines / total) * 100)}%</span></span>`).join('')}</div></div>`;
}

/** How the site found a session behind the commit, said plainly. */
export function foundWords(s) {
    if (s.found_by === 'edits_before') return 'Its agent edited this file before the commit, which was made by hand.';
    if (s.own) return s.found_by === 'agent_session' ? 'Named by the commit, and its agent made the changes.' : 'Made this commit.';
    if (s.found_by === 'agent_session') return 'Named by the commit’s Agent-Session line.';
    if (s.found_by === 'team_commit') return 'Your team’s repository puts the commit to it.';

    return 'Saw this commit while it worked.';
}

const NONE = {
    not_found: ['No agent session found', 'Nothing names this commit and no session you can read edited the file before it: made by hand, or in a session that was never sent.'],
    not_sent: ['Session not sent', 'The commit names an agent session KeepPlain does not have, and it is not on this computer.'],
    not_asked: ['Not looked up', 'Only the newest 300 commits of a file are looked up.'],
    uncommitted: ['Not committed yet', 'These lines changed since the last commit.'],
    unknown: ['Sessions not looked up', 'Sign in, or check the connection, to see the sessions behind this commit.'],
};

/** The panel of one commit: what git says of it, and the sessions behind it with a way to each. */
export function panelHtml(sha, data) {
    const c = data.commits[sha];
    if (!c) return '';
    const lines = data.lines.filter((l) => l.commit === sha).length;
    const head = sha === UNCOMMITTED ? '<h2>Not committed yet</h2>'
        : `<p class="eyebrow">${esc(c.short)} · ${esc(day(c.committed_at ?? c.author_time))}</p><h2>${esc(c.subject || 'No title')}</h2><p class="small muted">${esc(c.author ?? '')} · ${lines} line${lines === 1 ? '' : 's'} here</p>`;
    const sessions = (c.sessions ?? []).map((s) => `<div class="bl-session ${agentClass(s.agent)}"><i></i><div class="grow">
            <div class="what">${esc(s.title || 'Untitled session')}</div><div class="small muted">${esc(NAMES[s.agent] ?? s.agent ?? 'Agent')} · ${esc(foundWords(s))}</div>
            ${s.url ? `<button class="link small" data-action="open" data-url="${esc(s.url)}">${/\?turn=/.test(s.url) ? 'Open the turn' : 'Open the session'}</button>` : ''}</div></div>`);
    const closed = (c.closed ?? []).map((s) => `<div class="bl-session ${agentClass(s.agent)}"><i></i><div class="grow">
            <div class="what">${esc(s.author ?? 'A teammate')}’s session${s.team ? ` in ${esc(s.team)}` : ''}</div><div class="small muted">${esc(NAMES[s.agent] ?? s.agent ?? 'Agent')} · its transcript is for the team’s owners and admins.</div>
            ${s.url ? `<button class="link small" data-action="open" data-url="${esc(s.url)}">Open its page</button>` : ''}</div></div>`);
    const local = c.local ? [`<div class="bl-session ${agentClass(c.local.agent)}"><i></i><div class="grow">
            <div class="what">${esc(c.local.title || c.local.first_prompt || 'A session on this computer')}</div>
            <div class="small muted">${esc(NAMES[c.local.agent] ?? c.local.agent)} · on this computer${c.local.sent === false ? ', not sent to KeepPlain' : ''}. Send it from Sessions to keep it with the commit.</div></div></div>`] : [];
    const found = [...sessions, ...closed, ...local];
    const none = !found.length ? NONE[c.none] ?? null : null;

    return `<aside class="bl-panel card">
        <div class="row"><div class="grow">${head}</div><button class="btn ghost icon" data-action="blame-close" title="Close">×</button></div>
        ${found.length ? `<p class="eyebrow group">${found.length === 1 ? 'Session' : `${found.length} sessions`}</p>${found.join('')}` : ''}
        ${none ? `<div class="bl-none"><strong>${esc(none[0])}</strong><p class="small muted">${esc(none[1])}</p></div>` : ''}
    </aside>`;
}

/** The sessions of the file, the most lines first, each with its link. */
export function sessionsHtml(data) {
    if (!data.sessions?.length) return '';
    const rows = data.sessions.map((s) => {
        const what = s.closed ? `${s.author ?? 'A teammate'}, private${s.team ? ` · ${s.team}` : ''}` : s.local ? `${s.title || s.first_prompt || s.id}` : s.title || 'Untitled session';
        const where = s.local ? (s.sent === false ? 'not sent' : 'on this computer') : '';

        return `<div class="bl-session ${agentClass(s.agent)}"><i></i><div class="grow"><div class="what">${esc(what)}</div>
            <div class="small muted">${esc(NAMES[s.agent] ?? s.agent ?? 'Agent')} · ${s.lines} line${s.lines === 1 ? '' : 's'}${where ? ` · ${where}` : ''}</div></div>
            ${s.url ? `<button class="btn ghost" data-action="open" data-url="${esc(s.url)}">Open</button>` : ''}</div>`;
    });

    return `<p class="eyebrow group">Sessions in this file</p><div class="list bl-sessions">${rows.join('')}</div>`;
}
