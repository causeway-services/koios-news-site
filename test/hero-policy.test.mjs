import test from 'node:test';
import assert from 'node:assert/strict';
import {selectArticleHeroImage as select} from '../src/render/hero-policy.mjs';

const article={slug:'oracle-bones-computable-archive-ai-research-infrastructure',title:'Oracle bones are becoming a computable archive'};
const generated=(x)=>`Deterministic article art for ${x.title} in ${x.sectionTitle}`;
const fallback=`/assets/article-art/${article.slug}.svg`;

test('supplied image with descriptive alternative and credit is preserved',()=>{
  const p={...article,image:'/photos/oracle-bone.png',imageAlt:'Photograph of a Shang oracle-bone fragment with incised characters',imageCredit:'Museum CC BY'};
  assert.deepEqual(select(p,'Technology',generated),{image:p.image,imageAlt:p.imageAlt,imageCredit:p.imageCredit});
});
test('the existing generic production alternative triggers article-specific deterministic fallback',()=>{
  const p={...article,image:'/photos/unqualified.png',imageAlt:`Illustration for ${article.title}`,imageCredit:'Unknown'};
  assert.deepEqual(select(p,'Technology',generated),{image:fallback,imageAlt:generated({title:article.title,sectionTitle:'Technology'}),imageCredit:undefined});
});
test('case variant generic alternative cannot pass',()=>{
  const p={...article,image:'/photos/unqualified.png',imageAlt:'PHOTO For Oracle bones'};
  assert.equal(select(p,'Technology',generated).image,fallback);
});
test('supplied image without truthful alternative is not used',()=>{
  const p={...article,image:'/photos/not-describable.png',imageCredit:'Unresolved'};
  assert.equal(select(p,'Technology',generated).image,fallback);
});
test('image credit is stripped only when supplied imagery is rejected',()=>{
  const p={...article,image:'/photos/unqualified.png',imageAlt:'Image for story',imageCredit:'Specific photo credit'};
  assert.equal(select(p,'Technology',generated).imageCredit,undefined);
});
test('articles without supplied hero receive deterministic fallback',()=>{
  assert.equal(select(article,'Technology',generated).image,fallback);
});
test('malformed articles and invalid slug are refused',()=>{
  assert.throws(()=>select(null,'Technology',generated),TypeError);
  assert.throws(()=>select({...article,slug:'../evil'},'Technology',generated),TypeError);
  assert.throws(()=>select({...article,title:' '},'Technology',generated),TypeError);
});
test('empty generated alternative blocks rendering rather than publishing an unnamed hero',()=>{
  assert.throws(()=>select(article,'Technology',()=>''),/fallback alternative missing/);
});
