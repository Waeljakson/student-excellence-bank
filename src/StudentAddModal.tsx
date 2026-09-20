import {FormEvent,useMemo,useState} from "react";
import {niceError,rpc} from "./client";

type ClassOption={id:string;grade_id:string;grade_name:string;class_name:string};
type AddedStudent={ok:boolean;student_id:string;student_no:string;name:string;grade_name:string;class_name:string;guardian_linked:boolean};

export default function StudentAddModal({onAdded}:{onAdded:()=>Promise<void>}){
  const[open,setOpen]=useState(false);
  const[busy,setBusy]=useState(false);
  const[loadingOptions,setLoadingOptions]=useState(false);
  const[msg,setMsg]=useState("");
  const[options,setOptions]=useState<ClassOption[]>([]);
  const[studentNo,setStudentNo]=useState("");
  const[fullName,setFullName]=useState("");
  const[gradeId,setGradeId]=useState("");
  const[classId,setClassId]=useState("");
  const[mobile,setMobile]=useState("");
  const[guardianName,setGuardianName]=useState("");
  const[relationship,setRelationship]=useState("ولي أمر");
  const[joinedAt,setJoinedAt]=useState("");
  const[photoUrl,setPhotoUrl]=useState("");

  const grades=useMemo(()=>{
    const map=new Map<string,string>();
    options.forEach(x=>map.set(x.grade_id,x.grade_name));
    return Array.from(map.entries()).map(([id,name])=>({id,name}));
  },[options]);
  const classes=useMemo(()=>options.filter(x=>x.grade_id===gradeId),[options,gradeId]);

  async function show(){
    setOpen(true);setMsg("");
    if(options.length)return;
    setLoadingOptions(true);
    try{
      const rows=await rpc<ClassOption[]>("api_student_class_options");
      setOptions(Array.isArray(rows)?rows:[]);
    }catch(e){setMsg(niceError(e))}finally{setLoadingOptions(false)}
  }

  function reset(){
    setStudentNo("");setFullName("");setGradeId("");setClassId("");setMobile("");
    setGuardianName("");setRelationship("ولي أمر");setJoinedAt("");setPhotoUrl("");setMsg("");
  }

  async function submit(e:FormEvent){
    e.preventDefault();
    if(!/^\d{10}$/.test(studentNo.trim())){setMsg("رقم الطالب يجب أن يكون 10 أرقام.");return}
    if(!fullName.trim()){setMsg("اكتب اسم الطالب كاملًا.");return}
    if(!classId){setMsg("اختر الصف والفصل.");return}
    setBusy(true);setMsg("");
    try{
      const result=await rpc<AddedStudent>("api_add_student",{
        p_student_no:studentNo.trim(),
        p_full_name_ar:fullName.trim(),
        p_class_id:classId,
        p_mobile:mobile.trim()||null,
        p_guardian_name:guardianName.trim()||null,
        p_relationship:relationship.trim()||"ولي أمر",
        p_joined_at:joinedAt||null,
        p_photo_url:photoUrl.trim()||null
      });
      await onAdded();
      const label=result?.grade_name&&result?.class_name?`${result.grade_name} — فصل ${result.class_name}`:"الفصل المحدد";
      reset();setOpen(false);
      window.alert(`تمت إضافة الطالب ${result?.name||fullName} بنجاح إلى ${label}.\nيمكنه الدخول برقم الطالب وكلمة المرور الافتراضية: رقم الطالب + Aa.`);
    }catch(e){setMsg(niceError(e))}finally{setBusy(false)}
  }

  return <>
    <button type="button" className="btn primary student-add-open-btn" onClick={show}>+ إضافة طالب</button>
    {open&&<div className="student-class-backdrop" onClick={()=>!busy&&setOpen(false)}>
      <div className="student-class-card student-add-card" onClick={e=>e.stopPropagation()}>
        <button className="student-class-close" type="button" onClick={()=>setOpen(false)} disabled={busy}>×</button>
        <div className="student-add-heading">
          <h3>إضافة طالب جديد</h3>
          <p>أدخل بيانات الطالب كاملة. الحقول المميزة مطلوبة.</p>
        </div>
        <form className="student-add-form" onSubmit={submit}>
          <label>رقم الطالب *
            <input inputMode="numeric" maxLength={10} value={studentNo} onChange={e=>setStudentNo(e.target.value.replace(/\D/g,"").slice(0,10))} placeholder="10 أرقام" disabled={busy}/>
          </label>
          <label className="student-add-wide">اسم الطالب الكامل *
            <input value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="الاسم الرباعي كما هو في المدرسة" disabled={busy}/>
          </label>
          <label>الصف *
            <select value={gradeId} onChange={e=>{setGradeId(e.target.value);setClassId("")}} disabled={busy||loadingOptions}>
              <option value="">{loadingOptions?"جارٍ تحميل الصفوف...":"اختر الصف"}</option>
              {grades.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </label>
          <label>الفصل *
            <select value={classId} onChange={e=>setClassId(e.target.value)} disabled={busy||!gradeId}>
              <option value="">اختر الفصل</option>
              {classes.map(c=><option key={c.id} value={c.id}>فصل {c.class_name}</option>)}
            </select>
          </label>
          <label>رقم الجوال
            <input inputMode="tel" value={mobile} onChange={e=>setMobile(e.target.value)} placeholder="05xxxxxxxx" disabled={busy}/>
          </label>
          <label>اسم ولي الأمر
            <input value={guardianName} onChange={e=>setGuardianName(e.target.value)} placeholder="اختياري" disabled={busy}/>
          </label>
          <label>صلة القرابة
            <select value={relationship} onChange={e=>setRelationship(e.target.value)} disabled={busy}>
              <option>ولي أمر</option><option>أب</option><option>أم</option><option>أخ</option><option>عم</option><option>خال</option><option>أخرى</option>
            </select>
          </label>
          <label>تاريخ الانضمام
            <input type="date" value={joinedAt} onChange={e=>setJoinedAt(e.target.value)} disabled={busy}/>
          </label>
          <label className="student-add-wide">رابط صورة الطالب
            <input type="url" value={photoUrl} onChange={e=>setPhotoUrl(e.target.value)} placeholder="https://... (اختياري)" disabled={busy}/>
          </label>
          <div className="student-add-login-hint student-add-wide">
            بعد الإضافة يمكن للطالب الدخول مباشرة برقم الطالب. كلمة المرور الافتراضية: <b>رقم الطالب + Aa</b>.
            {mobile.trim()&&<> وسيتم ربط رقم الجوال بولي الأمر تلقائيًا.</>}
          </div>
          {msg&&<div className="notice error student-add-wide">{msg}</div>}
          <div className="student-add-actions student-add-wide">
            <button className="btn ghost" type="button" onClick={()=>setOpen(false)} disabled={busy}>إلغاء</button>
            <button className="btn primary" type="submit" disabled={busy||loadingOptions}>{busy?"جارٍ إضافة الطالب...":"حفظ وإضافة الطالب"}</button>
          </div>
        </form>
      </div>
    </div>}
  </>;
}
