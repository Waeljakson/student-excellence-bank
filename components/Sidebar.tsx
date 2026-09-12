import Link from "next/link";

const items = [
  ["/", "الرئيسية", "⌂"],
  ["/checks", "شيكات التميز", "▣"],
  ["/students", "الطلاب والمحافظ", "◎"],
  ["/rewards", "متجر المكافآت", "◇"],
  ["/competitions/khameesna", "خميسنا غير", "★"],
  ["/setup", "تهيئة النظام", "◆"],
  ["/settings", "الإعدادات", "⚙"],
] as const;

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand-mini">
        <span className="brand-mark">م</span>
        <div><strong>بنك التميز</strong><small>مدارس المشكاة الأهلية</small></div>
      </div>
      <nav>
        {items.map(([href, label, icon]) => (
          <Link className="nav-link" href={href} key={href}>
            <span className="nav-icon">{icon}</span><span>{label}</span>
          </Link>
        ))}
      </nav>
      <div className="sidebar-box">
        <b>رصيد إصدارك</b>
        <strong>63 نقطة</strong>
        <span>متبقية هذا الشهر</span>
      </div>
    </aside>
  );
}
