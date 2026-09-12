import AppShell from "@/components/AppShell";
import Header from "@/components/Header";
import { getRewards } from "@/lib/data";
export const dynamic='force-dynamic';
export default async function RewardsPage(){const rewards=await getRewards();return <AppShell><Header title="متجر المكافآت" subtitle="تحويل رصيد التميز إلى مكافآت مدرسية"/><main className="content"><section className="rewards-grid">{rewards.map((r:any)=><article className="reward-card" key={r.id}><span>{r.cash_value_sar?`قيمة ${Number(r.cash_value_sar)} ريال`:'مكافأة مدرسية'}</span><h3>{r.name_ar}</h3><strong>{r.cost_points} نقطة</strong><small>{r.stock===null?'المخزون: غير محدود':`المتوفر: ${r.stock}`}</small>{r.description_ar&&<p className="form-note">{r.description_ar}</p>}<button className="btn ghost">إدارة المكافأة</button></article>)}</section></main></AppShell>}
