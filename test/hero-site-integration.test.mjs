import test from 'node:test';
import assert from 'node:assert/strict';
import {cpSync,mkdtempSync,readFileSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildProperty} from '../src/build.mjs';

const fixtures=join(dirname(fileURLToPath(import.meta.url)),'fixtures');
function withArticleHero({imageAlt,imageCredit},fn){
  const root=mkdtempSync(join(tmpdir(),'koios-hero-assurance-'));
  try{
    const contentDir=join(root,'content'),outputDir=join(root,'public');
    cpSync(join(fixtures,'content'),contentDir,{recursive:true});
    const postPath=join(contentDir,'posts','hello-world.md');
    const original=readFileSync(postPath,'utf8');
    const fields=['image: "/assets/images/supplied.png"',...(imageAlt===undefined?[]:[`imageAlt: "${imageAlt}"`]),
      ...(imageCredit===undefined?[]:[`imageCredit: "${imageCredit}"`])];
    assert.ok(original.includes('section: "technology"'));
    writeFileSync(postPath,original.replace('section: "technology"', 'section: "technology"\n'+fields.join('\n')));
    const property=JSON.parse(readFileSync(join(fixtures,'property.json'),'utf8'));
    buildProperty({property,contentDir,outputDir,asOf:new Date('2026-07-20T00:00:00Z')});
    return fn({html:readFileSync(join(outputDir,'posts','hello-world','index.html'),'utf8'),outputDir});
  }finally{rmSync(root,{recursive:true,force:true})}
}
test('generic article hero is replaced at build time by existing deterministic art',()=>{
  withArticleHero({imageAlt:'Illustration for Hello World From Koios.News',imageCredit:'Credit for rejected image'},({html,outputDir})=>{
    assert.doesNotMatch(html,/alt="Illustration for Hello World From Koios.News"/);
    assert.match(html,/src="\/assets\/article-art\/hello-world.svg"/);
    assert.match(html,/Deterministic geometric article art/);
    assert.doesNotMatch(html,/Credit for rejected image/);
    assert.ok(existsSync(join(outputDir,'assets','article-art','hello-world.svg')));
  });
});
test('supplied image is preserved with descriptive alt and its proper credit',()=>{
  withArticleHero({imageAlt:'A detailed photograph of a printed newsroom newspaper',imageCredit:'Rights holder, CC BY'},({html})=>{
    assert.match(html,/src="\/assets\/images\/supplied.png"/);
    assert.match(html,/alt="A detailed photograph of a printed newsroom newspaper"/);
    assert.match(html,/Rights holder, CC BY/);
  });
});
