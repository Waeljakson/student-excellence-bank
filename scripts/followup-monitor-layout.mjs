import {readFileSync,writeFileSync} from "node:fs";
const path="src/StudentFollowupNotebook.tsx";
let s=readFileSync(path,"utf8");

s=s.replace(
`  useEffect(()=>{
    if(canMonitor&&classes.length&&!classes.some(c=>c.id===classId))setClassId(classes[0].id);
  },[canMonitor,classes,classId]);`,
`  useEffect(()=>{
    if(canMonitor&&classes.length&&classId!=="ALL"&&!classes.some(c=>c.id===classId))setClassId("ALL");
  },[canMonitor,classes,classId]);`
);
s=s.replace(
'    return notes.filter(n=>n.class_id===classId)\n      .filter(n=>monitorKind==="ALL"||n.note_kind===monitorKind)',
'    return notes.filter(n=>classId==="ALL"||n.class_id===classId)\n      .filter(n=>monitorKind==="ALL"||n.note_kind===monitorKind)'
);

if(!s.includes('const isAllClasses=classId==="ALL";')){
  s=s.replace(
`  const classNoteCount=(id:string)=>notes.filter(n=>n.class_id===id).length;
  const selectedClass=classes.find(c=>c.id===classId);
  const classPositive=notes.filter(n=>n.class_id===classId&&n.note_kind==="POSITIVE").length;
  const classNegative=notes.filter(n=>n.class_id===classId&&n.note_kind==="NEGATIVE").length;
  const classGeneral=notes.filter(n=>n.class_id===classId&&n.note_kind==="GENERAL").length;`,
"  const classNoteCount=(id:string)=>id===\"ALL\"?notes.length:notes.filter(n=>n.class_id===id).length;\n  const selectedClass=classes.find(c=>c.id===classId);\n  const isAllClasses=classId===\"ALL\";\n  const selectedStudentsCount=isAllClasses?students.length:(selectedClass?.students.length||0);\n  const classPositive=notes.filter(n=>(isAllClasses||n.class_id===classId)&&n.note_kind===\"POSITIVE\").length;\n  const classNegative=notes.filter(n=>(isAllClasses||n.class_id===classId)&&n.note_kind===\"NEGATIVE\").length;\n  const classGeneral=notes.filter(n=>(isAllClasses||n.class_id===classId)&&n.note_kind===\"GENERAL\").length;\n  const selectedLabel=isAllClasses?\"كل الفصول\":(selectedClass?.label||\"\");"
  );
}

const oldTabs="        <div className=\"periodic-class-tabs\">{classes.map(c=><button key={c.id} className={classId===c.id?\"active\":\"\"} onClick={()=>setClassId(c.id)}><b>{c.label}</b><small>{classNoteCount(c.id)} ملاحظة</small></button>)}</div>\n        {selectedClass&&<>";
const newTabs="        <div className=\"periodic-class-tabs followup-class-tabs\">\n          <button className={classId===\"ALL\"?\"active\":\"\"} onClick={()=>setClassId(\"ALL\")}><b>كل الفصول</b><small>{notes.length} ملاحظة</small></button>\n          {classes.map(c=><button key={c.id} className={classId===c.id?\"active\":\"\"} onClick={()=>setClassId(c.id)}><b>{c.label}</b><small>{classNoteCount(c.id)} ملاحظة</small></button>)}\n        </div>\n        {(isAllClasses||selectedClass)&&<>";
if(s.includes(oldTabs))s=s.replace(oldTabs,newTabs);
s=s.replace(
'            <div><small>طلاب الفصل</small><b>{selectedClass.students.length}</b></div>',
'            <div><small>{isAllClasses?"إجمالي الطلاب":"طلاب الفصل"}</small><b>{selectedStudentsCount}</b></div>'
);
s=s.replace(
'            <div><b>{selectedClass.label}</b><span>تظهر أحدث الملاحظات أولًا.</span></div>',
'            <div><b>{selectedLabel}</b><span>تظهر أحدث الملاحظات أولًا.</span></div>'
);
const oldTable="          <div className=\"table-wrap\"><table><thead><tr><th>الطالب</th><th>المعلم / المادة</th><th>النوع</th><th>التصنيف</th><th>الملاحظة</th><th>التاريخ</th>{isSuperAdmin&&<th>إجراء</th>}</tr></thead><tbody>\n            {classNotes.map(n=><tr key={n.id}><td><b>{n.student_name||\"—\"}</b><br/><small>{n.student_no||\"\"}</small></td><td><b>{n.teacher_name||\"—\"}</b><br/><small>{n.subject_ar||\"—\"}</small></td><td><span className={`teacher-status ${n.note_kind===\"POSITIVE\"?\"completed\":n.note_kind===\"NEGATIVE\"?\"not-started\":\"in-progress\"}`}>{kindLabel(n.note_kind)}</span></td><td>{n.category_ar||\"—\"}</td><td style={{whiteSpace:\"pre-wrap\",minWidth:260}}>{n.note_text||\"—\"}</td><td>{new Date(n.note_date||n.created_at).toLocaleDateString(\"ar-SA\")}</td>{isSuperAdmin&&<td>{n.note_kind===\"NEGATIVE\"?<button type=\"button\" className=\"followup-delete-btn\" disabled={deletingId===n.id} onClick={()=>deleteNegativeNote(n)}>{deletingId===n.id?\"جارٍ الحذف...\":\"حذف الملاحظة\"}</button>:<span className=\"followup-no-delete\">—</span>}</td>}</tr>)}\n            {!classNotes.length&&<tr><td colSpan={isSuperAdmin?7:6} className=\"periodic-empty-row\">لا توجد ملاحظات مطابقة في هذا الفصل حتى الآن.</td></tr>}\n          </tbody></table></div>";
const newTable="          <div className=\"table-wrap followup-table-wrap\"><table className=\"followup-notes-table\"><thead><tr><th>الطالب</th><th>المعلم / المادة</th><th>النوع</th><th>التصنيف</th><th>الملاحظة</th><th>التاريخ</th>{isSuperAdmin&&<th>إجراء</th>}</tr></thead><tbody>\n            {classNotes.map(n=><tr key={n.id}><td className=\"followup-student-cell\"><b>{n.student_name||\"—\"}</b><small>{n.student_no||\"\"}</small></td><td className=\"followup-teacher-cell\"><b>{n.teacher_name||\"—\"}</b><small>{n.subject_ar||\"—\"}</small></td><td className=\"followup-kind-cell\"><span className={`teacher-status ${n.note_kind===\"POSITIVE\"?\"completed\":n.note_kind===\"NEGATIVE\"?\"not-started\":\"in-progress\"}`}>{kindLabel(n.note_kind)}</span></td><td className=\"followup-category-cell\">{n.category_ar||\"—\"}</td><td className=\"followup-note-cell\"><div className=\"followup-note-scroll\">{n.note_text||\"—\"}</div></td><td className=\"followup-date-cell\">{new Date(n.note_date||n.created_at).toLocaleDateString(\"ar-SA\")}</td>{isSuperAdmin&&<td className=\"followup-action-cell\">{n.note_kind===\"NEGATIVE\"?<button type=\"button\" className=\"followup-delete-btn\" disabled={deletingId===n.id} onClick={()=>deleteNegativeNote(n)}>{deletingId===n.id?\"جارٍ الحذف...\":\"حذف الملاحظة\"}</button>:<span className=\"followup-no-delete\">—</span>}</td>}</tr>)}\n            {!classNotes.length&&<tr><td colSpan={isSuperAdmin?7:6} className=\"periodic-empty-row\">{isAllClasses?\"لا توجد ملاحظات مطابقة في جميع الفصول حتى الآن.\":\"لا توجد ملاحظات مطابقة في هذا الفصل حتى الآن.\"}</td></tr>}\n          </tbody></table></div>";
if(s.includes(oldTable))s=s.replace(oldTable,newTable);

if(!s.includes("كل الفصول")||!s.includes("followup-note-scroll")||!s.includes('classId==="ALL"')){
  throw new Error("followup-monitor-layout: compact all-classes monitor missing");
}
writeFileSync(path,s);
console.log("followup-monitor-layout: all classes + compact table verified");
