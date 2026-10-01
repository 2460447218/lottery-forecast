import fs from 'node:fs';
import {runMultiExperiment} from '../src/multibet.mjs';
const draws=JSON.parse(fs.readFileSync(new URL('../public/draws.json',import.meta.url),'utf8'));
const result=runMultiExperiment(draws,{strategy:'hot100',redPool:12,bluePool:4,tickets:5,seed:20261001,periods:Math.min(1000,draws.length-500),end:draws.length});
fs.writeFileSync(new URL('../public/multibet.json',import.meta.url),JSON.stringify(result));
console.log(JSON.stringify({cost:result.cost,prize:result.prize,net:result.net,winRate:result.winRate,returnRate:result.returnRate,random:result.random}));
