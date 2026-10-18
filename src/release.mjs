import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {auditProduction,planSelfAuthorized,executeObservedAuthorized,acceptPreviewProbe,observeProductionVersion,verifyBinding,TARGET,WRANGLER,runPinnedWrangler} from './carrier.mjs';
import {observeRelease,readPublicBaseline} from './release-observation.mjs';

/** Publish this website's immutable build through its existing preview and
 * rollback controls. The newsroom supplies inputs; the website owns delivery. */
export async function releaseWebsite({candidateDir,receipts,revision=process.env.GITHUB_SHA}) {
 candidateDir=resolve(candidateDir);receipts=resolve(receipts);
 mkdirSync(receipts,{recursive:true});
 const bindingPath=fileURLToPath(new URL('../release/koios-news-primary-binding.json',import.meta.url));
 return observeRelease(async({stage,bindCandidate,deferCleanup})=>{
  const prior=await stage('baseline-read',async()=>{
   const bytes=await readPublicBaseline();writeFileSync(join(receipts,'baseline.json'),bytes);return bytes;
  });
  const manifest=await stage('candidate-read',()=>readFileSync(join(candidateDir,'manifest.json')));
  const manifestSha256=createHash('sha256').update(manifest).digest('hex');
  bindCandidate(manifestSha256);
  if(manifest.equals(prior)){
   const audit=await stage('already-live-audit',()=>auditProduction({candidateDir,bindingPath,receiptOut:join(receipts,'already-live-audit.json')}));
   return {commit:revision,manifestSha256:audit.candidateManifestSha256,publiclyVerified:true,alreadyLive:true,receipt:audit.receiptPath};
  }
  const preview=await stage('preview-plan',()=>{
   const before=JSON.parse(prior),after=JSON.parse(manifest);
   const routes=new Set(after.artifacts.map(row=>row.file));
   for(const row of before.artifacts)if(/^posts\/[^/]+\/index.html$/.test(row.file)&&!routes.has(row.file))throw new Error(`release would lose public article ${row.file}`);
   return planSelfAuthorized({phase:'preview',candidateDir,bindingPath});
  });
  const worker=`${TARGET.workerName}-preview-${preview.candidate.manifestSha256.slice(0,12)}`;
  const previewUrl=`https://${worker}.561-group.workers.dev/`;
  deferCleanup(()=>{
   const result=runPinnedWrangler(WRANGLER,['delete','--name',worker,'--force']);
   if(result.status!==0&&!/not found|does not exist|10007|10090/i.test(`${result.stdout}\n${result.stderr}`))throw new Error('preview cleanup failed');
  });
  await stage('preview-deploy-verify',()=>executeObservedAuthorized({phase:'preview',plan:preview,receiptOut:join(receipts,'preview.json'),replayRoot:join(receipts,'authority'),url:previewUrl}));
  await stage('preview-probe',()=>acceptPreviewProbe({candidateDir,bindingPath,url:previewUrl,receiptOut:join(receipts,'probe.json')}));
  await stage('rollback-binding',()=>writeFileSync(join(receipts,'rollback.json'),JSON.stringify({kind:'koios.news.cloudflare-rollback-binding/v1',...TARGET,bindingSha256:verifyBinding(bindingPath).digest,priorVersionId:observeProductionVersion({}).versionId})));
  const release=await stage('release-plan',()=>planSelfAuthorized({phase:'release',candidateDir,bindingPath,rollbackPath:join(receipts,'rollback.json'),previewReceiptPath:join(receipts,'probe.json'),productionBaselinePath:join(receipts,'baseline.json')}));
  await stage('production-deploy-verify',()=>executeObservedAuthorized({phase:'release',plan:release,receiptOut:join(receipts,'release.json'),replayRoot:join(receipts,'authority'),url:'https://koios.news/'}));
  return {commit:revision,manifestSha256,publiclyVerified:true};
 },{revision});
}
