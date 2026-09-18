import "./guardian-portal.css";

type Note={id:string;subject_ar?:string;note_kind?:string;category_ar?:string;note_text:string;note_date:string;teacher_name?:string};

export default function StudentFollowupPanel({notes}:{notes:Note[]}){
  return <section className="portal-panel">
    <div className="portal-panel-title"><div><h3>ملاحظات المعلمين</h3><p>كل ما يسجله معلموك في دفتر المتابعة يظهر لك هنا.</p></div><span>{notes.length}</span></div>
    {notes.length?notes.map(n=><article className={`guardian-note ${String(n.note_kind||"general").toLowerCase()}`} key={n.id}>
      <div><b>{n.subject_ar||"متابعة"}</b><span>{n.category_ar||"ملاحظة"}</span></div>
      <p>{n.note_text}</p>
      <small>{new Date(n.note_date).toLocaleDateString("ar-SA")} · {n.teacher_name}</small>
    </article>):<div className="empty">لا توجد ملاحظات مسجلة لك حتى الآن.</div>}
  </section>;
}
