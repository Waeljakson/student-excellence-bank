import {useMemo,useState} from "react";
import {niceError,rpc} from "./client";
import "./assessments.css";

type DraftQ={
  prompt:string;section:string;axis:string;type:"LIKERT"|"SINGLE"|"TEXT";
  optionsText:string;required:boolean;scored:boolean;reverse:boolean;
};
const emptyQ=():DraftQ=>({prompt:"",section:"الأسئلة",axis:"",type:"LIKERT",optionsText:"",required:true,scored:true,reverse:false});
const likert=[
 {code:"NEVER",label:"أبدًا",score:0},
 {code:"RARELY",label:"نادرًا",score:1},
 {code:"SOMETIMES",label:"أحيانًا",score:2},
 {code:"OFTEN",label:"غالبًا",score:3},
 {code:"ALWAYS",label:"دائمًا",score:4}
];

export default function AssessmentScaleBuilder({onClose,onCreated}:{onClose:()=>void;onCreated:(id:string)=>void}){
 const[title,setTitle]=useState(""),[shortTitle,setShortTitle]=useState(""),[description,setDescription]=useState(""),[instructions,setInstructions]=useState(""),[minutes,setMinutes]=useState("7–10 دقائق");
 const[questions,setQuestions]=useState<DraftQ[]>([emptyQ()]),[busy,setBusy]=useState(false),[error,setError]=useState(""),[bulkOpen,setBulkOpen]=useState(false),[bulkText,setBulkText]=useState("");
 const sections=useMemo(()=>{const m=new Map<string,number>();questions.forEach(q=>{const s=q.section.trim()||"الأسئلة";if(!m.has(s))m.set(s,m.size+1)});return m},[questions]);
 function patch(i:number,p:Partial<DraftQ>){setQuestions(q=>q.map((x,n)=>n===i?{...x,...p}:x))}
 function remove(i:number){setQuestions(q=>q.length===1?q:q.filter((_,n)=>n!==i))}
 function add(){setQuestions(q=>[...q,emptyQ()])}
 function importBulk(){
  setError("");
  const lines=bulkText.split("\n").map(x=>x.trim()).filter(Boolean);
  if(!lines.length){setError("ألصق بيانات الأسئلة أولًا.");return}
  const parsed:DraftQ[]=[];
  for(const [idx,line] of lines.entries()){
   const parts=line.split("|").map(x=>x.trim());
   let type:"LIKERT"|"SINGLE"|"TEXT"="LIKERT",section="الأسئلة",axis="",prompt="",opts="";
   if(["LIKERT","SINGLE","TEXT"].includes((parts[0]||"").toUpperCase())){
    type=(parts[0]||"LIKERT").toUpperCase() as DraftQ["type"];
    section=parts[1]||"الأسئلة";axis=parts[2]||"";prompt=parts[3]||"";opts=parts.slice(4).join("|");
   }else if(parts.length>=3){
    section=parts[0]||"الأسئلة";axis=parts[1]||"";prompt=parts.slice(2).join("|");
   }else{
    prompt=line;
   }
   if(!prompt){setError("تعذر قراءة السطر رقم "+(idx+1)+". استخدم الصيغة الموضحة أسفل مربع الاستيراد.");return}
   parsed.push({prompt,section,axis,type,optionsText:type==="SINGLE"?opts.split(";").map(x=>x.trim()).filter(Boolean).join("\n"):"",required:true,scored:type!=="TEXT",reverse:false});
  }
  setQuestions(q=>q.length===1&&!q[0].prompt.trim()?parsed:[...q,...parsed]);
  setBulkText("");setBulkOpen(false);
 }
 async function save(){
  setError("");
  if(!title.trim()){setError("اكتب اسم المقياس.");return}
  if(!questions.length||questions.some(q=>!q.prompt.trim())){setError("أكمل نص جميع الأسئلة.");return}
  for(let i=0;i<questions.length;i++){const q=questions[i];if(q.type==="SINGLE"&&q.optionsText.split("\n").map(x=>x.trim()).filter(Boolean).length<2){setError("السؤال رقم "+(i+1)+" يحتاج خيارين على الأقل.");return}}
  const axisMap=new Map<string,string>();
  const payload=questions.map((q,i)=>{
   const section=q.section.trim()||"الأسئلة",step=sections.get(section)||1;
   let axis=q.axis.trim();
   if(q.scored&&!axis)axis=section;
   if(axis&&!axisMap.has(axis))axisMap.set(axis,"axis_"+(axisMap.size+1));
   let options:any[]=[];
   if(q.type==="LIKERT")options=q.reverse?likert.map((o,n)=>({...o,score:4-n})):likert;
   else if(q.type==="SINGLE"){
    const lines=q.optionsText.split("\n").map(x=>x.trim()).filter(Boolean);
    options=lines.map((label,n)=>q.scored?{code:"OPT_"+(n+1),label,score:q.reverse?lines.length-1-n:n}:{code:"OPT_"+(n+1),label});
   }
   return{
    step_order:step,section_key:"section_"+step,section_title_ar:section,
    axis_key:axis?axisMap.get(axis):null,axis_title_ar:axis||null,
    prompt_ar:q.prompt.trim(),question_type:q.type,options,
    is_required:q.required,is_scored:q.type==="TEXT"?false:q.scored
   };
  });
  setBusy(true);
  try{
   const r:any=await rpc("api_assessment_create_scale",{
    p_title_ar:title.trim(),p_short_title_ar:(shortTitle.trim()||title.trim()),
    p_description_ar:description.trim(),p_instructions_ar:instructions.trim(),
    p_estimated_minutes:minutes.trim(),p_questions:payload
   });
   onCreated(r.id);
  }catch(e){setError(niceError(e))}finally{setBusy(false)}
 }
 return <div className="assessment-preview-overlay" dir="rtl">
  <div className="assessment-builder-window">
   <div className="assessment-preview-toolbar">
    <div><span>إنشاء مقياس جديد</span><b>يبقى مسودة حتى تحدد موعد نشره</b><small>يمكنك بناء أي مقياس بالاسم والأسئلة والمحاور التي تختارها.</small></div>
    <button className="btn ghost" onClick={onClose}>إغلاق ×</button>
   </div>
   <div className="assessment-builder-body">
    {error&&<div className="notice error">{error}</div>}
    <section className="panel builder-meta">
     <h3>بيانات المقياس</h3>
     <div className="builder-grid">
      <label><span>اسم المقياس</span><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="مثال: مقياس القلق الدراسي"/></label>
      <label><span>الاسم المختصر</span><input value={shortTitle} onChange={e=>setShortTitle(e.target.value)} placeholder="مثال: القلق الدراسي"/></label>
      <label><span>المدة المتوقعة</span><input value={minutes} onChange={e=>setMinutes(e.target.value)}/></label>
      <label className="wide"><span>وصف المقياس</span><textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3}/></label>
      <label className="wide"><span>تعليمات الطالب</span><textarea value={instructions} onChange={e=>setInstructions(e.target.value)} rows={3}/></label>
     </div>
    </section>

    <section className="panel builder-questions">
     <div className="panel-row"><div><h3>الأسئلة</h3><p>رتّب الأسئلة، وحدد القسم والمحور ونوع الإجابة.</p></div><div className="builder-head-actions"><button className="btn ghost" onClick={()=>setBulkOpen(v=>!v)}>⇩ استيراد سريع</button><button className="btn primary" onClick={add}>+ إضافة سؤال</button></div></div>
     {bulkOpen&&<div className="bulk-import-box"><h4>لصق بيانات المقياس دفعة واحدة</h4><textarea rows={8} value={bulkText} onChange={e=>setBulkText(e.target.value)} placeholder={"مثال بسيط:\nالنوم والصحة | النوم والصحة | أتأخر في النوم بسبب استخدامي للأجهزة\n\nأو صيغة متقدمة:\nLIKERT | الدراسة | التأثير الدراسي | يؤثر الاستخدام على واجباتي\nTEXT | رأي الطالب | | ما الذي يساعدك على التوازن؟\nSINGLE | العادات | | هل لديك وقت محدد؟ | نعم;أحيانًا;لا"}/><small>الصيغة: النوع | القسم | المحور | السؤال | الخيارات عند الحاجة. ويمكن حذف «النوع» ليُنشأ السؤال تلقائيًا كمقياس خماسي.</small><button className="btn primary" onClick={importBulk}>تحويل النص إلى أسئلة</button></div>}
     {questions.map((q,i)=><article className="builder-question" key={i}>
      <header><b>السؤال {i+1}</b><button type="button" onClick={()=>remove(i)} disabled={questions.length===1}>حذف</button></header>
      <div className="builder-grid">
       <label className="wide"><span>نص السؤال</span><textarea rows={2} value={q.prompt} onChange={e=>patch(i,{prompt:e.target.value})}/></label>
       <label><span>القسم/الخطوة</span><input value={q.section} onChange={e=>patch(i,{section:e.target.value})} placeholder="مثال: النوم والصحة"/></label>
       <label><span>المحور التحليلي</span><input value={q.axis} onChange={e=>patch(i,{axis:e.target.value})} placeholder="مثال: النوم والصحة"/></label>
       <label><span>نوع السؤال</span><select value={q.type} onChange={e=>patch(i,{type:e.target.value as DraftQ["type"],scored:e.target.value==="TEXT"?false:q.scored})}><option value="LIKERT">مقياس خماسي</option><option value="SINGLE">اختيار واحد</option><option value="TEXT">إجابة نصية</option></select></label>
       {q.type==="SINGLE"&&<label className="wide"><span>الخيارات — كل خيار في سطر</span><textarea rows={4} value={q.optionsText} onChange={e=>patch(i,{optionsText:e.target.value})} placeholder={"نعم\nأحيانًا\nلا"}/></label>}
       <label className="check"><input type="checkbox" checked={q.required} onChange={e=>patch(i,{required:e.target.checked})}/><span>سؤال مطلوب</span></label>
       {q.type!=="TEXT"&&<label className="check"><input type="checkbox" checked={q.scored} onChange={e=>patch(i,{scored:e.target.checked})}/><span>يدخل في النتيجة</span></label>}{q.type!=="TEXT"&&q.scored&&<label className="check"><input type="checkbox" checked={q.reverse} onChange={e=>patch(i,{reverse:e.target.checked})}/><span>تصحيح عكسي</span></label>}
      </div>
     </article>)}
    </section>
    <div className="builder-actions"><button className="btn ghost" onClick={onClose}>إلغاء</button><button className="btn primary" disabled={busy} onClick={()=>void save()}>{busy?"جارٍ إنشاء المقياس...":"إنشاء المقياس كمسودة"}</button></div>
   </div>
  </div>
 </div>
}