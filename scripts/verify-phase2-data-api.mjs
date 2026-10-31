// Standalone smoke test: verify that newly deployed Neon Data API RPCs
// are actually visible over HTTPS, not merely present in PostgreSQL.
const base="https://ep-green-bar-b2rjvdpo.apirest.c-6.eu-central-1.aws.neon.tech/excellence_bank/rest/v1";
const authUrl="https://ep-green-bar-b2rjvdpo.neonauth.c-6.eu-central-1.aws.neon.tech/excellence_bank/auth";
const authResponse=await fetch(authUrl+"/token/anonymous",{method:"GET",headers:{"Accept":"application/json"},signal:AbortSignal.timeout(15000)});
const authRaw=await authResponse.text();
let authData={};try{authData=JSON.parse(authRaw)}catch{}
const token=typeof authData==="string"?authData:(authData.token||authData.jwt||authData.accessToken||authData.access_token||authRaw.trim());
if(!authResponse.ok||!String(token).includes(".")){
 process.stderr.write("Cannot obtain Neon anonymous JWT: HTTP "+authResponse.status+" response keys="+Object.keys(authData).join(",")+"\\n");
 process.exit(1);
}
process.stdout.write("Neon short-lived anonymous JWT acquired (not logged)\\n");
const functions=[
 {name:"api_phase2_guardian_experience",body:{p_student_no:"0000000000",p_school_code:"MISHKAT"},expected:"STUDENT_NOT_FOUND"},
 {name:"api_phase2_student_experience",body:{},expected:"AUTH_REQUIRED"},
 {name:"api_phase2_admin_data",body:{},expected:"AUTH_REQUIRED"},
 {name:"api_phase3_review_queue",body:{p_days:30,p_grade_id:null,p_class_id:null},expected:"AUTH_REQUIRED"},
 {name:"api_phase3_teacher_engagement",body:{p_days:30},expected:"AUTH_REQUIRED"},
 {name:"api_phase3_plan_history",body:{p_student_id:"00000000-0000-0000-0000-000000000000"},expected:"AUTH_REQUIRED"},
 {name:"api_phase3_save_plan",body:{p_id:null,p_student_id:"00000000-0000-0000-0000-000000000000",p_concern_kind:"ACADEMIC",p_goal:"test goal",p_action:"test action",p_review_on:null,p_private_note:"",p_status:"OPEN"},expected:"AUTH_REQUIRED"},
];
let errors=0;
for(const test of functions){
 try{
  const res=await fetch(base+"/rpc/"+test.name,{
    method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json","Authorization":"Bearer "+token},
    body:JSON.stringify(test.body),signal:AbortSignal.timeout(15000),
  });
  const body=await res.text();
  let data;try{data=JSON.parse(body)}catch{data={message:body.slice(0,450)}}
  const code=String(data.code||"");const message=String(data.message||"");
  const ok=(message.includes(test.expected)||code.includes(test.expected))&&!code.includes("PGRST202");
  process.stdout.write(test.name+": HTTP "+res.status+" code="+code+" expected="+test.expected+" "+(ok?"PASS":"FAIL")+"\n");
  if(!ok){errors++;process.stderr.write("  Response: "+JSON.stringify(data).slice(0,700)+"\n")}
 }catch(e){errors++;process.stderr.write(test.name+": NETWORK_ERROR "+String(e)+"\n")}
}
if(errors){process.stderr.write(errors+" Neon RPC checks failed\n");process.exitCode=1}
else process.stdout.write("Neon Phase 2/3 API schema and unauthorized-access controls VERIFIED\n");
