import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dataFile=path.join(root,'dist','draws.json');
const endpoint='https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice';
const shanghai='https://appsh.swlc.net.cn/shfcoc_datachart/datachart/ssq/lskj/ls_award.html';

function amount(value,label){
 const raw=String(value??'').replaceAll(',','').trim();
 if(!raw)return 0;
 const match=raw.match(/^(\d+)/);
 if(!match)throw new Error(`${label}的奖金格式无法解析：${raw}`);
 return Number(match[1]);
}
export function normalizeDraw(row){
 if(!/^\d{7}$/.test(String(row?.code??'')))throw new Error('官方期号格式不正确。');
 const issue=row.code.slice(2),date=String(row.date??'').slice(0,10);
 const red=String(row.red??'').split(',').map(Number).sort((a,b)=>a-b),blue=Number(row.blue);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||red.length!==6||new Set(red).size!==6||red.some(n=>!Number.isInteger(n)||n<1||n>33)||!Number.isInteger(blue)||blue<1||blue>16)throw new Error(`官方第${row.code}期数据不完整。`);
 const prizes=Array.isArray(row.prizegrades)?row.prizegrades:[];
 if(![1,2].every(type=>prizes.some(prize=>Number(prize.type)===type)))throw new Error(`官方第${row.code}期缺少一、二等奖金额。`);
 const prize=type=>amount(prizes.find(p=>Number(p.type)===type)?.typemoney,`${row.code}期${type}等奖`);
 const fyj=amount(row.fyjMoney,`${row.code}期福运奖`);
 if(fyj!==0&&fyj!==5)throw new Error(`${row.code}期福运奖金额发生变化，需要更新计奖规则。`);
 return{issue,date,red,blue,first:prize(1),second:prize(2),special:fyj===5};
}
export function mergeDraws(existing,officialRows){
 if(!Array.isArray(existing)||!existing.length||!Array.isArray(officialRows)||!officialRows.length)throw new Error('缺少历史开奖数据。');
 const result=existing.map(row=>({...row})),byIssue=new Map(result.map((row,i)=>[row.issue,i]));
 if(byIssue.size!==result.length)throw new Error('本地历史数据存在重复期号。');
 const latest=result.at(-1).issue,seen=new Set();let added=0,updated=0,overlap=0;
 for(const raw of officialRows){
  const row=normalizeDraw(raw);
  if(seen.has(row.issue))continue;seen.add(row.issue);
  const index=byIssue.get(row.issue);
  if(index===undefined){
   if(row.issue<=latest)throw new Error(`本地历史中缺少第${row.issue}期，需人工核查。`);
   result.push(row);added++;continue;
  }
  overlap++;const old=result[index];
  if(old.date!==row.date||old.blue!==row.blue||old.red.join(',')!==row.red.join(',')||(Object.hasOwn(raw,'fyjMoney')&&old.special!==row.special))throw new Error(`第${row.issue}期与官方开奖号码不一致，已停止更新。`);
  for(const field of ['first','second']){
   if(old[field]>0&&old[field]!==row[field])throw new Error(`第${row.issue}期${field}奖金与官方数据不一致，已停止更新。`);
   if(old[field]===0&&row[field]>0){old[field]=row[field];updated++;}
  }
 }
 if(!overlap)throw new Error('官方数据与本地历史没有重叠期号，已停止更新。');
 result.sort((a,b)=>a.issue.localeCompare(b.issue));
 return{draws:result,added,updated,overlap};
}
async function fetchPage(page){
 const url=new URL(endpoint);for(const [key,value] of Object.entries({name:'ssq',pageNo:page,pageSize:100,systemType:'PC'}))url.searchParams.set(key,value);
 let lastError;
 for(let attempt=0;attempt<3;attempt++){
  try{
   const response=await fetch(url,{headers:{Accept:'application/json',Referer:'https://www.cwl.gov.cn/','User-Agent':'lottery-forecast-data-sync/1.0'},signal:AbortSignal.timeout(20000)});
   if(!response.ok)throw new Error(`HTTP ${response.status}`);
   const body=await response.json();
   if(body.state!==0||!Array.isArray(body.result)||!Number.isInteger(body.total)||!body.result.length)throw new Error('官方接口返回格式异常。');
   return body;
  }catch(error){lastError=error;if(attempt<2)await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));}
 }
 throw new Error(`官方接口第${page}页获取失败：${lastError.message}`);
}
export function parseShanghai(html){
 const matches=[...html.matchAll(/employee\.push\(\{([^}]+)\}\)/g)];
 const rows=matches.map(([,body])=>{
  const fields=Object.fromEntries([...body.matchAll(/'([a-zA-Z0-9]+)':'([^']*)'/g)].map(([,key,value])=>[key,value]));
  if(!fields.id||!fields.c||!fields.t||fields.bonus1===undefined||fields.bonus2===undefined)throw new Error('上海福彩历史页的数据字段发生变化。');
  const [red,blue]=fields.c.split('|');
  return{code:fields.id,date:fields.t.slice(0,10),red,blue,prizegrades:[{type:1,typemoney:fields.bonus1},{type:2,typemoney:fields.bonus2}]};
 });
 if(rows.length<10)throw new Error('上海福彩历史页未返回足够的开奖数据。');
 return rows;
}
async function fetchShanghai(){
 const response=await fetch(shanghai,{headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html'},signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error(`HTTP ${response.status}`);
 return parseShanghai(await response.text());
}
async function fetchRows(existing){
 const known=new Set(existing.map(row=>row.issue)),rows=[];
 try{
  for(let page=1;page<=40;page++){
   const response=await fetchPage(page);rows.push(...response.result);
   if(response.result.some(row=>known.has(String(row.code).slice(2))))return{rows,source:'中国福利彩票'};
   if(rows.length>=response.total)throw new Error('已查完官方历史，仍找不到与本地数据重叠的期号。');
  }
  throw new Error('连续40页无重叠期号，请人工核查。');
 }catch(error){
  console.warn(`中国福利彩票接口暂不可用（${error.message}），改用上海市福彩官方历史页。`);
  const fallback=await fetchShanghai();
  if(!fallback.some(row=>known.has(row.code.slice(2))))throw new Error('上海福彩数据与本地历史没有重叠期号。');
  return{rows:fallback,source:'上海市福利彩票发行中心'};
 }
}
async function main(){
 const existing=JSON.parse(await fs.readFile(dataFile,'utf8')),{rows,source}=await fetchRows(existing);
 const merged=mergeDraws(existing,rows);
 if(merged.added||merged.updated)await fs.writeFile(dataFile,JSON.stringify(merged.draws)+'\n','utf8');
 console.log(`${source}数据：新增${merged.added}期，补全${merged.updated}个奖金字段，核对${merged.overlap}期；目前共${merged.draws.length}期，截至${merged.draws.at(-1).issue}期。`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(error=>{console.error(error.message);process.exitCode=1;});
