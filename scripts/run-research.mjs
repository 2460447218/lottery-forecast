import fs from 'node:fs';
import {runResearch} from '../src/research.mjs';
const draws=JSON.parse(fs.readFileSync(new URL('../public/draws.json',import.meta.url),'utf8'));
let stage='';
const result=runResearch(draws,{},p=>{if(p.stage!==stage){stage=p.stage;console.log(stage);}});
fs.writeFileSync(new URL('../public/research.json',import.meta.url),JSON.stringify(result));
console.log(JSON.stringify({model:result.selected.id,weights:result.selected.weights,test:result.test,random:result.random,nextPick:result.nextPick},null,2));
