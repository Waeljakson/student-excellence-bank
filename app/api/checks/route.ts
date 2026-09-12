import { getCurrentAppUser, hasAnyRole } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import { signQrPayload } from "@/lib/qr-token";

const ISSUER_ROLES=['SUPER_ADMIN','SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','GUIDANCE_COUNSELOR','TEACHER'];

export async function POST(request: Request){
  const current:any=await getCurrentAppUser();
  if(!current?.appUser) return Response.json({ok:false,error:'الحساب غير مربوط بصلاحية داخل المدرسة'}, {status:403});
  if(!hasAnyRole(current.appUser.roles,ISSUER_ROLES)) return Response.json({ok:false,error:'ليس لديك صلاحية إصدار شيكات'}, {status:403});
  const body=await request.json();
  const {studentId,ruleId,points,reason,notes}=body;
  if(!studentId||!ruleId||!points||!reason) return Response.json({ok:false,error:'بيانات الشيك غير مكتملة'},{status:400});
  const sql=getDb();
  try{
    const rows=await sql`SELECT issue_excellence_check(${current.appUser.school_id}::uuid,${studentId}::uuid,${ruleId}::uuid,${Number(points)}::int,${String(reason)},${current.appUser.id}::uuid,${notes ? String(notes) : null}) AS id`;
    const checkId=rows[0].id as string;
    const check=await sql`SELECT id,serial_no,points,reason_ar,status,approval_status FROM excellence_checks WHERE id=${checkId}::uuid`;
    return Response.json({ok:true,check:check[0],qrToken:signQrPayload(checkId)});
  }catch(e){return Response.json({ok:false,error:e instanceof Error?e.message:'تعذر إصدار الشيك'},{status:400});}
}
