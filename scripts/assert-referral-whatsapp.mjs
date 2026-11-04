import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const sql=read("database/20261104_referral_whatsapp_parent_contacts.sql");
const modal=read("src/ReferralWhatsAppShare.tsx");
const open=read("src/ReferralCenter.tsx");
const completed=read("src/CompletedReferralsReport.tsx");
const checks=[
 ["Contact lookup is scoped to the caller's existing visible referrals",
  sql.includes("public.api_student_referrals('ALL')")&&sql.includes("REFERRAL_NOT_ACCESSIBLE")],
 ["Guardian contacts must belong to the same school and the selected student",
  sql.includes("g.school_id=v_school")&&sql.includes("sg.student_id=v_student")],
 ["Anonymous callers receive no guardian contacts",
  sql.includes("AUTH_REQUIRED")&&sql.includes("v_auth IS NULL")],
 ["No full student data or portal access tokens are exposed by contact RPC",
  !sql.includes("guardian_access_links")&&!sql.includes("v_link.token")],
 ["Open referrals show the WhatsApp action",
  open.includes("إرسال التحويل لولي الأمر عبر واتساب")&&
  open.includes("<ReferralWhatsAppShare referral={r}")],
 ["Completed referrals can also be shared",
  completed.includes("واتساب ولي الأمر")&&
  completed.includes("<ReferralWhatsAppShare")],
 ["Sending is user-initiated and does not claim automatic WhatsApp delivery",
  modal.includes("https://wa.me/")&&modal.includes('encodeURIComponent(message.trim())')&&
  modal.includes('target="_blank" rel="noopener noreferrer"')&&
  modal.includes("لن تُرسل الرسالة تلقائيًا")],
 ["Brief parent-safe message is default, detailed content is optional",
  modal.includes('useState<Template>("BRIEF")')&&modal.includes('template==="DETAILS"')],
 ["Saudi guardian numbers from school roster are normalized to international form",
  modal.includes('return "966"+digits.slice(1)')&&modal.includes('/^9665')]
];
let failed=0;
for(const [name,pass] of checks){console.log((pass?"PASS":"FAIL")+" : "+name);if(!pass)failed++}
if(failed)throw new Error(failed+" WhatsApp referral safety checks failed");
console.log("All "+checks.length+" WhatsApp referral checks passed.");
