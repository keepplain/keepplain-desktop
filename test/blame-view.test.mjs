// The Blame screen's code and panel (src/renderer/blame.js), from what `keepplain blame --json` gives.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { agentClass, codeHtml, highlight, panelHtml, sessionsHtml, summaryHtml } from '../src/renderer/blame.js';

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const C = 'c'.repeat(40);
const NONE = '0'.repeat(40);

const data = {
    file: 'src/billing/webhook.ts', rev: 'HEAD', status: 'ok',
    lines: [
        { n: 1, commit: A, text: "import { verify } from './signature';" },
        { n: 2, commit: A, text: 'const TOLERANCE = 300; // seconds' },
        { n: 3, commit: B, text: 'const x = "<script>alert(1)</script>";' },
        { n: 4, commit: C, text: 'export {};' },
        { n: 5, commit: NONE, text: '' },
    ],
    commits: {
        [A]: { short: 'aaaaaaa', subject: 'Harden the webhook', author: 'Olga', author_time: '2026-10-12T10:00:00Z', committed_at: '2026-10-12T10:00:00Z',
            sessions: [{ id: 's1', agent: 'claude-code', title: 'Harden <the> webhook', url: 'https://keepplain.com/b/harden?turn=4', own: true, found_by: 'commit' }],
            closed: [], none: null, local: null, shown: { agent: 'claude-code', mark: '●', text: 'Claude Code · Harden <the> webhook', more: 0 } },
        [B]: { short: 'bbbbbbb', subject: 'Mark paid', author: 'Maya', author_time: '2026-10-13T10:00:00Z', sessions: [],
            closed: [{ agent: 'codex', author: 'maya', team: 'acme', url: 'https://keepplain.com/b/paid', found_by: 'commit' }], none: null, local: null,
            shown: { agent: 'codex', mark: '●', text: 'Codex · maya, private', more: 0 } },
        [C]: { short: 'ccccccc', subject: 'Export', author: 'Olga', author_time: '2026-10-01T10:00:00Z', sessions: [], closed: [], none: 'not_found', local: null,
            shown: { agent: null, mark: ' ', text: 'no session found', more: 0 } },
        [NONE]: { short: '0000000', subject: null, author: 'Not Committed Yet', sessions: [], closed: [], none: 'uncommitted', local: null,
            shown: { agent: null, mark: ' ', text: 'not committed yet', more: 0 } },
    },
    summary: [{ kind: 'claude-code', lines: 2 }, { kind: 'codex', lines: 1 }, { kind: 'none', lines: 1 }, { kind: 'uncommitted', lines: 1 }],
    sessions: [{ key: 's1', agent: 'claude-code', title: 'Harden <the> webhook', url: 'https://keepplain.com/b/harden?turn=4', lines: 2, closed: false, local: false }],
};

test('a line of code: its comments, strings, keywords, numbers and calls marked, the rest escaped', () => {
    assert.equal(highlight('const n = parse("a<b") + 42; // why'),
        '<span class="tok-k">const</span> n = <span class="tok-f">parse</span>(<span class="tok-s">&quot;a&lt;b&quot;</span>) + <span class="tok-n">42</span>; <span class="tok-c">// why</span>');
    assert.equal(highlight('  * @param  string  $x'), '<span class="tok-c">  * @param  string  $x</span>');
    assert.equal(highlight('#[Attribute] class A'), '#[Attribute] <span class="tok-k">class</span> A');
    assert.equal(highlight('<div>&</div>'), '&lt;div&gt;&amp;&lt;/div&gt;');
});

test('the gutter names a session once a block, in its colour, and opens its commit', () => {
    const html = codeHtml(data);
    const rows = html.match(/<div class="bl-row[^"]*"/g);
    assert.deepEqual(rows, ['<div class="bl-row ag-claude-code first"', '<div class="bl-row ag-claude-code"', '<div class="bl-row ag-codex first"', '<div class="bl-row ag-none first"', '<div class="bl-row ag-none first"']);
    assert.equal((html.match(/Claude Code · Harden &lt;the&gt; webhook/g) ?? []).length, 1);
    assert.ok(!html.includes('<script>'), 'the code is escaped');
    assert.match(html, /data-action="blame-open" data-sha="b{40}"/);
    // git's own gutter: the author and the day.
    const git = codeHtml(data, { mode: 'git', open: B });
    assert.match(git, /Maya · /);
    assert.match(git, /<div class="bl-row ag-none first open"/);
});

test('the panel of a commit: its sessions with a way to each, or why there is none', () => {
    const made = panelHtml(A, data);
    assert.match(made, /Harden &lt;the&gt; webhook/);
    assert.match(made, /Made this commit\./);
    assert.match(made, /data-url="https:\/\/keepplain\.com\/b\/harden\?turn=4">Open the turn/);
    assert.match(panelHtml(B, data), /maya’s session in acme/);
    assert.match(panelHtml(C, data), /No agent session found/);
    assert.match(panelHtml(NONE, data), /Not committed yet/);
    assert.equal(panelHtml('f'.repeat(40), data), '');
});

test('the lines by agent and the sessions of the file', () => {
    const bar = summaryHtml(data);
    assert.match(bar, /class="ag-claude-code" data-grow="2"/);
    assert.match(bar, /class="ag-none dashed" data-grow="1"/);
    assert.match(bar, /Claude Code <span class="faint">40%<\/span>/);
    assert.match(sessionsHtml(data), /Claude Code · 2 lines/);
    assert.equal(sessionsHtml({ ...data, sessions: [] }), '');
    assert.deepEqual(['claude-code', 'hermes', null].map(agentClass), ['ag-claude-code', 'ag-other', 'ag-none']);
});
