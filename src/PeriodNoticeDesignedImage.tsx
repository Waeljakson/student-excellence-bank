import {useEffect,useRef,useState} from "react";
import type {PeriodNotice} from "./PeriodNoticeViewer";
import "./period-notice-designer.css";

type Subject={subject:string;maximum:number|null;total:number|null;assessments?:Record<string,number|null>;note?:string};
type Props={notice:PeriodNotice;studentName:string;schoolName?:string};
const WIDTH=900;
const PAGE_HEIGHT=1273;
const PIXEL_RATIO=2;
const RIGHT=835;
const LEFT=65;
const FONT="Cairo, Tahoma, sans-serif";
const navy="#123a59";
const muted="#61798b";
const gold="#b68637";
const format=(v:unknown):string=>{
  if(v===null||v===undefined||v==="")return "—";
  const n=Number(v);
  return Number.isFinite(n)?n.toLocaleString("ar-SA",{maximumFractionDigits:2}):String(v);
};
const valid=(v:unknown)=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v));
const shortDate=(d:string)=>{
  const date=new Date(d);
  return Number.isNaN(date.getTime())?"—":date.toLocaleDateString("ar-SA-u-ca-gregory",{year:"numeric",month:"long",day:"numeric"});
};
function font(ctx:CanvasRenderingContext2D,size:number,weight=600){
  ctx.font=String(weight)+" "+size+"px "+FONT;
  ctx.direction="rtl";ctx.textAlign="right";ctx.textBaseline="alphabetic";
}
function txt(ctx:CanvasRenderingContext2D,text:unknown,x:number,y:number,size=16,color=navy,weight=600){
  font(ctx,size,weight);ctx.fillStyle=color;ctx.fillText(String(text??""),x,y);
}
function rounded(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number,color:string|CanvasGradient,stroke?:string){
  ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=color;ctx.fill();
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke()}
}
function split(ctx:CanvasRenderingContext2D,value:unknown,maxWidth:number,size=14,weight=500):string[]{
  const str=String(value??"").trim().replace(/\s+/g," ");
  if(!str)return [];
  font(ctx,size,weight);
  const lines:string[]=[];
  let line="";
  for(const part of str.split(" ")){
    const next=line?line+" "+part:part;
    if(line&&ctx.measureText(next).width>maxWidth){lines.push(line);line=part}
    else line=next;
  }
  if(line)lines.push(line);
  return lines;
}
function logo(ctx:CanvasRenderingContext2D,img:HTMLImageElement|null,x:number,y:number,size:number){
  rounded(ctx,x,y,size,size,16,"#ffffff");
  if(img&&img.complete&&img.naturalWidth){
    const ratio=Math.min((size-16)/img.naturalWidth,(size-16)/img.naturalHeight);
    const w=img.naturalWidth*ratio,h=img.naturalHeight*ratio;
    ctx.drawImage(img,x+(size-w)/2,y+(size-h)/2,w,h);
  }else{
    txt(ctx,"★",x+size/2+11,y+size/2+9,30,gold,800);
  }
}
function drawDocument(
  ctx:CanvasRenderingContext2D,
  notice:PeriodNotice,
  studentName:string,
  schoolName:string,
  logos:[HTMLImageElement|null,HTMLImageElement|null]
):number{
  const subjects:Array<Subject>=Array.isArray(notice.subjects)?notice.subjects:[];
  let page=0,y=0;
  function pageStart(continued=false){
    const top=page*PAGE_HEIGHT;
    ctx.fillStyle="#f8fafc";ctx.fillRect(0,top,WIDTH,PAGE_HEIGHT);
    ctx.fillStyle=navy;ctx.fillRect(0,top,WIDTH,10);
    ctx.fillStyle=gold;ctx.fillRect(0,top+10,WIDTH,4);
    ctx.strokeStyle="#dbe5eb";ctx.strokeRect(33,top+31,WIDTH-66,PAGE_HEIGHT-63);
    ctx.fillStyle=muted;
    txt(ctx,"بنك التميز الطلابي  •  إشعار نتائج معتمد للنشر",RIGHT,top+PAGE_HEIGHT-48,12,muted,600);
    font(ctx,12,600);ctx.textAlign="left";ctx.fillText("صفحة "+format(page+1),LEFT,top+PAGE_HEIGHT-48);
    if(continued){
      rounded(ctx,LEFT,top+48,WIDTH-LEFT*2,62,12,"#eaf2f7");
      txt(ctx,"تابع إشعار نتائج الطالب: "+studentName,RIGHT-18,top+87,17,navy,800);
      y=top+133;
    }else{
      const gradient=ctx.createLinearGradient(0,top+16,WIDTH,top+178);
      gradient.addColorStop(0,"#126e82");gradient.addColorStop(1,navy);
      rounded(ctx,LEFT,top+32,WIDTH-LEFT*2,154,20,gradient);
      logo(ctx,logos[0],RIGHT-104,top+52,84);
      logo(ctx,logos[1],LEFT+20,top+52,84);
      font(ctx,17,700);ctx.textAlign="center";ctx.fillStyle="#ffdf9a";
      ctx.fillText(schoolName,WIDTH/2,top+73,WIDTH-340);
      font(ctx,31,800);ctx.fillStyle="#ffffff";
      ctx.fillText("إشعار نتائج الطالب",WIDTH/2,top+116);
      font(ctx,15,600);ctx.fillStyle="#dbeef4";
      ctx.fillText("تقرير التحصيل الدراسي والفترة التقييمية",WIDTH/2,top+151);
      y=top+207;
    }
  }
  function ensure(height:number){
    if(y+height>PAGE_HEIGHT*(page+1)-91){page++;pageStart(true)}
  }
  function section(title:string){
    ensure(56);
    rounded(ctx,LEFT,y+4,WIDTH-LEFT*2,42,11,"#ecf2f7");
    ctx.fillStyle=gold;ctx.fillRect(RIGHT-7,y+13,4,24);
    txt(ctx,title,RIGHT-23,y+32,18,navy,800);
    y+=57;
  }
  function smallTag(label:string,value:unknown,x:number,top:number,w:number){
    rounded(ctx,x,top,w,69,11,"#ffffff","#dce6ee");
    txt(ctx,label,x+w-15,top+24,12,muted,600);
    txt(ctx,String(value??"—"),x+w-15,top+52,19,navy,800);
  }

  pageStart();
  const nameLines=split(ctx,studentName,650,24,800);
  const studentHeight=118+(Math.max(0,nameLines.length-1)*34);
  ensure(studentHeight+18);
  rounded(ctx,LEFT,y,WIDTH-LEFT*2,studentHeight,17,"#ffffff","#d6e4eb");
  txt(ctx,"اسم الطالب",RIGHT-20,y+32,13,muted,700);
  nameLines.forEach((line,i)=>txt(ctx,line,RIGHT-20,y+67+i*34,24,navy,800));
  const lineY=y+73+(nameLines.length-1)*34;
  ctx.strokeStyle="#e4ebf0";ctx.beginPath();ctx.moveTo(LEFT+20,lineY+6);ctx.lineTo(RIGHT-20,lineY+6);ctx.stroke();
  const info=(notice.grade||"—")+"  •  الفصل: "+(notice.class_name||"—");
  txt(ctx,info,RIGHT-20,lineY+30,14,navy,700);
  txt(ctx,(notice.period_title||notice.title||"نتائج الفترة")+"  |  "+(notice.semester||"")+"  |  "+(notice.academic_year||""),RIGHT-20,lineY+52,12,muted,600);
  y+=studentHeight+18;

  section("تفاصيل التحصيل الدراسي");
  if(!subjects.length){
    ensure(75);rounded(ctx,LEFT,y,WIDTH-LEFT*2,65,13,"#fff8ed","#edd7ac");
    txt(ctx,"لم تتوفر تفاصيل المواد ضمن بيانات الإشعار المنشور.",RIGHT-16,y+40,15,navy,700);y+=78;
  }
  for(let i=0;i<subjects.length;i++){
    const s=subjects[i];
    const detail=Object.entries(s.assessments||{})
      .filter(([,v])=>valid(v))
      .map(([k,v])=>k+": "+format(v)).join("  •  ");
    const detailLines=split(ctx,detail,WIDTH-LEFT*2-47,12,600);
    const noteLines=split(ctx,s.note?("ملاحظة: "+s.note):"",WIDTH-LEFT*2-47,12,600);
    const rowHeight=67+detailLines.length*19+noteLines.length*19;
    ensure(rowHeight+9);
    rounded(ctx,LEFT,y,WIDTH-LEFT*2,rowHeight,13,i%2===0?"#ffffff":"#f4f9fb","#dfeaf0");
    rounded(ctx,RIGHT-9,y+12,4,30,2,i%2===0?gold:"#1a8d99");
    const subjectLines=split(ctx,s.subject||"مادة دراسية",545,17,800);
    txt(ctx,subjectLines[0]||"مادة دراسية",RIGHT-25,y+29,17,navy,800);
    if(subjectLines.length>1)txt(ctx,subjectLines.slice(1).join(" "),RIGHT-25,y+47,12,navy,600);
    txt(ctx,format(s.total)+" / "+format(s.maximum),LEFT+149,y+29,20,"#176c7d",800);
    txt(ctx,"الدرجة / النهاية العظمى",LEFT+155,y+49,11,muted,600);
    let lineY=y+61;
    for(const l of detailLines){txt(ctx,l,RIGHT-25,lineY,12,muted,600);lineY+=19}
    for(const l of noteLines){txt(ctx,l,RIGHT-25,lineY,12,"#976a26",600);lineY+=19}
    y+=rowHeight+9;
  }
  section("ملخص النتائج");
  ensure(97);
  const blocks=[
    {label:"الدرجات المكتسبة",value:format(notice.sum_total)},
    {label:"النهاية العظمى",value:format(notice.sum_max)},
    {label:"نسبة التحصيل",value:valid(notice.score_percent)?format(notice.score_percent)+"٪":
      (valid(notice.sum_total)&&Number(notice.sum_max)>0?format(100*Number(notice.sum_total)/Number(notice.sum_max))+"٪":"—")}
  ];
  const blockWidth=(WIDTH-LEFT*2-20)/3;
  blocks.forEach((b,i)=>smallTag(b.label,b.value,LEFT+i*(blockWidth+10),y,blockWidth));
  y+=92;

  section("ترتيب الطالب");
  ensure(95);
  const rankWidth=(WIDTH-LEFT*2-12)/2;
  [ {label:"الترتيب على مستوى المدرسة",rank:notice.school_rank,count:notice.school_count},
    {label:"الترتيب على مستوى الفصل",rank:notice.class_rank,count:notice.class_count}
  ].forEach((r,i)=>{
    const x=LEFT+i*(rankWidth+12);
    rounded(ctx,x,y,rankWidth,85,14,i===0?"#e7f5f6":"#f6f0e5");
    txt(ctx,r.label,x+rankWidth-17,y+25,13,navy,700);
    txt(ctx,format(r.rank),x+rankWidth-17,y+62,30,i===0?"#116b78":"#956b2c",800);
    txt(ctx,"من "+format(r.count)+" طالبًا",x+rankWidth-112,y+62,12,muted,600);
  });
  y+=98;

  if(notice.is_top_five){
    ensure(54);
    rounded(ctx,LEFT,y,WIDTH-LEFT*2,46,12,"#fff3d8","#efd4a1");
    txt(ctx,"تهانينا! الطالب من الخمسة الأوائل على مستوى المدرسة",RIGHT-17,y+30,17,"#8e611a",800);
    y+=58;
  }
  const leaders=Array.isArray(notice.school_top_five)?notice.school_top_five:[];
  if(leaders.length){
    section("لوحة الشرف  •  الخمسة الأوائل على المدرسة");
    for(let i=0;i<leaders.length;i++){
      const leader=leaders[i];
      ensure(51);
      rounded(ctx,LEFT,y,WIDTH-LEFT*2,43,10,i===0?"#fff4dd":"#ffffff","#e1e9ed");
      rounded(ctx,RIGHT-48,y+7,32,29,9,i===0?"#dba74e":"#e8f1f4");
      txt(ctx,format(leader.rank),RIGHT-27,y+28,15,i===0?"#ffffff":navy,800);
      const leaderLines=split(ctx,leader.name,430,14,700);
      txt(ctx,leaderLines[0]||"—",RIGHT-62,y+28,14,navy,700);
      txt(ctx,valid(leader.score_percent)?format(leader.score_percent)+"٪":"—",LEFT+120,y+28,14,muted,800);
      y+=50;
    }
  }
  if(valid(notice.attendance)||valid(notice.behavior_excellence)||valid(notice.behavior_positive)){
    section("مؤشرات إضافية");
    const metrics=[
      ["المواظبة",notice.attendance],
      ["التميز السلوكي",notice.behavior_excellence],
      ["السلوك الإيجابي",notice.behavior_positive]
    ].filter(([,v])=>valid(v));
    for(const [label,v] of metrics){
      ensure(36);
      txt(ctx,label,RIGHT-10,y+22,14,muted,600);
      txt(ctx,format(v),LEFT+95,y+22,16,navy,800);
      y+=36;
    }
  }
  ensure(86);
  rounded(ctx,LEFT,y+8,WIDTH-LEFT*2,69,12,"#f3f8fb");
  txt(ctx,"نعتز بجهود طلابنا، ونسأل الله لهم دوام التوفيق والتميز.",RIGHT-17,y+36,15,navy,700);
  txt(ctx,"تُحسب المراكز بحسب نسبة التحصيل في الإشعارات المنشورة للفترة نفسها.",RIGHT-17,y+62,11,muted,500);
  y+=90;
  return page+1;
}
function loadLogo(path:string):Promise<HTMLImageElement|null>{
  return new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>resolve(img);
    img.onerror=()=>resolve(null);
    img.src=import.meta.env.BASE_URL+path;
  });
}
async function makePdf(canvas:HTMLCanvasElement,pages:number):Promise<Blob>{
  const enc=new TextEncoder();
  const sections:Uint8Array[]=[];
  let length=0;
  function add(data:string|Uint8Array){
    const bytes=typeof data==="string"?enc.encode(data):data;
    sections.push(bytes);length+=bytes.byteLength;
  }
  const images:Uint8Array[]=[];
  for(let i=0;i<pages;i++){
    const p=document.createElement("canvas");
    p.width=WIDTH*PIXEL_RATIO;p.height=PAGE_HEIGHT*PIXEL_RATIO;
    const cx=p.getContext("2d");
    if(!cx)throw new Error("تعذر تجهيز صفحات PDF.");
    cx.fillStyle="white";cx.fillRect(0,0,p.width,p.height);
    cx.drawImage(canvas,0,i*p.height,p.width,p.height,0,0,p.width,p.height);
    const jpeg=await new Promise<Blob>((resolve,reject)=>p.toBlob(b=>b?resolve(b):reject(new Error("تعذر إنشاء PDF")),"image/jpeg",0.9));
    images.push(new Uint8Array(await jpeg.arrayBuffer()));
  }
  const offsets:number[]=[0];const count=2+3*pages;
  add("%PDF-1.4\n");
  function obj(id:number,body:string|Uint8Array,header="",tail=""){
    offsets[id]=length;add(String(id)+" 0 obj\n");
    if(header)add(header);
    add(body);
    if(tail)add(tail);
    add("\nendobj\n");
  }
  obj(1,"<< /Type /Catalog /Pages 2 0 R >>");
  const refs=images.map((_,i)=>String(3+3*i)+" 0 R").join(" ");
  obj(2,"<< /Type /Pages /Kids ["+refs+"] /Count "+pages+" >>");
  images.forEach((jpeg,i)=>{
    const pid=3+3*i,cid=pid+1,imgid=pid+2;
    obj(pid,"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 "+imgid+" 0 R >> >> /Contents "+cid+" 0 R >>");
    const stream="q 595.28 0 0 841.89 0 0 cm /Im0 Do Q\n";
    obj(cid,stream,"<< /Length "+enc.encode(stream).length+" >>\nstream\n","\nendstream");
    obj(imgid,jpeg,"<< /Type /XObject /Subtype /Image /Width "+(WIDTH*PIXEL_RATIO)+" /Height "+(PAGE_HEIGHT*PIXEL_RATIO)+" /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length "+jpeg.byteLength+" >>\nstream\n","\nendstream");
  });
  const xref=length;
  add("xref\n0 "+(count+1)+"\n0000000000 65535 f \n");
  for(let id=1;id<=count;id++)add(String(offsets[id]).padStart(10,"0")+" 00000 n \n");
  add("trailer\n<< /Size "+(count+1)+" /Root 1 0 R >>\nstartxref\n"+xref+"\n%%EOF");
  return new Blob(sections as BlobPart[],{type:"application/pdf"});
}
function save(blob:Blob,name:string){
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;link.download=name;document.body.appendChild(link);
  link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
export default function PeriodNoticeDesignedImage({notice,studentName,schoolName="مدارس المشكاة الأهلية"}:Props){
  const ref=useRef<HTMLCanvasElement>(null);
  const pages=useRef(0);
  const [busy,setBusy]=useState(true);
  const [exporting,setExporting]=useState<""|"pdf"|"png">("");
  const [error,setError]=useState("");
  useEffect(()=>{
    let cancelled=false;
    setBusy(true);setError("");
    const draw=async()=>{
      try{
        await Promise.all([
          document.fonts.load("800 30px Cairo"),
          document.fonts.load("700 17px Cairo"),
          document.fonts.load("500 12px Cairo")
        ]);
        const logos=await Promise.all([loadLogo("school-logo.png"),loadLogo("guidance-logo.png")]) as [HTMLImageElement|null,HTMLImageElement|null];
        if(cancelled)return;
        const test=document.createElement("canvas").getContext("2d");
        if(!test)throw new Error("هذا المتصفح لا يدعم عرض صورة الإشعار.");
        const count=drawDocument(test,notice,studentName,schoolName,logos);
        const target=ref.current;
        const ctx=target?.getContext("2d");
        if(!target||!ctx)throw new Error("تعذر إنشاء صورة الإشعار.");
        target.width=WIDTH*PIXEL_RATIO;target.height=PAGE_HEIGHT*count*PIXEL_RATIO;
        const painter=target.getContext("2d");
        if(!painter)throw new Error("تعذر عرض الإشعار.");
        painter.scale(PIXEL_RATIO,PIXEL_RATIO);
        drawDocument(painter,notice,studentName,schoolName,logos);
        pages.current=count;
      }catch(e){if(!cancelled)setError(e instanceof Error?e.message:"تعذر تجهيز الإشعار.")}
      finally{if(!cancelled)setBusy(false)}
    };
    void draw();
    return()=>{cancelled=true};
  },[notice,studentName,schoolName]);
  async function exportFile(type:"pdf"|"png"){
    const canvas=ref.current;if(!canvas||busy||exporting||!pages.current)return;
    setExporting(type);setError("");
    try{
      const filename="إشعار نتائج - "+studentName.replace(/[\\/:*?"<>|]/g,"").slice(0,65);
      if(type==="pdf"){
        const pdf=await makePdf(canvas,pages.current);
        save(pdf,filename+".pdf");
      }else{
        const png=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("تعذر إنشاء الصورة")),"image/png"));
        save(png,filename+".png");
      }
    }catch(e){setError(e instanceof Error?e.message:"تعذر تنزيل الملف.")}
    finally{setExporting("")}
  }
  return <div className="period-designed-wrap" dir="rtl">
    {busy&&<div className="period-design-loading" role="status">جارٍ تصميم الإشعار بخط Cairo العربي...</div>}
    <div className="period-designed-image">
      <canvas ref={ref} className={busy?"period-designed-canvas hidden":"period-designed-canvas"} role="img"
        aria-label={"صورة إشعار نتائج الطالب "+studentName+" مع الدرجات والترتيب"} />
    </div>
    <div className="period-designed-actions">
      <button type="button" className="btn primary" disabled={busy||!!exporting} onClick={()=>void exportFile("pdf")}>
        {exporting==="pdf"?"جارٍ إنشاء PDF...":"تنزيل الإشعار PDF للطباعة"}
      </button>
      <button type="button" className="btn ghost" disabled={busy||!!exporting} onClick={()=>void exportFile("png")}>
        {exporting==="png"?"جارٍ إنشاء الصورة...":"حفظ الإشعار صورة PNG"}
      </button>
    </div>
    {error&&<div className="notice error" role="alert">{error}</div>}
  </div>;
}
