// The Plan limits screen (src/renderer/limits.js), from what `keepplain limits status --json` and `limits fit --json` give.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { money, nowHtml, resetsIn, shareHtml, tokens, windowHtml } from '../src/renderer/limits.js';

const NOW = Date.parse('2026-11-08T12:00:00Z');

const fitted = {
    enough: true,
    kept: 14,
    risen: 15.3,
    outside: 2,
    outliers: 1,
    falls: 0,
    tokensPerPercent: 2_450_000,
    m0: { dollarsPerPercent: 11.84, low: 10.9, high: 12.7, error: 0.07 },
    kinds: {
        error: 0.05,
        weights: {
            read: { relative: 0.48, low: 0.4, high: 0.56, share: 0.62, thin: false },
            output: { relative: 1.02, low: 0.95, high: 1.1, share: 0.3, thin: false },
            input: { relative: 3.1, low: 0, high: 9, share: 0.002, thin: true },
        },
    },
    families: { error: 0.06, weights: { opus: { relative: 1, low: 0.9, high: 1.1, share: 0.7, thin: false }, '<fable>': { relative: 1, share: 1, thin: false } } },
};

test('numbers: dollars, tokens and when a window resets', () => {
    assert.equal(money(11.84), '$11.84');
    assert.equal(money(1184), '$1,184');
    assert.equal(money(null), '—');
    assert.equal(tokens(2_450_000), '2.5M');
    assert.equal(tokens(48_000), '48K');
    assert.equal(resetsIn(NOW / 1000 + 200 * 60, NOW), 'resets in 3 h 20 min');
    assert.equal(resetsIn(NOW / 1000 + 4 * 86400, NOW), 'resets in 4 days');
    assert.equal(resetsIn(null, NOW), '');
});

test('now: both windows with their bars, a dash for a window not seen', () => {
    const html = nowHtml({ week: [41.3, NOW / 1000 + 86400 * 2], fiveHour: null }, NOW);
    assert.match(html, /41\.3%/);
    assert.match(html, /data-grow="41\.3"/);
    assert.match(html, /resets in 2 days/);
    assert.match(html, /Five hours<\/div><div class="lm-big faint">—/);
});

test('a fitted window: what a percent is worth, the weights, thin ones marked, unknown names left out', () => {
    const html = windowHtml('Weekly window', fitted);
    assert.match(html, /\$11\.84/);
    assert.match(html, /\$1,184/);
    assert.match(html, /2\.5M/);
    assert.match(html, /Cache reads<\/span><span class="lm-track"><span data-grow="0\.480">/);
    assert.match(html, /lm-track thin"><span data-grow="0.000">/);
    assert.match(html, /too little to tell/);
    assert.match(html, /Opus/);
    assert.doesNotMatch(html, /<fable>/);
    assert.match(html, /Left out: 2 with no work on this computer/);
});

test('a fit of few steps gives no weights and says from how many steps they come', () => {
    const html = windowHtml('Weekly window', { ...fitted, kept: 4, weightSteps: 12, kinds: null, families: null });
    assert.match(html, /\$11\.84/);
    assert.match(html, /show from 12 steps \(4 so far\)/);
    assert.doesNotMatch(html, /Cache reads/);
});

test('a window without enough steps says so', () => {
    assert.match(windowHtml('Five-hour window', { enough: false, intervals: 2 }), /Not enough yet: 2 step\(s\)/);
    assert.match(windowHtml('Five-hour window', { enough: false, intervals: 0, absent: true }), /None: Claude Code got no such window/);
});

test('sharing: the switch, its state and the two pages; off without a sign-in', () => {
    const on = shareHtml({ share: { on: true, sentAt: NOW, url: 'https://keepplain.com/limits/mine', error: null } }, { site: 'https://keepplain.com', signedIn: true, busy: false });
    assert.match(on, /data-action="limits-share" checked/);
    assert.match(on, /data-url="https:\/\/keepplain\.com\/limits\/mine"/);
    assert.match(on, /data-url="https:\/\/keepplain\.com\/limits"/);
    const out = shareHtml({ share: { on: false } }, { site: 'https://keepplain.com', signedIn: false, busy: false });
    assert.match(out, /Sign in from Home first/);
    assert.match(out, /data-action="limits-share"  disabled/);
    const failed = shareHtml({ share: { on: true, error: '<b>offline</b>' } }, { site: 'https://keepplain.com', signedIn: true, busy: false });
    assert.match(failed, /&lt;b&gt;offline/);
});
