/* Monthly pay engine; inputs are the exported, calculated workbook tables. */
(()=>{'use strict';
const parse=s=>s?new Date(s+'T00:00:00Z'):null;
const iso=d=>d?d.toISOString().slice(0,10):null;
function edate(s,n){if(!s)return null;const d=parse(s),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+n);const end=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,end));return iso(d);}
function years(start,end){if(!start||!end)return null;const a=parse(start),b=parse(end);return b.getUTCFullYear()-a.getUTCFullYear()-Number(b.getUTCMonth()<a.getUTCMonth()||(b.getUTCMonth()===a.getUTCMonth()&&b.getUTCDate()<a.getUTCDate()));}
const months=(a,b)=>{const x=parse(a),y=parse(b);return Math.max(0,(y.getUTCFullYear()-x.getUTCFullYear())*12+y.getUTCMonth()-x.getUTCMonth());};
const exceptions=['Line Check Airman','Simulator Instructor','Simulator Check Airman','Sim + 1 Designation','Sim + 2 Designations','APD','Pilot Check Airman (PCA)'];
const maxDate=(...dates)=>dates.filter(Boolean).sort().at(-1)||null;
function retirement(p,inputs,data){if(p.payProfile.retirement)return p.payProfile.retirement;const born=inputs.birthday||p.birthday;if(!born)return null;const b=parse(born);return iso(new Date(Date.UTC(b.getUTCFullYear()+data.retirementAge,b.getUTCMonth(),b.getUTCDate())));}
function defaults(p,data){const profile=p.payProfile;return {seat:profile.seat,schedule:profile.schedule,role:'Regular',ot:0,instruction:0,matchMonths:0,startStep:null,whatIfSeat:profile.seat,whatIfSchedule:profile.schedule,whatIfRole:'Regular',whatIfOT:0,whatIfInstruction:0,whatIfStep:null,delayFlow:0,delays:[0,0,0],upgrades:data.carriers.map(c=>c.upgradeYears),birthday:'',employeeRates:[0,0,0,0,0,0],profitSharing:[0,0,0,0,0,0],irsGrowth:.025,aaOptOut:false,aaCompRoute:'Cash',unitedDestination:'MBCBP',returnRate:.06,cbpReturnRate:.06,balance:0,priorWages:0,priorEE:0,priorER:0};}
function upgradeDate(p,seat,data){
 if(seat==='Captain')return data.asOf;
 // The workbook uses the system outlook's first numeric CA-hold date when
 // retirement is known; an already-holdable text result uses the 27-month rule.
 if(p.payProfile.captainHold)return p.payProfile.captainHold;
 return p.payProfile.hireDate?maxDate(data.asOf,edate(p.payProfile.hireDate,27)):null;
}
function monthlyEnvoy(p,inputs,data,whatIf=false,stay=false){
 const profile=p.payProfile,hire=profile.hireDate,seat=whatIf?inputs.whatIfSeat:inputs.seat;
 if(!hire||!seat)return null;
 const role=whatIf?inputs.whatIfRole:inputs.role,schedule=whatIf?inputs.whatIfSchedule:inputs.schedule;
 const exceptional=exceptions.includes(role),upgrade=upgradeDate(p,seat,data),credit=edate(hire,-inputs.matchMonths);
 const initial=whatIf?inputs.whatIfStep:inputs.startStep;
 let complete;
 if(seat==='Captain')complete=whatIf&&inputs.seat!=='Captain'?edate(data.asOf,12):profile.captainYearComplete;
 else complete=edate(upgrade,12);
 const step20=exceptional?edate(hire,60):(profile.acceptedFlow&&profile.eligibleForStep20?maxDate(edate(hire,60),complete):null);
 const guarantee={ 'Simulator Check Airman':data.special.simCheck,'Sim + 1 Designation':data.special.simOne,'Sim + 2 Designations':data.special.simTwo,'APD':data.special.apd }[role]??(schedule==='Reserve'?data.guarantees.reserve:data.guarantees.lineholder);
 const ot=whatIf?inputs.whatIfOT:inputs.ot,instruction=whatIf?inputs.whatIfInstruction:inputs.instruction;
 const creditYears=years(credit,data.asOf),flow=p.flow?months(data.asOf,p.flow):null;
 return Array.from({length:600},(_,i)=>{
  const when=edate(data.asOf,i),paidSeat=seat==='Captain'||(upgrade&&when>=upgrade)?'Captain':'First Officer';
  let step=initial===null||initial===''?years(credit,when)+1:Number(initial)+years(credit,when)-creditYears;
  step=Math.max(1,Math.min(paidSeat==='Captain'?20:15,step));
  if(paidSeat==='Captain'&&step20&&when>=step20&&(exceptional||when<'2029-07-01')&&(!stay||exceptional||i<flow))step=20;
  const scale=paidSeat==='Captain'?data.envoy.ca:data.envoy.fo;
  const rate=scale[step-1][when<=data.pspEnd?1:0];
  return rate*(guarantee+data.special.otMultiplier*ot+(role==='Line Check Airman'?data.special.lcaMultiplier*instruction:0));
 });
}
function calculate(p,inputs,data){
 if(!p)return null;
 const retire=retirement(p,inputs,data),career=retire?Math.max(0,Math.floor((parse(retire)-parse(data.asOf))/86400000/365.25*12+.5)):null;
 const flow=p.flow?months(data.asOf,p.flow):null;
 const current=monthlyEnvoy(p,inputs,data),whatIf=monthlyEnvoy(p,inputs,data,true),stay=monthlyEnvoy(p,inputs,data,false,true);
 const delay=flow===null?null:inputs.delayFlow>0?Math.min(career??600,flow+inputs.delayFlow):(career??600);
 const scenarios=[['Wait for AA flow — current',0,flow,current],['Wait for AA flow — what-if',0,flow,whatIf],['Delta now',1,inputs.delays[0],current],['United now',2,inputs.delays[1],current],['Southwest now',3,inputs.delays[2],current],['Stay at Envoy / delayed AA',0,delay,stay]];
 const rows=scenarios.map(([label,carrierIndex,start,envoy],index)=>{
  const carrier=data.carriers[carrierIndex],upgradeYears=inputs.upgrades[carrierIndex];
  const upgrade=upgradeYears===null||upgradeYears===''?600:Math.ceil(Math.round(Number(upgradeYears)*12*1e6)/1e6);
  const available=start!==null&&((index===0||index===1||index===5)?envoy!==null:(start===0||envoy!==null))&&!(index===5&&flow===null);
  const wages=Array.from({length:600},(_,i)=>{if(!available)return null;if(i<start)return envoy[i];const service=i-start,year=Math.min(11,Math.floor(service/12));return carrier[service<upgrade?'foAnnual':'caAnnual'][year]/12;});
  const total=horizon=>available?wages.slice(0,Math.min(horizon,career??horizon)).reduce((s,v)=>s+v,0):null;
  return {label,carrierIndex,start,available,wages,five:total(60),ten:total(120),career:career===null?null:total(career),index};
 });
 for(const row of rows)row.difference=row.ten!==null&&rows[0].ten!==null?row.ten-rows[0].ten:null;
 const result={rows,careerMonths:career,retirement:retire,flowMonths:flow};
 return window.ENY_RETIREMENT?window.ENY_RETIREMENT.apply(p,inputs,data,result):result;
}
window.ENY_PAY={parse,iso,edate,years,months,exceptions,defaults,calculate,monthlyEnvoy};
})();
