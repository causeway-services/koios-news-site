import { writeFileSync } from 'node:fs';
import { otlpLogRecord, otlpLogs } from '@red-cup-engineering/signcell/observability';

// Disclosure is decided at this provider boundary. SignCell owns the format;
// the retained failure is evidence, never a deployment receipt or retry grant.
export function redactReleaseText(value, environment = process.env) {
  let text = String(value ?? '');
  const secrets = Object.entries(environment).filter(([key, value]) =>
    typeof value === 'string' && value.length && /TOKEN|SECRET|PASSWORD|API_KEY|PRIVATE_KEY/iu.test(key))
    .map(([, value]) => value).sort((a, b) => b.length - a.length);
  for (const secret of secrets) text = text.split(secret).join('[REDACTED]');
  return text.replace(/Bearer\s+[^\s"']+/giu, 'Bearer [REDACTED]')
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/giu, '$1[REDACTED]@');
}
function errorData(error, environment, seen = new Set()) {
  if (error === null || typeof error !== 'object') return { message: redactReleaseText(error, environment) };
  if (seen.has(error)) return { message: '[circular cause]' };
  seen.add(error);
  const data = {};
  for (const key of ['name', 'message', 'stack', 'code', 'errno', 'syscall', 'path']) {
    try { if (error[key] !== undefined) data[key] = redactReleaseText(error[key], environment); } catch {}
  }
  try { if (error.cause !== undefined) data.cause = errorData(error.cause, environment, seen); } catch {}
  return data;
}
export function retainReleaseFailure({ error, phase, receiptOut, environment = process.env,
  result, attributes = {}, observedAt = new Date().toISOString() }) {
  const diagnosticPath = `${receiptOut}.failure.otlp.json`;
  const exception = errorData(error, environment);
  const body = { phase, exception, ...(result === undefined ? {} : {
    command: { ...(result?.status == null ? {} : { status: result.status }),
      ...(result?.signal == null ? {} : { signal: result.signal }),
      ...(result?.stdout == null ? {} : { stdout: redactReleaseText(result.stdout, environment) }),
      ...(result?.stderr == null ? {} : { stderr: redactReleaseText(result.stderr, environment) }),
      ...(result?.error === undefined ? {} : { error: errorData(result.error, environment) }) },
  }) };
  const record = otlpLogRecord({ observedAt, severityNumber: 17, severityText: 'ERROR',
    eventName: 'koios.website.release.failure', body, attributes: {
      'error.type': exception.code ?? exception.name ?? 'Error',
      'exception.type': exception.name ?? 'Error',
      ...(exception.message === undefined ? {} : { 'exception.message': exception.message }),
      ...(exception.stack === undefined ? {} : { 'exception.stacktrace': exception.stack }),
      'koios.release.phase': phase, ...attributes,
    } });
  const logs = otlpLogs({ serviceName: 'koios.news.website', scopeName: '@causeway-services/koios-news-site/release', records: [record] });
  writeFileSync(diagnosticPath, JSON.stringify(logs, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return diagnosticPath;
}
export function commandFailure({ result, phase, receiptOut, environment, attributes }) {
  const error = new Error(`Cloudflare command failed during ${phase}; deployment remains unreconciled (status=${result?.status ?? 'unknown'}).`);
  error.code = result?.error?.code ?? 'CLOUDFLARE_COMMAND_FAILED';
  if (result?.error) error.cause = result.error;
  try { error.diagnosticPath = retainReleaseFailure({ error, result, phase, receiptOut, environment, attributes }); }
  catch (diagnosticError) { error.diagnosticFailure = redactReleaseText(diagnosticError.message, environment); }
  return error;
}
