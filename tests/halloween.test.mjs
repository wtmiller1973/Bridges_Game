// Checks for Goldie's Halloween Adventure (halloween/), which is plain
// HTML/JS with no build step, so these guard the things a build would.
import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../halloween');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

function walk(dir) {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((d) => {
    const rel = path.posix.join(dir, d.name);
    return d.isDirectory() ? walk(rel) : [rel];
  });
}

const precache = [...read('sw.js').matchAll(/^\s+'([^']+)',$/gm)].map((m) => m[1]);
const jsFiles = walk('js');
const allJs = jsFiles.map(read).join('\n');

describe('offline cache', () => {
  it('lists every shipped file, and only files that exist', () => {
    const shipped = ['index.html', 'manifest.webmanifest', 'css', 'js', 'assets']
      .flatMap((p) => (fs.statSync(path.join(ROOT, p)).isDirectory() ? walk(p) : [p]))
      .filter((f) => !f.startsWith('assets/audio/voice/') && !/LICENSE|\.md$|\.gitkeep$/.test(f));
    const listed = precache.filter((p) => p !== './');
    expect(listed.sort()).toEqual(shipped.sort());
  });
});

describe('privacy', () => {
  it('never tracks the reference photos', () => {
    const tracked = execSync('git ls-files', { cwd: ROOT }).toString().split('\n');
    expect(tracked.filter((f) => /(^|\/)reference\//.test(f))).toEqual([]);
    expect(tracked.filter((f) => /\.(jpe?g|heic|webp)$/i.test(f))).toEqual([]);
  });
  it('makes no requests to other sites', () => {
    const shippedText = [read('index.html'), read('css/style.css'), allJs].join('\n');
    expect(shippedText).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
  });
});

describe('audio cues', () => {
  it('every cue the code uses is in the manifest, and every effect file exists', async () => {
    const { VOICE, SFX } = await import(path.join(ROOT, 'js/audio-cues.js'));
    const said = [...allJs.matchAll(/say\('([^']+)'\)/g)].map((m) => m[1])
      .concat([...allJs.matchAll(/cue: '([^']+)'/g)].map((m) => m[1]))
      .concat(['count-1', 'count-2', 'count-3', 'count-4', 'count-5', 'cheer-yay', 'cheer-great', 'cheer-did-it']);
    for (const name of said) expect(VOICE, name).toHaveProperty([name]);
    const effects = [...allJs.matchAll(/sfx\('([^']+)'/g)].map((m) => m[1]);
    for (const name of effects) expect(SFX).toContain(name);
    for (const name of SFX) expect(fs.existsSync(path.join(ROOT, `assets/audio/sfx/${name}.mp3`)), name).toBe(true);
  });
  it('the recording guide lists every voice cue', async () => {
    const { VOICE } = await import(path.join(ROOT, 'js/audio-cues.js'));
    const guide = read('AUDIO.md');
    for (const name of Object.keys(VOICE)) expect(guide, name).toContain(`\`${name}.mp3\``);
  });
});

describe('art', () => {
  it('every SVG the code asks for exists', () => {
    const names = [...allJs.matchAll(/'((?:characters|icons|scenes|costumes)\/[a-z0-9-]+)'/g)].map((m) => m[1]);
    const covers = [...allJs.matchAll(/COVERS = \[([^\]]+)\]/g)]
      .flatMap((m) => [...m[1].matchAll(/'([^']+)'/g)].map((c) => 'scenes/' + c[1]));
    const costumes = [...read('js/games/dressup.js').matchAll(/id: '([^']+)', slot/g)].map((m) => 'costumes/' + m[1]);
    for (const n of [...names, ...covers, ...costumes]) {
      expect(fs.existsSync(path.join(ROOT, 'assets', n + '.svg')), n).toBe(true);
    }
  });
});
