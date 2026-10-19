import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {buildConfiguredProperty} from '../scripts/build-property.mjs';
import {stagedArtifacts} from '../src/build.mjs';

const cli=fileURLToPath(new URL('../scripts/build-property.mjs', import.meta.url));
const property=fileURLToPath(new URL('./fixtures/property.json', import.meta.url));
const instant='2026-07-20T00:00:00.000Z';
function run(args) {return spawnSync(process.execPath, [cli, ...args], {encoding:'utf8'});}
function configuredProperty(root) {
  const value=JSON.parse(readFileSync(property,'utf8'));
  value.content={...value.content,root:fileURLToPath(new URL('./fixtures/content',import.meta.url))};
  const path=join(root,'property.json');writeFileSync(path,JSON.stringify(value));return path;
}

test('the original two-argument build invocation remains supported',()=>{
  const root=mkdtempSync(join(tmpdir(),'koios-build-cli-'));
  try {
    const result=run([configuredProperty(root),join(root,'public')]);
    assert.equal(result.status,0,result.stderr);
    assert.ok(JSON.parse(result.stdout).publishedPostCount>0);
    const index=readFileSync(join(root,"public","index.html"),"utf8");
    assert.match(index,/data-property="koios-news"/u,"ad slot uses the campaign catalog property key");
  } finally {rmSync(root,{recursive:true,force:true});}
});

test('the explicit build instant reaches the unchanged renderer byte-for-byte',()=>{
  const root=mkdtempSync(join(tmpdir(),'koios-build-cli-'));
  try {
    const output=join(root,'public'),expected=join(root,'expected'),config=configuredProperty(root);
    const result=run([config,output,'--as-of',instant]);
    assert.equal(result.status,0,result.stderr);
    buildConfiguredProperty(config,expected,{asOf:new Date(instant)});
    const files=stagedArtifacts(expected).map(x=>x.file);
    assert.deepEqual(stagedArtifacts(output).map(x=>x.file),files);
    for(const file of files) assert.ok(readFileSync(join(output,file)).equals(readFileSync(join(expected,file))),file);
  } finally {rmSync(root,{recursive:true,force:true});}
});

test('missing, repeated, unknown and malformed time options are rejected before building',()=>{
  const root=mkdtempSync(join(tmpdir(),'koios-build-cli-'));
  try {
    for(const flags of [
      ['--as-of'],['--as-of',instant,'--as-of',instant],['--unknown',instant],
      ['--as-of','2026-02-30T00:00:00.000Z'],['--as-of','2026-13-01T00:00:00.000Z'],
      ['--as-of','2026-07-20T24:00:00.000Z'],['--as-of','2026-07-20T00:00:00Z'],
      ['--as-of','2026-07-20T00:00:00.000+00:00'],['--as-of','not-a-date'],
    ]) {
      const result=run([property,join(root,'public'),...flags]);
      assert.equal(result.status,1,JSON.stringify(flags));
      assert.match(result.stderr,/usage:|--as-of/);
    }
  } finally {rmSync(root,{recursive:true,force:true});}
});
