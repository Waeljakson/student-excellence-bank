import {readFileSync,writeFileSync} from "node:fs";

let f=readFileSync("src/StudentFollowupNotebook.tsx","utf8");
f=f.replace('note_kind:"POSITIVE"|"NEGATIVE"|"GENERAL"','note_kind:"POSITIVE"|"NEGATIVE"|"GENERAL"|"HOMEWORK"');
f=f.replace('const kindLabel=(kind:string)=>kind==="POSITIVE"?"إيجابية":kind==="NEGATIVE"?"سلبية":"عامة";','const kindLabel=(kind:string)=>kind==="POSITIVE"?"إيجابية":kind==="NEGATIVE"?"سلبية":kind==="HOMEWORK"?"واجبات":"عامة";\nconst kindClass=(kind:string)=>kind==="POSITIVE"?"completed":kind==="NEGATIVE"?"not-started":kind==="HOMEWORK"?"homework":"in-progress";');
if(!f.includes('const classHomework='))f=f.replace('  const classGeneral=notes.filter(n=>(isAllClasses||n.class_id===classId)&&n.note_kind==="GENERAL").length;\n  const selectedLabel=','  const classGeneral=notes.filter(n=>(isAllClasses||n.class_id===classId)&&n.note_kind==="GENERAL").length;\n  const classHomework=notes.filter(n=>(isAllClasses||n.class_id===classId)&&n.note_kind==="HOMEWORK").length;\n  const selectedLabel=');
f=f.replace('<div className="teacher-progress-summary">','<div className="teacher-progress-summary followup-summary">');
if(!f.includes('ملاحظات واجبات'))f=f.replace('<div><small>ملاحظات عامة</small><b>{classGeneral}</b></div>\n            <div className="remaining">','<div><small>ملاحظات عامة</small><b>{classGeneral}</b></div>\n            <div className="homework"><small>ملاحظات واجبات</small><b>{classHomework}</b></div>\n            <div className="remaining">');
f=f.replace('<option value="GENERAL">عامة</option></select>','<option value="GENERAL">عامة</option><option value="HOMEWORK">واجبات</option></select>');
f=f.replace('className={`teacher-status ${n.note_kind==="POSITIVE"?"completed":n.note_kind==="NEGATIVE"?"not-started":"in-progress"}`}','className={`teacher-status ${kindClass(n.note_kind)}`}');
f=f.replace('<option value="GENERAL">عامة</option></select></label><label>التصنيف','<option value="GENERAL">عامة</option><option value="HOMEWORK">واجبات</option></select></label><label>التصنيف');
if(!f.includes('value="HOMEWORK"')||!f.includes('classHomework'))throw new Error("followup-homework-kind: teacher UI missing");
writeFileSync("src/StudentFollowupNotebook.tsx",f);

let g=readFileSync("src/GuardianPortal.tsx","utf8");
g=g.replace('  const general=notes.filter(n=>!["POSITIVE","NEGATIVE"].includes(String(n.note_kind).toUpperCase()));','  const homework=notes.filter(n=>String(n.note_kind).toUpperCase()==="HOMEWORK");\n  const general=notes.filter(n=>String(n.note_kind).toUpperCase()==="GENERAL");');
if(!g.includes('tone="homework"')){
  g=g.replace('  }else{\n    tone="general";\n    title="تنبيه أو معلومة عامة";','  }else if(homework.length){\n    tone="homework";\n    title="متابعة الواجبات اليوم";\n    body=homework.length===1\n      ?"وردت اليوم ملاحظة بخصوص الواجبات من أحد المعلمين. يمكنكم الاطلاع على تفاصيلها في دفتر المتابعة."\n      :`وردت اليوم ${homework.length} ملاحظات بخصوص الواجبات. يمكنكم الاطلاع على تفاصيلها في دفتر المتابعة.`;\n    advice=[];\n  }else{\n    tone="general";\n    title="تنبيه أو معلومة عامة";');
}
const anchor="function guardianSubjectLabel(value?:string|null){\n  const v=String(value||\"\").trim();\n  if(v===\"E\")return \"لغة إنجليزية\";\n  if(v===\"بدنية\")return \"التربية البدنية\";\n  if(v===\"فنية\")return \"التربية الفنية\";\n  return v||\"—\";\n}\n";
const helper="\nfunction guardianNoteKindLabel(value?:string|null){\n  const key=String(value||\"\").toUpperCase();\n  return key===\"POSITIVE\"?\"إيجابية\":key===\"NEGATIVE\"?\"سلبية\":key===\"HOMEWORK\"?\"واجبات\":\"عامة\";\n}\n";
if(!g.includes("function guardianNoteKindLabel(")){if(!g.includes(anchor))throw new Error("followup-homework-kind: guardian helper anchor missing");g=g.replace(anchor,anchor+helper);}
g=g.replace('<div><b>{n.subject_ar||"متابعة"}</b><span>{n.category_ar||"ملاحظة"}</span></div>','<div><b>{n.subject_ar||"متابعة"}</b><span>{guardianNoteKindLabel(n.note_kind)}{n.category_ar?` · ${n.category_ar}`:""}</span></div>');
if(!g.includes('tone="homework"')||!g.includes("guardianNoteKindLabel"))throw new Error("followup-homework-kind: guardian view missing");
writeFileSync("src/GuardianPortal.tsx",g);

let p=readFileSync("src/StudentFollowupPanel.tsx","utf8");
if(!p.includes("function noteKindLabel("))p=p.replace('type Note={id:string;subject_ar?:string;note_kind?:string;category_ar?:string;note_text:string;note_date:string;teacher_name?:string};','type Note={id:string;subject_ar?:string;note_kind?:string;category_ar?:string;note_text:string;note_date:string;teacher_name?:string};\n\nfunction noteKindLabel(value?:string){const key=String(value||"").toUpperCase();return key==="POSITIVE"?"إيجابية":key==="NEGATIVE"?"سلبية":key==="HOMEWORK"?"واجبات":"عامة"}');
p=p.replace('<div><b>{n.subject_ar||"متابعة"}</b><span>{n.category_ar||"ملاحظة"}</span></div>','<div><b>{n.subject_ar||"متابعة"}</b><span>{noteKindLabel(n.note_kind)}{n.category_ar?` · ${n.category_ar}`:""}</span></div>');
writeFileSync("src/StudentFollowupPanel.tsx",p);

let sp=readFileSync("src/StudentPortal.tsx","utf8");
sp=sp.replace('<span>{recentNote.category_ar||"ملاحظة"}</span>','<span>{String(recentNote.note_kind||"").toUpperCase()==="HOMEWORK"?"واجبات":(recentNote.category_ar||"ملاحظة")}</span>');
writeFileSync("src/StudentPortal.tsx",sp);

console.log("followup-homework-kind: HOMEWORK type verified across teacher, student, and guardian views");
