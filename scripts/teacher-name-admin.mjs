import { readFileSync, writeFileSync } from "node:fs";

const appPath="src/App.tsx";
let src=readFileSync(appPath,"utf8");

if(!src.includes('async function changeStaffName(s:StaffMember)')){
  const marker='  async function changeTeacherMobile(s:StaffMember){';
  const helper=`  async function changeStaffName(s:StaffMember){
    if(!isSuperAdmin||s.job_title_ar!=="معلم")return;
    const raw=window.prompt("الاسم الصحيح للمعلم",s.full_name_ar);
    if(raw===null)return;
    const name=raw.trim().replace(/\\s+/g," ");
    if(name.length<3){setMsg("اكتب اسم المعلم الصحيح كاملًا.");return}
    if(name===String(s.full_name_ar||"").trim()){setMsg("الاسم الجديد مطابق للاسم الحالي.");return}
    if(!window.confirm("سيتم تغيير اسم المعلم في حسابه وكل صفحات النظام من «"+s.full_name_ar+"» إلى «"+name+"». هل تريد المتابعة؟"))return;
    const key="name:"+s.id;setBusy(key);setMsg("");
    try{
      const result=await rpc<any>("api_set_staff_classes",{p_staff_id:s.id,p_class_ids:{action:"UPDATE_STAFF_NAME",full_name_ar:name}});
      setMsg("تم تغيير اسم المعلم من «"+(result?.old_name||s.full_name_ar)+"» إلى «"+(result?.full_name_ar||name)+"» في الحساب والنظام.");
      await reload();
    }catch(e){setMsg(niceError(e))}finally{setBusy("")}
  }
`;
  if(!src.includes(marker))throw new Error("teacher-name-admin: changeTeacherMobile marker not found");
  src=src.replace(marker,helper+marker);
}

const mobileButton='{isSuperAdmin&&s.job_title_ar==="معلم"&&<button className="mini-btn" disabled={busy==="mobile:"+s.id} onClick={()=>changeTeacherMobile(s)}>{busy==="mobile:"+s.id?"جارٍ التغيير...":"تغيير رقم الجوال"}</button>}';
const nameButton='{isSuperAdmin&&s.job_title_ar==="معلم"&&<button className="mini-btn" disabled={busy==="name:"+s.id} onClick={()=>changeStaffName(s)}>{busy==="name:"+s.id?"جارٍ التعديل...":"تعديل الاسم"}</button>}';
if(!src.includes('onClick={()=>changeStaffName(s)}')){
  if(!src.includes(mobileButton))throw new Error("teacher-name-admin: mobile button marker not found");
  src=src.replace(mobileButton,nameButton+mobileButton);
}

writeFileSync(appPath,src);

const clientPath="src/client.ts";
let client=readFileSync(clientPath,"utf8");
if(!client.includes('STAFF_NAME_INVALID')){
  const marker='  if (message.includes("STAFF_NOT_FOUND")) return "لم يتم العثور على الموظف في دليل الهيئة.";';
  const extra='  if (message.includes("STAFF_NAME_INVALID")) return "اسم المعلم غير صالح. اكتب الاسم الصحيح كاملًا.";\n  if (message.includes("STAFF_NAME_EXISTS")) return "يوجد موظف آخر مسجل بنفس الاسم.";\n';
  if(!client.includes(marker))throw new Error("teacher-name-admin: client error marker not found");
  client=client.replace(marker,extra+marker);
}
writeFileSync(clientPath,client);
