import Image from "next/image";
import { verifyQrToken } from "@/lib/qr-token";
import { getDb } from "@/lib/db";

export const dynamic='force-dynamic';

export default async function VerifyPage({searchParams}:{searchParams:Promise<{token?:string}>}){
  const {token}=await searchParams;
  const payload=token?verifyQrToken(token):null;
  let check:any=null;
  if(payload){
    const sql=getDb();
    const rows=await sql`SELECT ec.serial_no,ec.points,ec.reason_ar,ec.status,ec.approval_status,ec.issued_at,s.full_name_ar AS student_name,u.full_name_ar AS issuer_name,sch.point_value_sar
      FROM excellence_checks ec JOIN students s ON s.id=ec.student_id JOIN app_users u ON u.id=ec.issued_by JOIN schools sch ON sch.id=ec.school_id WHERE ec.id=${payload.checkId}::uuid LIMIT 1`;
    check=rows[0]??null;
  }
  const valid=!!check;
  return <main className="verify-screen"><section className={`verify-card ${valid?'valid':'invalid'}`}><div className="verify-logos"><Image src="/school-logo.png" alt="المشكاة" width={74} height={74}/><Image src="/guidance-logo.png" alt="التوجيه الطلابي" width={92} height={74}/></div>{valid?<><span className="verify-state">✓ شيك أصلي ومسجل</span><h1>{check.reason_ar}</h1><p>الطالب</p><h2>{check.student_name}</h2><div className="check-value"><span>النقاط</span><strong>{check.points} نقطة</strong></div><div className="verify-grid"><div><small>رقم الشيك</small><b>{check.serial_no}</b></div><div><small>المصدر</small><b>{check.issuer_name}</b></div><div><small>الحالة</small><b>{check.status}</b></div><div><small>القيمة التقديرية</small><b>{Number(check.points)*Number(check.point_value_sar)} ريال</b></div></div></>:<><span className="verify-state">× تعذر التحقق</span><h1>الرمز غير صحيح أو غير موجود</h1><p>راجع الجهة المصدرة للشيك.</p></>}</section></main>
}
