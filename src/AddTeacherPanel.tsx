import { FormEvent, useMemo, useState } from "react";
import { niceError, rpc } from "./client";
import "./add-teacher.css";

type AdminClass = { id: string; grade_name: string; class_name: string };
type Result = { ok: boolean; staff_id: string; name: string; mobile: string; username: string; default_password: string; status: string };

export default function AddTeacherPanel({ classes, reload }: { classes: AdminClass[]; reload: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [employeeNo, setEmployeeNo] = useState("");
  const [subject, setSubject] = useState("");
  const [classIds, setClassIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, AdminClass[]>();
    for (const c of classes) {
      const list = map.get(c.grade_name) || [];
      list.push(c);
      map.set(c.grade_name, list);
    }
    return Array.from(map.entries());
  }, [classes]);

  function toggleClass(id: string) {
    setClassIds(current => current.includes(id) ? current.filter(x => x !== id) : [...current, id]);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setResult(null);
    if (!name.trim()) { setMessage("اكتب اسم المعلم."); return; }
    if (!/^05\d{8}$/.test(mobile.trim())) { setMessage("رقم الجوال يجب أن يكون 10 أرقام ويبدأ بـ 05."); return; }
    if (!classIds.length) { setMessage("اختر فصلًا واحدًا على الأقل للمعلم."); return; }
    setBusy(true);
    try {
      const data = await rpc<Result>("api_set_staff_classes", {
        p_staff_id: null,
        p_class_ids: {
          action: "CREATE_TEACHER",
          full_name_ar: name.trim(),
          mobile: mobile.trim(),
          employee_no: employeeNo.trim() || null,
          teaching_subject_ar: subject.trim() || null,
          class_ids: classIds,
        },
      });
      setResult(data);
      setName("");
      setMobile("");
      setEmployeeNo("");
      setSubject("");
      setClassIds([]);
      await reload();
    } catch (e) {
      setMessage(niceError(e));
    } finally {
      setBusy(false);
    }
  }

  async function copyCredentials() {
    if (!result) return;
    const text = `اسم المعلم: ${result.name}\nاسم المستخدم: ${result.username}\nكلمة المرور الافتراضية: ${result.default_password}`;
    try {
      await navigator.clipboard.writeText(text);
      setMessage("تم نسخ بيانات الدخول.");
    } catch {
      setMessage("تعذر النسخ التلقائي. انسخ البيانات يدويًا.");
    }
  }

  return <section className="panel add-teacher-panel">
    <div className="panel-title add-teacher-title">
      <div>
        <h3>إضافة معلم جديد</h3>
        <p>أضف المعلم وحدد فصوله، وسيكون اسم المستخدم رقم الجوال وكلمة المرور الافتراضية رقم الجوال متبوعًا بـ Aa.</p>
      </div>
      <button type="button" className={open ? "btn ghost" : "btn primary"} onClick={() => setOpen(v => !v)}>{open ? "إغلاق" : "+ إضافة معلم"}</button>
    </div>

    {open && <form className="add-teacher-form" onSubmit={submit}>
      <div className="add-teacher-grid">
        <label>اسم المعلم<input required value={name} onChange={e => setName(e.target.value)} placeholder="الاسم الرباعي" /></label>
        <label>رقم الجوال<input required inputMode="numeric" value={mobile} onChange={e => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="05xxxxxxxx" /></label>
        <label>الرقم الوظيفي <small>اختياري</small><input value={employeeNo} onChange={e => setEmployeeNo(e.target.value)} placeholder="مثال: 1867" /></label>
        <label>المادة <small>اختياري</small><input value={subject} onChange={e => setSubject(e.target.value)} placeholder="مثال: رياضيات" /></label>
      </div>

      <div className="teacher-class-picker">
        <div className="teacher-class-picker-head"><b>الفصول المسندة للمعلم</b><span>{classIds.length} محدد</span></div>
        {grouped.map(([grade, items]) => <div className="teacher-class-group" key={grade}>
          <strong>{grade}</strong>
          <div>{items.map(c => <button type="button" key={c.id} className={classIds.includes(c.id) ? "active" : ""} onClick={() => toggleClass(c.id)}>فصل {c.class_name}</button>)}</div>
        </div>)}
      </div>

      <div className="default-login-preview">
        <div><small>اسم المستخدم الافتراضي</small><b>{mobile || "رقم الجوال"}</b></div>
        <div><small>كلمة المرور الافتراضية</small><b>{mobile ? `${mobile}Aa` : "رقم الجوال + Aa"}</b></div>
        <div><small>الحد الشهري</small><b>100 نقطة</b></div>
      </div>

      <button className="btn primary add-teacher-submit" disabled={busy}>{busy ? "جارٍ إضافة المعلم..." : "إضافة المعلم وتجهيز بيانات الدخول"}</button>
      {message && <div className="notice">{message}</div>}
    </form>}

    {result && <div className="teacher-created-card">
      <div><span className="teacher-created-icon">✓</span><div><h4>تمت إضافة {result.name}</h4><p>الحساب جاهز لأول دخول. عند دخول المعلم بهذه البيانات يُنشأ حساب Neon Auth ويرتبط تلقائيًا بسجله وفصوله.</p></div></div>
      <dl>
        <div><dt>اسم المستخدم</dt><dd>{result.username}</dd></div>
        <div><dt>كلمة المرور</dt><dd>{result.default_password}</dd></div>
      </dl>
      <button type="button" className="btn ghost" onClick={copyCredentials}>نسخ بيانات الدخول</button>
    </div>}
  </section>;
}
