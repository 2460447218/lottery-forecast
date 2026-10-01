import {compareStrategies} from './comparison.mjs';
self.onmessage=({data})=>{try{self.postMessage({result:compareStrategies(data.draws,data.config,progress=>self.postMessage({progress}))});}catch(error){self.postMessage({error:error.message});}};
