import AppShell from "@/components/AppShell";
import Header from "@/components/Header";
import { getRankingsData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function RankingsPage() {
  const data = await getRankingsData();
  const students = data.students as any[];
  const classes = data.classes as any[];
  const hasPoints = students.some((s) => Number(s.points || 0) > 0);

  return (
    <AppShell>
      <Header title="لوحة الترتيب" subtitle="ترتيب حي للطلاب والفصول من أرصدة المحافظ الفعلية" />
      <main className="content">
        {!hasPoints && (
          <section className="panel">
            <div className="empty-state">
              <b>تم تحميل الطلاب والفصول بنجاح، ولم تُصدر نقاط بعد</b>
              <span>ستتحدث المراكز تلقائيًا بمجرد إصدار أول شيك تميز.</span>
            </div>
          </section>
        )}

        <section className="grid-2">
          <article className="panel">
            <div className="panel-head"><div><h3>أوائل الطلاب</h3><p>الترتيب حسب الرصيد الحالي، ثم الاسم عند التعادل.</p></div></div>
            <div className="rank-list">
              {students.slice(0, 10).map((s, i) => (
                <div className="rank-row" key={s.id}>
                  <span className="rank-num">{i + 1}</span>
                  <div><b>{s.name}</b><small>{s.grade_name} — فصل {s.class_name}</small></div>
                  <strong>{Number(s.points).toLocaleString("ar-SA")} نقطة</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panel-head"><div><h3>ترتيب الفصول</h3><p>المعيار العادل: متوسط النقاط لكل طالب، ثم إجمالي النقاط.</p></div></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>المركز</th><th>الصف</th><th>الفصل</th><th>الطلاب</th><th>إجمالي النقاط</th><th>المتوسط</th></tr></thead>
                <tbody>
                  {classes.map((c, i) => (
                    <tr key={c.id}>
                      <td><b>{i + 1}</b></td>
                      <td>{c.grade_name}</td>
                      <td>{c.class_name}</td>
                      <td>{Number(c.student_count).toLocaleString("ar-SA")}</td>
                      <td>{Number(c.total_points).toLocaleString("ar-SA")}</td>
                      <td><b>{Number(c.average_points).toLocaleString("ar-SA", { maximumFractionDigits: 2 })}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      </main>
    </AppShell>
  );
}
