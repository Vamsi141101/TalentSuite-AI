import{useState,useEffect,useRef,useCallback,DragEvent,ChangeEvent}from'react'
import{RadarChart,Radar,PolarGrid,PolarAngleAxis,ResponsiveContainer,BarChart,Bar,XAxis,YAxis,Tooltip,LineChart,Line,PieChart,Pie,Cell}from'recharts'
import*as api from'./api'

// ─── Types ────────────────────────────────────────────────────────────────
interface User{id:number;email:string;name:string;role:string;plan?:string}
interface Toast{id:string;title:string;msg:string;type:'success'|'error'|'info'|'warning'}

// ─── Constants ────────────────────────────────────────────────────────────
const STEPS=['Parsing resume...','Extracting skills (NLP)...','Predicting roles (TF-IDF)...','Computing ATS score...','Estimating salary...','Generating insights...']
const TABS=['Analysis','ATS','Score','JD Match','Salary','Rewriter','Cover Letter','Interview Qs','Bulk','Compare']
const STAGES=['screened','shortlisted','interview','offer','rejected']
const STAGE_COLOR:Record<string,string>={screened:'#8892c0',shortlisted:'#06b6d4',interview:'#a78bfa',offer:'#10b981',rejected:'#ef4444'}
const PIE_COLORS=['#7c3aed','#06b6d4','#10b981','#f59e0b','#ef4444']
const fmt=(n:number)=>'$'+n.toLocaleString()
const gc=(g:string)=>({A:'text-[#10b981]',B:'text-[#06b6d4]',C:'text-[#f59e0b]',D:'text-[#f97316]',F:'text-[#ef4444]'}[g]||'text-[#f59e0b]')

// ─── Micro Components ─────────────────────────────────────────────────────
function GlassCard({title,children,glow,className=''}:{title?:string;children:any;glow?:string;className?:string}){
  const borderMap:Record<string,string>={cyan:'border-[rgba(96,165,250,0.25)]',green:'border-[rgba(52,211,153,0.25)]',amber:'border-[rgba(251,191,36,0.25)]',violet:'border-[rgba(99,102,241,0.25)]'}
  return(
    <div className={`card p-5 relative overflow-hidden ${glow?borderMap[glow]||'':''} ${className}`}>
      {title&&<p className="section-label">{title}</p>}
      {children}
    </div>
  )
}

function ScoreRing({score,size=80,color='#a78bfa'}:{score:number;size?:number;color?:string}){
  const r=size/2-6;const c=2*Math.PI*r;const d=c-(score/100)*c
  return(
    <div className="relative flex-shrink-0" style={{width:size,height:size}}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{transform:'rotate(-90deg)'}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={c} strokeDashoffset={d} strokeLinecap="round"
          style={{transition:'stroke-dashoffset 0.8s ease',filter:`drop-shadow(0 0 8px ${color}60)`}}/>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-bold mono" style={{fontSize:size/4.5,color}}>{score}%</span>
      </div>
    </div>
  )
}

function Tag({label,color='violet'}:{label:string;color?:string}){
  return<span className={`tag tag-${color}`}>{label}</span>
}

function Bar2({value,max,color='#a78bfa',height=4}:{value:number;max?:number;color?:string;height?:number}){
  const pct=max?Math.min(100,(value/max)*100):value
  return<div style={{height,background:'rgba(255,255,255,0.06)',borderRadius:height/2,overflow:'hidden'}}><div style={{height:'100%',width:`${pct}%`,background:color,borderRadius:height/2,transition:'width 0.8s ease',boxShadow:`0 0 8px ${color}60`}}/></div>
}

function ToastStack({toasts,remove}:{toasts:Toast[];remove:(id:string)=>void}){
  const icons={success:'✅',error:'⚠️',info:'💡',warning:'⚡'}
  const colors={success:'border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.08)]',error:'border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)]',info:'border-[rgba(124,58,237,0.3)] bg-[rgba(124,58,237,0.08)]',warning:'border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.08)]'}
  return(
    <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 w-72">
      {toasts.map(t=>(
        <div key={t.id} className={`glass rounded-xl p-3 flex gap-3 items-start animate-slide-up border ${colors[t.type]}`}>
          <span className="text-base flex-shrink-0">{icons[t.type]}</span>
          <div className="flex-1 min-w-0"><p className="text-[11px] font-bold text-[var(--text)]">{t.title}</p><p className="text-[10px] text-[var(--text3)] mono mt-0.5 truncate">{t.msg}</p></div>
          <button onClick={()=>remove(t.id)} className="text-[var(--text3)] hover:text-[var(--text)] text-xs flex-shrink-0">✕</button>
        </div>
      ))}
    </div>
  )
}

function CommandPalette({onClose,onGo}:{onClose:()=>void;onGo:(p:string)=>void}){
  const[q,setQ]=useState('');const[sel,setSel]=useState(0);const ref=useRef<HTMLInputElement>(null)
  useEffect(()=>{ref.current?.focus()},[])
  const cmds=[
    {icon:'📄',label:'Analyze Resume',sub:'Upload or paste resume text',key:'⌘N',page:'home'},
    {icon:'⚡',label:'Live Score',sub:'Real-time scoring as you type',key:'⌘L',page:'livescore'},
    {icon:'💳',label:'Pricing & Plans',sub:'Upgrade to Pro',key:'⌘P',page:'pricing'},
    {icon:'📋',label:'Pipeline',sub:'Kanban candidate board',page:'pipeline'},
    {icon:'📊',label:'Analytics',sub:'Recruiter dashboard',key:'⌘A',page:'analytics'},
    {icon:'⚔️',label:'Battle Mode',sub:'Compare two candidates',page:'battle'},
    {icon:'🎙',label:'Voice Analyzer',sub:'Speak your resume',page:'voice'},
    {icon:'🔍',label:'Bias Detector',sub:'DEI compliance scanner',page:'bias'},
    {icon:'🐙',label:'GitHub Analyzer',sub:'Portfolio intelligence',page:'github'},
    {icon:'💬',label:'Salary Negotiation',sub:'Practice with AI',page:'nego'},
    {icon:'🎯',label:'Interview Sim',sub:'AI-scored mock interview',page:'interviewsim'},
    {icon:'⚙️',label:'Settings',sub:'Account & preferences',page:'settings'},
  ].filter(c=>c.label.toLowerCase().includes(q.toLowerCase())||c.sub.toLowerCase().includes(q.toLowerCase()))
  function onKey(e:React.KeyboardEvent){
    if(e.key==='ArrowDown'){e.preventDefault();setSel(s=>Math.min(s+1,cmds.length-1))}
    if(e.key==='ArrowUp'){e.preventDefault();setSel(s=>Math.max(s-1,0))}
    if(e.key==='Enter'&&cmds[sel]){onGo(cmds[sel].page);onClose()}
    if(e.key==='Escape')onClose()
  }
  return(
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-start justify-center pt-[15vh] backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="glass2 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl" style={{boxShadow:'0 25px 60px rgba(0,0,0,0.5),0 0 40px rgba(124,58,237,0.15)'}} onClick={e=>e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#1e1e1e]">
          <span className="text-[var(--violet2)]">⌘</span>
          <input ref={ref} value={q} onChange={e=>setQ(e.target.value)} onKeyDown={onKey} placeholder="Search or run a command..." className="flex-1 bg-transparent text-[var(--text)] text-sm outline-none placeholder-[var(--text3)]"/>
          <kbd className="text-[9px] mono bg-[rgba(255,255,255,0.06)] text-[var(--text3)] px-2 py-1 rounded border border-[#1e1e1e]">ESC</kbd>
        </div>
        <div className="py-2 max-h-80 overflow-y-auto">
          <p className="text-[9px] mono text-[var(--text3)] px-5 py-2 uppercase tracking-widest">Commands</p>
          {cmds.map((c,i)=>(
            <div key={c.page} onClick={()=>{onGo(c.page);onClose()}} className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors ${i===sel?'bg-[rgba(124,58,237,0.1)]':'hover:bg-[rgba(255,255,255,0.04)]'}`}>
              <div className="w-8 h-8 glass rounded-lg flex items-center justify-center text-base flex-shrink-0">{c.icon}</div>
              <div className="flex-1"><p className="text-sm font-medium text-[var(--text)]">{c.label}</p><p className="text-[10px] mono text-[var(--text3)]">{c.sub}</p></div>
              {c.key&&<kbd className="text-[9px] mono bg-[rgba(255,255,255,0.06)] text-[var(--text3)] px-2 py-0.5 rounded border border-[#1e1e1e]">{c.key}</kbd>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function AuthModal({onClose,onDone}:{onClose:()=>void;onDone:(user:User,token:string)=>void}){
  const[mode,setMode]=useState<'login'|'register'>('login')
  const[email,setEmail]=useState('');const[name,setName]=useState('');const[pw,setPw]=useState('')
  const[err,setErr]=useState('');const[loading,setLoading]=useState(false)
  async function submit(){
    setErr('');setLoading(true)
    try{const r=mode==='register'?await api.register(email,name,pw):await api.login(email,pw);localStorage.setItem('ts_token',r.token);onDone(r.user,r.token)}
    catch(e:any){setErr(e?.response?.data?.detail||'Authentication failed')}
    finally{setLoading(false)}
  }
  return(
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="glass2 rounded-2xl p-7 w-full max-w-sm" style={{boxShadow:'0 25px 60px rgba(0,0,0,0.5),0 0 40px rgba(124,58,237,0.1)'}}>
        <div className="text-center mb-6">
          <div className="text-xl font-bold"><span className="grad-text">Talent</span><span style={{color:'var(--cyan)'}}>Suite</span></div>
          <p className="text-[11px] text-[var(--text3)] mono mt-1">Intelligence that finds the right person</p>
        </div>
        <div className="flex glass rounded-xl p-1 mb-5 gap-1">
          {(['login','register']as const).map(m=><button key={m} onClick={()=>setMode(m)} className={`flex-1 py-2 text-sm font-bold rounded-lg capitalize transition-all ${mode===m?'bg-[#6366f1] text-white':'text-[var(--text2)]'}`}>{m}</button>)}
        </div>
        {mode==='register'&&<input className="inp mb-3" placeholder="Full name" value={name} onChange={e=>setName(e.target.value)}/>}
        <input className="inp mb-3" placeholder="Email address" type="email" value={email} onChange={e=>setEmail(e.target.value)}/>
        <input className="inp mb-3" placeholder="Password" type="password" value={pw} onChange={e=>setPw(e.target.value)}/>
        {err&&<p className="text-[10px] text-[var(--red)] mb-3 mono">{err}</p>}
        <button onClick={submit} disabled={loading} className="btn-primary w-full mb-2">{loading?'Please wait...':mode==='login'?'Sign in →':'Create account →'}</button>
        <button onClick={onClose} className="w-full py-2 text-[10px] text-[var(--text3)] mono">Cancel</button>
      </div>
    </div>
  )
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────
export default function App(){
  const[page,setPage]=useState('home')
  const[tab,setTab]=useState('Analysis')
  const[user,setUser]=useState<User|null>(null)
  const[plan,setPlan]=useState<any>(null)
  const[showAuth,setShowAuth]=useState(false)
  const[showCmd,setShowCmd]=useState(false)
  const[backendHealth,setBackendHealth]=useState<any>(null)
  const[toasts,setToasts]=useState<Toast[]>([])
  const[auditLog,setAuditLog]=useState<any[]>([])

  // Analysis
  const[result,setResult]=useState<any>(null)
  const[resumeText,setResumeText]=useState('')
  const[jdText,setJdText]=useState('')
  const[file,setFile]=useState<File|null>(null)
  const[dragging,setDragging]=useState(false)
  const[loading,setLoading]=useState(false)
  const[loadingMsg,setLoadingMsg]=useState('')
  const[error,setError]=useState<string|null>(null)
  const[copied,setCopied]=useState(false)
  const fileRef=useRef<HTMLInputElement>(null)

  // Tool states
  const[bullet,setBullet]=useState('');const[bulletRes,setBulletRes]=useState<any>(null);const[bulletLoading,setBulletLoading]=useState(false)
  const[clTone,setClTone]=useState('professional');const[clRes,setClRes]=useState<any>(null);const[clLoading,setClLoading]=useState(false)
  const[iqRes,setIqRes]=useState<any>(null);const[iqLoading,setIqLoading]=useState(false);const[iqTab,setIqTab]=useState('technical')
  const[bulkTexts,setBulkTexts]=useState('');const[bulkRes,setBulkRes]=useState<any>(null);const[bulkLoading,setBulkLoading]=useState(false)
  const[cv1,setCv1]=useState('');const[cv2,setCv2]=useState('');const[cmpRes,setCmpRes]=useState<any>(null);const[cmpLoading,setCmpLoading]=useState(false)

  // Extra features
  const[liveText,setLiveText]=useState('');const[liveScore,setLiveScore]=useState(0);const[liveChanges,setLiveChanges]=useState<any[]>([]);const[liveAnalyzing,setLiveAnalyzing]=useState(false)
  const[recording,setRecording]=useState(false);const[transcript,setTranscript]=useState('');const[voiceScore,setVoiceScore]=useState<number|null>(null);const recogRef=useRef<any>(null)
  const[bv1,setBv1]=useState('');const[bv2,setBv2]=useState('');const[battleRes,setBattleRes]=useState<any>(null);const[battleLoading,setBattleLoading]=useState(false)
  const[biasJD,setBiasJD]=useState('');const[biasRes,setBiasRes]=useState<any>(null)
  const[anonText,setAnonText]=useState('');const[anonRes,setAnonRes]=useState<string|null>(null);const[blindMode,setBlindMode]=useState(false)
  const[attrText,setAttrText]=useState('');const[attrRes,setAttrRes]=useState<any>(null)
  const[cultureText,setCultureText]=useState('');const[cultureJD,setCultureJD]=useState('');const[cultureRes,setCultureRes]=useState<any>(null)
  const[ghUrl,setGhUrl]=useState('');const[ghRes,setGhRes]=useState<any>(null);const[ghLoading,setGhLoading]=useState(false)
  const[execText,setExecText]=useState('');const[execRes,setExecRes]=useState<any>(null)
  const[snapshots,setSnapshots]=useState<any[]>([])
  const[negoMsgs,setNegoMsgs]=useState<any[]>([]);const[negoInput,setNegoInput]=useState('');const[negoLoading,setNegoLoading]=useState(false)
  const[simQ,setSimQ]=useState('');const[simQIdx,setSimQIdx]=useState(0);const[simA,setSimA]=useState('');const[simRes,setSimRes]=useState<any>(null);const[simLoading,setSimLoading]=useState(false)
  const[jobs,setJobs]=useState<any[]>([]);const[selJob,setSelJob]=useState<any>(null);const[pipeline,setPipeline]=useState<any>(null);const[newJobTitle,setNewJobTitle]=useState('');const[newJobDept,setNewJobDept]=useState('Engineering')
  const[analytics,setAnalytics]=useState<any>(null)
  const[history,setHistory]=useState<any[]>([])
  // New feature states
  const[mlText,setMlText]=useState('');const[mlDetected,setMlDetected]=useState<any>(null);const[mlTranslated,setMlTranslated]=useState<any>(null);const[mlLoading,setMlLoading]=useState(false)
  const[rejName,setRejName]=useState('');const[rejRole,setRejRole]=useState('');const[rejCompany,setRejCompany]=useState('');const[rejSkills,setRejSkills]=useState('');const[rejTone,setRejTone]=useState('polite');const[rejResult,setRejResult]=useState<any>(null);const[rejLoading,setRejLoading]=useState(false)
  const[mtText,setMtText]=useState('');const[mtResult,setMtResult]=useState<any>(null);const[mtLoading,setMtLoading]=useState(false)
  const[teamSkills,setTeamSkills]=useState('');const[teamCandidate,setTeamCandidate]=useState('');const[teamResult,setTeamResult]=useState<any>(null);const[teamLoading,setTeamLoading]=useState(false)
  const[trajText,setTrajText]=useState('');const[trajResult,setTrajResult]=useState<any>(null);const[trajLoading,setTrajLoading]=useState(false)
  const[hmText,setHmText]=useState('');const[hmResult,setHmResult]=useState<any>(null);const[hmLoading,setHmLoading]=useState(false)
  const[jbJobs,setJbJobs]=useState<any[]>([]);const[jbSelected,setJbSelected]=useState<any>(null);const[jbName,setJbName]=useState('');const[jbEmail,setJbEmail]=useState('');const[jbResume,setJbResume]=useState('');const[jbApplying,setJbApplying]=useState(false);const[jbLoading,setJbLoading]=useState(false)
    const[bulkRejCandidate,setBulkRejCandidate]=useState<any>(null);const[bulkRejResult,setBulkRejResult]=useState<any>(null);const[bulkRejLoading,setBulkRejLoading]=useState(false)
  const[settingsTab,setSettingsTab]=useState('profile')
  const[billingCycle,setBillingCycle]=useState<'monthly'|'yearly'>('monthly')
  const[notifications,setNotifications]=useState(true);const[liveEnabled,setLiveEnabled]=useState(true)
  const liveTimer=useRef<any>(null)

  const toast=useCallback((title:string,msg:string,type:Toast['type']='info')=>{
    const id=Math.random().toString(36).slice(2)
    setToasts(p=>[...p,{id,title,msg,type}])
    setAuditLog(p=>[{id,action:title,meta:msg,time:new Date().toLocaleTimeString()},...p].slice(0,100))
    setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),4500)
  },[])

  const removeToast=(id:string)=>setToasts(p=>p.filter(t=>t.id!==id))

  useEffect(()=>{
    api.checkHealth().then(setBackendHealth)
    const iv=setInterval(()=>api.checkHealth().then(setBackendHealth),8000)
    const token=localStorage.getItem('ts_token')
    if(token)api.getMe().then(u=>{setUser(u);api.getMyPlan().then(setPlan).catch(()=>{})}).catch(()=>localStorage.removeItem('ts_token'))
    const p=new URLSearchParams(window.location.search)
    const rid=p.get('result')
    if(rid)api.getSharedResult(rid).then(r=>{setResult(r);setPage('results')}).catch(()=>{})
    const onKey=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();setShowCmd(s=>!s)}}
    window.addEventListener('keydown',onKey)
    return()=>{clearInterval(iv);window.removeEventListener('keydown',onKey)}
  },[])

  useEffect(()=>{
    if(!user)return
    if(page==='pipeline')api.getJobs().then(setJobs)
    if(page==='analytics')api.getAnalytics().then(setAnalytics)
    if(page==='history')api.getMyResumes().then(setHistory)
    if(page==='timemachine')api.getSnapshots().then(setSnapshots).catch(()=>{})
  },[user,page])

  // Live score
  useEffect(()=>{
    if(!liveText.trim()){setLiveScore(0);setLiveChanges([]);return}
    clearTimeout(liveTimer.current)
    liveTimer.current=setTimeout(async()=>{
      setLiveAnalyzing(true)
      try{
        const r=await api.analyzeText(liveText)
        setLiveScore(r.resume_score.overall)
        const ch:any[]=[]
        if(r.skills.technical.length>0)ch.push({t:'up',p:r.skills.technical.length*2,r:`${r.skills.technical.length} technical skills found`})
        if(r.profile.experience_years!=='Not specified')ch.push({t:'up',p:6,r:'Experience years detected'})
        if(r.profile.sections.length<3)ch.push({t:'down',p:4,r:'Missing resume sections'})
        if(r.profile.email)ch.push({t:'up',p:3,r:'Contact info present'})
        setLiveChanges(ch.slice(0,4))
      }catch{}
      setLiveAnalyzing(false)
    },900)
    return()=>clearTimeout(liveTimer.current)
  },[liveText])

  async function runAnalysis(){
    if(!file&&!resumeText.trim()){setError('Please upload a file or paste resume text.');return}
    // Check plan limits
    if(plan?.is_limited&&plan?.resumes_remaining<=0){
      toast('Plan limit reached','Upgrade to Pro for unlimited resumes','warning')
      setPage('pricing');return
    }
    setError(null);setLoading(true);setResult(null)
    let i=0;setLoadingMsg(STEPS[0])
    const iv=setInterval(()=>{i=Math.min(i+1,STEPS.length-1);setLoadingMsg(STEPS[i])},700)
    try{
      const data=file?await api.analyzeFile(file,jdText):await api.analyzeText(resumeText,jdText)
      setResult(data);setPage('results');setTab('Analysis')
      setSnapshots(p=>[...p,{score:data.resume_score.overall,skills:data.skills.technical.length+data.skills.tools.length,label:new Date().getFullYear().toString(),created_at:new Date().toISOString()}].slice(0,10))
      if(user)api.getMyPlan().then(setPlan).catch(()=>{})
      toast('Analysis complete!',`${data.profile.name} · ${data.ats_score.overall}% ATS`,'success')
    }catch(e:any){
      const msg=e?.response?.data?.detail||'Cannot connect to backend. Run: py main.py'
      setError(msg);toast('Analysis failed',msg,'error')
    }finally{clearInterval(iv);setLoading(false)}
  }

  function copyShare(){
    if(!result?.result_id)return
    navigator.clipboard.writeText(window.location.origin+'?result='+result.result_id)
    setCopied(true);setTimeout(()=>setCopied(false),2000)
    toast('Link copied!','Share this link with anyone','success')
  }

  function reset(){setResult(null);setFile(null);setResumeText('');setJdText('');setError(null);setPage('home')}
  function logout(){localStorage.removeItem('ts_token');setUser(null);setPlan(null);setPage('home');toast('Signed out','See you next time!','info')}

  // Voice analyzer with real Web Speech API
  function toggleRecording(){
    if(!('webkitSpeechRecognition' in window)&&!('SpeechRecognition' in window)){
      toast('Not supported','Your browser does not support voice recording. Use Chrome.','error');return
    }
    if(recording){
      recogRef.current?.stop();setRecording(false)
      if(transcript){
        api.analyzeText(transcript).then(r=>{setVoiceScore(r.resume_score.overall);toast('Voice analysis done',`Score: ${r.resume_score.overall}%`,'success')}).catch(()=>{})
      }
    }else{
      const SR=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition
      const recog=new SR()
      recog.continuous=true;recog.interimResults=true;recog.lang='en-US'
      recog.onresult=(e:any)=>{let t='';for(let i=0;i<e.results.length;i++)t+=e.results[i][0].transcript+' ';setTranscript(t)}
      recog.onerror=()=>{setRecording(false);toast('Recording error','Could not access microphone','error')}
      recog.start();recogRef.current=recog;setRecording(true);setTranscript('');setVoiceScore(null)
      toast('Recording started','Speak your resume clearly','info')
    }
  }

  // Bias detect
  function detectBias(){
    const words=['rockstar','ninja','guru','wizard','culture fit','fast-paced','aggressive','dominant','manpower','man-hours','he or she','guys','young','energetic']
    const alts:Record<string,string>={'rockstar':'skilled engineer','ninja':'expert developer','guru':'specialist','wizard':'expert','culture fit':'values aligned','fast-paced':'dynamic','aggressive':'driven','dominant':'strong','manpower':'workforce','man-hours':'person-hours','he or she':'they','guys':'team','young':'motivated','energetic':'enthusiastic'}
    const found:any[]=[]
    biasJD.toLowerCase().split(/\s+/).forEach(w=>{const clean=w.replace(/[^a-z\s]/g,'');if(alts[clean])found.push({word:clean,type:['rockstar','ninja','guru','wizard'].includes(clean)?'Exclusionary':['manpower','man-hours','he or she','guys'].includes(clean)?'Gendered':['young','energetic'].includes(clean)?'Ageist':'Tone',alt:alts[clean]})})
    setBiasRes({found:[...new Map(found.map(f=>[f.word,f])).values()],score:Math.max(10,100-found.length*15)})
    toast('Bias scan complete',`${found.length} issues found`,'warning')
  }

  // Anonymize
  function anonymize(){
    let out=anonText
    out=out.replace(/[\w.+-]+@[\w-]+\.[a-z]{2,}/gi,'[EMAIL REDACTED]')
    out=out.replace(/(\+?\d[\d\s\-().]{8,14}\d)/g,'[PHONE REDACTED]')
    out=out.replace(/linkedin\.com\/in\/[\w-]+/gi,'[LINKEDIN REDACTED]')
    out=out.replace(/github\.com\/[\w-]+/gi,'[GITHUB REDACTED]')
    out=out.replace(/\b(19|20)\d{2}\b/g,'[YEAR REDACTED]')
    const lines=out.split('\n');if(lines[0])lines[0]='[NAME REDACTED]'
    setAnonRes(lines.join('\n'));toast('Resume anonymized','All PII removed','success')
  }

  // Attrition risk
  function analyzeAttrition(){
    const t=attrText.toLowerCase();let risk=20;const factors:any[]=[]
    const dates=(t.match(/\b20\d{2}\b/g)||[]).length
    if(dates>6){risk+=25;factors.push({icon:'⚠',txt:'Job-hopper pattern detected',pts:'+25',c:'red'})}
    if(t.includes('seeking')||t.includes('open to')||t.includes('looking')){risk+=20;factors.push({icon:'🔍',txt:'Actively seeking signals',pts:'+20',c:'red'})}
    if(!t.includes('promoted')&&!t.includes('senior')&&!t.includes('lead')){risk+=10;factors.push({icon:'📈',txt:'No visible career growth',pts:'+10',c:'amber'})}
    if(t.includes('award')||t.includes('recognition')||t.includes('achievement')){risk-=10;factors.push({icon:'🏆',txt:'Awards show engagement',pts:'-10',c:'green'})}
    risk=Math.min(95,Math.max(10,risk))
    setAttrRes({risk,level:risk>=70?'HIGH':risk>=40?'MEDIUM':'LOW',factors})
    toast('Attrition analyzed',`Risk: ${risk}/100`,'info')
  }

  // Culture fit
  function analyzeCulture(){
    const kw=['shipped','owned','scaled','impact','drove','led','built','launched','grew','delivered','bold','scrappy','iterate','fast','autonomy']
    const rl=cultureText.toLowerCase();const jl=cultureJD.toLowerCase()
    const matches=kw.filter(k=>rl.includes(k)&&jl.includes(k))
    const partial=kw.filter(k=>rl.includes(k)&&!jl.includes(k))
    const missing=kw.filter(k=>!rl.includes(k)&&jl.includes(k))
    const score=Math.round((matches.length/Math.max(kw.filter(k=>jl.includes(k)).length,1))*100)
    setCultureRes({score,matches,partial,missing,verdict:score>=75?'High culture fit — strong ownership mindset':score>=50?'Moderate fit — some culture alignment':'Low fit — consider different role type'})
    toast('Culture fit analyzed',`${score}% alignment`,'info')
  }

  // GitHub (via backend with caching)
  async function analyzeGithub(){
    if(!ghUrl.trim())return;setGhLoading(true)
    const username=ghUrl.replace(/.*github\.com\//,'').split('/')[0].split('?')[0].replace('@','')
    try{
      const r=await api.analyzeGithubReal(username)
      setGhRes(r)
      toast('GitHub analyzed',`@${r.username} — ${r.repos} repos · ${r.stars} stars`,'success')
    }catch(e:any){toast('GitHub error',e?.response?.data?.detail||e.message||'Could not fetch profile','error')}
    setGhLoading(false)
  }

  // Exec summary
  async function generateExec(){
    if(!execText.trim())return
    const r=await api.analyzeText(execText)
    setExecRes({name:r.profile.name,role:r.role_predictions[0]?.role||'Software Engineer',years:r.profile.experience_years,seniority:r.profile.seniority,ats:r.ats_score.overall,score:r.resume_score.overall,salary:fmt(r.salary_estimate.median),skills:r.skills.technical.slice(0,6),grade:r.resume_score.grade,verdict:r.resume_score.overall>=80?'✅ Strong Hire — Recommend final round':r.resume_score.overall>=65?'⚠ Good Candidate — Proceed with interview':'❌ Needs Review — Consider other candidates'})
    toast('Exec summary ready','One-page candidate card generated','success')
  }

  // Salary negotiation with real AI
  async function sendNego(){
    if(!negoInput.trim())return
    const msgs=[...negoMsgs,{role:'user',content:negoInput}]
    setNegoMsgs(msgs);setNegoInput('');setNegoLoading(true)
    try{const r=await api.aiNegotiate(msgs,'$160,000');setNegoMsgs([...msgs,{role:'assistant',content:r.response}])}
    catch{setNegoMsgs([...msgs,{role:'assistant',content:"I need to consult with our team. Can we reconnect tomorrow?"}])}
    setNegoLoading(false)
  }

  // Interview simulation with real AI scoring
  const simQuestions=['Tell me about your most impactful project and the business outcome it delivered.','Design a scalable system handling 100M requests/day. Walk through your architecture decisions.','Describe a time you disagreed with a technical decision. How did you handle it?','How do you balance technical debt with shipping new features quickly?','Where do you see AI/ML changing your field in the next 3 years?']
  function startSim(){setSimQIdx(0);setSimQ(simQuestions[0]);setSimA('');setSimRes(null)}
  async function scoreAnswer(){
    if(!simA.trim())return;setSimLoading(true)
    try{const r=await api.aiScoreAnswer(simQ,simA);setSimRes(r);toast(`Q${simQIdx+1} scored`,`Overall: ${r.overall}/10`,'info')}
    catch{setSimRes({clarity:7,depth:7,relevance:7,overall:7,feedback:'Good answer. Add specific metrics and outcomes.',mode:'fallback'})}
    setSimLoading(false)
  }

  // Upgrade to pro
  async function generateBulkRejection(candidate:any){
    setBulkRejCandidate(candidate);setBulkRejResult(null);setBulkRejLoading(true)
    try{
      const r=await api.generateRejectionEmail(candidate.name,candidate.top_role,candidate.missing_skills||[],'polite','Our Company')
      setBulkRejResult(r);toast('Email ready',`For ${candidate.name}`,'success')
    }catch{
      setBulkRejResult({email:`Dear ${candidate.name},\n\nThank you for applying for the ${candidate.top_role} position. After careful consideration, we have decided to move forward with other candidates.\n\nWe appreciate your interest and wish you the best.\n\nBest regards,\nRecruiting Team`,tone:'polite',word_count:42})
    }
    setBulkRejLoading(false)
  }

    async function handleUpgrade(){
    if(!user){setShowAuth(true);return}
    try{
      const stripeKey=import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
      if(stripeKey&&stripeKey!=='pk_test_paste_your_key_here'){
        const r=await api.createCheckout(window.location.origin+'/payment-success',window.location.origin+'/pricing')
        if(r.url)window.open(r.url,'_blank')
      }else{
        await api.upgradeDemoMode()
        const u=await api.getMe();setUser(u)
        const p=await api.getMyPlan();setPlan(p)
        toast('Upgraded to Pro!','All features unlocked (demo mode)','success')
        setPage('home')
      }
    }catch(e:any){toast('Upgrade failed',e?.response?.data?.detail||'Please try again','error')}
  }

  const totalSkills=result?result.skills.technical.length+result.skills.tools.length+result.skills.soft.length:0
  const isPro=user?.plan==='pro'||plan?.plan==='pro'

  // ── SIDEBAR ──────────────────────────────────────────────────────────────
  const navItems=[
    {icon:'📄',label:'Analyze',page:'home'},
    {icon:'⚡',label:'Live Score',page:'livescore'},
    {icon:'💳',label:'Pricing',page:'pricing'},
    ...(user?[{icon:'🕐',label:'History',page:'history'},{icon:'📋',label:'Pipeline',page:'pipeline'},{icon:'📊',label:'Analytics',page:'analytics'},{icon:'⚙️',label:'Settings',page:'settings'}]:[]),
    {icon:'🧰',label:'More Tools',page:'tools'},
  ]

  return(
    <div className="flex h-screen overflow-hidden mesh-bg" style={{fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');`}</style>

      {/* ── SIDEBAR ── */}
      <aside className="w-56 flex-shrink-0 flex flex-col glass border-r border-[#1e1e1e] z-30">
        {/* Logo */}
        <div className="p-5 border-b border-[#1e1e1e]">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={()=>setPage('home')}>
            <div className="w-7 h-7 rounded-lg bg-[#6366f1] flex items-center justify-center flex-shrink-0">
              <div className="w-2.5 h-2.5 rounded-full bg-white opacity-70"/>
            </div>
            <div>
              <div className="text-[14px] font-bold leading-tight"><span className="grad-text">Talent</span><span style={{color:'var(--cyan)'}}>Suite</span></div>
              <div className="text-[9px] mono text-[var(--text3)]">AI Recruiting</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(n=>(
            <button key={n.page} onClick={()=>setPage(n.page)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${page===n.page?'bg-[#6366f1] text-white':'text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#161616]'}`}>
              <span className="text-base">{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}
        </nav>

        {/* Plan + user */}
        <div className="p-3 border-t border-[#1e1e1e]">
          {plan&&(
            <div className="glass rounded-xl p-3 mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className={isPro?'badge-pro':'badge-free'}>{isPro?'Pro':'Free'}</span>
                {!isPro&&<button onClick={()=>setPage('pricing')} className="text-[9px] text-[var(--violet2)] mono hover:underline">Upgrade →</button>}
              </div>
              {plan.is_limited&&(
                <div>
                  <div className="flex justify-between mb-1"><span className="text-[9px] mono text-[var(--text3)]">Resumes</span><span className="text-[9px] mono text-[var(--text2)]">{plan.resumes_used}/{plan.resumes_limit}</span></div>
                  <Bar2 value={plan.resumes_used} max={plan.resumes_limit} color={plan.resumes_remaining<=1?'#ef4444':'#a78bfa'}/>
                </div>
              )}
            </div>
          )}
          {user?(
            <div className="flex items-center gap-2 px-2">
              <div className="w-7 h-7 rounded-full bg-[#6366f1] flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0">{user.name[0].toUpperCase()}</div>
              <div className="flex-1 min-w-0"><p className="text-[11px] font-bold text-[var(--text)] truncate">{user.name}</p><p className="text-[9px] mono text-[var(--text3)] truncate">{user.email}</p></div>
              <button onClick={logout} className="text-[9px] text-[var(--text3)] hover:text-[var(--red)] mono flex-shrink-0">out</button>
            </div>
          ):(
            <button onClick={()=>setShowAuth(true)} className="btn-primary w-full py-2.5 text-sm">Sign in →</button>
          )}
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="glass border-b border-[#1e1e1e] px-6 py-3 flex items-center justify-between flex-shrink-0 z-20">
          <div>
            <h1 className="text-base font-bold text-[var(--text)] capitalize">{page==='home'?'Analyze Resume':page==='results'?'Analysis Results':page==='livescore'?'Live Score':page==='pricing'?'Pricing':page==='pipeline'?'Job Pipeline':page==='analytics'?'Analytics':page==='history'?'History':page==='settings'?'Settings':page==='tools'?'All Tools':page}</h1>
            <p className="text-[10px] mono text-[var(--text3)]">
              {page==='home'?'Upload or paste resume to analyze':page==='results'&&result?`${totalSkills} skills · ${result.profile.experience_years} · ${result.profile.seniority}`:page==='livescore'?'Score updates every 0.9s as you type':page==='pricing'?'Simple, transparent pricing':'TalentSuite AI'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={()=>setShowCmd(true)} className="btn-ghost flex items-center gap-2 text-[11px]">
              <span className="text-[var(--violet2)]">⌘</span><span>K</span>
            </button>
            {result&&page==='results'&&(
              <button onClick={copyShare} className="btn-ghost text-[11px]">{copied?'✓ Copied':'🔗 Share'}</button>
            )}
            <div className="flex items-center gap-1.5 glass rounded-full px-3 py-1.5">
              <div className={`w-1.5 h-1.5 rounded-full animate-pulse-dot ${backendHealth?.status==='ok'?'bg-[var(--green)]':'bg-[var(--red)]'}`} style={{boxShadow:backendHealth?.status==='ok'?'0 0 6px var(--green)':'0 0 6px var(--red)'}}/>
              <span className={`text-[9px] mono ${backendHealth?.status==='ok'?'text-[var(--green)]':'text-[var(--red)]'}`}>{backendHealth?.status==='ok'?'API live':'offline'}</span>
              {backendHealth?.openai&&<span className="text-[8px] mono text-[var(--violet2)] ml-1">· AI ✓</span>}
              {backendHealth?.stripe&&<span className="text-[8px] mono text-[var(--cyan)] ml-1">· Stripe ✓</span>}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">

          {/* MODALS */}
          {showAuth&&<AuthModal onClose={()=>setShowAuth(false)} onDone={(u,t)=>{setUser(u);localStorage.setItem('ts_token',t);setShowAuth(false);api.getMyPlan().then(setPlan).catch(()=>{});toast('Welcome!',u.name,'success')}}/>}
          {showCmd&&<CommandPalette onClose={()=>setShowCmd(false)} onGo={p=>{setPage(p);setShowCmd(false)}}/>}
          <ToastStack toasts={toasts} remove={removeToast}/>

          {/* ══ HOME ══ */}
          {page==='home'&&(
            <div className="animate-fade-in max-w-4xl mx-auto">
              {!backendHealth&&(
                <div className="glass rounded-xl p-4 mb-5 border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.06)]">
                  <p className="text-sm text-[var(--red)] mono">⚠ Backend offline — open terminal, cd backend, run: <code className="bg-[rgba(255,255,255,0.1)] px-2 py-0.5 rounded">py main.py</code></p>
                </div>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-bold text-[var(--text)] mb-3">Upload resume</p>
                  <div className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${dragging?'border-[var(--violet2)] bg-[rgba(124,58,237,0.06)]':file?'border-[var(--green)] bg-[rgba(16,185,129,0.04)]':'border-[#272727] hover:border-[#303030]'}`}
                    onClick={()=>fileRef.current?.click()}
                    onDragOver={e=>{e.preventDefault();setDragging(true)}}
                    onDragLeave={()=>setDragging(false)}
                    onDrop={(e:DragEvent)=>{e.preventDefault();setDragging(false);const f=e.dataTransfer.files[0];if(f){setFile(f);setError(null)}}}>
                    {file?(
                      <>
                        <div className="w-14 h-14 rounded-full border border-[var(--green)] flex items-center justify-center mx-auto mb-4 text-2xl" style={{boxShadow:'0 0 20px rgba(16,185,129,0.2)'}}>✅</div>
                        <p className="text-sm font-bold text-[var(--green)]">{file.name}</p>
                        <p className="text-[10px] mono text-[var(--green)] opacity-60 mt-1">{(file.size/1024).toFixed(0)} KB</p>
                      </>
                    ):(
                      <>
                        <div className="w-14 h-14 rounded-full glass border border-[#272727] flex items-center justify-center mx-auto mb-4 text-2xl">📄</div>
                        <p className="text-sm font-bold text-[var(--text)]">Drop resume here</p>
                        <p className="text-[10px] mono text-[var(--text3)] mt-1">PDF · DOCX · TXT — or click to browse</p>
                      </>
                    )}
                    <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={(e:ChangeEvent<HTMLInputElement>)=>{if(e.target.files?.[0]){setFile(e.target.files[0]);setError(null)}}}/>
                  </div>
                  {file&&<button onClick={()=>setFile(null)} className="text-[10px] mono text-[var(--text3)] underline mt-1.5 block">Remove file</button>}
                  <div className="flex items-center gap-3 my-4"><div className="flex-1 h-px bg-[var(--border)]"/><span className="text-[10px] mono text-[var(--text3)]">or paste text</span><div className="flex-1 h-px bg-[var(--border)]"/></div>
                  <textarea className="inp" rows={7} placeholder="Paste your resume text here..." value={resumeText} disabled={!!file} onChange={e=>{setResumeText(e.target.value);setError(null)}}/>
                </div>
                <div>
                  <p className="text-sm font-bold text-[var(--text)] mb-3">Job description <span className="font-normal text-[var(--text3)]">(optional)</span></p>
                  <textarea className="inp" rows={12} placeholder="Paste the job description for JD matching, ATS scoring, bias detection, cover letter, interview prep..." value={jdText} onChange={e=>setJdText(e.target.value)}/>
                  {error&&<div className="mt-3 glass rounded-xl p-3 border border-[rgba(239,68,68,0.3)]"><p className="text-[10px] text-[var(--red)] mono">{error}</p></div>}
                  {plan?.is_limited&&(
                    <div className="mt-3 glass rounded-xl p-3 flex items-center justify-between">
                      <span className="text-[10px] mono text-[var(--text2)]">{plan.resumes_remaining} analyses remaining this month</span>
                      <button onClick={()=>setPage('pricing')} className="text-[10px] text-[var(--violet2)] mono hover:underline">Upgrade →</button>
                    </div>
                  )}
                  <button onClick={runAnalysis} disabled={loading||!backendHealth} className="btn-primary w-full mt-4 py-3.5 text-base">
                    {loading?loadingMsg:'Run TalentSuite Analysis →'}
                  </button>
                  {loading&&<div className="flex items-center justify-center gap-2 mt-3"><div className="w-4 h-4 border-2 border-[rgba(255,255,255,0.1)] border-t-[var(--violet2)] rounded-full animate-spin"/><span className="text-[10px] mono text-[var(--text3)]">{loadingMsg}</span></div>}
                </div>
              </div>
            </div>
          )}

          {/* ══ RESULTS ══ */}
          {page==='results'&&result&&(
            <div className="animate-fade-in">
              {/* Header */}
              <div className="glass rounded-2xl p-5 mb-5 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#6366f1] flex items-center justify-center text-base font-bold text-white flex-shrink-0">
                    {result.profile.name!=='Not detected'?result.profile.name.split(' ').map((w:string)=>w[0]).join('').slice(0,2):'TS'}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[var(--text)]">{result.profile.name!=='Not detected'?result.profile.name:'Resume Analysis'}</h2>
                    <p className="text-[10px] mono text-[var(--text3)]">{totalSkills} skills · {result.profile.experience_years} · {result.profile.seniority} · {new Date(result.analyzed_at).toLocaleTimeString()}</p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={copyShare} className="btn-ghost text-[11px]">{copied?'✓ Copied':'🔗 Share'}</button>
                  <button onClick={()=>window.print()} className="btn-ghost text-[11px]">🖨 PDF</button>
                  <button onClick={reset} className="btn-ghost text-[11px]">← New</button>
                </div>
              </div>

              {/* Score cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                {[
                  {l:'Top Role',v:`${result.role_predictions[0]?.score.toFixed(0)}%`,s:result.role_predictions[0]?.role.split(' ').slice(0,2).join(' '),c:'#a78bfa'},
                  {l:'ATS Score',v:`${result.ats_score.overall}%`,s:`Grade ${result.ats_score.grade}`,c:'#10b981'},
                  {l:'Resume Score',v:`${result.resume_score.overall}%`,s:result.resume_score.summary.split('.')[0],c:'#06b6d4'},
                  {l:'Salary',v:fmt(result.salary_estimate.median),s:`${Math.round(result.salary_estimate.low/1000)}k–${Math.round(result.salary_estimate.high/1000)}k`,c:'#f59e0b'},
                ].map(m=>(
                  <div key={m.l} className="glass rounded-xl p-4 relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl" style={{background:m.c}}/>
                    <p className="text-[9px] mono text-[var(--text3)] mb-1">{m.l}</p>
                    <p className="text-2xl font-bold" style={{color:m.c}}>{m.v}</p>
                    <p className="text-[9px] mono text-[var(--text3)] mt-0.5 truncate">{m.s}</p>
                  </div>
                ))}
              </div>

              {/* Tabs */}
              <div className="flex gap-1 mb-5 flex-wrap glass rounded-xl p-1">
                {TABS.map(t=>(
                  <button key={t} onClick={()=>setTab(t)} className={`text-[10px] px-3 py-2 rounded-lg mono font-medium transition-all ${tab===t?'bg-[#6366f1] text-white':'text-[var(--text3)] hover:text-[var(--text2)]'}`}>{t}</button>
                ))}
              </div>

              {/* Analysis Tab */}
              {tab==='Analysis'&&(
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <GlassCard title="Parsed Profile">
                      {[['Name',result.profile.name],['Email',result.profile.email||'—'],['Phone',result.profile.phone||'—'],['LinkedIn',result.profile.linkedin||'—'],['GitHub',result.profile.github||'—'],['Location',result.profile.location||'—'],['Experience',result.profile.experience_years],['Seniority',result.profile.seniority],['Education',result.profile.education],['Sections',result.profile.sections.join(', ')||'—']].map(([k,v])=>(
                        <div key={k} className="flex gap-3 mb-2">
                          <span className="text-[10px] mono text-[var(--text3)] w-20 flex-shrink-0 pt-0.5">{k}</span>
                          <span className="text-[11px] font-medium text-[var(--text)]">{v}</span>
                        </div>
                      ))}
                    </GlassCard>
                    <GlassCard title="Role Prediction (TF-IDF)">
                      {result.role_predictions.slice(0,7).map((r:any,i:number)=>(
                        <div key={r.role} className="mb-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-[11px] mono ${i===0?'font-bold text-[var(--text)]':'text-[var(--text2)]'}`}>{r.role}</span>
                            <span className="text-[10px] mono text-[var(--text3)]">{r.score}%</span>
                          </div>
                          <Bar2 value={r.score} color={i===0?'#a78bfa':i===1?'#06b6d4':'rgba(255,255,255,0.15)'}/>
                        </div>
                      ))}
                    </GlassCard>
                  </div>
                  <div className="space-y-4">
                    <GlassCard title="Extracted Skills">
                      {[['Technical',result.skills.technical,'cyan'],['Tools',result.skills.tools,'violet'],['Soft Skills',result.skills.soft,'amber']].map(([l,s,c]:any)=>(
                        <div key={l} className="mb-4">
                          <p className="text-[9px] mono text-[var(--text3)] mb-2">{l} ({s.length})</p>
                          <div className="flex flex-wrap gap-1">{s.length===0?<span className="text-[10px] mono text-[var(--text3)]">None detected</span>:s.map((sk:string)=><Tag key={sk} label={sk} color={c}/>)}</div>
                        </div>
                      ))}
                    </GlassCard>
                    {result.jd_match&&(
                      <GlassCard title="Quick JD Match" glow="green">
                        <div className="flex items-center gap-4 mb-3">
                          <span className="text-4xl font-bold mono" style={{color:'var(--green)'}}>{result.jd_match.score.toFixed(0)}%</span>
                          <p className="text-[10px] mono text-[var(--text2)]">{result.jd_match.gap_analysis}</p>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {result.jd_match.matched_skills.slice(0,5).map((s:string)=><Tag key={s} label={s} color="green"/>)}
                          {result.jd_match.missing_skills.slice(0,3).map((s:string)=><Tag key={s} label={s} color="red"/>)}
                        </div>
                      </GlassCard>
                    )}
                  </div>
                </div>
              )}

              {/* ATS Tab */}
              {tab==='ATS'&&(
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <GlassCard title="ATS Score" glow="cyan">
                    <div className="flex items-center gap-5 mb-5">
                      <ScoreRing score={result.ats_score.overall} size={90} color="#10b981"/>
                      <div>
                        <p className={`text-4xl font-bold mono ${gc(result.ats_score.grade)}`}>Grade {result.ats_score.grade}</p>
                        <p className="text-[10px] mono text-[var(--text3)] mt-1">ATS compatibility score</p>
                      </div>
                    </div>
                    {Object.entries(result.ats_score.checks).map(([k,c]:any)=>(
                      <div key={k} className="mb-3">
                        <div className="flex justify-between mb-1"><span className="text-[11px] font-medium text-[var(--text)] capitalize">{k.replace(/_/g,' ')}</span><span className="text-[10px] mono text-[var(--text3)]">{c.score}/{c.max}</span></div>
                        <Bar2 value={c.score} max={c.max} color="#06b6d4"/>
                        <p className="text-[9px] mono text-[var(--text3)] mt-0.5">{c.details}</p>
                      </div>
                    ))}
                  </GlassCard>
                  <GlassCard title="Improvements">
                    {result.ats_score.improvements.length===0?<p className="text-sm text-[var(--green)] mono">✓ Well optimized for ATS!</p>:result.ats_score.improvements.map((tip:string,i:number)=>(
                      <div key={i} className="flex gap-2 mb-3 p-3 glass rounded-xl border border-[rgba(245,158,11,0.2)]">
                        <span className="text-[var(--amber)]">⚠</span><p className="text-[10px] mono text-[var(--amber)]">{tip}</p>
                      </div>
                    ))}
                  </GlassCard>
                </div>
              )}

              {/* Resume Score Tab */}
              {tab==='Score'&&(
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <GlassCard title="Score Overview">
                    <div className="flex items-center gap-5 mb-5">
                      <ScoreRing score={result.resume_score.overall} size={90} color="#a78bfa"/>
                      <div>
                        <p className={`text-3xl font-bold mono ${gc(result.resume_score.grade)}`}>Grade {result.resume_score.grade}</p>
                        <p className="text-[10px] mono text-[var(--text2)] mt-1 max-w-40">{result.resume_score.summary}</p>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <RadarChart data={Object.entries(result.resume_score.dimensions).map(([,d]:any)=>({d:d.label,s:d.score}))}>
                        <PolarGrid stroke="rgba(255,255,255,0.08)"/>
                        <PolarAngleAxis dataKey="d" tick={{fontSize:10,fill:'var(--text3)',fontFamily:'JetBrains Mono'}}/>
                        <Radar name="Score" dataKey="s" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.15}/>
                      </RadarChart>
                    </ResponsiveContainer>
                  </GlassCard>
                  <GlassCard title="Dimensions">
                    {Object.entries(result.resume_score.dimensions).map(([k,d]:any)=>(
                      <div key={k} className="mb-4">
                        <div className="flex justify-between mb-1.5">
                          <span className="text-sm font-bold text-[var(--text)]">{d.label}</span>
                          <span className={`text-sm font-bold mono ${gc(d.score>=70?'A':d.score>=55?'B':'D')}`}>{d.score}%</span>
                        </div>
                        <Bar2 value={d.score} height={6} color="#a78bfa"/>
                        <p className="text-[9px] mono text-[var(--text3)] mt-1">{d.tip}</p>
                      </div>
                    ))}
                  </GlassCard>
                </div>
              )}

              {/* JD Match Tab */}
              {tab==='JD Match'&&(
                !result.jd_match?(
                  <GlassCard title="">
                    <div className="text-center py-10"><div className="text-5xl mb-3">📋</div><p className="font-bold text-[var(--text)]">No job description provided</p><p className="text-sm text-[var(--text3)] mono mt-1">Go back and paste a JD to see match analysis</p><button onClick={reset} className="btn-ghost mt-4">← Add JD</button></div>
                  </GlassCard>
                ):(
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <GlassCard title="Match Score" glow="green">
                      <div className="flex items-center gap-5 mb-4">
                        <ScoreRing score={Math.round(result.jd_match.score)} size={90} color="#10b981"/>
                        <div><p className="text-[10px] mono text-[var(--text3)] mb-1">{result.jd_match.method}</p><p className="text-[11px] mono text-[var(--text2)] leading-relaxed">{result.jd_match.gap_analysis}</p></div>
                      </div>
                      <div className="flex gap-4 mb-3 text-[10px] mono">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--green)] inline-block"/>{result.jd_match.matched_count} matched</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--red)] inline-block"/>{result.jd_match.missing_count} missing</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {result.jd_match.matched_skills.map((s:string)=><Tag key={s} label={s} color="green"/>)}
                        {result.jd_match.missing_skills.map((s:string)=><Tag key={s} label={s} color="red"/>)}
                      </div>
                    </GlassCard>
                    <GlassCard title="Skill Gap Roadmap">
                      {result.jd_match.recommendation.map((r:string,i:number)=>(
                        <div key={i} className="flex gap-2 mb-3 p-3 glass rounded-xl border border-[rgba(124,58,237,0.2)]">
                          <span className="text-[var(--violet2)]">→</span><p className="text-[10px] mono text-[var(--violet2)]">{r}</p>
                        </div>
                      ))}
                      {result.jd_match.missing_skills.slice(0,6).map((s:string)=>(
                        <div key={s} className="flex items-center gap-3 mb-2">
                          <Tag label={s} color="red"/>
                          <span className="text-[9px] mono text-[var(--text3)]">→ Learn + build a project</span>
                        </div>
                      ))}
                    </GlassCard>
                  </div>
                )
              )}

              {/* Salary Tab */}
              {tab==='Salary'&&(
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <GlassCard title="Salary Intelligence" glow="amber">
                    <div className="text-center py-4">
                      <p className="text-[10px] mono text-[var(--text3)] mb-2">estimated annual range</p>
                      <p className="text-4xl font-bold mono" style={{color:'var(--cyan)'}}>{fmt(result.salary_estimate.low)} – {fmt(result.salary_estimate.high)}</p>
                      <p className="text-sm text-[var(--text2)] mt-1 mono">Median: <span className="font-bold" style={{color:'var(--cyan)'}}>{fmt(result.salary_estimate.median)}</span></p>
                    </div>
                    <ResponsiveContainer width="100%" height={150}>
                      <BarChart data={[{n:'Low',v:result.salary_estimate.low/1000},{n:'Median',v:result.salary_estimate.median/1000},{n:'High',v:result.salary_estimate.high/1000}]} barSize={40}>
                        <XAxis dataKey="n" tick={{fontSize:11,fill:'var(--text3)',fontFamily:'JetBrains Mono'}} axisLine={false} tickLine={false}/>
                        <YAxis tick={{fontSize:10,fontFamily:'JetBrains Mono'}} axisLine={false} tickLine={false} tickFormatter={(v:any)=>`$${v}k`}/>
                        <Tooltip formatter={(v:any)=>`$${v}k`} contentStyle={{background:'rgba(6,8,24,0.9)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'10px',color:'var(--text)'}}/>
                        <Bar dataKey="v" radius={[6,6,0,0]} fill="url(#salGrad)"/>
                        <defs><linearGradient id="salGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7c3aed"/><stop offset="100%" stopColor="#06b6d4"/></linearGradient></defs>
                      </BarChart>
                    </ResponsiveContainer>
                  </GlassCard>
                  <GlassCard title="Details">
                    {[['Role',result.salary_estimate.role],['Seniority',result.salary_estimate.seniority],['Market',result.salary_estimate.market]].map(([k,v])=>(
                      <div key={k} className="flex gap-3 mb-3"><span className="text-[10px] mono text-[var(--text3)] w-20">{k}</span><span className="text-[11px] font-bold text-[var(--text)]">{v}</span></div>
                    ))}
                    <p className="text-[10px] mono text-[var(--text3)] mb-2">Premium skills detected</p>
                    <div className="flex flex-wrap gap-1 mb-4">{result.salary_estimate.premium_skills.map((s:string)=><Tag key={s} label={`💰 ${s}`} color="amber"/>)}</div>
                    <div className="p-3 glass rounded-xl border border-[rgba(245,158,11,0.2)]"><p className="text-[10px] mono text-[var(--amber)]">{result.salary_estimate.note}</p></div>
                  </GlassCard>
                </div>
              )}

              {/* Rewriter Tab */}
              {tab==='Rewriter'&&(
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <GlassCard title="AI Bullet Rewriter">
                    <textarea className="inp" rows={4} placeholder="Paste a weak bullet point to improve with AI..." value={bullet} onChange={(e:any)=>setBullet(e.target.value)}/>
                    <button onClick={async()=>{if(!bullet.trim())return;setBulletLoading(true);try{const r=await api.rewriteBullet(bullet);setBulletRes(r);toast('Bullet rewritten!','AI improved your bullet','success')}catch{}setBulletLoading(false)}} disabled={bulletLoading||!bullet.trim()} className="btn-primary w-full mt-3">
                      {bulletLoading?'Rewriting with AI...':'✨ Rewrite with AI'}
                    </button>
                    {bulletRes&&(
                      <div className="mt-4 space-y-3">
                        {bulletRes.issues_found?.length>0&&<div className="p-3 glass rounded-xl border border-[rgba(239,68,68,0.2)]"><p className="text-[10px] mono text-[var(--red)] font-bold mb-1">Issues found</p>{bulletRes.issues_found.map((i:string,idx:number)=><p key={idx} className="text-[10px] mono text-[var(--red)]">• {i}</p>)}</div>}
                        <div className="p-3 glass rounded-xl border border-[rgba(16,185,129,0.2)]"><p className="text-[10px] mono text-[var(--green)] font-bold mb-1">✓ {bulletRes.mode==='ai'?'AI Improved':'Improved'}</p><p className="text-sm text-[var(--green)] font-medium">{bulletRes.improved}</p></div>
                      </div>
                    )}
                  </GlassCard>
                  <GlassCard title="Alternatives">
                    {bulletRes?(<>
                      {bulletRes.alternatives?.map((a:string,i:number)=><div key={i} className="p-3 glass rounded-xl border border-[rgba(124,58,237,0.2)] mb-2"><p className="text-[10px] mono text-[var(--violet2)]">{a}</p></div>)}
                      {bulletRes.tips?.map((t:string,i:number)=><div key={i} className="flex gap-2 mb-2"><span className="text-[var(--violet2)]">→</span><p className="text-[10px] mono text-[var(--text2)]">{t}</p></div>)}
                    </>):<div className="text-center py-10"><div className="text-5xl mb-3">✍️</div><p className="text-sm mono text-[var(--text3)]">Paste a bullet and click Rewrite</p></div>}
                  </GlassCard>
                </div>
              )}

              {/* Cover Letter Tab */}
              {tab==='Cover Letter'&&(
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <GlassCard title="Settings">
                    <p className="text-[10px] mono text-[var(--text3)] mb-3">Select tone</p>
                    {['professional','confident','casual'].map(t=>(
                      <button key={t} onClick={()=>setClTone(t)} className={`w-full text-left text-[11px] px-3 py-2.5 rounded-xl mb-1.5 capitalize mono font-medium transition-all ${clTone===t?'bg-[#6366f1] text-white':'bg-[#161616] text-[var(--text2)] hover:text-[var(--text)] border border-[#272727]'}`}>{t}</button>
                    ))}
                    <button onClick={async()=>{setClLoading(true);try{const r=await api.generateCoverLetter(resumeText||result.profile.name,jdText||'Software Engineer',clTone);setClRes(r);toast('Cover letter ready!',`${r.word_count} words`,'success')}catch{}setClLoading(false)}} disabled={clLoading} className="btn-primary w-full mt-3">
                      {clLoading?'Generating...':'✉ Generate'}
                    </button>
                  </GlassCard>
                  <div className="lg:col-span-2">
                    <GlassCard title="Cover Letter">
                      {clRes?(<>
                        <div className="flex justify-between mb-3"><span className="text-[10px] mono text-[var(--text3)]">{clRes.word_count} words · {clRes.tone}</span><button onClick={()=>navigator.clipboard.writeText(clRes.cover_letter)} className="btn-ghost text-[10px]">📋 Copy</button></div>
                        <div className="glass rounded-xl p-4 text-[11px] leading-relaxed whitespace-pre-wrap mono text-[var(--text2)] max-h-64 overflow-y-auto">{clRes.cover_letter}</div>
                        {clRes.tips&&<div className="mt-3 space-y-1">{clRes.tips.map((t:string,i:number)=><div key={i} className="flex gap-2 p-2 glass rounded-lg"><span className="text-[var(--violet2)]">💡</span><p className="text-[10px] mono text-[var(--violet2)]">{t}</p></div>)}</div>}
                      </>):<div className="text-center py-12"><div className="text-5xl mb-3 animate-float">✉️</div><p className="text-sm mono text-[var(--text3)]">Click Generate to create a tailored cover letter</p></div>}
                    </GlassCard>
                  </div>
                </div>
              )}

              {/* Interview Questions Tab */}
              {tab==='Interview Qs'&&(
                !iqRes?(
                  <GlassCard title="">
                    <div className="text-center py-12">
                      <div className="text-5xl mb-4 animate-float">🎯</div>
                      <p className="font-bold text-[var(--text)] mb-4">Generate Interview Questions</p>
                      <button onClick={async()=>{setIqLoading(true);try{const r=await api.generateInterviewQuestions(resumeText||result.profile.name,jdText||'Software Engineer');setIqRes(r);toast('Questions ready!',`${r.technical.length+r.behavioral.length} questions`,'success')}catch{}setIqLoading(false)}} disabled={iqLoading} className="btn-primary px-8">
                        {iqLoading?'Generating...':'🎯 Generate Questions'}
                      </button>
                    </div>
                  </GlassCard>
                ):(
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    <GlassCard title="Categories">
                      {[['technical','⚙️ Technical',iqRes.technical.length],['behavioral','🤝 Behavioral',iqRes.behavioral.length],['role_specific','🎯 Role-Specific',iqRes.role_specific.length]].map(([k,l,c]:any)=>(
                        <button key={k} onClick={()=>setIqTab(k)} className={`w-full text-left text-[11px] px-3 py-2.5 rounded-xl mb-1 flex justify-between mono ${iqTab===k?'bg-[#6366f1] text-white':'glass text-[var(--text2)]'}`}><span>{l}</span><span>{c}</span></button>
                      ))}
                      <div className="mt-3 p-3 glass rounded-xl border border-[rgba(124,58,237,0.2)]">
                        <p className="text-[9px] mono text-[var(--violet2)] font-bold mb-2">Prep Tips</p>
                        {iqRes.preparation_tips.map((t:string,i:number)=><p key={i} className="text-[9px] mono text-[var(--text3)] mb-1">• {t}</p>)}
                      </div>
                    </GlassCard>
                    <div className="lg:col-span-3">
                      <GlassCard title="Questions">
                        {(iqTab==='technical'?iqRes.technical:iqTab==='behavioral'?iqRes.behavioral:iqRes.role_specific).map((q:string,i:number)=>(
                          <div key={i} className="flex gap-3 mb-4 p-4 glass rounded-xl border border-[#1e1e1e]">
                            <span className="text-[var(--violet2)] font-bold text-sm flex-shrink-0 mono">Q{i+1}</span>
                            <p className="text-sm text-[var(--text)]">{q}</p>
                          </div>
                        ))}
                      </GlassCard>
                    </div>
                  </div>
                )
              )}

              {/* Bulk Tab */}
              {tab==='Bulk'&&(
                !bulkRes?(
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <GlassCard title="Paste Multiple Resumes">
                      <p className="text-[10px] mono text-[var(--text3)] mb-2">Separate each resume with <code className="glass px-1 rounded">---</code></p>
                      <textarea className="inp" rows={14} placeholder="RESUME 1&#10;John Smith...&#10;&#10;---&#10;&#10;RESUME 2&#10;Jane Doe..." value={bulkTexts} onChange={(e:any)=>setBulkTexts(e.target.value)}/>
                      <p className="text-[10px] mono text-[var(--text3)] mt-1">{bulkTexts.split('---').filter(r=>r.trim()).length} resume(s)</p>
                    </GlassCard>
                    <GlassCard title="Instructions">
                      {['Paste JD in the main input first','Separate resumes with ---','Click Rank to score all resumes','Export as CSV for your ATS'].map((s,i)=>(
                        <div key={i} className="flex gap-3 mb-3">
                          <div className="w-6 h-6 rounded-full bg-[#6366f1] flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">{i+1}</div>
                          <p className="text-[11px] mono text-[var(--text2)] pt-0.5">{s}</p>
                        </div>
                      ))}
                      <button onClick={async()=>{const rs=bulkTexts.split('---').map(r=>r.trim()).filter(Boolean);if(rs.length<2||!jdText.trim()){toast('Need more data','Add at least 2 resumes and a JD','warning');return}setBulkLoading(true);try{const r=await api.bulkAnalyze(rs,jdText);setBulkRes(r);toast('Bulk complete!',`${r.total} candidates ranked`,'success')}catch{}setBulkLoading(false)}} disabled={bulkLoading} className="btn-primary w-full mt-4">
                        {bulkLoading?'Analyzing...':'🏆 Rank Candidates'}
                      </button>
                    </GlassCard>
                  </div>
                ):(
                  <GlassCard title={`Ranked Candidates (${bulkRes.total})`}>
                    <div className="flex justify-between mb-4">
                      <p className="text-[10px] mono text-[var(--text3)]">Sorted by composite score</p>
                      <div className="flex gap-2">
                        <button onClick={()=>setBulkRes(null)} className="btn-ghost text-[10px]">← New</button>
                        <button onClick={()=>{const csv=['Rank,Name,Email,Role,JD Match,ATS,Score,Composite'].concat(bulkRes.candidates.map((c:any)=>`${c.rank},${c.name},${c.email},${c.top_role},${c.jd_match_score}%,${c.ats_score}%,${c.resume_score}%,${c.composite_score}%`)).join('\n');const b=new Blob([csv],{type:'text/csv'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download='candidates.csv';a.click();toast('CSV exported!',`${bulkRes.total} candidates`,'success')}} className="btn-ghost text-[10px] text-[var(--green)] border-[rgba(16,185,129,0.3)]">📥 Export CSV</button>
                      </div>
                    </div>
                    
                    {bulkRejCandidate&&(
                      <div className="mb-4 p-4 rounded-xl border" style={{background:'#111111',borderColor:'#272727'}}>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[11px] font-semibold text-[var(--text)]">Rejection email — {bulkRejCandidate.name}</p>
                          <button onClick={()=>{setBulkRejCandidate(null);setBulkRejResult(null)}} className="text-[10px] text-[var(--text3)] hover:text-[var(--text)]">✕</button>
                        </div>
                        {bulkRejLoading?<p className="text-[10px] mono text-[var(--text3)]">Generating...</p>:bulkRejResult&&(
                          <div>
                            <div className="rounded-xl p-3 mb-2 max-h-28 overflow-y-auto" style={{background:'#0f0f0f',border:'1px solid #1e1e1e'}}>
                              <p className="text-[10px] mono text-[var(--text2)] whitespace-pre-wrap">{bulkRejResult.email}</p>
                            </div>
                            <button onClick={()=>navigator.clipboard.writeText(bulkRejResult.email).then(()=>toast('Copied','','success'))} className="btn-ghost btn-sm">Copy Email</button>
                          </div>
                        )}
                      </div>
                    )}
<div className="overflow-x-auto">
                      <table className="w-full text-[10px] mono">
                        <thead><tr className="border-b border-[#1e1e1e]">{['#','Name','Role','JD Match','ATS','Score','Composite','Skills'].map(h=><th key={h} className="text-left py-2.5 px-3 text-[var(--text3)] font-bold">{h}</th>)}</tr></thead>
                        <tbody>{bulkRes.candidates.map((c:any)=>(
                          <tr key={c.rank} className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.02)]">
                            <td className="py-2.5 px-3"><span className={`font-bold ${c.rank===1?'text-[#f59e0b]':c.rank===2?'text-[var(--text2)]':c.rank===3?'text-[#f97316]':'text-[var(--text3)]'}`}>#{c.rank}</span></td>
                            <td className="py-2.5 px-3 font-bold text-[var(--text)]">{c.name}</td>
                            <td className="py-2.5 px-3 text-[var(--text2)]">{c.top_role.split(' ').slice(0,2).join(' ')}</td>
                            <td className="py-2.5 px-3"><span className={`font-bold ${c.jd_match_score>=70?'text-[var(--green)]':c.jd_match_score>=50?'text-[var(--amber)]':'text-[var(--red)]'}`}>{c.jd_match_score.toFixed(0)}%</span></td>
                            <td className="py-2.5 px-3 text-[var(--text2)]">{c.ats_score}%</td>
                            <td className="py-2.5 px-3 text-[var(--text2)]">{c.resume_score}%</td>
                            <td className="py-2.5 px-3"><span className="font-bold text-[var(--violet2)]">{c.composite_score}%</span></td>
                            <td className="py-2.5 px-3 text-[var(--text3)]">{c.total_skills}</td>
                            <td className="py-2.5 px-3"><button onClick={()=>generateBulkRejection(c)} className="text-[8px] bg-[#161616] border border-[#272727] px-2 py-1 rounded mono text-[var(--text3)] hover:text-[#f87171]">✕ Reject</button></td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </GlassCard>
                )
              )}

              {/* Compare Tab */}
              {tab==='Compare'&&(
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <GlassCard title="Resume Compare">
                    <p className="text-[10px] mono text-[var(--text3)] mb-1">Version 1 (old)</p>
                    <textarea className="inp mb-3" rows={6} placeholder="Paste resume version 1..." value={cv1} onChange={(e:any)=>setCv1(e.target.value)}/>
                    <p className="text-[10px] mono text-[var(--text3)] mb-1">Version 2 (new/improved)</p>
                    <textarea className="inp mb-3" rows={6} placeholder="Paste resume version 2..." value={cv2} onChange={(e:any)=>setCv2(e.target.value)}/>
                    <button onClick={async()=>{if(!cv1.trim()||!cv2.trim())return;setCmpLoading(true);try{const r=await api.compareResumes(cv1,cv2,jdText);setCmpRes(r);toast('Compare done!',`${r.winner==='v2'?'V2 wins':'V1 wins'} by ${Math.abs(r.score_diff)}%`,'info')}catch{}setCmpLoading(false)}} disabled={cmpLoading} className="btn-primary w-full">
                      {cmpLoading?'Comparing...':'⚖️ Compare Versions'}
                    </button>
                  </GlassCard>
                  <GlassCard title="Results">
                    {cmpRes?(<div className="space-y-4">
                      <div className={`p-4 glass rounded-xl border ${cmpRes.winner==='v2'?'border-[rgba(16,185,129,0.3)]':'border-[rgba(6,182,212,0.3)]'}`}>
                        <p className={`text-sm font-bold mono ${cmpRes.winner==='v2'?'text-[var(--green)]':'text-[var(--cyan)]'}`}>🏆 {cmpRes.winner==='v2'?'Version 2 wins!':'Version 1 wins!'}</p>
                        <p className={`text-[10px] mt-1 mono ${cmpRes.winner==='v2'?'text-[var(--green)]':'text-[var(--cyan)]'}`}>Score diff: {Math.abs(cmpRes.score_diff)}% · ATS diff: {Math.abs(cmpRes.ats_diff)}%</p>
                      </div>
                      {[['Only in V1',cmpRes.skills_only_v1,'cyan'],['Only in V2',cmpRes.skills_only_v2,'green'],['Shared',cmpRes.shared_skills,'violet']].map(([l,skills,c]:any)=>(
                        <div key={l}><p className="text-[10px] mono text-[var(--text3)] mb-1.5">{l} ({skills.length})</p><div className="flex flex-wrap gap-1">{skills.slice(0,8).map((s:string)=><Tag key={s} label={s} color={c}/>)}</div></div>
                      ))}
                    </div>):<div className="text-center py-12"><div className="text-5xl mb-3">⚖️</div><p className="text-sm mono text-[var(--text3)]">Paste two resume versions and compare</p></div>}
                  </GlassCard>
                </div>
              )}
            </div>
          )}

          {/* ══ PRICING PAGE ══ */}
          {page==='pricing'&&(
            <div className="animate-fade-in max-w-4xl mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mb-2">Simple pricing</h2>
                <p className="text-[var(--text2)] mono text-sm mb-5">Start free. Scale as you grow.</p>
                <div className="inline-flex bg-[#111111] border border-[#1e1e1e] rounded-xl p-1 gap-1">
                  {(['monthly','yearly']as const).map(c=>(
                    <button key={c} onClick={()=>setBillingCycle(c)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${billingCycle===c?'bg-[#6366f1] text-white':'text-[var(--text3)] hover:text-[var(--text)]'}`}>
                      {c} {c==='yearly'&&<span className="text-[10px] ml-1 text-[#34d399]">Save 20%</span>}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {[
                  {name:'Free',price:'$0',period:'/mo',badge:'',features:['5 resumes/month','Basic NLP analysis','JD matching','ATS score','Resume score'],cta:'Get started',action:()=>setShowAuth(true),highlight:false},
                  {name:'Pro',price:`$${billingCycle==='yearly'?23:29}`,period:'/mo',badge:'Most popular',features:['Unlimited resumes','All 50 features','Pipeline + Kanban','Analytics dashboard','AI tools (OpenAI)','Salary nego sim','Interview simulation','Priority support'],cta:isPro?'Current plan':'Upgrade to Pro →',action:handleUpgrade,highlight:true},
                  {name:'Enterprise',price:'Custom',period:'',badge:'',features:['Everything in Pro','White-label option','SSO + SAML','Dedicated CSM','Custom integrations','Unlimited team seats','SLA guarantee'],cta:'Contact sales',action:()=>window.open('mailto:hello@talentsuite.ai'),highlight:false},
                ].map(p=>(
                  <div key={p.name} className={`glass rounded-2xl p-6 relative overflow-hidden transition-all ${p.highlight?'border-[rgba(124,58,237,0.4)]':''}`}>
                    {p.highlight&&<div className="absolute top-0 left-0 right-0 h-0.5 bg-[#6366f1]"/>}
                    {p.badge&&<div className="inline-block text-[10px] bg-[#6366f1] text-white px-3 py-1 rounded-full mono mb-3">{p.badge}</div>}
                    <h3 className="text-xl font-bold text-[var(--text)] mb-1">{p.name}</h3>
                    <div className="mb-5"><span className="text-3xl font-bold mono" style={{color:p.highlight?'var(--violet2)':'var(--text)'}}>{p.price}</span><span className="text-sm mono text-[var(--text3)]">{p.period}</span></div>
                    <div className="space-y-2.5 mb-6">{p.features.map(f=><div key={f} className="flex items-center gap-2"><span className="text-[var(--green)] text-sm">✓</span><span className="text-[11px] mono text-[var(--text2)]">{f}</span></div>)}</div>
                    <button onClick={p.action} disabled={isPro&&p.name==='Pro'} className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${p.highlight?'btn-primary':' btn-ghost'}`}>{p.cta}</button>
                  </div>
                ))}
              </div>
              {!user&&<div className="text-center mt-8 p-4 glass rounded-xl"><p className="text-sm mono text-[var(--text2)]">💡 Sign in first, then upgrade to Pro. Test card: <span className="text-[var(--violet2)]">4242 4242 4242 4242</span></p></div>}
              {!backendHealth?.stripe&&<div className="text-center mt-4 p-3 glass rounded-xl border border-[rgba(245,158,11,0.2)]"><p className="text-[10px] mono text-[var(--amber)]">⚠ Stripe key not configured — add STRIPE_SECRET_KEY to backend/.env for real payments. Click "Upgrade to Pro" to test in demo mode.</p></div>}
            </div>
          )}

          {/* ══ LIVE SCORE ══ */}
          {page==='livescore'&&(
            <div className="animate-fade-in max-w-5xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <GlassCard title="Resume Editor">
                  <div className="relative">
                    <div className="absolute top-0 left-0 right-0 h-px bg-[var(--violet2)] opacity-20 animate-scan" style={{pointerEvents:'none'}}/>
                    <textarea className="inp" rows={18} placeholder="Start typing or paste your resume here...&#10;&#10;Score updates automatically as you type!" value={liveText} onChange={e=>setLiveText(e.target.value)}/>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${liveAnalyzing?'bg-[var(--amber)] animate-pulse-dot':'bg-[var(--green)]'}`}/>
                    <span className="text-[9px] mono text-[var(--text3)]">{liveAnalyzing?'Analyzing...':'Live · updates every 0.9s'}</span>
                    <span className="text-[9px] mono text-[var(--text3)] ml-auto">{liveText.split(/\s+/).filter(Boolean).length} words</span>
                  </div>
                </GlassCard>
                <div className="space-y-4">
                  <GlassCard title="Live Score" glow="violet">
                    <div className="flex items-center gap-6 py-3">
                      <ScoreRing score={liveScore} size={90} color="#a78bfa"/>
                      <div>
                        <p className="text-2xl font-bold text-[var(--text)]">{liveScore>=80?'Excellent':liveScore>=60?'Good':liveScore>=40?'Average':'Needs Work'}</p>
                        <p className="text-[10px] mono text-[var(--text3)] mt-1">Resume quality score</p>
                        <Bar2 value={liveScore} height={5} color="#a78bfa" className="mt-2 w-32"/>
                      </div>
                    </div>
                  </GlassCard>
                  <GlassCard title="Real-time Changes">
                    {liveChanges.length===0?<p className="text-[10px] mono text-[var(--text3)] py-4 text-center">Start typing to see score changes...</p>:liveChanges.map((c,i)=>(
                      <div key={i} className="flex items-center gap-3 p-2.5 glass rounded-lg mb-2 border border-[#1e1e1e]">
                        <span className={`text-[10px] font-bold mono ${c.t==='up'?'text-[var(--green)]':'text-[var(--red)]'}`}>{c.t==='up'?'▲':'▼'}+{c.p}%</span>
                        <span className="text-[10px] mono text-[var(--text2)]">{c.r}</span>
                      </div>
                    ))}
                  </GlassCard>
                  <GlassCard title="Tips">
                    {['Add metrics: "reduced load time by 40%"','Include all sections: Summary, Skills, Experience, Education','Start bullets with: Led, Built, Designed, Architected','Add LinkedIn, GitHub and contact info','Keep 300–800 words for best ATS score'].map((tip,i)=>(
                      <div key={i} className="flex gap-2 mb-2"><span className="text-[var(--violet2)] flex-shrink-0 mono text-[10px]">→</span><p className="text-[10px] mono text-[var(--text2)]">{tip}</p></div>
                    ))}
                  </GlassCard>
                </div>
              </div>
            </div>
          )}

          {/* ══ TOOLS HUB ══ */}
          {page==='tools'&&(
            <div className="animate-fade-in">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
                {[
                  {icon:'🎙',label:'Voice Analyzer',sub:'Speak your resume',page:'voice'},
                  {icon:'⚔️',label:'Battle Mode',sub:'Head-to-head compare',page:'battle'},
                  {icon:'🔍',label:'Bias Detector',sub:'DEI compliance',page:'bias'},
                  {icon:'🙈',label:'Anonymizer',sub:'Blind screening',page:'anon'},
                  {icon:'⚠️',label:'Attrition Risk',sub:'Flight risk score',page:'attrition'},
                  {icon:'🔮',label:'Culture Fit',sub:'Language analysis',page:'culture'},
                  {icon:'🐙',label:'GitHub Analyzer',sub:'Real API + caching',page:'github'},
                  {icon:'📋',label:'Exec Summary',sub:'One-page card',page:'exec'},
                  {icon:'⏱',label:'Time Machine',sub:'Score history',page:'timemachine'},
                  {icon:'💬',label:'Salary Nego',sub:'AI negotiation sim',page:'nego'},
                  {icon:'🎯',label:'Interview Sim',sub:'AI-scored mock',page:'interviewsim'},
                  {icon:'🌍',label:'Multi-Language',sub:'Real translation',page:'multilang'},
                  {icon:'✉️',label:'Rejection Emails',sub:'Auto-personalized',page:'rejection'},
                  {icon:'⏰',label:'Market Timing',sub:'Availability scorer',page:'markettiming'},
                  {icon:'🧩',label:'Team Complement',sub:'Skill gap analysis',page:'teamfit'},
                  {icon:'🔭',label:'Skill Trajectory',sub:'Predict next skills',page:'trajectory'},
                  {icon:'🌡',label:'Resume Heatmap',sub:'Section strength',page:'heatmap'},
                  {icon:'💼',label:'Public Job Board',sub:'Candidates apply',page:'jobboard'},
                ].map(f=>(
                  <button key={f.page} onClick={()=>setPage(f.page)} className="glass rounded-2xl p-5 text-left hover:border-[rgba(124,58,237,0.3)] hover:shadow-[0_0_20px_rgba(124,58,237,0.1)] transition-all border border-[#1e1e1e]">
                    <div className="text-3xl mb-3 animate-float">{f.icon}</div>
                    <p className="text-sm font-bold text-[var(--text)]">{f.label}</p>
                    <p className="text-[10px] mono text-[var(--text3)] mt-0.5">{f.sub}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ══ VOICE ══ */}
          {page==='voice'&&(
            <div className="animate-fade-in max-w-4xl mx-auto">
              <button onClick={()=>setPage('tools')} className="btn-ghost text-[11px] mb-5">← Back to Tools</button>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="mb-5 p-3 rounded-xl border" style={{borderColor:'rgba(251,191,36,0.3)',background:'rgba(251,191,36,0.04)'}}>
                <p className="text-[10px] mono" style={{color:'#fbbf24'}}>⚠ Voice recording requires Chrome. Firefox and Safari are not supported. Use the text input below instead.</p>
              </div>
              <GlassCard title="Voice Recorder">
                  <div className="text-center py-6">
                    <p className="text-sm mono text-[var(--text2)] mb-6">Speak your resume — AI transcribes and structures it</p>
                    <div className="relative w-20 h-20 mx-auto mb-6">
                      <div className="absolute inset-0 rounded-full border border-[rgba(124,58,237,0.3)] animate-ring-1"/>
                      <div className="absolute inset-0 rounded-full border border-[rgba(124,58,237,0.15)] animate-ring-2"/>
                      <button onClick={toggleRecording} className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl relative z-10 transition-all ${recording?'bg-[var(--red)]':'bg-[#6366f1]'}`}>
                        {recording?'⏹':'🎙'}
                      </button>
                    </div>
                    {recording&&(
                      <div className="flex items-center justify-center gap-1 mb-4">
                        {[1,2,3,4,5,4,3,2,1].map((h,i)=>(
                          <div key={i} className={`w-1 rounded bg-[var(--violet2)] animate-wave-${Math.min(h,5)}`} style={{height:`${h*4}px`}}/>
                        ))}
                      </div>
                    )}
                    <p className={`text-sm font-bold mono ${recording?'text-[var(--red)]':'text-[var(--text3)]'}`}>{recording?'● Recording... speak now':'Click mic to start'}</p>
                    <p className="text-[10px] mono text-[var(--text3)] mt-1">{recording?'Click ⏹ to stop and analyze':'Uses Chrome Web Speech API'}</p>
                  </div>
                  <div className="glass rounded-xl p-4 min-h-24 border border-[#1e1e1e]">
                    <p className="text-[9px] mono text-[var(--text3)] mb-2">Live transcript</p>
                    {transcript?<p className="text-[11px] mono text-[var(--text2)] leading-relaxed">{transcript}</p>:<p className="text-[10px] mono text-[var(--text3)]">Transcript appears here as you speak...</p>}
                    <span className="cursor-blink"/>
                  </div>
                </GlassCard>
                <div className="space-y-4">
                  {voiceScore&&<GlassCard title="Voice Analysis" glow="violet"><div className="flex items-center gap-4 py-2"><ScoreRing score={voiceScore} size={80} color="#a78bfa"/><div><p className="text-xl font-bold text-[var(--text)]">{voiceScore}% Complete</p><p className="text-[10px] mono text-[var(--text3)]">Resume completeness from voice</p></div></div></GlassCard>}
                  <GlassCard title="Instructions">
                    {['Click mic to start — uses your browser microphone','Speak naturally about your experience and skills','Mention roles, companies, skills, and achievements','Click ⏹ to stop — AI structures your transcript','Review the transcript then run full analysis'].map((s,i)=>(
                      <div key={i} className="flex gap-3 mb-3">
                        <div className="w-6 h-6 rounded-full bg-[#6366f1] flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">{i+1}</div>
                        <p className="text-[11px] mono text-[var(--text2)] pt-0.5">{s}</p>
                      </div>
                    ))}
                    <div className="p-3 glass rounded-xl border border-[rgba(245,158,11,0.2)] mt-2">
                      <p className="text-[10px] mono text-[var(--amber)]">⚠ Requires Chrome browser for Web Speech API. Firefox/Safari not supported.</p>
                    </div>
                  </GlassCard>
                </div>
              </div>
              <GlassCard title="Text Fallback (Firefox / Safari)" className="mt-4">
                <p className="text-[10px] mono text-[var(--text2)] mb-3">Not using Chrome? Paste or type your resume below instead:</p>
                <textarea className="inp" rows={6} placeholder="Paste resume here..." value={transcript} onChange={(e:any)=>setTranscript(e.target.value)}/>
                <button onClick={()=>{if(transcript.trim()){setResumeText(transcript);setPage('home');toast('Loaded','Ready to analyze','success')}}} disabled={!transcript.trim()} className="btn-primary w-full mt-3">Use This as Resume →</button>
              </GlassCard>
            </div>
          )}

          {/* ══ BATTLE MODE ══ */}
          {page==='battle'&&(
            <div className="animate-fade-in max-w-5xl mx-auto">
              <button onClick={()=>setPage('tools')} className="btn-ghost text-[11px] mb-5">← Back to Tools</button>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
                <GlassCard title="Candidate 1"><textarea className="inp" rows={8} placeholder="Paste resume 1..." value={bv1} onChange={(e:any)=>setBv1(e.target.value)}/></GlassCard>
                <GlassCard title="Candidate 2"><textarea className="inp" rows={8} placeholder="Paste resume 2..." value={bv2} onChange={(e:any)=>setBv2(e.target.value)}/></GlassCard>
              </div>
              <div className="text-center mb-6">
                <button onClick={async()=>{if(!bv1.trim()||!bv2.trim()){toast('Missing content','Paste resumes in both fields','warning');return;}if(bv1.trim().length<50||bv2.trim().length<50){toast('Too short','Each resume needs at least 50 characters','warning');return;}setBattleLoading(true);try{const[r1,r2]=await Promise.all([api.analyzeText(bv1,jdText),api.analyzeText(bv2,jdText)]);setBattleRes({c1:r1,c2:r2});toast('Battle complete!','Head-to-head comparison ready','success')}catch{}setBattleLoading(false)}} disabled={battleLoading} className="btn-primary px-10 py-3.5 text-base">
                  {battleLoading?'Analyzing both candidates...':'⚔️ START BATTLE'}
                </button>
              </div>
              {battleRes&&(
                <GlassCard title="Battle Results" glow="violet">
                  <div className="flex items-center justify-between mb-8">
                    <div className="text-center">
                      <div className="w-14 h-14 rounded-full bg-[#6366f1] flex items-center justify-center text-xl font-bold text-white mx-auto mb-2">{battleRes.c1.profile.name[0]||'C'}</div>
                      <p className="text-sm font-bold text-[var(--text)]">{battleRes.c1.profile.name}</p>
                      <p className="text-[10px] mono text-[var(--text3)]">{battleRes.c1.profile.seniority}</p>
                    </div>
                    <div className="text-4xl font-black" style={{background:'linear-gradient(135deg,#ec4899,#a78bfa)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>VS</div>
                    <div className="text-center">
                      <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white mx-auto mb-2" style={{background:'linear-gradient(135deg,#ec4899,#f59e0b)'}}>{battleRes.c2.profile.name[0]||'C'}</div>
                      <p className="text-sm font-bold text-[var(--text)]">{battleRes.c2.profile.name}</p>
                      <p className="text-[10px] mono text-[var(--text3)]">{battleRes.c2.profile.seniority}</p>
                    </div>
                  </div>
                  {[
                    {label:'ATS Score',v1:battleRes.c1.ats_score.overall,v2:battleRes.c2.ats_score.overall,fmt:(v:number)=>`${v}%`},
                    {label:'Resume Score',v1:battleRes.c1.resume_score.overall,v2:battleRes.c2.resume_score.overall,fmt:(v:number)=>`${v}%`},
                    {label:'JD Match',v1:battleRes.c1.jd_match?.score||0,v2:battleRes.c2.jd_match?.score||0,fmt:(v:number)=>`${v.toFixed(0)}%`},
                    {label:'Skills',v1:battleRes.c1.skills.technical.length+battleRes.c1.skills.tools.length,v2:battleRes.c2.skills.technical.length+battleRes.c2.skills.tools.length,fmt:(v:number)=>v.toString()},
                    {label:'Salary',v1:battleRes.c1.salary_estimate.median,v2:battleRes.c2.salary_estimate.median,fmt},
                  ].map(m=>(
                    <div key={m.label} className="mb-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-bold mono" style={{color:m.v1>=m.v2?'#a78bfa':'var(--text3)'}}>{m.fmt(m.v1)}</span>
                        <span className="text-[10px] mono text-[var(--text3)]">{m.label}</span>
                        <span className="text-[11px] font-bold mono" style={{color:m.v2>m.v1?'#ec4899':'var(--text3)'}}>{m.fmt(m.v2)}</span>
                      </div>
                      <div className="flex gap-1 h-2.5">
                        <div className="flex-1 glass rounded-l-full overflow-hidden flex justify-end"><div className="h-full rounded-l-full bg-[#a78bfa]" style={{width:`${(m.v1/Math.max(m.v1,m.v2,1))*100}%`,transition:'width 0.8s ease'}}/></div>
                        <div className="flex-1 glass rounded-r-full overflow-hidden"><div className="h-full rounded-r-full" style={{width:`${(m.v2/Math.max(m.v1,m.v2,1))*100}%`,background:'#ec4899',transition:'width 0.8s ease'}}/></div>
                      </div>
                    </div>
                  ))}
                  <div className="p-4 glass rounded-xl border border-[rgba(124,58,237,0.3)] text-center mt-4">
                    <p className="text-sm font-bold mono text-[var(--violet2)]">
                      🏆 {battleRes.c1.resume_score.overall>=battleRes.c2.resume_score.overall?battleRes.c1.profile.name:battleRes.c2.profile.name} wins overall!
                    </p>
                  </div>
                </GlassCard>
              )}
            </div>
          )}

          {/* ══ BIAS DETECTOR ══ */}
          {page==='bias'&&(
            <div className="animate-fade-in max-w-4xl mx-auto">
              <button onClick={()=>setPage('tools')} className="btn-ghost text-[11px] mb-5">← Back to Tools</button>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <GlassCard title="Job Description Input">
                  <textarea className="inp" rows={12} placeholder="Paste job description to scan for biased language..." value={biasJD} onChange={(e:any)=>setBiasJD(e.target.value)}/>
                  <button onClick={detectBias} disabled={!biasJD.trim()} className="btn-primary w-full mt-3">🔍 Scan for Bias</button>
                </GlassCard>
                <GlassCard title="Bias Analysis">
                  {biasRes?(<>
                    <div className="flex items-center gap-4 mb-4">
                      <ScoreRing score={biasRes.score} size={70} color={biasRes.score>=70?'#10b981':biasRes.score>=40?'#f59e0b':'#ef4444'}/>
                      <div><p className="text-xl font-bold text-[var(--text)]">DEI Score: {biasRes.score}%</p><p className="text-[10px] mono text-[var(--text3)]">{biasRes.found.length} issues found</p></div>
                    </div>
                    {biasRes.found.length===0?<div className="p-4 glass rounded-xl border border-[rgba(16,185,129,0.3)] text-center"><p className="text-[var(--green)] font-bold mono">✓ No bias detected! Great JD!</p></div>:biasRes.found.map((f:any,i:number)=>(
                      <div key={i} className="p-3 glass rounded-xl border border-[rgba(239,68,68,0.2)] mb-2">
                        <p className="text-[10px] mono text-[var(--red)] font-bold mb-1">⚠ {f.type}</p>
                        <p className="text-[10px] mono">"{f.word}" <span className="text-[var(--text3)]">→</span> <span className="text-[var(--green)]">"{f.alt}"</span></p>
                      </div>
                    ))}
                  </>):<div className="text-center py-12"><div className="text-5xl mb-3">🔍</div><p className="text-sm mono text-[var(--text3)]">Paste a JD and click Scan for Bias</p></div>}
                </GlassCard>
              </div>
            </div>
          )}

          {/* ══ ANONYMIZER ══ */}
          {page==='anon'&&(
            <div className="animate-fade-in max-w-4xl mx-auto">
              <button onClick={()=>setPage('tools')} className="btn-ghost text-[11px] mb-5">← Back to Tools</button>
              <div className="glass rounded-xl p-4 mb-5 flex items-center justify-between border border-[#1e1e1e]">
                <div><p className="text-sm font-bold text-[var(--text)]">Blind Screening Mode</p><p className="text-[10px] mono text-[var(--text3)] mt-0.5">Remove all PII for unbiased evaluation</p></div>
                <button onClick={()=>setBlindMode(!blindMode)} className={`w-12 h-6 rounded-full relative transition-all ${blindMode?'bg-[#6366f1]':'glass border border-[#1e1e1e]'}`}>
                  <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow" style={{left:blindMode?'calc(100% - 22px)':'2px'}}/>
                </button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <GlassCard title="Original Resume">
                  <textarea className="inp" rows={14} placeholder="Paste resume with personal info to anonymize..." value={anonText} onChange={(e:any)=>setAnonText(e.target.value)}/>
                  <button onClick={anonymize} disabled={!anonText.trim()} className="btn-primary w-full mt-3">🙈 Anonymize</button>
                </GlassCard>
                <GlassCard title="Anonymized Version">
                  {anonRes?(<>
                    <div className="flex justify-end mb-2"><button onClick={()=>navigator.clipboard.writeText(anonRes)} className="btn-ghost text-[10px]">📋 Copy</button></div>
                    <div className="glass rounded-xl p-4 max-h-72 overflow-y-auto border border-[rgba(16,185,129,0.2)]"><p className="text-[10px] mono text-[var(--text2)] leading-relaxed whitespace-pre-wrap">{anonRes}</p></div>
                    <div className="mt-3 p-3 glass rounded-xl border border-[rgba(16,185,129,0.2)]"><p className="text-[10px] mono text-[var(--green)]">✓ Name, email, phone, LinkedIn, GitHub, graduation years redacted</p></div>
                  </>):<div className="text-center py-12"><div className="text-5xl mb-3">🙈</div><p className="text-sm mono text-[var(--text3)]">Anonymized resume appears here</p></div>}
                </GlassCard>
              </div>
            </div>
          )}

          {/* ══ ATTRITION ══ */}
          {page==='attrition'&&(
            <div className="animate-fade-in max-w-4xl mx-auto">
              <button onClick={()=>setPage('tools')} className="btn-ghost text-[11px] mb-5">← Back to Tools</button>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <GlassCard title="Resume Input">
                  <textarea className="inp" rows={12} placeholder="Paste resume to analyze attrition risk..." value={attrText} onChange={(e:any)=>setAttrText(e.target.value)}/>
                  <button onClick={analyzeAttrition} disabled={!attrText.trim()} className="btn-primary w-full mt-3">⚠ Analyze Risk</button>
                </GlassCard>
                <GlassCard title="Attrition Risk">
                  {attrRes?(<>
                    <div className="flex items-center gap-5 mb-5">
                      <ScoreRing score={attrRes.risk} size={80} color={attrRes.level==='HIGH'?'#ef4444':attrRes.level==='MEDIUM'?'#f59e0b':'#10b981'}/>
                      <div>
                        <p className={`text-3xl font-bold mono ${attrRes.level==='HIGH'?'text-[var(--red)]':attrRes.level==='MEDIUM'?'text-[var(--amber)]':'text-[var(--green)]'}`}>{attrRes.level}</p>
                        <p className="text-[10px] mono text-[var(--text3)]">{attrRes.risk}/100 risk score</p>
                      </div>
                    </div>
                    {attrRes.factors.map((f:any,i:number)=>(
                      <div key={i} className="flex items-center gap-3 p-3 glass rounded-xl mb-2 border border-[#1e1e1e]">
                        <span className="text-base">{f.icon}</span>
                        <span className="text-[10px] mono text-[var(--text2)] flex-1">{f.txt}</span>
                        <span className={`text-[10px] font-bold mono ${f.c==='red'?'text-[var(--red)]':f.c==='amber'?'text-[var(--amber)]':'text-[var(--green)]'}`}>{f.pts}</span>
                      </div>
                    ))}
                  </>):<div className="text-center py-12"><div className="text-5xl mb-3">⚠️</div><p className="text-sm mono text-[var(--text3)]">Paste a resume and click Analyze</p></div>}
                </GlassCard>
              </div>
            </div>
          )}

          {/* ══ CULTURE FIT ══ */}
          {page==='culture'&&(
            <div className="animate-fade-in max-w-5xl mx-auto">
              <button onClick={()=>setPage('tools')} className="btn-ghost text-[11px] mb-5">← Back to Tools</button>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <GlassCard title="Candidate Resume"><textarea className="inp" rows={10} placeholder="Paste candidate resume..." value={cultureText} onChange={(e:any)=>setCultureText(e.target.value)}/></GlassCard>
                <GlassCard title="Company JD / Culture Keywords"><textarea className="inp" rows={10} placeholder="Paste JD or culture keywords..." value={cultureJD} onChange={(e:any)=>setCultureJD(e.target.value)}/></GlassCard>
                <GlassCard title="Culture Fit Score">
                  <button onClick={analyzeCulture} disabled={!cultureText.trim()||!cultureJD.trim()} className="btn-primary w-full mb-5">🔮 Analyze Fit</button>
                  {cultureRes?(<>
                    <div className="flex items-center gap-4 mb-4"><ScoreRing score={cultureRes.score} size={70} color="#10b981"/><div><p className="text-2xl font-bold text-[var(--text)]">{cultureRes.score}%</p><p className="text-[10px] mono text-[var(--text3)]">culture fit</p></div></div>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {cultureRes.matches.map((k:string)=><Tag key={k} label={`✓ ${k}`} color="green"/>)}
                      {cultureRes.partial.map((k:string)=><Tag key={k} label={`≈ ${k}`} color="amber"/>)}
                      {cultureRes.missing.map((k:string)=><Tag key={k} label={`✗ ${k}`} color="red"/>)}
                    </div>
                    <div className="p-3 glass rounded-xl border border-[rgba(16,185,129,0.2)]"><p className="text-[10px] mono text-[var(--green)]">{cultureRes.verdict}</p></div>
                  </>):<div className="text-center py-6"><div className="text-4xl mb-2">🔮</div><p className="text-[10px] mono text-[var(--text3)]">Fill both fields and click Analyze</p></div>}
                </GlassCard>
              </div>
            </div>
          )}

          {/* ══ GITHUB ══ */}
          {page==='github'&&(
            <div className="animate-fade-in max-w-4xl mx-auto">
              <button onClick={()=>setPage('tools')} className="btn-ghost text-[11px] mb-5">← Back to Tools</button>
              <GlassCard title="GitHub Profile URL" className="mb-5">
                <div className="flex gap-3">
                  <input className="inp flex-1" placeholder="https://github.com/username" value={ghUrl} onChange={(e:any)=>setGhUrl(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')analyzeGithub()}}/>
                  <button onClick={analyzeGithub} disabled={!ghUrl.trim()||ghLoading} className="btn-primary px-6 flex-shrink-0">{ghLoading?'Fetching...':'Analyze'}</button>
                </div>
                <p className="text-[10px] mono text-[var(--text3)] mt-2">Uses real GitHub REST API — actual live data</p>
              </GlassCard>
              {ghRes&&(
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <GlassCard title="Profile Overview" glow="cyan">
                    <div className="flex items-center gap-3 mb-5">
                      {ghRes.avatar?<img src={ghRes.avatar} alt="avatar" className="w-12 h-12 rounded-full border border-[#272727]"/>:<div className="w-12 h-12 rounded-full glass border border-[#272727] flex items-center justify-center text-2xl">⚫</div>}
                      <div><p className="text-sm font-bold text-[var(--text)]">{ghRes.name||ghRes.username}</p><p className="text-[10px] mono text-[var(--text3)]">@{ghRes.username} · Last active: {ghRes.lastActive}</p>{ghRes.bio&&<p className="text-[10px] mono text-[var(--text2)] mt-0.5">{ghRes.bio.slice(0,60)}</p>}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mb-5">
                      {[['Repos',ghRes.repos,'#a78bfa'],['Followers',ghRes.followers,'#06b6d4'],['Stars',ghRes.stars,'#f59e0b']].map(([l,v,c])=>(
                        <div key={String(l)} className="glass rounded-xl p-3 text-center border border-[#1e1e1e]">
                          <p className="text-lg font-bold mono" style={{color:String(c)}}>{v}</p>
                          <p className="text-[9px] mono text-[var(--text3)]">{l}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] mono text-[var(--text3)] mb-2">Top languages</p>
                    <div className="flex flex-wrap gap-1">{ghRes.languages.map((l:string)=><Tag key={l} label={l} color="cyan"/>)}</div>
                  </GlassCard>
                  <GlassCard title="Code Quality">
                    {[['Code Quality Score',ghRes.quality,'#a78bfa'],['Commit Consistency',ghRes.consistency,'#06b6d4']].map(([l,v,c])=>(
                      <div key={String(l)} className="mb-4">
                        <div className="flex justify-between mb-1.5"><span className="text-[11px] font-medium text-[var(--text)]">{l}</span><span className="text-[11px] font-bold mono" style={{color:String(c)}}>{v}%</span></div>
                        <Bar2 value={Number(v)} height={6} color={String(c)}/>
                      </div>
                    ))}
                    <div className="p-4 glass rounded-xl border border-[rgba(16,185,129,0.2)] mt-4">
                      <p className="text-[10px] mono text-[var(--green)] font-bold mb-2">Signals from real GitHub data:</p>
                      <p className="text-[10px] mono text-[var(--green)]">✓ {ghRes.repos} public repositories</p>
                      <p className="text-[10px] mono text-[var(--green)]">✓ {ghRes.followers} followers — community engagement</p>
                      <p className="text-[10px] mono text-[var(--green)]">✓ {ghRes.stars} total stars earned</p>
                    </div>
                  </GlassCard>
                </div>
              )}
            </div>
          )}

          {/* ══ EXEC SUMMARY ══ */}
          {page==='exec'&&(
            <div className="animate-fade-in max-w-4xl mx-auto">
              <button onClick={()=>setPage('tools')} className="btn-ghost text-[11px] mb-5">← Back to Tools</button>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <GlassCard title="Resume Input">
                  <textarea className="inp" rows={12} placeholder="Paste resume to generate executive summary card..." value={execText} onChange={(e:any)=>setExecText(e.target.value)}/>
                  <button onClick={generateExec} disabled={!execText.trim()} className="btn-primary w-full mt-3">📋 Generate Card</button>
                </GlassCard>
                <GlassCard title="Executive Summary Card">
                  {execRes?(<div className="bg-white rounded-2xl p-6" style={{color:'#111827'}}>
                    <div className="h-1 rounded mb-5 bg-[#6366f1]"/>
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white bg-[#6366f1] flex-shrink-0">{execRes.name[0]}</div>
                      <div className="flex-1"><p className="font-bold text-gray-900">{execRes.name}</p><p className="text-[10px] text-gray-500 font-mono">{execRes.role} · {execRes.years} · {execRes.seniority}</p></div>
                      <div className="text-3xl font-black" style={{background:'linear-gradient(135deg,#7c3aed,#06b6d4)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>{execRes.grade}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {[['ATS',execRes.ats+'%'],['Score',execRes.score+'%'],['Salary',execRes.salary]].map(([l,v])=>(
                        <div key={String(l)} className="bg-purple-50 rounded-xl p-3 text-center"><p className="text-[9px] text-gray-400 font-mono">{l}</p><p className="text-sm font-bold text-purple-700">{v}</p></div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1 mb-4">{execRes.skills.map((s:string)=><span key={s} className="text-[9px] px-2 py-0.5 rounded bg-purple-100 text-purple-700 font-mono">{s}</span>)}</div>
                    <div className="rounded-xl p-3 text-center" style={{background:'linear-gradient(135deg,#ecfdf5,#d1fae5)'}}><p className="text-[11px] font-bold text-green-800">{execRes.verdict}</p></div>
                  </div>):<div className="text-center py-12"><div className="text-5xl mb-3">📋</div><p className="text-sm mono text-[var(--text3)]">Candidate card appears here</p></div>}
                </GlassCard>
              </div>
            </div>
          )}

          {/* ══ TIME MACHINE ══ */}
          {page==='timemachine'&&(
            <div className="animate-fade-in max-w-3xl mx-auto">
              <button onClick={()=>setPage('tools')} className="btn-ghost text-[11px] mb-5">← Back to Tools</button>
              <GlassCard title="Resume Score History">
                <p className="text-[10px] mono text-[var(--text3)] mb-5">Scores are saved automatically every time you run an analysis while signed in</p>
                {snapshots.length===0?(
                  <div className="text-center py-12"><div className="text-5xl mb-3">⏱</div><p className="text-sm mono text-[var(--text3)]">Run analyses to build your score history</p><button onClick={()=>setPage('home')} className="btn-primary mt-4 px-6">Analyze Resume →</button></div>
                ):(
                  <div>
                    <div className="flex gap-3 mb-5 overflow-x-auto pb-2">
                      {snapshots.map((s,i)=>(
                        <div key={i} className={`flex-shrink-0 glass rounded-2xl p-5 text-center min-w-[110px] border ${i===snapshots.length-1?'border-[rgba(124,58,237,0.4)]':'border-[#1e1e1e]'}`}>
                          <p className="text-[9px] mono text-[var(--text3)] mb-1">{new Date(s.created_at).toLocaleDateString()}</p>
                          <p className={`text-3xl font-bold mono ${s.score>=70?'text-[var(--green)]':s.score>=50?'text-[var(--amber)]':'text-[var(--red)]'}`}>{s.score}%</p>
                          <p className="text-[9px] mono text-[var(--text3)] mt-1">{s.skills} skills</p>
                          {i===snapshots.length-1&&<div className="text-[9px] mono text-[var(--violet2)] mt-1">Latest</div>}
                        </div>
                      ))}
                    </div>
                    {snapshots.length>1&&(
                      <div className="p-4 glass rounded-xl border border-[rgba(16,185,129,0.2)]">
                        <p className="text-[11px] mono text-[var(--green)]">📈 Score improved {snapshots[snapshots.length-1].score-snapshots[0].score > 0 ? '+':''}{snapshots[snapshots.length-1].score-snapshots[0].score}% since first analysis</p>
                      </div>
                    )}
                    <ResponsiveContainer width="100%" height={160} className="mt-5">
                      <LineChart data={snapshots.map(s=>({score:s.score,date:new Date(s.created_at).toLocaleDateString()}))}>
                        <XAxis dataKey="date" tick={{fontSize:9,fill:'var(--text3)',fontFamily:'JetBrains Mono'}} axisLine={false} tickLine={false}/>
                        <YAxis tick={{fontSize:9,fontFamily:'JetBrains Mono'}} axisLine={false} tickLine={false} domain={[0,100]}/>
                        <Tooltip contentStyle={{background:'rgba(6,8,24,0.9)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'10px'}}/>
                        <Line type="monotone" dataKey="score" stroke="#a78bfa" strokeWidth={2} dot={{fill:'#a78bfa',r:4}} activeDot={{r:6}}/>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </GlassCard>
            </div>
          )}

          {/* ══ SALARY NEGOTIATION ══ */}
          {page==='nego'&&(
            <div className="animate-fade-in max-w-5xl mx-auto">
              <button onClick={()=>setPage('tools')} className="btn-ghost text-[11px] mb-5">← Back to Tools</button>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <GlassCard title="Tips">
                  <p className="text-[10px] mono text-[var(--text2)] leading-relaxed mb-4">Practice negotiating with an AI hiring manager powered by {backendHealth?.openai?'OpenAI GPT':'scripted responses'}.</p>
                  {[['State your target clearly','Use specific numbers with market data'],['Use competing offers','Mention them strategically'],['Justify with rare skills','LLMs, RAG, system design = premium'],['Ask for total comp','Signing bonus + equity']].map(([t,d])=>(
                    <div key={t} className="mb-3"><p className="text-[10px] font-bold mono text-[var(--violet2)]">{t}</p><p className="text-[9px] mono text-[var(--text3)] mt-0.5">{d}</p></div>
                  ))}
                  <button onClick={()=>setNegoMsgs([{role:'assistant',content:"We'd like to offer you $140,000 base for this role. We believe it's competitive for the market. What are your thoughts on the compensation?"}])} className="btn-primary w-full mt-4">▶ Start Simulation</button>
                  {negoMsgs.length>0&&<button onClick={()=>setNegoMsgs([])} className="btn-ghost w-full mt-2">Reset</button>}
                </GlassCard>
                <div className="lg:col-span-2">
                  <GlassCard title={`Negotiation Chat${backendHealth?.openai?' (AI-powered)':' (scripted)'}`}>
                    <div className="space-y-3 mb-4 max-h-72 overflow-y-auto">
                      {negoMsgs.length===0?<div className="text-center py-10"><div className="text-4xl mb-2 animate-float">💬</div><p className="text-sm mono text-[var(--text3)]">Click Start Simulation to begin</p></div>:negoMsgs.map((m,i)=>(
                        <div key={i} className={`p-3 rounded-xl text-[11px] mono leading-relaxed max-w-[92%] border ${m.role==='assistant'?'glass border-[#1e1e1e] text-[var(--text2)]':'bg-[rgba(124,58,237,0.1)] border-[rgba(124,58,237,0.2)] text-[var(--violet2)] ml-auto'}`}>
                          <span className="font-bold">{m.role==='assistant'?'👔 Hiring Manager: ':'You: '}</span>{m.content}
                        </div>
                      ))}
                      {negoLoading&&<div className="flex items-center gap-2 p-3 glass rounded-xl"><div className="w-3 h-3 border-2 border-[rgba(255,255,255,0.1)] border-t-[var(--violet2)] rounded-full animate-spin"/><span className="text-[10px] mono text-[var(--text3)]">Thinking...</span></div>}
                    </div>
                    {negoMsgs.length>0&&(
                      <div className="flex gap-2 mt-3">
                        <input className="inp flex-1" placeholder="Your response..." value={negoInput} onChange={(e:any)=>setNegoInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')sendNego()}}/>
                        <button onClick={sendNego} disabled={negoLoading||!negoInput.trim()} className="btn-primary px-4 flex-shrink-0 disabled:opacity-40">Send</button>
                      </div>
                    )}
                    {negoMsgs.length>=8&&(
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        {[['Final Offer','$155k','var(--green)'],['Your Target','$165k','var(--violet2)'],['Left on Table','$10k','var(--amber)']].map(([l,v,c])=>(
                          <div key={String(l)} className="glass rounded-xl p-3 text-center border border-[#1e1e1e]"><p className="text-[9px] mono text-[var(--text3)]">{l}</p><p className="text-sm font-bold mono" style={{color:String(c)}}>{v}</p></div>
                        ))}
                      </div>
                    )}
                  </GlassCard>
                </div>
              </div>
            </div>
          )}

          {/* ══ INTERVIEW SIM ══ */}
          {page==='interviewsim'&&(
            <div className="animate-fade-in max-w-5xl mx-auto">
              <button onClick={()=>setPage('tools')} className="btn-ghost text-[11px] mb-5">← Back to Tools</button>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <GlassCard title="Control">
                  <p className="text-[10px] mono text-[var(--text3)] mb-2">Question {simQIdx+1} of {simQuestions.length}</p>
                  <Bar2 value={simQIdx+1} max={simQuestions.length} height={4} color="#a78bfa"/>
                  <div className="mt-5 space-y-2">
                    <button onClick={startSim} className="btn-primary w-full">▶ Start Interview</button>
                    {simQ&&<button onClick={()=>{const ni=Math.min(simQIdx+1,simQuestions.length-1);setSimQIdx(ni);setSimQ(simQuestions[ni]);setSimA('');setSimRes(null)}} className="btn-ghost w-full text-[11px]">Next Question →</button>}
                  </div>
                  {simRes&&(
                    <div className="mt-5 space-y-2">
                      {[['Clarity',simRes.clarity,'#a78bfa'],['Depth',simRes.depth,'#06b6d4'],['Relevance',simRes.relevance,'#10b981']].map(([l,v,c])=>(
                        <div key={String(l)}>
                          <div className="flex justify-between mb-1"><span className="text-[10px] mono text-[var(--text2)]">{l}</span><span className="text-[10px] mono font-bold" style={{color:String(c)}}>{v}/10</span></div>
                          <Bar2 value={Number(v)*10} height={4} color={String(c)}/>
                        </div>
                      ))}
                      <div className="p-3 glass rounded-xl border border-[rgba(16,185,129,0.2)] mt-2"><p className="text-[10px] mono text-[var(--green)] font-bold">Overall: {simRes.overall}/10</p><p className="text-[10px] mono text-[var(--green)] mt-1">{simRes.mode==='ai'?'🤖 AI: ':'📊 '}{simRes.feedback}</p></div>
                    </div>
                  )}
                </GlassCard>
                <div className="lg:col-span-2">
                  <GlassCard title={`Interview${backendHealth?.openai?' (AI-scored)':' (heuristic)'}`}>
                    {simQ?(<>
                      <div className="p-4 glass rounded-xl mb-4 border border-[rgba(124,58,237,0.2)] border-l-2 border-l-[var(--violet2)]">
                        <p className="text-[10px] mono text-[var(--text3)] mb-2">Q{simQIdx+1}</p>
                        <p className="text-sm text-[var(--text)]">{simQ}</p>
                      </div>
                      <p className="text-[10px] mono text-[var(--text3)] mb-2">Your answer — use STAR method: Situation, Task, Action, Result</p>
                      <textarea className="inp mb-3" rows={8} placeholder="Type your answer here..." value={simA} onChange={(e:any)=>setSimA(e.target.value)}/>
                      <button onClick={scoreAnswer} disabled={!simA.trim()||simLoading} className="btn-primary w-full">{simLoading?'Scoring your answer...':'📊 Score My Answer'}</button>
                    </>):<div className="text-center py-14"><div className="text-5xl mb-3 animate-float">🎯</div><p className="text-sm mono text-[var(--text3)]">Click Start Interview to begin simulation</p></div>}
                  </GlassCard>
                </div>
              </div>
            </div>
          )}

          {/* ══ MULTI-LANGUAGE ══ */}
          {/* ══ MULTI-LANGUAGE REAL ══ */}
          {page==='multilang'&&(
            <div className="animate-fade-in max-w-4xl mx-auto">
              <button onClick={()=>setPage('tools')} className="btn-ghost text-[11px] mb-5">← Back to Tools</button>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <GlassCard title="Paste Resume in Any Language">
                  <textarea className="inp" rows={12} placeholder="Paste resume in Spanish, French, German, Hindi, Chinese..." value={mlText} onChange={(e:any)=>setMlText(e.target.value)}/>
                  <div className="flex gap-2 mt-3">
                    <button onClick={async()=>{if(!mlText.trim())return;setMlLoading(true);try{const r=await api.detectLanguage(mlText);setMlDetected(r);toast('Language detected',r.language_name,'info')}catch{}setMlLoading(false)}} disabled={!mlText.trim()||mlLoading} className="btn-ghost flex-1 text-[11px]">{mlLoading?'Detecting...':'Detect Language'}</button>
                    <button onClick={async()=>{if(!mlText.trim())return;setMlLoading(true);try{const r=await api.translateResume(mlText);setMlTranslated(r);if(r.was_translated)toast('Translated!',r.original_language_name+' to English','success');else toast('Already English','No translation needed','info')}catch{}setMlLoading(false)}} disabled={!mlText.trim()||mlLoading} className="btn-primary flex-1 text-[11px]">{mlLoading?'Translating...':'Translate + Analyze'}</button>
                  </div>
                </GlassCard>
                <GlassCard title="Result">
                  {mlDetected&&!mlTranslated&&<div className="p-4 glass rounded-xl border border-[rgba(124,58,237,0.3)] mb-4"><p className="text-sm font-bold text-[var(--violet2)]">Detected: {mlDetected.language_name}</p><p className="text-[10px] mono text-[var(--text3)] mt-1">Confidence: {mlDetected.confidence}</p></div>}
                  {mlTranslated?(<div>{mlTranslated.was_translated&&<div className="p-3 glass rounded-xl border border-[rgba(16,185,129,0.3)] mb-3"><p className="text-[10px] mono text-[var(--green)] font-bold">Translated from {mlTranslated.original_language_name} to English</p></div>}<div className="glass rounded-xl p-4 max-h-48 overflow-y-auto mb-3 border border-[#1e1e1e]"><p className="text-[10px] mono text-[var(--text2)] leading-relaxed whitespace-pre-wrap">{mlTranslated.translated}</p></div><button onClick={()=>{setResumeText(mlTranslated.translated);setPage('home');toast('Ready!','Translated resume loaded','success')}} className="btn-primary w-full">Run Full Analysis on Translated Resume</button></div>):<div className="text-center py-10"><div className="text-5xl mb-3 animate-float">🌍</div><p className="text-sm mono text-[var(--text3)]">Paste resume and click Translate</p></div>}
                </GlassCard>
              </div>
            </div>
          )}

          {/* ══ REJECTION EMAIL ══ */}
          {page==='rejection'&&(
            <div className="animate-fade-in max-w-4xl mx-auto">
              <button onClick={()=>setPage('tools')} className="btn-ghost text-[11px] mb-5">← Back to Tools</button>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <GlassCard title="Candidate Details">
                  <input className="inp mb-3" placeholder="Candidate name" value={rejName} onChange={(e:any)=>setRejName(e.target.value)}/>
                  <input className="inp mb-3" placeholder="Role applied for" value={rejRole} onChange={(e:any)=>setRejRole(e.target.value)}/>
                  <input className="inp mb-3" placeholder="Company name" value={rejCompany} onChange={(e:any)=>setRejCompany(e.target.value)}/>
                  <input className="inp mb-3" placeholder="Missing skills (comma separated)" value={rejSkills} onChange={(e:any)=>setRejSkills(e.target.value)}/>
                  <div className="flex gap-1 mb-4">{['polite','firm','encouraging'].map(t=><button key={t} onClick={()=>setRejTone(t)} className={`flex-1 py-2 text-[10px] rounded-lg mono capitalize ${rejTone===t?'bg-[#6366f1] text-white':'glass text-[var(--text2)]'}`}>{t}</button>)}</div>
                  <button onClick={async()=>{setRejLoading(true);try{const r=await api.generateRejectionEmail(rejName,rejRole,rejSkills.split(',').map(s=>s.trim()).filter(Boolean),rejTone,rejCompany);setRejResult(r);toast('Email ready!',r.word_count+' words','success')}catch{}setRejLoading(false)}} disabled={!rejName.trim()||!rejRole.trim()||rejLoading} className="btn-primary w-full">{rejLoading?'Generating...':'Generate Email'}</button>
                </GlassCard>
                <div className="lg:col-span-2"><GlassCard title="Rejection Email">{rejResult?(<div><div className="flex justify-between mb-3"><span className="tag tag-gray">{rejResult.tone} · {rejResult.word_count} words</span><button onClick={()=>navigator.clipboard.writeText(rejResult.email).then(()=>toast('Copied!','','success'))} className="btn-ghost text-[10px]">Copy</button></div><div className="glass rounded-xl p-4 max-h-80 overflow-y-auto border border-[#1e1e1e] mb-3"><p className="text-[11px] mono text-[var(--text2)] whitespace-pre-wrap">{rejResult.email}</p></div>{rejResult.tips?.map((t:string,i:number)=><p key={i} className="text-[9px] mono text-[var(--violet2)] mb-1">💡 {t}</p>)}</div>):<div className="text-center py-14"><div className="text-5xl mb-3 animate-float">✉️</div><p className="text-sm mono text-[var(--text3)]">Fill details and generate</p></div>}</GlassCard></div>
              </div>
            </div>
          )}

          {/* ══ MARKET TIMING ══ */}
          {page==='markettiming'&&(
            <div className="animate-fade-in max-w-4xl mx-auto">
              <button onClick={()=>setPage('tools')} className="btn-ghost text-[11px] mb-5">← Back to Tools</button>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <GlassCard title="Resume Input"><textarea className="inp" rows={12} placeholder="Paste resume to score candidate availability..." value={mtText} onChange={(e:any)=>setMtText(e.target.value)}/><button onClick={async()=>{if(!mtText.trim())return;setMtLoading(true);try{const r=await api.marketTiming(mtText);setMtResult(r);toast('Scored',r.level+' — '+r.score+'/100','info')}catch{}setMtLoading(false)}} disabled={!mtText.trim()||mtLoading} className="btn-primary w-full mt-3">{mtLoading?'Analyzing...':'Score Market Timing'}</button></GlassCard>
                <GlassCard title="Market Timing Score">{mtResult?(<div><div className="flex items-center gap-5 mb-4"><ScoreRing score={mtResult.score} size={80} color={mtResult.level==='HIGH'?'#10b981':mtResult.level==='MEDIUM'?'#f59e0b':'#ef4444'}/><div><p className={`text-3xl font-bold mono ${mtResult.level==='HIGH'?'text-[var(--green)]':mtResult.level==='MEDIUM'?'text-[var(--amber)]':'text-[var(--red)]'}`}>{mtResult.level}</p><p className="text-[10px] mono text-[var(--text3)]">availability signal</p></div></div><div className="p-3 glass rounded-xl border border-[rgba(124,58,237,0.2)] mb-3"><p className="text-[10px] mono text-[var(--violet2)]">{mtResult.recommendation}</p></div>{mtResult.signals?.map((s:any,i:number)=><div key={i} className="flex items-center gap-2 p-2 glass rounded-lg mb-1 border border-[#1e1e1e]"><span className="text-[10px] font-bold mono text-[var(--green)]">{s.impact}</span><span className="text-[9px] mono text-[var(--text2)]">{s.signal}</span></div>)}</div>):<div className="text-center py-12"><div className="text-5xl mb-3 animate-float">⏰</div><p className="text-sm mono text-[var(--text3)]">Paste resume and score timing</p></div>}</GlassCard>
              </div>
            </div>
          )}

          {/* ══ TEAM COMPLEMENT ══ */}
          {page==='teamfit'&&(
            <div className="animate-fade-in max-w-5xl mx-auto">
              <button onClick={()=>setPage('tools')} className="btn-ghost text-[11px] mb-5">← Back to Tools</button>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <GlassCard title="Team Skills"><textarea className="inp" rows={6} placeholder="React, Python, AWS, Docker..." value={teamSkills} onChange={(e:any)=>setTeamSkills(e.target.value)}/><p className="text-[10px] mono text-[var(--text3)] mt-1">{teamSkills.split(',').filter(s=>s.trim()).length} skills</p></GlassCard>
                <GlassCard title="Candidate Resume"><textarea className="inp" rows={8} placeholder="Paste candidate resume..." value={teamCandidate} onChange={(e:any)=>setTeamCandidate(e.target.value)}/><button onClick={async()=>{const skills=teamSkills.split(',').map(s=>s.trim()).filter(Boolean);if(!skills.length||!teamCandidate.trim())return;setTeamLoading(true);try{const r=await api.teamComplement(skills,teamCandidate);setTeamResult(r);toast('Done',r.recommendation,'info')}catch{}setTeamLoading(false)}} disabled={!teamSkills.trim()||!teamCandidate.trim()||teamLoading} className="btn-primary w-full mt-3">{teamLoading?'Analyzing...':'Analyze Fit'}</button></GlassCard>
                <GlassCard title="Result">{teamResult?(<div><div className="flex items-center gap-4 mb-4"><ScoreRing score={teamResult.complement_score} size={70} color="#a78bfa"/><div><p className="text-xl font-bold text-[var(--text)]">{teamResult.complement_score}%</p><p className="text-[10px] mono text-[var(--text3)]">complement</p></div></div><div className={`p-3 glass rounded-xl border mb-3 ${teamResult.hire_recommendation?'border-[rgba(16,185,129,0.3)]':'border-[rgba(239,68,68,0.3)]'}`}><p className={`text-[10px] mono font-bold ${teamResult.hire_recommendation?'text-[var(--green)]':'text-[var(--red)]'}`}>{teamResult.hire_recommendation?'✅':'❌'} {teamResult.recommendation}</p></div><p className="text-[9px] mono text-[var(--text3)] mb-1">Unique skills added:</p><div className="flex flex-wrap gap-1 mb-2">{teamResult.unique_to_candidate?.slice(0,6).map((s:string)=><Tag key={s} label={s} color="green"/>)}</div></div>):<div className="text-center py-8"><div className="text-4xl mb-2">🧩</div><p className="text-[10px] mono text-[var(--text3)]">Fill both fields and analyze</p></div>}</GlassCard>
              </div>
            </div>
          )}

          {/* ══ SKILL TRAJECTORY ══ */}
          {page==='trajectory'&&(
            <div className="animate-fade-in max-w-4xl mx-auto">
              <button onClick={()=>setPage('tools')} className="btn-ghost text-[11px] mb-5">← Back to Tools</button>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <GlassCard title="Resume Input"><textarea className="inp" rows={12} placeholder="Paste resume to predict skill trajectory..." value={trajText} onChange={(e:any)=>setTrajText(e.target.value)}/><button onClick={async()=>{if(!trajText.trim())return;setTrajLoading(true);try{const r=await api.skillTrajectory(trajText);setTrajResult(r);toast('Predicted',r.trajectory,'info')}catch{}setTrajLoading(false)}} disabled={!trajText.trim()||trajLoading} className="btn-primary w-full mt-3">{trajLoading?'Predicting...':'Predict Trajectory'}</button></GlassCard>
                <GlassCard title="Skill Trajectory">{trajResult?(<div><div className="p-3 glass rounded-xl border border-[rgba(124,58,237,0.2)] mb-4"><p className="text-[10px] mono text-[var(--violet2)]">{trajResult.insight}</p></div><p className="text-[10px] mono text-[var(--text3)] mb-1">Current ({trajResult.current_skills?.length})</p><div className="flex flex-wrap gap-1 mb-3">{trajResult.current_skills?.slice(0,8).map((s:string)=><Tag key={s} label={s} color="cyan"/>)}</div><p className="text-[10px] mono text-[var(--violet2)] mb-2">Predicted next:</p><div className="space-y-1.5 mb-3">{trajResult.predicted_next?.map((p:any,i:number)=><div key={i} className="flex items-center gap-2 p-2 glass rounded-lg border border-[rgba(124,58,237,0.2)]"><Tag label={p.skill} color="violet"/><span className="text-[9px] mono text-[var(--text3)] flex-1">from {p.based_on}</span><span className={`text-[8px] mono ${p.confidence==='High'?'text-[var(--green)]':'text-[var(--amber)]'}`}>{p.confidence}</span></div>)}</div><p className="text-[10px] mono text-[var(--amber)] mb-2">Priority to add now:</p><div className="space-y-1">{trajResult.trending_to_add?.map((t:any,i:number)=><div key={i} className="flex items-center gap-2 p-2 glass rounded-lg border border-[rgba(245,158,11,0.2)]"><Tag label={t.skill} color="amber"/><span className="text-[9px] mono text-[var(--text3)]">{t.reason}</span></div>)}</div></div>):<div className="text-center py-12"><div className="text-5xl mb-3 animate-float">🔭</div><p className="text-sm mono text-[var(--text3)]">Paste resume and predict trajectory</p></div>}</GlassCard>
              </div>
            </div>
          )}

          {/* ══ RESUME HEATMAP ══ */}
          {page==='heatmap'&&(
            <div className="animate-fade-in max-w-4xl mx-auto">
              <button onClick={()=>setPage('tools')} className="btn-ghost text-[11px] mb-5">← Back to Tools</button>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <GlassCard title="Resume Input"><textarea className="inp" rows={12} placeholder="Paste resume to generate section heatmap..." value={hmText} onChange={(e:any)=>setHmText(e.target.value)}/><button onClick={async()=>{if(!hmText.trim())return;setHmLoading(true);try{const r=await api.resumeHeatmap(hmText);setHmResult(r);toast('Heatmap ready',r.strongest+' is strongest','info')}catch{}setHmLoading(false)}} disabled={!hmText.trim()||hmLoading} className="btn-primary w-full mt-3">{hmLoading?'Analyzing...':'Generate Heatmap'}</button></GlassCard>
                <GlassCard title="Section Heatmap">{hmResult?(<div><div className="flex items-center justify-between mb-4"><div><p className="text-2xl font-bold mono" style={{color:hmResult.overall>=75?'var(--green)':hmResult.overall>=50?'var(--amber)':'var(--red)'}}>{hmResult.overall}%</p><p className="text-[10px] mono text-[var(--text3)]">overall strength</p></div><div className="text-right"><p className="text-[10px] mono text-[var(--green)]">Strong: {hmResult.strongest}</p><p className="text-[10px] mono text-[var(--red)]">Weak: {hmResult.weakest}</p></div></div><div className="space-y-3">{hmResult.sections?.map((s:any)=><div key={s.name}><div className="flex justify-between mb-1"><span className="text-[11px] font-medium text-[var(--text)]">{s.name}</span><span className="text-[10px] mono font-bold" style={{color:s.score>=75?'var(--green)':s.score>=50?'var(--amber)':'var(--red)'}}>{s.score}%</span></div><div className="h-4 glass rounded-lg overflow-hidden border border-[#1e1e1e]"><div className="h-full rounded-lg" style={{width:s.score+'%',background:s.score>=75?'rgba(16,185,129,0.3)':s.score>=50?'rgba(245,158,11,0.3)':'rgba(239,68,68,0.3)',transition:'width 0.7s ease'}}/></div>{s.issues?.length>0&&<p className="text-[9px] mono text-[var(--red)] mt-0.5">{s.issues[0]}</p>}</div>)}</div><div className="mt-4 p-3 glass rounded-xl border border-[rgba(124,58,237,0.2)]"><p className="text-[10px] mono text-[var(--violet2)]">{hmResult.recommendation}</p></div></div>):<div className="text-center py-12"><div className="text-5xl mb-3 animate-float">🌡</div><p className="text-sm mono text-[var(--text3)]">Paste resume and see section strengths</p></div>}</GlassCard>
              </div>
            </div>
          )}

          {/* ══ PUBLIC JOB BOARD ══ */}
          {page==='jobboard'&&(
            <div className="animate-fade-in max-w-5xl mx-auto">
              <div className="flex items-center justify-between mb-5">
                <div><h2 className="text-xl font-bold text-[var(--text)]">Public Job Board</h2><p className="text-[10px] mono text-[var(--text3)]">Apply directly — resume auto-analyzed</p></div>
                <button onClick={async()=>{setJbLoading(true);try{const r=await api.getPublicJobs();setJbJobs(r)}catch{}setJbLoading(false)}} className="btn-ghost text-[11px]">{jbLoading?'Loading...':'Refresh'}</button>
              </div>
              {!jbSelected?(
                jbJobs.length===0?<GlassCard title=""><div className="text-center py-14"><div className="text-5xl mb-3 animate-float">💼</div><p className="font-bold text-[var(--text)] mb-2">No public jobs yet</p><p className="text-sm mono text-[var(--text3)] mb-4">Create jobs in Pipeline to list them here</p><div className="flex gap-3 justify-center"><button onClick={()=>setPage('pipeline')} className="btn-primary px-6">Go to Pipeline</button><button onClick={async()=>{const r=await api.getPublicJobs().catch(()=>[]);setJbJobs(r)}} className="btn-ghost px-6">Load Jobs</button></div></div></GlassCard>:(
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {jbJobs.map((j:any)=>(
                      <div key={j.id} onClick={()=>setJbSelected(j)} className="glass rounded-2xl p-5 border border-[#1e1e1e] cursor-pointer hover:border-[rgba(124,58,237,0.4)] transition-all">
                        <div className="flex items-start justify-between mb-2"><p className="text-base font-bold text-[var(--text)]">{j.title}</p><Tag label={j.department} color="violet"/></div>
                        <p className="text-[10px] mono text-[var(--text3)] mb-2">{j.location||'Remote'} · {j.applicant_count||0} applicants</p>
                        <p className="text-[11px] text-[var(--text2)] line-clamp-2">{j.description?.slice(0,120)}...</p>
                      </div>
                    ))}
                  </div>
                )
              ):(
                <div>
                  <button onClick={()=>setJbSelected(null)} className="btn-ghost text-[11px] mb-5">← Back to Jobs</button>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2"><GlassCard title="Job Details"><h2 className="text-xl font-bold text-[var(--text)] mb-1">{jbSelected.title}</h2><p className="text-[10px] mono text-[var(--text3)] mb-4">{jbSelected.department} · {jbSelected.location||'Remote'}</p><p className="text-sm text-[var(--text2)] leading-relaxed whitespace-pre-wrap">{jbSelected.description}</p></GlassCard></div>
                    <GlassCard title="Apply Now"><input className="inp mb-3" placeholder="Your name" value={jbName} onChange={(e:any)=>setJbName(e.target.value)}/><input className="inp mb-3" placeholder="Your email" value={jbEmail} onChange={(e:any)=>setJbEmail(e.target.value)}/><textarea className="inp mb-3" rows={8} placeholder="Paste your resume..." value={jbResume} onChange={(e:any)=>setJbResume(e.target.value)}/><button onClick={async()=>{if(!jbName.trim()||!jbResume.trim())return;setJbApplying(true);try{const r=await api.applyToJob(jbSelected.id,jbName,jbEmail,jbResume);toast('Submitted!',r.message,'success');setJbSelected(null);setJbName('');setJbEmail('');setJbResume('')}catch{}setJbApplying(false)}} disabled={!jbName.trim()||!jbResume.trim()||jbApplying} className="btn-primary w-full">{jbApplying?'Submitting...':'Submit Application'}</button><p className="text-[9px] mono text-[var(--text3)] mt-2 text-center">Resume auto-analyzed and added to pipeline</p></GlassCard>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ PIPELINE ══ */}
          {page==='pipeline'&&user&&(
            <div className="animate-fade-in">
              <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                <div/>
                <div className="flex gap-2">
                  <input className="inp w-44 py-2" placeholder="Job title..." value={newJobTitle} onChange={(e:any)=>setNewJobTitle(e.target.value)}/>
                  <select className="inp w-36 py-2" value={newJobDept} onChange={(e:any)=>setNewJobDept(e.target.value)}>
                    {['Engineering','Product','Design','Data','AI/ML','DevOps'].map(d=><option key={d}>{d}</option>)}
                  </select>
                  <button onClick={async()=>{if(!newJobTitle.trim())return;await api.createJob(newJobTitle,jdText,newJobDept);setNewJobTitle('');api.getJobs().then(setJobs);toast('Job created!',newJobTitle,'success')}} className="btn-primary px-4 flex-shrink-0">+ New Job</button>
                </div>
              </div>
              {jobs.length===0?<GlassCard title=""><div className="text-center py-14"><div className="text-5xl mb-3">💼</div><p className="font-bold text-[var(--text)]">No jobs yet</p><p className="text-sm mono text-[var(--text3)] mt-1">Create your first job opening above</p></div></GlassCard>:(
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    {jobs.map((j:any)=>(
                      <div key={j.id} onClick={async()=>{setSelJob(j);setPipeline(await api.getPipeline(j.id))}} className={`glass rounded-xl p-4 cursor-pointer transition-all border ${selJob?.id===j.id?'border-[rgba(124,58,237,0.4)]':'border-[#1e1e1e] hover:border-[#272727]'}`}>
                        <p className="text-sm font-bold text-[var(--text)]">{j.title}</p>
                        <p className="text-[10px] mono text-[var(--text3)] mt-1">{j.department} · {j.candidate_count} candidates</p>
                      </div>
                    ))}
                  </div>
                  <div className="lg:col-span-3">
                    {pipeline&&selJob?(
                      <div>
                        <p className="text-sm font-bold text-[var(--text)] mb-4">{selJob.title} — Kanban Board</p>
                        <div className="grid grid-cols-5 gap-2">
                          {STAGES.map(stage=>(
                            <div key={stage} className="glass rounded-xl p-3 border border-[#1e1e1e]">
                              <p className="text-[9px] font-bold capitalize mono mb-3" style={{color:STAGE_COLOR[stage]}}>{stage} ({(pipeline.board[stage]||[]).length})</p>
                              {(pipeline.board[stage]||[]).map((c:any)=>(
                                <div key={c.id} className="glass rounded-lg p-2.5 mb-2 border border-[#1e1e1e]">
                                  <p className="text-[10px] font-bold text-[var(--text)]">{c.name}</p>
                                  <p className="text-[9px] mono text-[var(--text3)]">{c.match_score?.toFixed(0)}%</p>
                                  <div className="flex gap-1 mt-1.5 flex-wrap">
                                    {STAGES.filter(s=>s!==stage).slice(0,2).map(s=>(
                                      <button key={s} onClick={()=>api.updateCandidateStatus(c.id,s).then(()=>api.getPipeline(selJob.id).then(p=>{setPipeline(p);toast('Status updated',`${c.name} → ${s}`,'info')}))}
                                        className="text-[7px] px-1.5 py-0.5 rounded mono glass border border-[#1e1e1e]" style={{color:STAGE_COLOR[s]}}>→{s.slice(0,4)}</button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    ):<GlassCard title=""><div className="text-center py-10"><div className="text-4xl mb-3">👈</div><p className="text-sm mono text-[var(--text3)]">Select a job to view kanban board</p></div></GlassCard>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ ANALYTICS ══ */}
          {page==='analytics'&&user&&(
            <div className="animate-fade-in">
              {analytics?(
                <div className="space-y-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[['Total Resumes',analytics.total_resumes,'#a78bfa'],['Active Jobs',analytics.total_jobs,'#10b981'],['Avg JD Match',`${analytics.avg_match_score}%`,'#06b6d4'],['Avg ATS',`${analytics.avg_ats_score}%`,'#f59e0b']].map(([l,v,c])=>(
                      <div key={String(l)} className="glass rounded-xl p-5 relative overflow-hidden border border-[#1e1e1e]">
                        <div className="absolute top-0 left-0 right-0 h-0.5" style={{background:String(c)}}/>
                        <p className="text-[10px] mono text-[var(--text3)] mb-1">{l}</p>
                        <p className="text-3xl font-bold mono" style={{color:String(c)}}>{v}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <GlassCard title="Pipeline Funnel">
                      {Object.entries(analytics.pipeline_status).length===0?<p className="text-sm mono text-[var(--text3)] text-center py-4">No pipeline data yet</p>:Object.entries(analytics.pipeline_status).map(([stage,count])=>(
                        <div key={stage} className="mb-3">
                          <div className="flex justify-between mb-1"><span className="text-[11px] capitalize font-medium text-[var(--text)] mono">{stage}</span><span className="text-[10px] mono text-[var(--text3)]">{count}</span></div>
                          <Bar2 value={Number(count)} max={Math.max(...Object.values(analytics.pipeline_status) as number[])} color={STAGE_COLOR[stage]||'#a78bfa'} height={6}/>
                        </div>
                      ))}
                    </GlassCard>
                    <GlassCard title="Weekly Activity">
                      {analytics.weekly_activity?.length>0?(
                        <ResponsiveContainer width="100%" height={180}>
                          <BarChart data={analytics.weekly_activity}>
                            <XAxis dataKey="day" tick={{fontSize:9,fill:'var(--text3)',fontFamily:'JetBrains Mono'}} axisLine={false} tickLine={false}/>
                            <YAxis tick={{fontSize:9,fontFamily:'JetBrains Mono'}} axisLine={false} tickLine={false}/>
                            <Tooltip contentStyle={{background:'rgba(6,8,24,0.9)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'10px'}}/>
                            <Bar dataKey="n" radius={[4,4,0,0]} fill="#a78bfa"/>
                          </BarChart>
                        </ResponsiveContainer>
                      ):<p className="text-sm mono text-[var(--text3)] text-center py-8">Analyze more resumes to see weekly activity</p>}
                    </GlassCard>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <GlassCard title="Top Roles Applied For">
                      {analytics.top_roles?.length>0?(
                        <ResponsiveContainer width="100%" height={180}>
                          <BarChart data={analytics.top_roles} layout="vertical" barSize={14}>
                            <XAxis type="number" tick={{fontSize:9,fill:'var(--text3)',fontFamily:'JetBrains Mono'}} axisLine={false} tickLine={false}/>
                            <YAxis type="category" dataKey="role" tick={{fontSize:8,fill:'var(--text3)',fontFamily:'JetBrains Mono'}} axisLine={false} tickLine={false} width={120}/>
                            <Tooltip contentStyle={{background:'rgba(6,8,24,0.9)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'10px'}}/>
                            <Bar dataKey="count" radius={[0,4,4,0]} fill="#a78bfa"/>
                          </BarChart>
                        </ResponsiveContainer>
                      ):<p className="text-sm mono text-[var(--text3)] text-center py-8">No role data yet</p>}
                    </GlassCard>
                    <GlassCard title="Pipeline Distribution">
                      {Object.keys(analytics.pipeline_status).length>0?(
                        <ResponsiveContainer width="100%" height={180}>
                          <PieChart>
                            <Pie data={Object.entries(analytics.pipeline_status).map(([k,v])=>({name:k,value:v}))} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value">
                              {Object.entries(analytics.pipeline_status).map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
                            </Pie>
                            <Tooltip contentStyle={{background:'rgba(6,8,24,0.9)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'10px'}}/>
                          </PieChart>
                        </ResponsiveContainer>
                      ):<p className="text-sm mono text-[var(--text3)] text-center py-8">No pipeline data yet</p>}
                    </GlassCard>
                  </div>
                  <GlassCard title="Key Metrics">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {[['Avg JD Match',analytics.avg_match_score+'%','#10b981'],['Avg ATS Score',analytics.avg_ats_score+'%','#06b6d4'],['Avg Resume Score',analytics.avg_resume_score+'%','#a78bfa'],['Hire Rate',analytics.hire_rate+'%','#f59e0b']].map(([l,v,c])=>(
                        <div key={String(l)} className="glass rounded-xl p-4 border border-[#1e1e1e]"><p className="text-[9px] mono text-[var(--text3)] mb-1">{l}</p><p className="text-2xl font-bold mono" style={{color:String(c)}}>{v}</p></div>
                      ))}
                    </div>
                    {analytics?.is_demo&&<div className="p-3 mb-4 rounded-xl border" style={{borderColor:'rgba(251,191,36,0.3)',background:'rgba(251,191,36,0.04)'}}><p className="text-[10px] mono" style={{color:'#fbbf24'}}>📊 Showing demo data — analyze resumes and create pipeline jobs to see your real data here</p></div>}
                  </GlassCard>
                </div>
              ):<div className="text-center py-20"><div className="w-10 h-10 border-2 border-[rgba(255,255,255,0.1)] border-t-[var(--violet2)] rounded-full animate-spin mx-auto"/></div>}
            </div>
          )}

          {/* ══ HISTORY ══ */}
          {page==='history'&&user&&(
            <div className="animate-fade-in">
              {history.length===0?<GlassCard title=""><div className="text-center py-14"><div className="text-5xl mb-3">📂</div><p className="font-bold text-[var(--text)]">No history yet</p><p className="text-sm mono text-[var(--text3)] mt-1">Analyze resumes while signed in to save them here</p><button onClick={()=>setPage('home')} className="btn-primary mt-5">Analyze Resume →</button></div></GlassCard>:(
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {history.map((r:any)=>(
                    <GlassCard key={r.id} title="">
                      <p className="font-bold text-sm text-[var(--text)]">{r.name}</p>
                      <p className="text-[10px] mono text-[var(--text3)] mb-3">{r.filename} · {new Date(r.created_at).toLocaleDateString()}</p>
                      <p className="text-[10px] mono text-[var(--text2)] mb-3">{r.top_role}</p>
                      <div className="flex gap-2 flex-wrap">
                        <Tag label={`ATS ${r.ats_score}%`} color="cyan"/>
                        <Tag label={`Score ${r.resume_score}%`} color="green"/>
                      </div>
                    </GlassCard>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══ SETTINGS ══ */}
          {page==='settings'&&(
            <div className="animate-fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <GlassCard title="Menu">
                  {['profile','notifications','appearance','api','audit'].map(t=>(
                    <button key={t} onClick={()=>setSettingsTab(t)} className={`w-full text-left text-[11px] px-3 py-2.5 rounded-xl mb-1 capitalize mono font-medium ${settingsTab===t?'bg-[#6366f1] text-white':'bg-[#161616] text-[var(--text2)] hover:text-[var(--text)] border border-[#272727]'}`}>{t}</button>
                  ))}
                </GlassCard>
                <div className="lg:col-span-3">
                  {settingsTab==='profile'&&(
                    <GlassCard title="Profile">
                      {user?(<>
                        {[['Name',user.name],['Email',user.email],['Role',user.role],['Plan',plan?.plan||'free']].map(([l,v])=>(
                          <div key={String(l)} className="flex items-center justify-between py-3 border-b border-[#1e1e1e]">
                            <div><p className="text-sm font-medium text-[var(--text)]">{l}</p><p className="text-[10px] mono text-[var(--text3)]">{v}</p></div>
                          </div>
                        ))}
                        <div className="mt-4 flex gap-3">
                          {!isPro&&<button onClick={()=>setPage('pricing')} className="btn-primary px-5">Upgrade to Pro →</button>}
                          <button onClick={logout} className="btn-ghost text-[var(--red)] border-[rgba(239,68,68,0.2)]">Sign out</button>
                        </div>
                      </>):<p className="text-sm mono text-[var(--text3)]">Sign in to view profile</p>}
                    </GlassCard>
                  )}
                  {settingsTab==='notifications'&&(
                    <GlassCard title="Notifications">
                      {[['Email alerts','New candidate matches',notifications,()=>setNotifications(!notifications)],['Live score','Real-time scoring',liveEnabled,()=>setLiveEnabled(!liveEnabled)],['Toast notifications','In-app alerts',true,()=>{}]].map(([l,s,v,toggle]:any)=>(
                        <div key={String(l)} className="flex items-center justify-between py-3.5 border-b border-[#1e1e1e]">
                          <div><p className="text-sm font-medium text-[var(--text)]">{l}</p><p className="text-[10px] mono text-[var(--text3)]">{s}</p></div>
                          <button onClick={toggle} className={`w-11 h-6 rounded-full relative transition-all ${v?'bg-[#6366f1]':'glass border border-[#1e1e1e]'}`}>
                            <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow" style={{left:v?'calc(100% - 22px)':'2px'}}/>
                          </button>
                        </div>
                      ))}
                    </GlassCard>
                  )}
                  {settingsTab==='appearance'&&(
                    <GlassCard title="Appearance">
                      <div className="flex items-center justify-between py-3.5 border-b border-[#1e1e1e]">
                        <div><p className="text-sm font-medium text-[var(--text)]">Dark mode (Glassmorphism)</p><p className="text-[10px] mono text-[var(--text3)]">Deep navy + frosted glass</p></div>
                        <button className="w-11 h-6 rounded-full relative bg-[#6366f1]" style={{boxShadow:'0 0 10px rgba(124,58,237,0.3)'}}>
                          <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 shadow" style={{left:'calc(100% - 22px)'}}/>
                        </button>
                      </div>
                      <div className="mt-5"><p className="text-[10px] mono text-[var(--text3)] mb-3">Accent color</p><div className="flex gap-3">{['#7c3aed','#06b6d4','#10b981','#ef4444','#f59e0b'].map(c=><div key={c} className="w-9 h-9 rounded-full cursor-pointer border-2 border-[#1e1e1e] transition-all hover:scale-110" style={{background:c,boxShadow:`0 0 12px ${c}60`}}/>)}</div></div>
                    </GlassCard>
                  )}
                  {settingsTab==='api'&&(
                    <GlassCard title="API Reference">
                      <div className="glass rounded-xl p-4 mb-5 border border-[#1e1e1e]">
                        <p className="text-[9px] mono text-[var(--text3)] mb-1">Base URL</p>
                        <p className="text-[11px] mono text-[var(--violet2)]">http://localhost:8001</p>
                        <p className="text-[9px] mono text-[var(--text3)] mt-2">Interactive docs</p>
                        <p className="text-[11px] mono text-[var(--cyan)]">http://localhost:8001/docs</p>
                      </div>
                      <div className="space-y-2">
                        {[['POST','/upload-resume','Upload and analyze resume file'],['POST','/analyze-text','Analyze resume text'],['POST','/bulk-analyze','Rank multiple candidates'],['POST','/ai/negotiate','AI salary negotiation'],['POST','/ai/score-interview-answer','AI interview scoring'],['GET','/payments/my-plan','Get current plan'],['POST','/payments/create-checkout','Start Stripe checkout'],['GET','/jobs','List jobs (auth required)'],['GET','/analytics','Dashboard stats (auth required)']].map(([method,path,desc])=>(
                          <div key={String(path)} className="flex items-center gap-3 p-2.5 glass rounded-xl border border-[#1e1e1e]">
                            <span className={`text-[9px] px-2 py-0.5 rounded mono font-bold flex-shrink-0 ${String(method)==='GET'?'tag-green':'tag-violet'}`}>{method}</span>
                            <span className="text-[10px] mono text-[var(--violet2)] flex-shrink-0">{path}</span>
                            <span className="text-[9px] mono text-[var(--text3)] hidden sm:block truncate">{desc}</span>
                          </div>
                        ))}
                      </div>
                    </GlassCard>
                  )}
                  {settingsTab==='audit'&&(
                    <GlassCard title="Audit Log">
                      <p className="text-[10px] mono text-[var(--text3)] mb-4">All actions logged automatically in this session</p>
                      {auditLog.length===0?<p className="text-sm mono text-[var(--text3)] text-center py-8">No actions yet — start using TalentSuite!</p>:auditLog.map((log:any)=>(
                        <div key={log.id} className="flex gap-3 py-3 border-b border-[#1e1e1e]">
                          <div className="w-2 h-2 rounded-full bg-[var(--violet2)] flex-shrink-0 mt-1.5" style={{boxShadow:'0 0 4px var(--violet2)'}}/>
                          <div className="flex-1 min-w-0"><p className="text-[11px] font-medium text-[var(--text)]">{log.action}</p><p className="text-[9px] mono text-[var(--text3)] truncate">{log.meta}</p></div>
                          <p className="text-[9px] mono text-[var(--text3)] flex-shrink-0">{log.time}</p>
                        </div>
                      ))}
                    </GlassCard>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Auth gate */}
          {['pipeline','analytics','history'].includes(page)&&!user&&(
            <div className="text-center py-24 animate-fade-in">
              <div className="text-6xl mb-5">🔐</div>
              <h2 className="text-2xl font-bold text-[var(--text)] mb-2">Sign in required</h2>
              <p className="mono text-[var(--text3)] mb-6">Create a free account to access {page}</p>
              <button onClick={()=>setShowAuth(true)} className="btn-primary px-10 py-3.5 text-base">Sign in / Create account →</button>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}
