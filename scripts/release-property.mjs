#!/usr/bin/env node
import {releaseWebsite} from '../src/release.mjs';
const [candidateDir,receipts,...extra]=process.argv.slice(2);
if(!candidateDir||!receipts||extra.length)throw new Error('usage: koios-website-release <public-directory> <receipt-directory>');
console.log(JSON.stringify(await releaseWebsite({candidateDir,receipts})));
