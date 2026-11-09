/* Buildless, offline-capable viewer. No network requests or third-party scripts. */
(()=>{'use strict';
const D=window.SENIORITY_DATA;
const group=s=>/^[PMODW][CF][LR]$/.test(s||'')?s.slice(0,2):'';
const fmt=(v,d=0)=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('en-US',{maximumFractionDigits:d}):'—';
const month=d=>d?new Date(d+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',year:'numeric',timeZone:'UTC'}):'Not projected';
const date=d=>d?new Date(d+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}):'Not available';
function baseView(data,p,c,selected=-1){
 let index=selected,planned=false;
 const dca=c.code.startsWith('W'),observed=data.pilots.some(q=>group(q.current).startsWith('W'));
 if(dca&&!observed&&data.asOf<data.opening&&index<0){index=data.baseMonths.findIndex(m=>m>=data.opening);planned=true;if(index<0)return {status:'Beyond forecast',rank:null};}
 const when=index<0?data.asOf:data.baseMonths[index];
 if(dca&&!observed&&(!data.opening||when<data.opening))return {status:'NOT OPEN',rank:null};
 const membership=q=>index<0?group(q.current):q.positions[index];
 const population=data.pilots.filter(q=>membership(q)===c.code).length;
 const rank=p?1+data.pilots.filter(q=>q.rank<p.rank&&membership(q)===c.code).length:null;
 const lines=index<0?c.lines:c.forecast[index];
 const staffing=dca?Math.max(population,data.targets[c.code]||0):(index<0?c.population:population);
 const award=p&&[p.current,p.next,p.final].some(s=>group(s)===c.code);
 const trainee=p&&p.current==='TRN'&&award&&(!p.qualifiedOn||p.qualifiedOn>when);
 let status=!p?'Look up a pilot':trainee?'RESERVE':typeof lines!=='number'?'Cutoff unavailable':rank<=lines&&lines>0?'LINEHOLDER':rank<=staffing||award||data.standing[c.code]?'RESERVE':'CANNOT HOLD';
 return {status,rank,lines,population,when,planned,basis:index<0?c.basis:'Dated forecast'};
}
window.ENY_CORE={group,baseView,fmt};
if(typeof document==='undefined')return;
const $=id=>document.getElementById(id);
const make=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
if(!D||D.version!==3){$('lookup-message').textContent='Website data is missing or incompatible. Upload all exported docs files together.';return;}
let selected=null;
function tab(name){for(const el of document.querySelectorAll('.view'))el.hidden=el.id!==name;for(const el of document.querySelectorAll('.tab')){el.classList.toggle('active',el.dataset.tab===name);if(el.dataset.tab===name)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');}}
document.querySelectorAll('.tab').forEach(el=>el.addEventListener('click',()=>tab(el.dataset.tab)));
$('asof').textContent='Roster as of '+date(D.asOf);$('published').textContent='Workbook published '+date(D.published);
if((Date.now()-Date.parse(D.asOf+'T12:00:00Z'))/86400000>21)$('stale').textContent='Older source snapshot · check for a newer update';
function chart(){
 const box=$('rank-chart');box.replaceChildren();if(!selected){box.className='chart empty';box.textContent='Look up a pilot to see their projected rank.';return;}box.className='chart';
 const count=Number($('horizon').value),values=[selected.rank,...selected.outlook.slice(0,count)];
 const points=values.map((v,i)=>v===null?null:{v,i}).filter(Boolean);
 if(points.length<2){box.className='chart empty';box.textContent='No projection beyond the current roster date.';return;}
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 620 255');svg.setAttribute('role','img');svg.setAttribute('aria-label',`Projected rank from ${selected.rank} to ${points.at(-1).v} over ${points.at(-1).i} months. Lower is better.`);
 const lo=Math.max(1,Math.floor(Math.min(...points.map(p=>p.v))*.9)),hi=Math.ceil(Math.max(...points.map(p=>p.v))*1.05),x=i=>55+i/count*545,y=v=>35+(v-lo)/Math.max(1,hi-lo)*165;
 const node=(tag,attrs,text)=>{const n=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;svg.append(n);return n;};
 for(let i=0;i<4;i++){const val=lo+(hi-lo)*i/3;node('line',{x1:55,y1:y(val),x2:600,y2:y(val),stroke:'#e6edf0'});node('text',{x:44,y:y(val)+4,'text-anchor':'end',fill:'#718490','font-size':11},fmt(Math.round(val)));}
 const path=points.map((p,i)=>(i?'L':'M')+x(p.i)+','+y(p.v)).join(' ');
 node('path',{d:path+` L${x(points.at(-1).i)},210 L55,210 Z`,fill:'#eaf5f5'});
 node('path',{d:path,fill:'none',stroke:'#0b8993','stroke-width':3,'stroke-linejoin':'round'});
 for(const p of [points[0],points.at(-1)]){node('circle',{cx:x(p.i),cy:y(p.v),r:4,fill:'#0b8993'});node('text',{x:x(p.i),y:y(p.v)-11,'text-anchor':p.i===0?'start':'end',fill:'#203d50','font-size':12,'font-weight':600},'#'+fmt(p.v));}
 node('text',{x:55,y:239,fill:'#718490','font-size':11},month(D.asOf));node('text',{x:600,y:239,fill:'#718490','font-size':11,'text-anchor':'end'},month(D.months[count-1]));box.append(svg);
}
function overview(){
 const p=selected;if(!p)window.ENY_PAY_UI?.select(null);$('pilot-title').textContent=p?'Your pilot profile':'Your place in the system';$('assignment').textContent=p?(p.current||'Not listed'):'Look up a profile above';
 const stats=[['System seniority',p?'#'+fmt(p.rank):'—',fmt(D.pilots.length)+' pilots on the roster'],['Projected AA flow',p?month(p.flow):'—','Planning estimate, subject to eligibility'],['Years to flow',p&&p.yearsToFlow!==null?fmt(p.yearsToFlow,1):'—','From the workbook’s source date'],['Flow queue',p&&p.queue!==null?'#'+fmt(p.queue):'—','Unawarded projection queue']];
 $('stats').replaceChildren(...stats.map(([label,val,note],i)=>{const el=make('article',undefined,'stat'+(i===0?' accent':''));el.append(make('small',label),make('strong',val),make('span',note));return el;}));
 const rows=p?[['Current status',p.current||'—'],['Next assignment',p.next||'—'],['Final assignment',p.final||'—'],['Envoy years at flow',fmt(p.envoyYearsToFlow,1)]]:[['Profile','Enter your employee ID above.']];
 $('profile').replaceChildren(...rows.flatMap(([a,b])=>[make('dt',a),make('dd',b)]));chart();renderBases();
}
function rememberRank(){
 try{
  if($('remember').checked&&selected)localStorage.setItem('enyRosterRank',JSON.stringify({roster:D.workbookHash,rank:selected.rank}));
  else localStorage.removeItem('enyRosterRank');
 }catch{}
}
function selectPilot(p){selected=p;$('lookup-message').textContent=`Profile found · system seniority ${fmt(p.rank)}`;rememberRank();overview();window.ENY_PAY_UI?.select(p);}
$('lookup').addEventListener('submit',event=>{
 event.preventDefault();
 const input=$('employee-lookup');
 const employee=input.value.trim();
 const rank=/^[0-9]{1,6}$/.test(employee)?D.lookup[employee.padStart(6,'0')]:undefined;
 const pilot=D.pilots.find(p=>p.rank===rank);
 if(pilot){input.value='';selectPilot(pilot);tab('overview');}
 else{selected=null;rememberRank();overview();$('lookup-message').textContent='Employee ID not found. Check your entry and the roster date.';}
});
$('remember').addEventListener('change',rememberRank);
$('horizon').addEventListener('change',chart);
D.baseMonths.forEach((m,i)=>{const option=make('option',month(m));option.value=i;$('base-month').append(option);});$('base-month').addEventListener('change',renderBases);
function renderBases(){
 $('base-grid').replaceChildren(...D.capacities.map(c=>{const v=baseView(D,selected,c,Number($('base-month').value)),card=make('article',undefined,'base-card'),heading=make('div',undefined,'base-head'),title=make('div');
 title.append(make('h3',c.label),make('small',(v.planned?'PLANNED · ':'')+(v.when?month(v.when):'Outside forecast')+' · '+(v.basis||'Dated forecast')));
 const status=make('span',v.status,'status'+(v.status==='LINEHOLDER'?' good':v.status==='RESERVE'?' reserve':''));heading.append(title,status);card.append(heading);
 if(v.rank!==null&&typeof v.lines==='number'){const bar=make('div',undefined,'bar'),fill=make('div',undefined,'bar-fill'),marker=make('span',undefined,'bar-marker'),max=Math.max(v.rank,v.lines,v.population,1)*1.1;fill.style.width=Math.min(100,v.lines/max*100)+'%';marker.style.left=Math.min(99,v.rank/max*100)+'%';marker.setAttribute('aria-hidden','true');bar.append(fill,marker);card.append(bar);const legend=make('div',undefined,'bar-legend');legend.append(make('span','Your rank: '+fmt(v.rank)),make('span','Hard lines: '+fmt(v.lines)));card.append(legend);}else card.append(make('p',selected?'Rank / cutoff: '+fmt(v.rank)+' / '+fmt(v.lines):'Look up a pilot to personalize this comparison.','note'));
 return card;}));
}
$('change-rows').replaceChildren(...D.changes.map(r=>{const tr=make('tr');[month(r.month),r.population,r.hires,r.flows,r.retirements,r.other,r.selections,r.projectedFlows].forEach((v,i)=>tr.append(make('td',i===0?v:fmt(v))));return tr;}));
if(D.staffing){
 const box=make('article',undefined,'card staffing-card'),grid=make('div',undefined,'stats');
 const labels={totalPilots:'Total pilots',hiresMTD:'New hires MTD',hiresYTD:'New hires YTD',otherMTD:'MTD OAL/RE attrition',flowsMTD:'MTD flow attrition',otherYTD:'YTD OAL/RE attrition',flowsYTD:'YTD flow attrition',totalYTD:'YTD total attrition'};
 for(const [key,label] of Object.entries(labels)){const tile=make('div',undefined,'stat');tile.append(make('small',label),make('strong',fmt(D.staffing.values[key])));grid.append(tile);}
 box.append(make('h3','Pilot staffing · '+date(D.staffing.asOf)),grid,make('p',D.staffing.note,'note'));
 $('changes').querySelector('.section-heading').after(box);
}
overview();try{
 localStorage.removeItem('enyEmployee');
 const saved=JSON.parse(localStorage.getItem('enyRosterRank'));
 const p=saved?.roster===D.workbookHash&&D.pilots.find(p=>p.rank===saved.rank);
 if(p){$('remember').checked=true;selectPilot(p);}else localStorage.removeItem('enyRosterRank');
}catch{}
})();
