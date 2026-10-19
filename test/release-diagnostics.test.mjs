import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, statSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { commandFailure } from '../src/release-diagnostics.mjs';
import { observeRelease } from '../src/release-observation.mjs';

test('failed publication retains full redacted OTLP evidence and remains unreconciled', async t => {
  const root = mkdtempSync(join(tmpdir(), 'koios-release-diagnostics-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const token = 'provider-secret-not-for-logs';
  const detail = 'x'.repeat(2000) + ' EROFS /gnu/store/release/.wrangler/tmp';
  const error = commandFailure({ phase: 'preview', receiptOut: join(root, 'preview.json'),
    environment: { CLOUDFLARE_API_TOKEN: token },
    result: { status: 1, signal: null, stdout: '', stderr: detail + ' Bearer ' + token,
      error: Object.assign(new Error('read-only filesystem'), { code: 'EROFS' }) },
    attributes: { 'koios.release.authority_use.path': '/authority/exact-consumption' } });
  const bytes = readFileSync(error.diagnosticPath, 'utf8');
  assert.equal(bytes.includes(token), false);
  assert.equal(bytes.includes(detail), true);
  assert.equal(statSync(error.diagnosticPath).mode & 0o777, 0o600);
  const logs = JSON.parse(bytes), record = logs.resourceLogs[0].scopeLogs[0].logRecords[0];
  assert.equal(record.severityNumber, 17);
  assert.equal(record.eventName, 'koios.website.release.failure');
  const keys=record.attributes.map(a=>a.key);
  for(const key of ['semioverse.channel.id','semioverse.message.id','semioverse.packet.id'])assert.equal(keys.includes(key),true);
  assert.equal('traceId' in record, false);
  assert.equal('timeUnixNano' in record, false);
  assert.match(record.observedTimeUnixNano, /^\d+$/);
  const events = [];let attempts = 0;
  await assert.rejects(observeRelease(async ({stage}) => stage('preview-deploy-verify', () => {
    attempts++;throw error;
  }), {emit: event => events.push(event), diagnose: e => e.diagnosticPath}), e => e === error);
  assert.equal(attempts, 1);
  assert.equal(events.at(-1).effects.preview, 'attempted-unreconciled');
  assert.equal(events.some(e => e.diagnosticPath === error.diagnosticPath), true);
});

test('ordinary release progress uses the shared channel, message and packet representation',async()=>{
 const emitted=[],prior=console.error;console.error=line=>emitted.push(JSON.parse(line));
 try{await observeRelease(async({stage})=>stage('candidate-read',()=>({read:true})));}
 finally{console.error=prior;}
 assert.equal(emitted.length,3);
 const records=emitted.flatMap(request=>request.resourceLogs.flatMap(resource=>resource.scopeLogs.flatMap(scope=>scope.logRecords)));
 assert.equal(records.length,3);
 const attributes=records.map(record=>Object.fromEntries(record.attributes.map(a=>[a.key,a.value.stringValue])));
 assert.equal(new Set(attributes.map(a=>a['semioverse.channel.id'])).size,1);
 assert.equal(new Set(attributes.map(a=>a['semioverse.message.id'])).size,3);
 assert.equal(records.every(record=>record.eventName==='koios.website.release.phase'),true);
 assert.equal(records.some(record=>'traceId' in record),false);
});
