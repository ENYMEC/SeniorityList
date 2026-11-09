/* Calendar-year retirement ledger. End-of-month deposits; fixed planning rates. */
(()=>{'use strict';
function ledger(p,inputs,data,row){
 const engine=window.ENY_PAY,settings=data.retirement,records=[];
 let prior=null,qfv=inputs.balance,cfv=0;
 for(let i=0;i<600;i++){
  const date=engine.edate(data.asOf,i),year=Number(date.slice(0,4));
  const carrier=i<row.start?0:row.carrierIndex+1,group=carrier<=1?1:carrier;
  const factor=(1+inputs.irsGrowth)**Math.max(0,year-settings.baseYear);
  const compCap=settings.compensation*factor,limit=settings.additions*factor,eeCap=settings.deferral*factor;
  const sameYear=prior?.year===year,sameGroup=sameYear&&prior.group===group;
  const priorWages=sameGroup?prior.groupWages:(i===0&&group===1?inputs.priorWages:0);
  const priorQualified=sameGroup?prior.groupQualified:(i===0&&group===1?inputs.priorEE+inputs.priorER:0);
  const priorEE=sameYear?prior.employeeYTD:(i===0?inputs.priorEE:0);
  const base=row.available?row.wages[i]:0,wages=base;
  const allowed=Math.min(wages,Math.max(0,compCap-priorWages));
  const service=p.payProfile.hireDate?engine.years(p.payProfile.hireDate,date)+1:1;
  const tier=service<=4?0:service<=9?1:service<=14?2:service<=19?3:4;
  const eeRate=inputs.employeeRates[row.index];
  const rate=carrier===0?settings.envoyMatch[tier][1]*Math.min(1,eeRate/settings.envoyMatch[tier][0]):settings.rates[carrier];
  let employee=Math.min(allowed*eeRate,Math.max(0,eeCap-priorEE));
  const target=allowed*rate;
  // AA's opt-out case returns employee deferrals first rather than inventing
  // a cash payment for an employer amount the supplied CBA does not resolve.
  if(carrier===1&&inputs.aaOptOut)employee-=Math.min(employee,Math.max(0,target-Math.max(0,limit-priorQualified-employee)));
  const qualified=Math.min(target,Math.max(0,limit-priorQualified-employee));
  const spill=Math.max(0,target-qualified),aboveCap=carrier===0?0:(wages-allowed)*rate;
  const swaEligible=carrier===4&&i-row.start>=13;
  let cbp=0,cash=0,health=0,unallocated=0;
  if(carrier===1){
   if(inputs.aaOptOut)unallocated=spill;else cbp=spill;
   if(!inputs.aaOptOut&&inputs.aaCompRoute==='MBCBP')cbp+=aboveCap;else cash=aboveCap;
  }else if(carrier===2)cbp=spill+aboveCap;
  else if(carrier===3){if(inputs.unitedDestination==='HRA')health=spill+aboveCap;else cbp=spill+aboveCap;}
  else if(carrier===4){
   if(swaEligible){cbp=spill+allowed*settings.extra[4];cash=aboveCap+(wages-allowed)*settings.extra[4];}
   else{unallocated=spill;cash=aboveCap;}
  }
  qfv=qfv*(1+inputs.returnRate)**(1/12)+employee+qualified;
  cfv=cfv*(1+inputs.cbpReturnRate)**(1/12)+cbp;
  prior={date,year,carrier,group,wages,bonus:base*inputs.profitSharing[row.index],employee,qualified,cbp,cash,health,unallocated,qualifiedFV:qfv,cbpFV:cfv,
   groupWages:priorWages+wages,groupQualified:priorQualified+employee+qualified,employeeYTD:priorEE+employee};
  records.push(prior);
 }
 return records;
}
function apply(p,inputs,data,result){
 if(!data.retirement)return result;
 for(const row of result.rows){
  row.benefits=ledger(p,inputs,data,row);
  const total=(key,n)=>row.available?row.benefits.slice(0,Math.min(n,result.careerMonths??n)).reduce((sum,v)=>sum+v[key],0):null;
  row.five=total('wages',60)+total('cash',60)+total('bonus',60);row.ten=total('wages',120)+total('cash',120)+total('bonus',120);
  if(!row.available){row.five=null;row.ten=null;}
  const n=result.careerMonths;
  row.career=n===null||!row.available?null:total('wages',n)+total('cash',n)+total('bonus',n);
  const final=n===null?null:row.benefits[Math.min(600,n)-1];
  row.retirementFV=!row.available||n===null?null:final?final.qualifiedFV+final.cbpFV:inputs.balance;
  row.employee= n===null?null:total('employee',n);
  row.qualified=n===null?null:total('qualified',n);row.cbp=n===null?null:total('cbp',n);
  row.restoration=n===null?null:total('cash',n);row.health=n===null?null:total('health',n);
  row.unallocated=total('unallocated',n??120);
 }
 for(const row of result.rows)row.difference=row.ten!==null&&result.rows[0].ten!==null?row.ten-result.rows[0].ten:null;
 return result;
}
window.ENY_RETIREMENT={ledger,apply};
})();
