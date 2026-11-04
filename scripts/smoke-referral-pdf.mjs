// Exercise the actual Arabic referral PDF function in headless Chromium, then
// parse the binary PDF (not just its filename) using pdfjs-dist.
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
import {pathToFileURL} from "node:url";
import ts from "typescript";
import {getDocument} from "pdfjs-dist/legacy/build/pdf.mjs";

const browser=["google-chrome","google-chrome-stable","chromium","chromium-browser"]
 .find(cmd=>spawnSync("sh",["-c","command -v "+cmd],{encoding:"utf8"}).status===0);
if(!browser){console.log("SKIP : Headless Chrome unavailable for actual referral PDF render");process.exit(0)}
const dir=mkdtempSync(join(tmpdir(),"referral-pdf-"));
try{
 const tsSource=readFileSync(new URL("../src/referral-pdf.ts",import.meta.url),"utf8");
 const output=ts.transpileModule(tsSource,{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022
 }}).outputText.replaceAll("import.meta.env.BASE_URL",'"./"');
 writeFileSync(join(dir,"renderer.mjs"),output);
 const fixture={
  referral_no:"RF-2026-0047",student_name:"طالب تجريبي",student_no:"1234567890",
  grade_name:"الأول المتوسط",class_name:"1",teacher_name:"معلم تجريبي",
  subject_ar:"الرياضيات",incident_date:"2026-11-04",
  target_label:"الموجه الطلابي",violation_category_label:"تعليمية",
  occurrence_label:"أول مرة",violation_text:"المتابعة الدورية للواجبات والتحصيل الدراسي",
  violation_explanation:"ملاحظة تربوية تستدعي تعزيز التعاون بين الأسرة والمدرسة.",
  teacher_action_1:"التواصل مع الطالب وتقديم الدعم داخل الصف",
  teacher_action_date_1:"2026-11-04",
  teacher_action_2:"تقديم خطة متابعة قصيرة",teacher_action_date_2:"2026-11-04",
  status:"OPEN"
 };
 const html=`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8">
 <title>Referral PDF Browser Verification</title><div id="result">RUNNING</div>
 <script type="module">
 import {createReferralPdf} from "./renderer.mjs";
 const r=${JSON.stringify(fixture)};
 try{
  const file=await createReferralPdf(r,"متوسطة وثانوية مشكاة الشعلة الأهلية");
  const bytes=new Uint8Array(await file.arrayBuffer());
  let text="";
  for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));
  document.getElementById("result").textContent="PDF:"+btoa(text);
 }catch(e){
  document.getElementById("result").textContent="ERROR:"+String(e?.stack||e);
 }
 <\/script></html>`;
 const page=join(dir,"index.html");writeFileSync(page,html);
 const run=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu",
  "--allow-file-access-from-files","--disable-dev-shm-usage",
  "--disable-web-security","--virtual-time-budget=18000","--dump-dom",
  pathToFileURL(page).href],{encoding:"utf8",timeout:60000,maxBuffer:16*1024*1024});
 if(run.status!==0)throw new Error("Chrome test failed: "+run.stderr?.slice(-900));
 const result=run.stdout.match(/<div id="result">(PDF:([A-Za-z0-9+/=]+)|ERROR:([^<]+)|RUNNING)<\/div>/);
 if(!result)throw new Error("Browser did not return a referral PDF; stdout tail "+run.stdout.slice(-600));
 if(result[1]==="RUNNING")throw new Error("PDF generation did not complete in the browser");
 if(result[3])throw new Error("Browser failed to generate PDF: "+result[3]);
 const binary=Buffer.from(result[2],"base64");
 if(binary.length<10000||binary.subarray(0,8).toString("utf8")!=="%PDF-1.4")
   throw new Error("Generated referral PDF is empty or invalid ("+binary.length+" bytes)");
 const pdf=await getDocument({data:new Uint8Array(binary),useSystemFonts:true}).promise;
 if(pdf.numPages<1||pdf.numPages>8)throw new Error("Unexpected PDF page count: "+pdf.numPages);
 let imagePages=0;
 for(let i=1;i<=pdf.numPages;i++){
  const page=await pdf.getPage(i);
  const ops=await page.getOperatorList();
  if(ops.fnArray.length>0)imagePages++;
 }
 const pages=pdf.numPages;
 await pdf.destroy();
 if(imagePages!==pages)throw new Error("Blank pages detected");
 console.log("PASS : Real Arabic referral PDF created, parsed, "+pages+
  " rendered page(s), "+binary.length+" bytes, all with printable image content");
}finally{rmSync(dir,{recursive:true,force:true})}
