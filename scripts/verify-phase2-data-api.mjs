// Standalone smoke test: verify that newly deployed Neon Data API RPCs
// are actually visible over HTTPS, not merely present in PostgreSQL.
const base="https://ep-green-bar-b2rjvdpo.apirest.c-6.eu-central-1.aws.neon.tech/excellence_bank/rest/v1";
const functions=[
 {name:"api_phase2_guardian_experience",body:{p_student_no:"0000000000",p_school_code:"MISHKAT"},expected:"STUDENT_NOT_FOUND"},
 {name:"api_phase2_student_experience",body:{},expected:"AUTH_REQUIRED"},
 {name:"api_phase2_admin_data",body:{},expected:"AUTH_REQUIRED"},
];
let errors=0;
for(const test of functions){
 try{
  const res=await fetch(base+"/rpc/"+test.name,{
    method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},
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
else process.stdout.write("Neon Phase 2 API schema cache and RPC exposure VERIFIED\n");
