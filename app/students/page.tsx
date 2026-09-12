import AppShell from "@/components/AppShell";
import Header from "@/components/Header";
import { getStudentsWallets } from "@/lib/data";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function StudentsPage() {
  const students = await getStudentsWallets() as any[];
  const totalPoints = students.reduce((sum, s) => sum + Number(s.points || 0), 0);
  const activeWallets = students.filter((s) => Number(s.points || 0) > 0).length;
  const totalValue = students.reduce((sum, s) => sum + Number(s.value_sar || 0), 0);

  return (
    <AppShell>
      <Header title="الطلاب والمحافظ" subtitle="بيانات فعلية من Neon — الرصيد محسوب من دفتر الحركات ولا يتم تعديله يدويًا" />
      <main className="content">
        <section className="stats-grid">
          <article className="stat-card"><span>إجمالي الطلاب</span><strong>{students.length.toLocaleString("ar-SA")}</strong><small>طلاب نشطون</small></article>
          <article className="stat-card"><span>محافظ بها نقاط</span><strong>{activeWallets.toLocaleString("ar-SA")}</strong><small>طالب حصل على نقاط</small></article>
          <article className="stat-card"><span>إجمالي النقاط الحالية</span><strong>{totalPoints.toLocaleString("ar-SA")}</strong><small>رصيد كل المحافظ</small></article>
          <article className="stat-card"><span>القيمة التقديرية</span><strong>{totalValue.toLocaleString("ar-SA")} ر.س</strong><small>حسب قيمة النقطة الحالية</small></article>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div><h3>محافظ الطلاب</h3><p>المرحلة والصف والفصل والرصيد تُقرأ مباشرة من قاعدة البيانات.</p></div>
            <Link href="/rankings">فتح لوحة الترتيب</Link>
          </div>
          {students.length ? (
            <div className="table-wrap"><table><thead><tr><th>الطالب</th><th>رقم الطالب</th><th>الصف</th><th>الفصل</th><th>المستوى</th><th>الرصيد</th><th>القيمة التقديرية</th></tr></thead><tbody>
              {students.map((s:any) => <tr key={s.id}><td><b>{s.name}</b></td><td>{s.student_no}</td><td>{s.grade_name}</td><td>{s.class_name}</td><td><span className="status">{s.level}</span></td><td><b>{s.points} نقطة</b></td><td>{Number(s.value_sar).toLocaleString("ar-SA")} ر.س</td></tr>)}
            </tbody></table></div>
          ) : (
            <div className="empty-state"><b>لا يوجد طلاب حتى الآن</b><span>استورد الطلاب من صفحة تهيئة النظام.</span><Link href="/setup" className="btn ghost">التهيئة</Link></div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
