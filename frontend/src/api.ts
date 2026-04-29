import axios from 'axios'
const B=import.meta.env.VITE_API_URL||'http://localhost:8001'
const H=()=>{const t=localStorage.getItem('ts_token');return t?{Authorization:`Bearer ${t}`}:{}}
export const checkHealth=async()=>{try{const{data}=await axios.get(B+'/health',{timeout:3000});return data}catch{return null}}
export const register=async(email:string,name:string,password:string)=>{const{data}=await axios.post(B+'/auth/register',{email,name,password});return data}
export const login=async(email:string,password:string)=>{const{data}=await axios.post(B+'/auth/login',{email,password});return data}
export const getMe=async()=>{const{data}=await axios.get(B+'/auth/me',{headers:H()});return data}
export const analyzeFile=async(file:File,jd?:string)=>{const form=new FormData();form.append('file',file);if(jd?.trim())form.append('job_description',jd);const{data}=await axios.post(B+'/upload-resume',form,{headers:{...H()}});return data}
export const analyzeText=async(text:string,jd?:string)=>{const{data}=await axios.post(B+'/analyze-text',{resume_text:text,job_description:jd?.trim()||undefined},{headers:H()});return data}
export const getSharedResult=async(id:string)=>{const{data}=await axios.get(B+'/result/'+id);return data}
export const getMyResumes=async()=>{const{data}=await axios.get(B+'/my-resumes',{headers:H()});return data}
export const getSnapshots=async()=>{const{data}=await axios.get(B+'/auth/snapshots',{headers:H()}).catch(()=>({data:[]}));return data}
export const rewriteBullet=async(bullet:string,context?:string)=>{const{data}=await axios.post(B+'/ai/ai-rewrite',{bullet,context});return data}
export const generateCoverLetter=async(resumeText:string,jd:string,tone:string)=>{const{data}=await axios.post(B+'/cover-letter',{resume_text:resumeText,job_description:jd,tone});return data}
export const generateInterviewQuestions=async(resumeText:string,jd:string)=>{const{data}=await axios.post(B+'/interview-questions',{resume_text:resumeText,job_description:jd});return data}
export const compareResumes=async(v1:string,v2:string,jd?:string)=>{const{data}=await axios.post(B+'/compare-resumes',{resume_v1:v1,resume_v2:v2,job_description:jd});return data}
export const bulkAnalyze=async(resumes:string[],jd:string,weights?:any)=>{const{data}=await axios.post(B+'/bulk-analyze',{resumes,job_description:jd,weights});return data}
export const createJob=async(title:string,description:string,department:string)=>{const{data}=await axios.post(B+'/jobs',{title,description,department},{headers:H()});return data}
export const getJobs=async()=>{const{data}=await axios.get(B+'/jobs',{headers:H()});return data}
export const getPipeline=async(jobId:number)=>{const{data}=await axios.get(B+'/pipeline/'+jobId,{headers:H()});return data}
export const updateCandidateStatus=async(candidateId:number,status:string,notes?:string)=>{const{data}=await axios.put(B+'/candidates/'+candidateId+'/status',{status,notes},{headers:H()});return data}
export const getAnalytics=async()=>{const{data}=await axios.get(B+'/analytics',{headers:H()});return data}
export const getMyPlan=async()=>{const{data}=await axios.get(B+'/payments/my-plan',{headers:H()});return data}
export const createCheckout=async(successUrl:string,cancelUrl:string)=>{const{data}=await axios.post(B+'/payments/create-checkout',{success_url:successUrl,cancel_url:cancelUrl},{headers:H()});return data}
export const upgradeDemoMode=async()=>{const{data}=await axios.post(B+'/payments/upgrade-demo',{},{headers:H()});return data}
export const aiNegotiate=async(messages:any[],targetSalary:string)=>{const{data}=await axios.post(B+'/ai/negotiate',{messages,target_salary:targetSalary});return data}
export const aiScoreAnswer=async(question:string,answer:string)=>{const{data}=await axios.post(B+'/ai/score-interview-answer',{question,answer});return data}
export const detectLanguage=async(text:string)=>{const{data}=await axios.post(B+'/features/detect-language',{text});return data}
export const translateResume=async(text:string)=>{const{data}=await axios.post(B+'/features/translate',{text});return data}
export const generateRejectionEmail=async(candidate_name:string,role:string,missing_skills:string[],tone:string,company_name:string)=>{const{data}=await axios.post(B+'/features/rejection-email',{candidate_name,role,missing_skills,tone,company_name});return data}
export const marketTiming=async(resume_text:string)=>{const{data}=await axios.post(B+'/features/market-timing',{resume_text});return data}
export const teamComplement=async(team_skills:string[],candidate_resume:string)=>{const{data}=await axios.post(B+'/features/team-complement',{team_skills,candidate_resume});return data}
export const skillTrajectory=async(resume_text:string)=>{const{data}=await axios.post(B+'/features/skill-trajectory',{resume_text});return data}
export const resumeHeatmap=async(resume_text:string)=>{const{data}=await axios.post(B+'/features/resume-heatmap',{resume_text});return data}
export const getPublicJobs=async()=>{const{data}=await axios.get(B+'/features/public-jobs');return data}
export const applyToJob=async(job_id:number,applicant_name:string,applicant_email:string,resume_text:string)=>{const{data}=await axios.post(B+`/features/public-jobs/${job_id}/apply`,{job_id,applicant_name,applicant_email,resume_text});return data}
export const analyzeGithubReal=async(username:string,token?:string)=>{const{data}=await axios.post(B+'/github/analyze-github',{username,token});return data}
export const getFullAnalytics=async()=>{const{data}=await axios.get(B+'/analytics',{headers:H()});return data}
