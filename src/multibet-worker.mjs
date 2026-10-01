import {runMultiExperiment} from './multibet.mjs';
self.onmessage=({data})=>{try{self.postMessage({result:runMultiExperiment(data.draws,data.config,p=>self.postMessage(p))});}catch(error){self.postMessage({error:error.message});}};
