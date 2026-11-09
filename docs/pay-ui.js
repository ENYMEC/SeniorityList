(()=>{'use strict';
const $=id=>document.getElementById(id),section=$('compensation');if(!section)return;
const D=window.SENIORITY_DATA,engine=window.ENY_PAY;
const make=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
let pilot=null,inputs=null;
if(!D.pay||!engine){$('pay-status').textContent='Regenerate the website export with the latest updater to enable compensation.';return;}
const fields={};
function field(parent,key,title,type='number',options={}){
 const label=make('label',title),input=make(type==='select'?'select':'input');input.name=key;
 if(type==='select'){for(const [value,title] of options.values.map(v=>Array.isArray(v)?v:[v,v])){const option=make('option',title);option.value=value;input.append(option);}}
 else{input.type=type;for(const prop of ['min','max','step','placeholder'])if(options[prop]!==undefined)input[prop]=options[prop];}
 label.append(input);parent.append(label);fields[key]=input;input.addEventListener('input',render);
 return input;
}
function profile(parent,prefix=''){
 const isWhat=Boolean(prefix),key=name=>isWhat?'whatIf'+name[0].toUpperCase()+name.slice(1):name;
 field(parent,key('seat'),'Seat','select',{values:[['','Choose paid seat'],'Captain','First Officer']});
 field(parent,key('schedule'),'Schedule','select',{values:['Lineholder','Reserve']});
 field(parent,key('role'),'Role','select',{values:['Regular',...engine.exceptions]});
 field(parent,isWhat?'whatIfOT':'ot','Overtime hours / month','number',{min:0,max:300,step:1});
 field(parent,isWhat?'whatIfInstruction':'instruction','LCA instruction hours / month','number',{min:0,max:300,step:1});
 field(parent,isWhat?'whatIfStep':'startStep','Starting normal pay step','number',{min:1,max:20,step:1,placeholder:'Auto'});
}
profile($('pay-current'));profile($('pay-whatif'),'whatIf');
field($('pay-planning'),'matchMonths','Longevity match (months)','number',{min:0,max:600,step:1});
field($('pay-planning'),'delayFlow','Delay AA flow (months)','number',{min:0,max:600,step:1});
field($('pay-planning'),'birthday','Your birthdate for career totals (optional, stays in this browser)','date');
D.pay.carriers.forEach((c,i)=>field($('pay-carriers'),'upgrade'+i,c.name+' Captain upgrade (years)','number',{min:0,max:50,step:'any',placeholder:'Blank = FO only'}));
['Delta','United','Southwest'].forEach((c,i)=>field($('pay-carriers'),'delay'+i,c+' hiring delay (months)','number',{min:0,max:600,step:1}));
const retirementFields=make('div',undefined,'pay-fields'),details=make('details'),summary=make('summary','Retirement and excess-contribution assumptions');details.append(summary,retirementFields);$('pay-carriers').after(details);
const percentKeys=['irsGrowth','returnRate','cbpReturnRate'];
for(const [key,title] of [['irsGrowth','Annual IRS limit growth (%)'],['returnRate','Qualified savings return (%)'],['cbpReturnRate','Cash balance return (%)']])field(retirementFields,key,title,'number',{min:key==='irsGrowth'?0:-99,max:key==='irsGrowth'?10:100,step:.1});
for(const [key,title] of [['balance','Current retirement savings ($)'],['priorWages','Earlier YTD Envoy/AA wages ($)'],['priorEE','Earlier YTD employee deferrals, all jobs ($)'],['priorER','Earlier YTD Envoy/AA qualified employer ($)']])field(retirementFields,key,title,'number',{min:0,max:100000000,step:1});
field(retirementFields,'aaOptOut','AA cash balance opt-out (if eligible)','select',{values:[['No','No — participate'],['Yes','Yes — illustrative opt-out']]});
field(retirementFields,'aaCompRoute','AA above compensation cap','select',{values:[['Cash','Cash restoration (supplied CBA)'],['MBCBP','Cash balance planning alternative']]});
field(retirementFields,'unitedDestination','United excess contributions','select',{values:[['MBCBP','Cash balance plan'],['HRA','Healthcare account']]});
['AA flow current','AA flow what-if','Delta now','United now','Southwest now','Stay / delayed AA'].forEach((title,i)=>{
 field(retirementFields,'employee'+i,title+' employee contribution (%)','number',{min:0,max:100,step:.1});
 field(retirementFields,'profit'+i,title+' assumed cash bonus (%)','number',{min:0,max:100,step:.1});
});
details.append(make('p','IRS limits reset by calendar year, with 2.5% future growth by default. Employer and employee deposits share the annual additions limit; employee deferrals also share one annual limit across jobs. Envoy match requires employee contributions and follows actual service. AA defaults to cash above the compensation cap; Delta future hires use cash balance. United healthcare credits stay separate from invested retirement. Southwest’s additional 2% begins after cash balance eligibility. Earlier YTD inputs default to zero. Optional cash bonuses are excluded from the retirement earnings base. Delta uses an 18% planning proxy pending final accrual terms. No catch-up contributions or taxes are modeled.','note'));
const money=v=>typeof v==='number'?v.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}):'—';
const number=(key,nullable=false)=>fields[key].value===''?(nullable?null:0):Number(fields[key].value);
function read(){
 const value={...inputs,upgrades:[...inputs.upgrades],delays:[...inputs.delays],employeeRates:[...inputs.employeeRates],profitSharing:[...inputs.profitSharing]};
 for(const key of ['seat','schedule','role','whatIfSeat','whatIfSchedule','whatIfRole','birthday'])value[key]=fields[key].value;
 for(const key of ['ot','instruction','matchMonths','delayFlow','whatIfOT','whatIfInstruction'])value[key]=number(key);
 for(const key of ['startStep','whatIfStep'])value[key]=number(key,true);
 for(let i=0;i<4;i++)value.upgrades[i]=number('upgrade'+i,true);
 for(let i=0;i<3;i++)value.delays[i]=number('delay'+i);
 for(const key of percentKeys)value[key]=number(key)/100;
 for(const key of ['balance','priorWages','priorEE','priorER'])value[key]=number(key);
 for(let i=0;i<6;i++){value.employeeRates[i]=number('employee'+i)/100;value.profitSharing[i]=number('profit'+i)/100;}
 value.aaOptOut=fields.aaOptOut.value==='Yes';value.aaCompRoute=fields.aaCompRoute.value;value.unitedDestination=fields.unitedDestination.value;
 return value;
}
function render(){
 if(!pilot||!inputs)return;
 if(!$('pay-form').checkValidity()){$('pay-status').textContent='Check the highlighted input ranges before comparing compensation.';return;}
 const value=read(),result=engine.calculate(pilot,value,D.pay);
 const rows=result.rows.map(r=>{const tr=make('tr');[r.label,money(r.five),money(r.ten),money(r.difference),money(r.career)].forEach(v=>tr.append(make('td',v)));return tr;});
 $('pay-rows').replaceChildren(...rows);
 if(!$('pay-benefit-rows')){
  const card=make('article',undefined,'card table-scroll pay-planning-card'),table=make('table'),head=make('thead'),tr=make('tr');
  ['Scenario','Retirement value at age 65','Qualified employer deposits','Cash balance deposits','Cash restoration (included above)','Healthcare credits'].forEach(v=>tr.append(make('th',v)));head.append(tr);
  const body=make('tbody');body.id='pay-benefit-rows';table.append(head,body);card.append(make('h3','Career employer benefits'),table);$('pay-chart').closest('article').after(card);
 }
 $('pay-benefit-rows').replaceChildren(...result.rows.map(r=>{const tr=make('tr');[r.label,money(r.retirementFV),money(r.qualified),money(r.cbp),money(r.restoration),money(r.health)].forEach(v=>tr.append(make('td',v)));return tr;}));
 const max=Math.max(1,...result.rows.map(r=>r.ten||0));
 $('pay-chart').replaceChildren(...result.rows.map(r=>{const row=make('div',undefined,'pay-bar-row'),heading=make('div',undefined,'pay-bar-heading');heading.append(make('span',r.label),make('strong',money(r.ten)));const track=make('div',undefined,'pay-bar-track'),bar=make('div',undefined,'pay-bar-fill');bar.style.width=(r.ten===null?0:r.ten/max*100)+'%';track.append(bar);row.append(heading,track);return row;}));
 const missing=[];if(!value.seat)missing.push('choose the actual current paid seat');if(!pilot.payProfile.hireDate)missing.push('hire date is missing');if(!pilot.flow)missing.push('AA flow is not projected');if(result.careerMonths===null)missing.push('a birthday is needed for career totals');
 const unresolved=result.rows.some(r=>r.unallocated>0)?' Some opt-out / early-eligibility employer allocations need plan confirmation and are excluded from cash and retirement value.':'';
 $('pay-status').textContent=(missing.length?'Review: '+missing.join('; ')+'. ':'')+'Cash includes applicable restoration, before tax and employee retirement deductions. PSP applies through '+D.pay.pspEnd+'. Blank/zero delay flow means staying at Envoy until retirement.'+unresolved;
 $('pay-source').textContent=D.pay.carriers.map(c=>`${c.name}: ${c.equipment}, ${c.units}, ${c.guarantee} units/month; rates effective ${c.effective}`).join(' · ');
 window.ENY_PAY_RESULT=result;
}
function select(p){
 pilot=p;$('pay-controls').disabled=!p;inputs=p?engine.defaults(p,D.pay):null;
 if(!p){$('pay-status').textContent='Look up a pilot to compare compensation.';$('pay-rows').replaceChildren();$('pay-chart').replaceChildren();$('pay-benefit-rows')?.replaceChildren();return;}
 for(const key of ['seat','schedule','role','whatIfSeat','whatIfSchedule','whatIfRole','birthday','ot','instruction','matchMonths','delayFlow','whatIfOT','whatIfInstruction','startStep','whatIfStep'])fields[key].value=inputs[key]??'';
 for(let i=0;i<4;i++)fields['upgrade'+i].value=inputs.upgrades[i]??'';
 for(let i=0;i<3;i++)fields['delay'+i].value=inputs.delays[i];
 for(const key of percentKeys)fields[key].value=inputs[key]*100;
 for(const key of ['balance','priorWages','priorEE','priorER','aaCompRoute','unitedDestination'])fields[key].value=inputs[key];
 fields.aaOptOut.value=inputs.aaOptOut?'Yes':'No';
 for(let i=0;i<6;i++){fields['employee'+i].value=inputs.employeeRates[i]*100;fields['profit'+i].value=inputs.profitSharing[i]*100;}
 fields.birthday.disabled=Boolean(p.birthday||p.payProfile.retirement);render();
}
$('pay-reset').addEventListener('click',()=>select(pilot));
$('pay-form').addEventListener('submit',event=>{event.preventDefault();render();});
window.ENY_PAY_UI={select,render};select(null);
})();
