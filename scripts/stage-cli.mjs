#!/usr/bin/env node
/**
 * Puts the single keepplain file for this computer where the app's build takes it from (package.json, build.extraResources):
 * resources/bin/<mac|win|linux>-<arch>/keepplain[.exe].
 *
 * The file is the plugin's release named by `keepplainCli` in package.json: keepplain-<platform>-<arch>[.exe] from the
 * release keepplain--v<version> of keepplain/keepplain-plugin, checked against that release's SHA256SUMS, as install.sh
 * and `keepplain update` check it. A release can get new files under its tag (the plugin's release.yml), so SHA256SUMS is
 * read every time and a file kept from an earlier download (resources/cli) is used only while it still matches.
 *
 *   node scripts/stage-cli.mjs                             this computer's platform and arch
 *   KEEPPLAIN_CLI_FILE=<path> node scripts/stage-cli.mjs   that file instead (a CLI built from a plugin checkout, not released)
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPOSITORY = 'keepplain/keepplain-plugin';
const platform = process.platform;
const arch = process.env.KEEPPLAIN_ARCH || process.arch;
const version = JSON.parse(readFileSync(join(HERE, 'package.json'), 'utf8')).keepplainCli;
const asset = platform === 'win32' ? `keepplain-windows-${arch}.exe` : `keepplain-${platform}-${arch}`;

const fail = (message) => {
    console.error(message);
    process.exit(1);
};
const sha256 = (data) => createHash('sha256').update(data).digest('hex');

async function download(url) {
    const response = await fetch(url, { headers: { 'User-Agent': 'keepplain-desktop-build' } });
    if (!response.ok) fail(`GitHub answered ${response.status} for ${url}.`);

    return Buffer.from(await response.arrayBuffer());
}

/** The released file, downloaded once and checked against the release's SHA256SUMS each time. */
async function released() {
    if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) fail('package.json has no keepplainCli version (x.y.z): the keepplain release the app carries.');
    const base = `https://github.com/${REPOSITORY}/releases/download/keepplain--v${version}`;
    const sums = (await download(`${base}/SHA256SUMS`)).toString('utf8');
    const expected = sums.split('\n').map((l) => l.trim().split(/\s+\*?/)).find(([, name]) => name === asset)?.[0]?.toLowerCase();
    if (!expected) fail(`The SHA256SUMS of keepplain ${version} has no ${asset}.`);

    const file = join(HERE, 'resources', 'cli', `keepplain--v${version}`, asset);
    if (existsSync(file) && sha256(readFileSync(file)) === expected) return file;

    console.log(`Downloading keepplain ${version} (${asset})…`);
    const body = await download(`${base}/${asset}`);
    if (sha256(body) !== expected) fail(`The downloaded ${asset} does not match the SHA256SUMS of keepplain ${version}.`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(`${file}.part`, body);
    renameSync(`${file}.part`, file);

    return file;
}

const source = process.env.KEEPPLAIN_CLI_FILE ? resolve(process.env.KEEPPLAIN_CLI_FILE) : await released();
if (!existsSync(source)) fail(`No keepplain file at ${source}.`);

const os = { darwin: 'mac', win32: 'win' }[platform] ?? platform;
const dir = join(HERE, 'resources', 'bin', `${os}-${arch}`);
const name = platform === 'win32' ? 'keepplain.exe' : 'keepplain';
// The folder goes whole into the package: nothing but this file, not one left from an earlier name or build.
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
copyFileSync(source, join(dir, name));
if (platform !== 'win32') chmodSync(join(dir, name), 0o755);

// A file for this computer runs here: the released one must say the version the app is built with.
if (arch === process.arch) {
    const said = spawnSync(join(dir, name), ['version'], { encoding: 'utf8', timeout: 30_000, windowsHide: true }).stdout?.match(/keepplain (\d+\.\d+\.\d+)/)?.[1];
    if (!said) fail(`${join(dir, name)} does not run.`);
    if (!process.env.KEEPPLAIN_CLI_FILE && said !== version) fail(`${asset} of release ${version} says it is keepplain ${said}.`);
}
console.log(`Staged ${source} as ${join(dir, name)}`);
