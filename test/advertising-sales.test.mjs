import test from 'node:test';
import assert from 'node:assert/strict';
import { advertisingInventory, hasAdvertisingInventory, renderAdvertisingSales } from '../src/render/advertising-sales.mjs';

const page={name:'Koios.News',monetization:{houseAds:{server:'https://ads.561.group',slots:['header','afterArticle','footer']}}};

test('publisher offers first-party sponsorship inquiry even without A-Ads',()=>{
  assert.equal(hasAdvertisingInventory(page),true);
  const html=renderAdvertisingSales(page);
  assert.match(html,/First-party contextual placements/);
  assert.match(html,/After articles/);
  assert.match(html,/https:\/\/561\.group\/contact\//);
  assert.match(html,/not a purchase or an automatic advertising contract/);
  assert.doesNotMatch(html,/aads\.com/);
});

test('retains the original A-Ads buying route without inventing direct payments',()=>{
  const property={name:'Koios.News',monetization:{aads:{units:['12345','67890']}}};
  const html=renderAdvertisingSales(property);
  assert.match(html,/aads\.com\/ad_units\/12345/);
  assert.match(html,/aads\.com\/ad_units\/67890/);
  assert.match(html,/does not take payment for those units directly/);
  assert.doesNotMatch(html,/First-party contextual placements/);
});

test('advertising opportunities and provider units compose without duplicate routes',()=>{
  const property={...page,monetization:{...page.monetization,aads:{units:['12345','12345','broken']}}};
  const inventory=advertisingInventory(property);
  assert.deepEqual(inventory.houseSlots,['header','afterArticle','footer']);
  assert.deepEqual(inventory.aadsUnits,['12345']);
  const html=renderAdvertisingSales(property);
  assert.match(html,/First-party contextual placements/);
  assert.match(html,/A-Ads network placements/);
  assert.equal((html.match(/aads\.com\/ad_units\/12345/g)||[]).length,1);
});

test('no solicitation is published without configured inventory',()=>{
  const property={name:'Koios.News',monetization:{houseAds:{server:'https://ads.561.group',slots:[]}}};
  assert.equal(hasAdvertisingInventory(property),false);
  assert.equal(renderAdvertisingSales(property),null);
  assert.equal(hasAdvertisingInventory({name:'Plain publication'}),false);
});

test('publisher and unfamiliar slot text cannot become markup',()=>{
  const property={name:'<script>alert(1)</script>',monetization:{houseAds:{server:'https://ads.561.group',slots:['<img src=x onerror=evil()>']}}};
  const html=renderAdvertisingSales(property);
  assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html,/&lt;img src=x onerror=evil\(\)&gt;/);
  assert.doesNotMatch(html,/<script>|<img/);
});
