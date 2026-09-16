import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let app = readFileSync(appPath, "utf8");
if (!app.includes("BEHAVIORAL_TEACHER_TAB_ALWAYS_V1")) {
  const oldLine = '  const showBehavior=profile.roles?.some(r=>["GUIDANCE_COUNSELOR","SUPER_ADMIN"].includes(r))||(profile.roles?.includes("TEACHER")&&behaviorStatus?.visible_to_teacher===true);';
  const newLine = '  // BEHAVIORAL_TEACHER_TAB_ALWAYS_V1: teachers always see the tab; nomination availability is controlled inside the page.\n  const showBehavior=profile.roles?.some(r=>["TEACHER","GUIDANCE_COUNSELOR","SUPER_ADMIN"].includes(r));';
  if (!app.includes(oldLine)) throw new Error("Behavioral navigation visibility line not found");
  app = app.replace(oldLine, newLine);
  writeFileSync(appPath, app);
}

const behavioralPath = "src/BehavioralExcellence.tsx";
let behavioral = readFileSync(behavioralPath, "utf8");
if (!behavioral.includes("BEHAVIORAL_TEACHER_WAITING_NOTICE_V1")) {
  const nominationStart = '    {c&&data.is_teacher&&data.visible_to_teacher&&<section className="behavioral-nomination-area">';
  const replacement = '    {/* BEHAVIORAL_TEACHER_WAITING_NOTICE_V1 */}\n    {data.is_teacher&&(!c||!data.visible_to_teacher)&&<section className="panel empty"><h3>الترشيح غير متاح حاليًا</h3><p>{!c?"لم يتم تجهيز دورة للتميز السلوكي حتى الآن.":c.status==="SCHEDULED"?"الدورة جاهزة وتنتظر تفعيل الموجه الطلابي. عند التفعيل ستظهر لك فصولك والطلاب هنا مباشرة.":"الدورة مغلقة حاليًا ولا يمكن إضافة ترشيحات جديدة."}</p></section>}\n\n    {c&&data.is_teacher&&data.visible_to_teacher&&<section className="behavioral-nomination-area">';
  if (!behavioral.includes(nominationStart)) throw new Error("Behavioral nomination section not found");
  behavioral = behavioral.replace(nominationStart, replacement);
  writeFileSync(behavioralPath, behavioral);
}
