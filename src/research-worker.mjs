import {runResearch} from './research.mjs';
self.onmessage=({data})=>{try{self.postMessage({result:runResearch(data.draws,data.config,p=>self.postMessage(p))});}catch(error){self.postMessage({error:error.message});}};
