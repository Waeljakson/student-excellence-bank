import {readFileSync,mkdtempSync,writeFileSync,existsSync,statSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
import {pathToFileURL} from "node:url";
const source=readFileSync(new URL("../src/report-print.ts",import.meta.url),"utf8");
const match=source.match(/<style>\s*([\s\S]*?)\s*<\/style><\/head><body>/);
if(!match)throw new Error("No self-contained print CSS in report-print.ts");
const css=match[1].replace(/\$\{options\.orientation\|\|"landscape"\}/g,"landscape").replaceAll("${fontFaces}","");
if(css.includes("${"))throw new Error("Unexpected unresolved template interpolation in print CSS");
const chrome=["google-chrome","google-chrome-stable","chromium","chromium-browser"].find(command=>
 spawnSync("sh",["-c","command -v "+command],{encoding:"utf8"}).status===0);
if(!chrome){console.log("Browser smoke test SKIPPED: Chromium/Chrome unavailable; source checks still run.");process.exit(0)}
const dir=mkdtempSync(join(tmpdir(),"bank-print-smoke-"));
try{
 const html=join(dir,"report.html"),pdf=join(dir,"report.pdf");
 writeFileSync(html,`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>Print Regression 2026</title><style>${css}</style></head><body>
 <div class="report-page"><header class="report-head"><div></div><div class="title"><h1>Print Regression 2026</h1></div><div></div></header>
 <div class="report-meta">Report rows: 3</div><div class="table-shell"><table><thead><tr><th>Student</th><th>Grade</th></tr></thead>
 <tbody><tr><td>STUDENT_001</td><td>98</td></tr><tr><td>STUDENT_002</td><td>92</td></tr><tr><td>STUDENT_003</td><td>90</td></tr></tbody></table></div></div></body></html>`);
 const cmd=spawnSync(chrome,["--headless=new","--disable-gpu","--no-sandbox","--no-first-run",
  "--disable-dev-shm-usage","--no-pdf-header-footer","--print-to-pdf="+pdf,pathToFileURL(html).href],
  {encoding:"utf8",timeout:50000});
 if(cmd.status!==0||!existsSync(pdf))throw new Error("Headless print failed: "+(cmd.stderr||"").slice(-900));
 const bytes=statSync(pdf).size;
 if(bytes<6000)throw new Error("PDF file is suspiciously empty ("+bytes+" bytes)");
 // pdfjs-dist is a production dependency, so this CI test verifies the actual
 // text inside the browser-generated PDF without relying on OS-installed tools.
 const {getDocument}=await import("pdfjs-dist/legacy/build/pdf.mjs");
 const doc=await getDocument({data:new Uint8Array(readFileSync(pdf)),useSystemFonts:true}).promise;
 let extracted="";
 for(let pageNumber=1;pageNumber<=doc.numPages;pageNumber++){
   const content=await (await doc.getPage(pageNumber)).getTextContent();
   extracted+=" "+content.items.map(x=>("str" in x?x.str:"")).join(" ");
 }
 await doc.destroy();
 for(const expected of ["Print Regression 2026","STUDENT_001","STUDENT_002","STUDENT_003"]){
   if(!extracted.includes(expected))
     throw new Error("Print regression: missing "+expected+" in browser PDF text (blank or hidden printout).");
 }
 console.log("PASS : Headless Chromium PDF contains title and all student report rows ("+bytes+" bytes).");
}finally{rmSync(dir,{recursive:true,force:true})}
