import{test}from'node:test';import assert from'node:assert/strict';import{mkdtempSync,mkdirSync,writeFileSync,rmSync}from'node:fs';import{join}from'node:path';import{tmpdir}from'node:os';import{readPosts}from'../src/build.mjs';
test('A public frontmatter flag cannot bypass the accepted ledger',()=>{
 const root=mkdtempSync(join(tmpdir(),'publication-custody-'));try{
  const corpus=join(root,'corpus'),ledger=join(root,'ledger');mkdirSync(join(corpus,'posts'),{recursive:true});mkdirSync(ledger);
  const source='---\ntitle: A report\nslug: a-report\ndate: 2026-10-07\nsection: world\ndraft: false\n---\nA supported report.\n';
  writeFileSync(join(corpus,'posts/a-report.md'),source);
  const read=()=>readPosts(corpus,{},'posts',undefined,ledger,{},true);
  assert.throws(read,/Unreviewed content/);
  writeFileSync(join(ledger,'a-report.md'),source);assert.equal(read().length,1);
  writeFileSync(join(corpus,'posts/a-report.md'),source.replace('supported','unreviewed changed'));assert.throws(read,/Unreviewed content/);
  writeFileSync(join(corpus,'posts/a-report.md'),source.replace('draft: false','draft: true'));assert.equal(read()[0].body.trim(),'A supported report.');
 }finally{rmSync(root,{recursive:true,force:true});}
});
