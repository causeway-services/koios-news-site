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
