import {runBacktest} from './engine.mjs';
self.onmessage=({data})=>{try{const result=runBacktest(data.draws,data.config,p=>self.postMessage({progress:p}));self.postMessage({result});}catch(e){self.postMessage({error:e.message});}};
