export type ReportPrintOptions={title:string;subtitle?:string;orientation?:"landscape"|"portrait"};

const esc=(v:any)=>String(v??"").replace(/[&<>"']/g,(m)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]||m));

function cleanTable(source:HTMLTableElement){
  const clone=source.cloneNode(true) as HTMLTableElement;
  clone.querySelectorAll("button,input,select,textarea,.no-print,.screen-only,.auto-report-print-toolbar").forEach(x=>x.remove());
  const firstRow=clone.querySelector("thead tr")||clone.querySelector("tr");
  const remove:number[]=[];
  if(firstRow){
    Array.from(firstRow.children).forEach((cell,index)=>{
      const text=(cell.textContent||"").trim();
      if((cell as HTMLElement).classList.contains("no-print")||/^(إجراء|الإجراء|تحكم|حذف|إدارة)$/.test(text))remove.push(index);
    });
  }
  if(remove.length){
    clone.querySelectorAll("tr").forEach(row=>{
      const cells=Array.from(row.children);
      remove.slice().sort((a,b)=>b-a).forEach(index=>cells[index]?.remove());
    });
  }
  clone.querySelectorAll("[style]").forEach(el=>{
    const h=el as HTMLElement;
    h.style.maxHeight="";h.style.overflow="";h.style.display="";
  });
  return clone;
}

export function printTableReport(table:HTMLTableElement,options:ReportPrintOptions){
  const clean=cleanTable(table);
  const rows=clean.querySelectorAll("tbody tr").length;
  const printedAt=new Date().toLocaleString("ar-SA",{year:"numeric",month:"long",day:"numeric",hour:"numeric",minute:"2-digit"});
  const base=new URL(import.meta.env.BASE_URL,window.location.origin).href;
  const schoolLogo=new URL("school-logo.png",base).href;
  const guidanceLogo=new URL("guidance-logo.png",base).href;
  const styles=Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).map(x=>`<link rel="stylesheet" href="${esc(x.href)}">`).join("");
  const w=window.open("","_blank","width=1200,height=850");
  if(!w){window.alert("تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة.");return}
  w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(options.title)}</title>${styles}<style>
    @page{size:A4 ${options.orientation||"landscape"};margin:11mm}
    *{box-sizing:border-box}html,body{background:#fff!important;color:#17242c!important}body{margin:0;padding:0;font-family:"Cairo",Tahoma,Arial,sans-serif!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .report-page{width:100%}.report-head{display:grid;grid-template-columns:110px 1fr 110px;align-items:center;gap:14px;border-bottom:3px solid #0b7562;padding:0 0 12px;margin-bottom:14px}.report-head img{width:72px;height:72px;object-fit:contain;justify-self:center}.report-head .title{text-align:center}.report-head h1{font-size:20px;margin:0 0 4px;color:#153f62}.report-head h2{font-size:11px;margin:0;color:#0b7562}.report-head p{font-size:9px;margin:5px 0 0;color:#667983}.report-meta{display:flex;justify-content:space-between;gap:12px;align-items:center;margin:0 0 10px;padding:7px 10px;background:#f4f8f8;border:1px solid #dbe6e8;border-radius:9px;font-size:9px}.report-meta b{color:#0b7562}.table-shell{width:100%;overflow:visible!important}table{width:100%!important;max-width:none!important;min-width:0!important;border-collapse:collapse!important;table-layout:auto!important;font-size:9px!important;background:#fff!important}thead{display:table-header-group}tfoot{display:table-footer-group}tr{break-inside:avoid;page-break-inside:avoid}th,td{border:1px solid #cfdadd!important;padding:6px 7px!important;text-align:right!important;vertical-align:top!important;white-space:normal!important;overflow-wrap:anywhere!important;background:#fff!important;color:#17242c!important}th{background:#eaf3f1!important;color:#124d45!important;font-weight:800!important}tbody tr:nth-child(even) td{background:#f9fbfb!important}td small,td span{color:#5e737e!important}.report-footer{margin-top:12px;padding-top:8px;border-top:1px solid #d5e0e3;display:flex;justify-content:space-between;font-size:8px;color:#748690}.screen-tools{display:flex;justify-content:center;gap:8px;margin:16px 0}.screen-tools button{font-family:inherit;border:0;border-radius:10px;padding:9px 18px;font-weight:800;cursor:pointer;background:#0b7562;color:#fff}@media print{.screen-tools{display:none!important}.report-page{padding:0}.report-head{break-inside:avoid}.report-footer{position:relative}}
  </style></head><body><div class="report-page"><header class="report-head"><img src="${esc(schoolLogo)}" alt="شعار المدرسة"><div class="title"><h2>مدارس المشكاة الأهلية — بنك التميز الطلابي</h2><h1>${esc(options.title)}</h1>${options.subtitle?`<p>${esc(options.subtitle)}</p>`:""}</div><img src="${esc(guidanceLogo)}" alt="شعار التوجيه الطلابي"></header><div class="report-meta"><span>عدد السجلات: <b>${rows.toLocaleString("ar-SA")}</b></span><span>تاريخ إعداد التقرير: <b>${esc(printedAt)}</b></span></div><div class="table-shell">${clean.outerHTML}</div><footer class="report-footer"><span>التوجيه الطلابي</span><span>تم إنشاء التقرير إلكترونيًا من نظام بنك التميز الطلابي</span></footer><div class="screen-tools"><button onclick="window.print()">طباعة / حفظ PDF</button></div></div><script>window.addEventListener('load',()=>setTimeout(()=>{window.focus();window.print()},300));<\/script></body></html>`);
  w.document.close();
}
