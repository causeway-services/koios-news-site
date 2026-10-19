import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,symlinkSync,readFileSync,rmSync,realpathSync,writeFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const source=dirname(dirname(fileURLToPath(import.meta.url)));
function packageRoot(name,entry){
  let path=dirname(fileURLToPath(import.meta.resolve(entry)));
  while(path!==dirname(path)){
    try{if(JSON.parse(readFileSync(join(path,'package.json'),'utf8')).name===name)return path;}catch{}
    path=dirname(path);
  }
  throw Error('Installed dependency not found: '+name);
}

test('received website resolves and executes its pinned tool in PNPM sibling layout',async t=>{
 const scratch=mkdtempSync(join(tmpdir(),'koios-received-tool-'));
 t.after(()=>rmSync(scratch,{recursive:true,force:true}));
 const modules=join(scratch,'virtual','node_modules'),pkg=join(modules,'@causeway-services','koios-news-site');
 mkdirSync(join(pkg,'src'),{recursive:true});
 copyFileSync(join(source,'src/carrier.mjs'),join(pkg,'src/carrier.mjs'));
 copyFileSync(join(source,'src/release-diagnostics.mjs'),join(pkg,'src/release-diagnostics.mjs'));
 copyFileSync(join(source,'package.json'),join(pkg,'package.json'));
 const suppliers=[['@red-cup-engineering/signcell','@red-cup-engineering/signcell/observability'],['wrangler','wrangler/package.json'],
  ['@red-cup-engineering/json-services-section','@red-cup-engineering/json-services-section/canonical-json'],
  ['@red-cup-engineering/cryptographic-computer-data-engineering-services-section','@red-cup-engineering/cryptographic-computer-data-engineering-services-section/integrity']];
 for(const[name,entry]of suppliers){const target=join(modules,name);mkdirSync(dirname(target),{recursive:true});symlinkSync(packageRoot(name,entry),target);}
 const carrier=await import(pathToFileURL(join(pkg,'src/carrier.mjs')));
 assert.equal(carrier.verifyPinnedWrangler().version,carrier.WRANGLER_VERSION);
 assert.equal(realpathSync(carrier.WRANGLER),realpathSync(join(packageRoot('wrangler','wrangler/package.json'),'bin/wrangler.js')));
 const result=carrier.runPinnedWrangler(carrier.WRANGLER,['--version'],{environment:{...process.env,WRANGLER_SEND_METRICS:'false'}});
 assert.equal(result.status,0,result.stderr);
 assert.equal(result.stdout.trim(),carrier.WRANGLER_VERSION);
});

test('publisher configuration and temporary build files live outside the installed program',async t=>{
 const scratch=mkdtempSync(join(tmpdir(),'koios-wrangler-workspace-test-'));
 t.after(()=>rmSync(scratch,{recursive:true,force:true}));
 const program=join(scratch,'tool.mjs');
 writeFileSync(program,`import fs from 'node:fs';import path from 'node:path';
 const config=process.argv[process.argv.indexOf('--config')+1];
 fs.mkdirSync(path.join(path.dirname(config),'.wrangler/tmp'),{recursive:true});
 console.log(JSON.stringify({cwd:process.cwd(),config,bytes:fs.readFileSync(config,'utf8')}));`);
 const carrier=await import('../src/carrier.mjs');
 const config=join(source,'release/wrangler-static-assets.json'),before=readFileSync(config,'utf8');
 const result=carrier.runPinnedWrangler(program,['--config',config]);
 assert.equal(result.status,0,result.stderr);
 const observed=JSON.parse(result.stdout);
 assert.notEqual(observed.config,config);
 assert.equal(dirname(observed.config),observed.cwd);
 assert.equal(observed.bytes,before);
 assert.equal(readFileSync(config,'utf8'),before);
 assert.equal(existsSync(observed.cwd),false);
});
