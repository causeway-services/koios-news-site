// Fixed, value-free release progress. This observer cannot authorize or retry an effect.
const PHASES=new Set(['baseline-read','candidate-read','already-live-audit','preview-plan',
 'preview-deploy-verify','preview-probe','rollback-binding','release-plan',
 'production-deploy-verify','preview-cleanup']);
const EFFECTS={
 'preview-deploy-verify':['preview','koios.news.cloudflare-preview-deployment-receipt/v1'],
 'production-deploy-verify':['production','koios.news.cloudflare-release-receipt/v1'],
};
const identity=(value,pattern)=>typeof value==='string'&&!/\s/u.test(value)&&pattern.test(value)?value:null;
const errorClass=error=>{
 // A thrown value can have an accessor or Proxy trap. Read once, under guard.
 try{const name=error?.name;return ['Error','TypeError','RangeError','SyntaxError','AbortError','TimeoutError'].includes(name)?name:'Error';}
 catch{return 'Error';}
};

/** Keep body consumption in the same six-attempt, 20-second read budget as headers.
 * No provider command, admission change or deployment retry belongs in this helper. */
export async function readPublicBaseline({fetchImpl=fetch,wait=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 for(let attempt=0;attempt<6;attempt++){
  try{
   const response=await fetchImpl('https://koios.news/manifest.json',{
    headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(20000),
   });
   if(!response.ok)throw new Error(`live baseline returned ${response.status}`);
   return Buffer.from(await response.arrayBuffer());
  }catch(error){
   if(attempt===5)throw error;
   await wait(1000*(attempt+1));
  }
 }
}

/** A failed mutation-capable call stays unreconciled even if it changed a provider.
 * Only a returned accepted receipt advances its effect witness. Cleanup failure
 * never replaces the original exception; both fixed classes appear in the report. */
export async function observeRelease(operation,{emit=value=>console.error(JSON.stringify(value)),
 revision=process.env.GITHUB_SHA,runId=process.env.GITHUB_RUN_ID,runAttempt=process.env.GITHUB_RUN_ATTEMPT}={}){
 const binding={revision:identity(revision,/^[a-f0-9]{40}$/u),
  runId:identity(runId,/^[1-9][0-9]{0,19}$/u),runAttempt:identity(runAttempt,/^[1-9][0-9]{0,7}$/u)};
 const effects={preview:'not-attempted',production:'not-attempted'};
 let candidateManifestSha256=null,phase=null,failedPhase=null,cleanup,cleanupStatus='not-attempted';
 const report=(status,extra={})=>{
  // Diagnostics must not replace the work's original result or exception.
  try{emit({kind:'koios.website-release-progress/v1',...binding,candidateManifestSha256,
   phase,status,effects:{...effects},cleanup:cleanupStatus,...extra});}catch{}
 };
 const stage=async(name,work)=>{
  if(!PHASES.has(name)||typeof work!=='function')throw new Error('Unknown release observation phase');
  phase=name;
  const effect=EFFECTS[name];
  if(effect)effects[effect[0]]='attempted-unreconciled';
  if(name==='preview-cleanup')cleanupStatus='attempted-unreconciled';
  report('started');
  try{
   const result=await work();
   if(effect&&result?.kind===effect[1]&&result?.probe?.accepted===true
    &&candidateManifestSha256!==null&&result.candidateManifestSha256===candidateManifestSha256
    &&result.probe.candidateManifestSha256===candidateManifestSha256
    &&result.probe.manifestSha256===candidateManifestSha256){
    effects[effect[0]]='publicly-verified';
   }
   if(name==='preview-cleanup')cleanupStatus='completed';
   report('completed');return result;
  }catch(error){failedPhase=name;report('failed',{errorClass:errorClass(error)});throw error;}
 };
 let result,failure,originalPhase,cleanupFailure,failed=false,cleanupFailed=false;
 try{
  result=await operation({stage,
   bindCandidate:digest=>{candidateManifestSha256=identity(digest,/^[a-f0-9]{64}$/u);},
   deferCleanup:work=>{
    if(cleanup||typeof work!=='function')throw new Error('Release cleanup already assigned');
    cleanup=work;
   },
  });
 }catch(error){failed=true;failure=error;originalPhase=failedPhase??phase;}
 if(cleanup){
  try{await stage('preview-cleanup',cleanup);}
  catch(error){cleanupFailed=true;cleanupFailure=error;if(!failed){failed=true;failure=error;originalPhase='preview-cleanup';}}
 }
 if(failed){
  phase=originalPhase;
  report('failed',{terminal:true,errorClass:errorClass(failure),
   ...(!cleanupFailed?{}:{cleanupErrorClass:errorClass(cleanupFailure)})});
  throw failure;
 }
 phase='complete';report('completed',{terminal:true});return result;
}
