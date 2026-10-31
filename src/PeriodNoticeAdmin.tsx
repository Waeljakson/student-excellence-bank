import {useEffect,useMemo,useState} from "react";
import {niceError,rpc} from "./client";
import {splitOriginalExcelNotices,type OriginalNoticeUpload} from "./PeriodNoticeOriginalExcel";
import "./period-notices.css";

type Subject={subject:string;maximum:number|null;total:number|null;assessments:Record<string,number|null>;note:string};
type Incoming={student_no:string;student_name:string;grade_name:string;class_name:string;
  academic_year:string;semester:string;period_title:string;subjects:Subject[];
  sum_max:number|null;sum_total:number|null;attendance:number|null;
  behavior_excellence:number|null;behavior_positive:number|null};
type FileDraft={name:string;entries:Incoming[];originals:OriginalNoticeUpload[];warnings:string[]};
type AdminBatch={id:string;title:string;published_at:string|null;created_at:string;student_count:number;
  unmatched_count:number;
  unmatched:Array<{student_no:string;student_name:string;source_file:string;error:string}>;
  items:Array<{id:string;student_name:string;student_no:string;grade_name:string;
  class_name:string;subject_count:number;total:number|null;total_max:number|null;score_complete:boolean;source_file:string;
  subjects:Array<{subject:string;total:number|null;maximum:number|null}>}>};
type AdminData={batches:AdminBatch[]};
type StageResult={batch_id:string;saved:number;missing_count:number;
  missing:Array<{student_no:string;student_name:string;error:string}>;published:boolean};

const asString=(v:unknown)=>v==null?"":String(v).trim();
const asNumber=(v:unknown):number|null=>{
  if(v==null||v===""||String(v).trim()==="")return null;
  const n=Number(String(v).replace(/[٠-٩]/g,x=>String("٠١٢٣٤٥٦٧٨٩".indexOf(x))).replace(/,/g,""));
  return Number.isFinite(n)?n:null;
};
const cell=(sheet:unknown[][],r:number,c:number)=>sheet[r-1]?.[c-1];
const assessmentCols:[string,number][]=[
  ["تقييم مستمر",7],["تقويمات متنوعة",12],["المهام الأدائية والمشاركة",14],
  ["اختبارات قصيرة تحريرية",15],["اختبارات شفهية وتحريرية",17],
  ["مشاركة وتفاعل",19],["مهام أدائية",20]
];

async function parseExcelFiles(files:File[]):Promise<FileDraft[]>{
  const XLSX=await import("xlsx");
  const results:FileDraft[]=[];
  for(const file of files){
    if(!/\.xlsx$/i.test(file.name))throw new Error("مسموح بملفات Excel بصيغة xlsx فقط: "+file.name);
    if(file.size>15_000_000)throw new Error("حجم الملف أكبر من 15 ميجابايت: "+file.name);
    const buffer=await file.arrayBuffer();
    const workbook=XLSX.read(buffer,{type:"array",cellDates:false});
    const entries:Incoming[]=[];const warnings:string[]=[];
    const originalRequests:{sheetName:string;studentNo:string}[]=[];
    for(const sheetName of workbook.SheetNames){
      const sheet=XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName],
        {header:1,defval:null,blankrows:true,raw:true});
      const student_name=asString(cell(sheet,19,2));
      const student_no=asString(cell(sheet,20,2)).replace(/\.0$/,'');
      if(!student_name&&!student_no)continue;
      if(!student_name||!/^\d{8,12}$/.test(student_no)){
        warnings.push(sheetName+": بيانات اسم الطالب أو رقم الهوية غير صالحة؛ لم يُدرج في المسودة.");
        continue;
      }
      const subjects:Subject[]=[];
      for(let r=24;r<=34;r++){
        const subject=asString(cell(sheet,r,21)).replace(/^\*+/,"").replace(/\s+/g," ").trim();
        if(!subject||subject==="المجموع")continue;
        const assessments:Record<string,number|null>={};
        for(const [key,col] of assessmentCols)assessments[key]=asNumber(cell(sheet,r,col));
        subjects.push({subject,maximum:asNumber(cell(sheet,r,3)),
          total:asNumber(cell(sheet,r,6)),assessments,
          note:asString(cell(sheet,r,2))});
      }
      if(!subjects.length){warnings.push(sheetName+": لم تُعثر على مواد دراسية؛ لم يُدرج.");continue;}
      originalRequests.push({sheetName,studentNo:student_no});
      entries.push({student_no,student_name,
        academic_year:asString(cell(sheet,2,1)),semester:asString(cell(sheet,4,1)),
        grade_name:asString(cell(sheet,6,1)),class_name:asString(cell(sheet,13,1)),
        period_title:asString(cell(sheet,14,13))||"إشعار الفترة الأولى",
        subjects,sum_max:asNumber(cell(sheet,35,3)),sum_total:asNumber(cell(sheet,35,6)),
        attendance:asNumber(cell(sheet,39,2)),
        behavior_excellence:asNumber(cell(sheet,40,2)),
        behavior_positive:asNumber(cell(sheet,41,2))});
    }
    if(!entries.length)warnings.push("الملف لا يحتوي على إشعارات طلاب قابلة للاستيراد.");
    const originals=await splitOriginalExcelNotices(buffer,originalRequests);
    results.push({name:file.name,entries,originals,warnings});
  }
  return results;
}

export default function PeriodNoticeAdmin({schoolName}:{schoolName:string}){
  const [batches,setBatches]=useState<AdminBatch[]>([]);
  const [chosenBatch,setChosenBatch]=useState("");
  const [fileDrafts,setFileDrafts]=useState<FileDraft[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [missing,setMissing]=useState<StageResult["missing"]>([]);
  const [previewGrade,setPreviewGrade]=useState("ALL");

  async function load(){
    try{
      const d=await rpc<AdminData>("api_period_notice_admin_data");
      setBatches(Array.isArray(d?.batches)?d.batches:[]);
      setChosenBatch(current=>current||d?.batches?.find(b=>!b.published_at)?.id||"");
      setError("");
    }catch(e){setError(niceError(e))}
  }
  useEffect(()=>{void load()},[]);
  const batch=batches.find(b=>b.id===chosenBatch)||null;
  const draftTotal=fileDrafts.reduce((a,f)=>a+f.entries.length,0);
  const duplicateCount=useMemo(()=>{
    const all=fileDrafts.flatMap(f=>f.entries.map(e=>e.student_no));
    return all.length-new Set(all).size;
  },[fileDrafts]);
  const grades=useMemo(()=>[...new Set(batch?.items.map(x=>x.grade_name)||[])].sort((a,b)=>a.localeCompare(b,"ar")),[batch]);
  const shown=useMemo(()=>batch?.items.filter(x=>previewGrade==="ALL"||x.grade_name===previewGrade)||[],[batch,previewGrade]);

  async function chooseFiles(input:FileList|null){
    if(!input?.length)return;
    setBusy(true);setError("");setMessage("");setMissing([]);
    try{
      const files=Array.from(input);
      if(files.length>30)throw new Error("يمكن اختيار 30 ملفًا كحد أقصى في المرة الواحدة.");
      const parsed=await parseExcelFiles(files);
      setFileDrafts(parsed);
      setMessage("تم فحص ملفات Excel محليًا. لم تُرسل البيانات إلى قاعدة البيانات بعد، ولم يُنشر أي إشعار.");
    }catch(e){setError(niceError(e));setFileDrafts([])}
    finally{setBusy(false)}
  }
  async function saveDraft(){
    if(busy||draftTotal===0)return;
    if(batch?.published_at){setError("لا يمكن إضافة ملفات إلى دفعة منشورة. اختر إنشاء مسودة جديدة.");return;}
    setBusy(true);setError("");setMessage("");setMissing([]);
    let id=chosenBatch||null;
    const errors:StageResult["missing"]=[];let saved=0;let originalsSaved=0;
    try{
      for(const file of fileDrafts){
        for(let start=0;start<file.entries.length;start+=35){
          const d=await rpc<StageResult>("api_period_notice_stage",{
            p_batch_id:id,p_file_name:file.name,p_entries:file.entries.slice(start,start+35)
          });
          id=d.batch_id;saved+=d.saved;errors.push(...(d.missing||[]));
        }
      }
      // Upload each student's original isolated Excel worksheet. If this step
      // fails, keep the selected files and do NOT consider staging complete.
      // The original workbook preserves formatting, graphics and print layout.
      if(!id)throw new Error("تعذر تحديد دفعة الإشعارات لحفظ الملفات الأصلية.");
      for(const file of fileDrafts){
        for(let start=0;start<file.originals.length;start+=5){
          const chunk=file.originals.slice(start,start+5);
          const result=await rpc<{saved:number}>("api_period_notice_stage_originals",{
            p_batch_id:id,p_files:chunk
          });
          originalsSaved+=Number(result.saved||0);
        }
      }
      if(id)setChosenBatch(id);
      setMissing(errors);setFileDrafts([]);await load();
      setMessage("تم حفظ "+saved+" إشعارًا كمسودات، مع "+originalsSaved+" ملف أصلي بنفس تنسيق Excel دون تغيير. "+
        (errors.length?"هناك "+errors.length+" طالبًا لم تُطابق بياناته؛ راجع القائمة أدناه.":
          "تمت مطابقة الطلاب بنجاح.")+" لا يستطيع أولياء الأمور أو الطلاب رؤيتها قبل ضغط «انشر الإشعارات».");
    }catch(e){
      if(id)setChosenBatch(id);
      await load();
      setError("توقف حفظ المسودات بعد "+saved+" سجلًا وحُفظت "+originalsSaved+" نسخة أصلية. لم يُنشر أي سجل جديد. راجع الدفعة ثم أعد المحاولة: "+niceError(e));
    }finally{setBusy(false)}
  }
  async function publish(){
    if(!batch||batch.published_at||busy||!batch.student_count)return;
    if(!window.confirm("تأكيد نشر "+batch.student_count+" إشعارًا؟ سيحصل أصحاب المراكز الخمسة الأولى بكل صف ومن تساووا مع الخامس في النسبة على 25 نقطة تميز تلقائيًا، دون تكرار المكافأة لنفس الفترة. لا يمكن تعديل الدفعة بعد النشر."))return;
    setBusy(true);setError("");setMessage("");
    try{
      const r=await rpc<{published:boolean;student_count:number}>("api_period_notice_publish",{p_batch_id:batch.id});
      await load();
      setMessage("تم نشر "+r.student_count+" إشعارًا بنجاح. جرى احتساب مكافأة التفوق (+25 نقطة) للمستحقين، بما في ذلك المتساوون مع الخامس في النسبة. لا تتكرر المكافأة لنفس الفترة عند إعادة نشر النتائج.");
    }catch(e){setError(niceError(e))}finally{setBusy(false)}
  }
  return <div className="period-notices" dir="rtl">
    <header className="topbar"><div><h1>إشعارات نتائج الطلاب</h1>
      <p>{schoolName} — رفع ملفات الإشعارات ومراجعتها قبل نشرها لولي الأمر والطالب.</p></div></header>
    <main className="content">
      {error&&<div className="notice error" role="alert">{error}</div>}
      {message&&<div className="notice" role="status">{message}</div>}
      <section className="panel"><h3>1. اختر دفعة مسودات</h3>
        <div className="period-toolbar"><label>دفعة الإشعارات
          <select value={chosenBatch} onChange={e=>{setChosenBatch(e.target.value);setPreviewGrade("ALL")}}>
            <option value="">إنشاء دفعة جديدة عند الحفظ</option>
            {batches.map(b=><option key={b.id} value={b.id}>
              {b.title} — {b.student_count} طالب — {b.published_at?"منشورة":"مسودة"}
            </option>)}
          </select></label><button type="button" className="mini-btn" onClick={()=>void load()} disabled={busy}>تحديث</button></div>
        <p className="period-hint">يمكنك رفع الملفات الثمانية معًا. سيُحفظ لكل طالب ملف الإشعار الأصلي منفصلًا بنفس تنسيقه وصوره، دون مشاركة أوراق الطلاب الآخرين. عند تصحيح النتائج ونشر دفعة جديدة لنفس العام والفصل والفترة، تظهر تلقائيًا أحدث نسخة فقط للطالب وولي الأمر، وتبقى النسخ السابقة محفوظة في سجل الإدارة.</p>
      </section>
      <section className="panel"><h3>2. رفع ملفات Excel للمراجعة</h3>
        <input type="file" accept=".xlsx" multiple disabled={busy||Boolean(batch?.published_at)}
          onChange={e=>{void chooseFiles(e.currentTarget.files);e.currentTarget.value=""}}/>
        {fileDrafts.length>0&&<><div className="period-import-stats"><b>{fileDrafts.length} ملف</b><b>{draftTotal} إشعار</b>
          {duplicateCount>0&&<b className="period-danger">{duplicateCount} رقم طالب مكرر؛ آخر نسخة ستُعتمد</b>}</div>
          <div className="period-source-list">{fileDrafts.map(f=><div key={f.name}>
            <strong>{f.name}</strong><span>{f.entries.length} طالب</span>
            {f.warnings.map((w,i)=><small key={i} className="period-danger">{w}</small>)}
          </div>)}</div>
          <button type="button" className="btn primary" onClick={()=>void saveDraft()} disabled={busy||!draftTotal}>
            {busy?"جارٍ حفظ المسودات...":"احفظ الإشعارات كمسودة (دون نشر)"}
          </button>
        </>}
        {!!missing.length&&<div className="period-warning"><h4>طلاب لم تتم مطابقتهم — لم تُرفع إشعاراتهم</h4>
          {missing.map((x,i)=><p key={i}>{x.student_name} — {x.student_no}: {x.error}</p>)}
        </div>}
      </section>
      <section className="panel"><h3>3. مراجعة الإشعارات المحفوظة</h3>
        {!batch?<p>اختر دفعة من القائمة أو احفظ الملفات كمسودة لتظهر النتائج هنا.</p>:<>
          <div className="period-import-stats"><b>{batch.student_count} طالب</b>
            <b className={batch.published_at?"period-published":"period-draft"}>
              {batch.published_at?"منشورة":"مسودة — غير مرئية للطلاب وأولياء الأمور"}
            </b></div>
          {batch.items.some(item=>item.score_complete===false)&&<div className="period-warning">
              <h4>تنبيه: توجد إشعارات بها درجات مواد غير مكتملة</h4>
              <p>النسبة والترتيب يُحتسبان من مجموع درجات جميع المواد، وليس من المادة الأخيرة. لن يدخل أصحاب البيانات غير المكتملة في قائمة الأوائل حتى تصحيح درجاتهم.</p>
              <p>الإشعارات غير المكتملة: {batch.items.filter(item=>item.score_complete===false).length}</p>
              <details className="period-student-preview">
                <summary>عرض أسماء الطلاب والمواد التي تنقص درجاتها</summary>
                {batch.items.filter(item=>item.score_complete===false).map(item=>
                  <p key={item.id}>
                    <strong>{item.student_name} — {item.grade_name} — الفصل {item.class_name}:</strong>
                    {" "}{item.subjects.filter(subject=>subject.total==null||subject.maximum==null)
                    .map(subject=>subject.subject).join("، ")||"يحتاج مراجعة بيانات الدرجات"}
                  </p>
                )}
              </details>
            </div>}
          <label>الصف الدراسي
            <select value={previewGrade} onChange={e=>setPreviewGrade(e.target.value)}>
              <option value="ALL">كل الصفوف</option>{grades.map(x=><option value={x} key={x}>{x}</option>)}
            </select></label>
          {(batch.unmatched_count||0)>0&&<div className="period-warning">
            <h4>تنبيه: {batch.unmatched_count} إشعار لم يُطابق أي طالب في سجلات المدرسة</h4>
            <p>لن تظهر هذه الإشعارات لأحد. راجع بيانات الطلاب وأضفهم أو صحّح أرقامهم، ثم أعد رفع ملفاتهم إلى المسودة نفسها قبل النشر.</p>
            {(batch.unmatched||[]).map(x=><p key={x.student_no}>
              {x.student_name} — {x.student_no} — {x.source_file}
            </p>)}
          </div>}
          <div className="table-wrap"><table className="period-table"><thead><tr>
            <th>اسم الطالب</th><th>رقم الطالب</th><th>الصف</th><th>الفصل</th>
            <th>المواد</th><th>المجموع</th><th>المصدر</th>
          </tr></thead><tbody>{shown.map(x=><tr key={x.id}>
            <td>{x.student_name}</td><td>{x.student_no}</td><td>{x.grade_name}</td>
            <td>{x.class_name}</td><td>{x.subject_count}</td>
            <td>{x.score_complete===false?"بيانات غير مكتملة":x.total!=null&&x.total_max!=null?x.total+" / "+x.total_max:"—"}</td><td>{x.source_file}
              <details className="period-student-preview"><summary>معاينة المواد والدرجات</summary>
                {(x.subjects||[]).map((subject,i)=><p key={i}>{subject.subject}:
                  <b> {subject.total??"—"} / {subject.maximum??"—"}</b></p>)}
              </details></td>
          </tr>)}</tbody></table></div>
          {!batch.published_at&&<div className="period-publish">
            <p>لن يصل أي إشعار إلى حساب طالب أو ولي أمر قبل الضغط على الزر التالي وتأكيد النشر.</p>
            {!!batch.unmatched_count&&<p className="period-danger">تحذير: يوجد {batch.unmatched_count} طلاب لم تُطابق إشعاراتهم؛ النشر سيشمل الطلاب المطابقين فقط.</p>}
            <button type="button" className="btn primary" disabled={busy||!batch.student_count}
              onClick={()=>void publish()}>{busy?"جارٍ النشر...":"انشر الإشعارات"}</button>
          </div>}
        </>}
      </section>
    </main>
  </div>;
}