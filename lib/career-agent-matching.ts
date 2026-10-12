import { matchJob, resumeContainsSkill } from './career-core';
import type { ManualJob, Profile, Preferences } from './career-core';

type Factor = { name: string; weight: number; points: number; status: 'supported' | 'gap' | 'unknown' | 'not-requested'; evidence: string };
const norm=(value:string)=>value.trim().toLowerCase();
const includes=(value:string|null|undefined,choices:string[])=>!!value&&choices.some(choice=>norm(value).includes(norm(choice)));
/** Transparent evidence ranking, never a hiring probability. Mandatory policy remains first. */
export function rankAgentJob(job:ManualJob,profile:Profile,preferences:Preferences,activeResumeText?:string,verifiedFacts?:{key:string;value:string|null;classification:string}[]) {
  const base=matchJob(job,profile,preferences,activeResumeText);
  const factors:Factor[]=[];
  const add=(name:string,weight:number,status:Factor['status'],points:number,evidence:string)=>factors.push({name,weight,status,points:Math.max(0,Math.min(weight,Math.round(points*100)/100)),evidence});
  const role=base.relevance.components.targetRole>0;
  add('role relevance',15,preferences.targetRoles.length?(role?'supported':'gap'):'not-requested',role?15:0,role?'Title contains an explicit target role.':'No explicit target-title match is established.');
  const explicit=job.requirements.length>0;
  add('skills',25,base.matchedSkills.length?'supported':explicit?'gap':'unknown',base.relevance.components.skills/60*25,explicit?`${base.matchedSkills.length} supported of ${job.requirements.length} listed requirements; related skills receive partial credit and remain gaps.`:'Unstructured description keywords are weak evidence; skill credit is capped.');
  const experienceKnown=job.minExperience!=null||job.maxExperience!=null;
  const candidateExperienceKnown=profile.relevantExperience>0||!!verifiedFacts?.some(f=>f.key==='profile.relevantExperience'&&f.classification==='VERIFIED'&&f.value!==null&&Number(f.value)===profile.relevantExperience);
  add('relevant experience',15,experienceKnown&&candidateExperienceKnown?(base.relevance.components.experience?'supported':'gap'):'unknown',candidateExperienceKnown&&base.relevance.components.experience?15:0,!candidateExperienceKnown?'Candidate relevant experience is not confirmed. A default zero is not a verified fresher claim.':experienceKnown?`Confirmed relevant experience: ${profile.relevantExperience} years; employer range: ${job.minExperience??'not provided'}–${job.maxExperience??'not provided'} years.`:'Employer experience range is not provided.');
  const seniority=!!job.seniority&&resumeContainsSkill(`${profile.currentRole}\n${profile.headline}`,job.seniority);
  add('seniority',5,job.seniority?(seniority?'supported':'gap'):'unknown',seniority?5:0,job.seniority?(seniority?'Requested seniority appears explicitly in the confirmed role/headline.':'Requested seniority is not explicitly confirmed; years alone do not establish it.'):'Employer seniority is not provided.');
  const careerText=[profile.summary,profile.workHistory,profile.projects,profile.certifications].join('\n');
  const industry=!!job.industry&&resumeContainsSkill(careerText,job.industry);
  add('industry',5,job.industry?(industry?'supported':'gap'):'unknown',industry?5:0,job.industry?(industry?'Industry term appears in confirmed career history.':'Targeting an industry does not establish prior industry experience.'):'Employer industry is not provided.');
  const cities=preferences.preferredCities.length?preferences.preferredCities:profile.currentCity?[profile.currentCity]:[];
  const location=includes(job.location,cities);
  add('location',10,cities.length?(job.location?(location?'supported':'gap'):'unknown'):'not-requested',location?10:0,location?'Location matches a configured city.':job.location?'Location does not match a configured city.':'Employer location is not provided.');
  const salary=base.salaryComparison;
  add('compensation',10,salary.status==='overlap'?'supported':salary.status==='outside'?'gap':salary.status==='not-requested'?'not-requested':'unknown',salary.status==='overlap'?10:0,salary.reason);
  const arrangement=!!job.workArrangement&&preferences.workArrangements.includes(job.workArrangement);
  add('work arrangement',5,preferences.workArrangements.length?(job.workArrangement?(arrangement?'supported':'gap'):'unknown'):'not-requested',arrangement?5:0,arrangement?'Work arrangement matches an explicit preference.':job.workArrangement?'Work arrangement differs from the selected preference.':'Employer work arrangement is not provided.');
  const industryGoal=!!job.industry&&preferences.industries.some(item=>norm(item)===norm(job.industry!));
  const goal=role||industryGoal;
  const goalPoints=preferences.targetRoles.length&&preferences.industries.length?(role?6:0)+(industryGoal?4:0):goal?10:0;
  add('career goals',10,preferences.targetRoles.length||preferences.industries.length?(goal?'supported':'gap'):'not-requested',goalPoints,'Compared only with explicit target-role and target-industry goals; learned feedback cannot replace mandatory preferences.');
  const score=Math.round(factors.reduce((sum,factor)=>sum+factor.points,0));
  const coverage=factors.filter(f=>f.status==='supported'||f.status==='gap').reduce((sum,f)=>sum+f.weight,0);
  const whyMatches=factors.filter(f=>f.status==='supported').map(f=>`${f.name}: ${f.evidence}`);
  const possibleGaps=[...base.missingSkills.map(skill=>`Requirement not confirmed: ${skill}`),...factors.filter(f=>f.status==='gap').map(f=>`${f.name}: ${f.evidence}`)];
  const unknownInformation=[...base.relevance.uncertainty,...factors.filter(f=>f.status==='unknown').map(f=>`${f.name}: ${f.evidence}`)];
  const method='Mandatory filters are applied first. Fixed weights: role 15, skills 25, relevant experience 15, seniority 5, industry 5, location 10, compensation 10, work arrangement 5, career goals 10 (100 total). Unknown or unrequested factors receive no points and are shown separately; coverage reports the assessed weight. Exact confirmed terms support claims; related skills remain gaps. Same-currency annual/monthly salary conversion uses 12 months, without exchange-rate assumptions. This is an estimate of profile fit, not a hiring probability or universal ATS score.';
  return {...base,whyMatches,possibleGaps,unknownInformation,factors,coverage,relevance:{...base.relevance,score:base.relevance.eligible?score:null,label:!base.relevance.eligible?'Excluded by preferences':score>=70&&coverage>=70?'Strong relevance':score>=45?'Worth reviewing':'Limited relevance',components:Object.fromEntries(factors.map(f=>[f.name,f.points])),method,uncertainty:[...new Set(unknownInformation)]}};
}
