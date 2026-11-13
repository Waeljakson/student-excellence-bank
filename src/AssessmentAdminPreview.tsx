import {useMemo,useState} from "react";
import "./assessments.css";

type Question={id:string;question_no:number;step_order:number;section_key:string;section_title_ar:string;prompt_ar:string;question_type:"SINGLE"|"LIKERT"|"TEXT";options:Array<{code:string;label:string;score?:number}>;is_required:boolean};
type Scale={title_ar:string;short_title_ar:string;description_ar?:string;estimated_minutes?:string;ui_meta?:Record<string,string>;questions?:Question[]};

const icons:Record<string,string>={habits:"🎮",control:"🎯",preoccupation:"🧠",emotional:"💭",persistence:"🔁",academic:"📚",sleep_health:"🌙",family_social:"👨‍👩‍👦",emotion_behavior:"🙂",self_regulation:"🧭",student_message:"✍️"};

export default function AssessmentAdminPreview({scale,schoolName,onClose}:{scale:Scale;schoolName:string;onClose:()=>void}){
  const[step,setStep]=useState(0);
  const[answers,setAnswers]=useState<Record<string,string|number>>({});
  const steps=useMemo(()=>{
    const m=new Map<number,{order:number;title:string;key:string;questions:Question[]}>();
    for(const q of scale.questions||[]){
      const row=m.get(q.step_order)||{order:q.step_order,title:q.section_title_ar,key:q.section_key,questions:[]};
      row.questions.push(q);m.set(q.step_order,row);
    }
    return[...m.values()].sort((a,b)=>a.order-b.order);
  },[scale.questions]);
  const current=steps[step];
  const required=(scale.questions||[]).filter(q=>q.is_required);
  const done=required.filter(q=>String(answers[String(q.question_no)]??"").trim()!=="").length;
  const pct=required.length?Math.round(done*100/required.length):0;
  const setAnswer=(q:Question,v:string|number)=>setAnswers(a=>({...a,[String(q.question_no)]:v}));

  return <div className="assessment-preview-overlay" dir="rtl">
    <div className="assessment-preview-window">
      <div className="assessment-preview-toolbar">
        <div><span>معاينة الإدارة</span><b>هذا هو الشكل الذي سيظهر للطالب</b><small>لا يتم حفظ أي إجابات ولا يؤثر ذلك على نشر المقياس.</small></div>
        <button className="btn ghost" onClick={onClose}>إغلاق المعاينة ×</button>
      </div>

      <div className="assessment-shell assessment-preview-body">
        <section className="assessment-preview-badge">وضع المعاينة — المقياس غير منشور للطلاب</section>

        <section className="assessment-hero">
          <div>{scale.ui_meta?.icon||"📋"}</div>
          <article>
            <span>{scale.ui_meta?.department||"قسم التوجيه الطلابي"}</span>
            <h2>{scale.title_ar}</h2>
            <p>{scale.description_ar}</p>
            <small>⏱ {scale.estimated_minutes||"7–10 دقائق"} · 🔐 إجابات الطالب سرية</small>
          </article>
        </section>

        <section className="assessment-student-card">
          <div><small>الطالب</small><b>طالب تجريبي — معاينة فقط</b></div>
          <div><small>المدرسة</small><b>{schoolName}</b></div>
          <div><small>الصف / الفصل</small><b>يظهر تلقائيًا من حساب الطالب</b></div>
          <label><small>العمر</small><input value="15" readOnly aria-label="عمر تجريبي"/></label>
        </section>

        <section className="assessment-progress">
          <div><b>{pct}% مكتمل</b><span>الخطوة {Math.min(step+1,Math.max(steps.length,1))} من {Math.max(steps.length,1)}</span></div>
          <i><b style={{width:String(Math.max(pct,3))+"%"}}/></i>
        </section>

        {!steps.length?<section className="panel"><p>لم يتم تحميل أسئلة المقياس في المعاينة.</p></section>:current&&
          <section className="assessment-question-panel">
            <header><span>{icons[current.key]||"◉"}</span><div><small>المحور الحالي</small><h3>{current.title}</h3></div></header>
            {current.questions.map(q=><div className="assessment-question" key={q.id}>
              <div className="q-title"><b>{q.question_no}</b><p>{q.prompt_ar}</p></div>
              {q.question_type==="TEXT"?
                <textarea value={answers[String(q.question_no)]??""} onChange={e=>setAnswer(q,e.target.value)} placeholder="اكتب إجابتك هنا..."/>:
                <div className={"answer-options "+(q.question_type==="LIKERT"?"likert":"")}>
                  {(q.options||[]).map(o=>{
                    const v=q.question_type==="LIKERT"?Number(o.score||0):o.code;
                    return <button type="button" key={o.code} className={String(answers[String(q.question_no)]??"")===String(v)?"selected":""} onClick={()=>setAnswer(q,v)}><i/><b>{o.label}</b></button>
                  })}
                </div>}
            </div>)}
          </section>}

        <div className="assessment-actions preview-actions">
          <button className="btn secondary" disabled={!step} onClick={()=>setStep(x=>Math.max(0,x-1))}>السابق</button>
          <span>جرّب الاختيارات للتأكد من الشكل — لن تُحفظ.</span>
          {step<steps.length-1?<button className="btn primary" onClick={()=>setStep(x=>Math.min(steps.length-1,x+1))}>التالي</button>:<button className="btn primary" onClick={onClose}>إنهاء المعاينة</button>}
        </div>
        <p className="assessment-footnote">لا توجد إجابات صحيحة أو خاطئة. يجيب الطالب وفق تجربته خلال الأشهر الثلاثة الماضية.</p>
      </div>
    </div>
  </div>
}