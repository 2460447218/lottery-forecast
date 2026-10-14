import assert from 'node:assert/strict';
import {trendModel,ticketCount} from './src/trend.mjs';
const ds=[{red:[1,2,3,4,5,6],blue:1},{red:[2,3,4,5,6,7],blue:2},{red:[1,2,3,4,5,6],blue:2}];
const m=trendModel(ds,3,2);assert.deepEqual(m.rows.map(r=>r.miss[0]),[1,0]);assert.equal(m.stats[0].count,1);assert.equal(m.stats[34].longest,2);assert.equal(m.rows[0].miss[32],2);assert.equal(m.rows[0].known[32],false);assert.equal(trendModel(ds,1,50).rows.length,1);assert.equal(trendModel(ds,2,1).stats[0].current,1);assert.equal(ticketCount({red:[1,2,3,4,5,6,7],blue:[1,2]}),14);assert.equal(ticketCount({red:[1],blue:[1]}),0);console.log('PASS: trend cutoff, historical omissions, unknown history, consecutive hits, combination counts.');

