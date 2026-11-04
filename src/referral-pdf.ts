// Generates the actual referral form as a standalone, readable A4 PDF.
// Arabic is rendered to canvas using the school's Cairo typeface before being
// embedded into the PDF, avoiding unsupported Arabic PDF font encodings.
export type ReferralPdfData={
  referral_no:string;student_name:string;student_no?:string;
  grade_name:string;class_name:string;teacher_name?:string;
  subject_ar?:string|null;incident_date?:string|null;created_at?:string|null;
  target_label:string;violation_category_label:string;
  occurrence_label?:string;violation_text?:string|null;
  violation_explanation?:string|null;
  teacher_action_1?:string|null;teacher_action_date_1?:string|null;
  teacher_action_2?:string|null;teacher_action_date_2?:string|null;
  teacher_action_3?:string|null;teacher_action_date_3?:string|null;
  status:"OPEN"|"COMPLETED";deducted_points?:number|null;
  deduction_note?:string|null;completed_at?:string|null;
  completion_note?:string|null;completed_by_name?:string|null;
};

const WIDTH=900,HEIGHT=1273,RATIO=1.6,RIGHT=822,LEFT=78;
const navy="#17435f",green="#147d78",muted="#576f7c";
const fontFamily="Cairo, Tahoma, Arial, sans-serif";
const formatDate=(s?:string|null)=>{
  if(!s)return "—";
  const d=new Date(s.length===10?s+"T12:00:00":s);
  return Number.isNaN(d.getTime())?"—":d.toLocaleDateString("ar-SA",{year:"numeric",month:"long",day:"numeric"});
};
function words(ctx:CanvasRenderingContext2D,value:unknown,size:number,max:number,weight=600){
  ctx.font=weight+" "+size+"px "+fontFamily;
  const text=String(value??"").trim().replace(/\s+/g," ");
  if(!text)return ["—"];
  const lines:string[]=[];let line="";
  for(const word of text.split(" ")){
    const next=line?line+" "+word:word;
    if(line&&ctx.measureText(next).width>max){lines.push(line);line=word}else line=next;
  }
  if(line)lines.push(line);
  return lines;
}
function line(ctx:CanvasRenderingContext2D,value:unknown,x:number,y:number,size=16,color=navy,weight=600){
  ctx.direction="rtl";ctx.textAlign="right";ctx.textBaseline="alphabetic";
  ctx.font=weight+" "+size+"px "+fontFamily;
  ctx.fillStyle=color;ctx.fillText(String(value??""),x,y);
}
async function image(path:string):Promise<HTMLImageElement|null>{
  return new Promise(resolve=>{
    const el=new Image();el.onload=()=>resolve(el);el.onerror=()=>resolve(null);
    el.src=import.meta.env.BASE_URL+path;
  });
}
function fitLogo(ctx:CanvasRenderingContext2D,logo:HTMLImageElement|null,x:number,y:number,w:number,h:number){
  if(!logo?.naturalWidth)return;
  const ratio=Math.min(w/logo.naturalWidth,h/logo.naturalHeight);
  const dx=x+(w-logo.naturalWidth*ratio)/2,dy=y+(h-logo.naturalHeight*ratio)/2;
  ctx.drawImage(logo,dx,dy,logo.naturalWidth*ratio,logo.naturalHeight*ratio);
}
async function imagesToPdf(canvases:HTMLCanvasElement[]):Promise<Blob>{
  if(!canvases.length)throw new Error("لا توجد صفحات في ملف التحويل.");
  const binary:Uint8Array[]=[];
  for(const canvas of canvases){
    const blob=await new Promise<Blob>((resolve,reject)=>
      canvas.toBlob(x=>x?resolve(x):reject(new Error("تعذر إنشاء صورة PDF")),"image/jpeg",0.88));
    binary.push(new Uint8Array(await blob.arrayBuffer()));
  }
  const enc=new TextEncoder(),pieces:Uint8Array[]=[];let length=0;
  const offsets:number[]=[0];
  const add=(part:Uint8Array|string)=>{
    const bytes=typeof part==="string"?enc.encode(part):part;
    pieces.push(bytes);length+=bytes.byteLength;
  };
  function object(id:number,body:Uint8Array|string,header="",tail=""){
    offsets[id]=length;add(id+" 0 obj\n");
    if(header)add(header);add(body);if(tail)add(tail);add("\nendobj\n");
  }
  add("%PDF-1.4\n");
  object(1,"<< /Type /Catalog /Pages 2 0 R >>");
  object(2,"<< /Type /Pages /Kids ["+
    binary.map((_,i)=>(3+3*i)+" 0 R").join(" ")+"] /Count "+binary.length+" >>");
  for(let i=0;i<binary.length;i++){
    const page=3+i*3,stream=page+1,photo=page+2,jpeg=binary[i];
    object(page,"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 "+photo+" 0 R >> >> /Contents "+stream+" 0 R >>");
    const commands="q 595.28 0 0 841.89 0 0 cm /Im0 Do Q\n";
    object(stream,commands,"<< /Length "+enc.encode(commands).length+" >>\nstream\n","\nendstream");
    object(photo,jpeg,"<< /Type /XObject /Subtype /Image /Width "+Math.round(WIDTH*RATIO)+" /Height "+Math.round(HEIGHT*RATIO)+" /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length "+jpeg.byteLength+" >>\nstream\n","\nendstream");
  }
  const startxref=length,count=binary.length*3+2;
  add("xref\n0 "+(count+1)+"\n0000000000 65535 f \n");
  for(let i=1;i<=count;i++)add(String(offsets[i]).padStart(10,"0")+" 00000 n \n");
  add("trailer\n<< /Size "+(count+1)+" /Root 1 0 R >>\nstartxref\n"+startxref+"\n%%EOF");
  return new Blob(pieces as BlobPart[],{type:"application/pdf"});
}
export async function createReferralPdf(referral:ReferralPdfData,schoolName:string):Promise<File>{
  await Promise.all([
    document.fonts.load("800 24px Cairo"),
    document.fonts.load("700 16px Cairo"),
    document.fonts.load("500 15px Cairo")
  ]);
  await document.fonts.ready;
  const logos=await Promise.all([image("school-logo.png"),image("guidance-logo.png")]);
  const canvases:HTMLCanvasElement[]=[];
  let ctx:CanvasRenderingContext2D;let y=0;
  const newPage=()=>{
    const canvas=document.createElement("canvas");
    canvas.width=Math.round(WIDTH*RATIO);canvas.height=Math.round(HEIGHT*RATIO);
    const next=canvas.getContext("2d");if(!next)throw new Error("تعذر تجهيز صفحات التحويل.");
    ctx=next;ctx.scale(RATIO,RATIO);
    ctx.fillStyle="#ffffff";ctx.fillRect(0,0,WIDTH,HEIGHT);
    ctx.fillStyle=navy;ctx.fillRect(0,0,WIDTH,12);
    ctx.fillStyle=green;ctx.fillRect(0,12,WIDTH,5);
    ctx.strokeStyle="#d6e4e8";ctx.lineWidth=2;ctx.strokeRect(35,37,WIDTH-70,HEIGHT-77);
    fitLogo(ctx,logos[0],LEFT,59,106,94);
    fitLogo(ctx,logos[1],RIGHT-107,59,107,94);
    ctx.direction="rtl";ctx.textAlign="center";
    ctx.font="800 19px "+fontFamily;ctx.fillStyle=navy;
    ctx.fillText(schoolName,WIDTH/2,88,425);
    ctx.font="800 24px "+fontFamily;ctx.fillText("استمارة تحويل طالب",WIDTH/2,127,425);
    ctx.font="700 14px "+fontFamily;ctx.fillStyle=green;
    ctx.fillText("رقم التحويل: "+referral.referral_no,WIDTH/2,155,430);
    ctx.direction="rtl";ctx.textAlign="right";
    ctx.fillStyle="#c8d8df";ctx.fillRect(LEFT,176,WIDTH-LEFT*2,1);
    line(ctx,"وثيقة تربوية سرية — موجهة لولي أمر الطالب فقط",RIGHT,HEIGHT-82,12,muted,700);
    line(ctx,"بنك التميز الطلابي  •  "+(canvases.length+1),LEFT+90,HEIGHT-82,11,muted,500);
    y=204;canvases.push(canvas);
  };
  newPage();
  function keep(height:number){if(y+height>HEIGHT-130)newPage()}
  function section(title:string){
    keep(54);
    ctx.fillStyle="#eaf4f3";ctx.beginPath();ctx.roundRect(LEFT,y,WIDTH-LEFT*2,39,8);ctx.fill();
    line(ctx,title,RIGHT-15,y+27,17,navy,800);y+=55;
  }
  function field(label:string,value:unknown,extra=false){
    const w=WIDTH-LEFT*2-34;
    const size=extra?15:16;
    const lines=words(ctx,value,size,w,600);
    const itemHeight=27+lines.length*(extra?26:27)+10;
    keep(itemHeight+6);
    line(ctx,label,RIGHT,y+15,13,muted,700);
    for(const [i,txt] of lines.entries())line(ctx,txt,RIGHT-8,y+41+i*(extra?26:27),size,navy,600);
    y+=itemHeight;
  }
  section("بيانات الطالب والتحويل");
  field("اسم الطالب",referral.student_name);
  field("الصف / الفصل",referral.grade_name+" / "+referral.class_name);
  if(referral.student_no)field("رقم الطالب",referral.student_no);
  if(referral.teacher_name)field("المعلم المحوّل",referral.teacher_name);
  field("المادة",referral.subject_ar);
  field("تاريخ الواقعة",formatDate(referral.incident_date));
  field("جهة التحويل",referral.target_label);
  field("التصنيف / التكرار",(referral.violation_category_label||"—")+" / "+(referral.occurrence_label||"—"));
  section("تفاصيل الواقعة");
  field("موضوع التحويل",referral.violation_text,true);
  field("توضيح الواقعة",referral.violation_explanation,true);
  section("الإجراءات التربوية السابقة");
  const actions=[
    [referral.teacher_action_1,referral.teacher_action_date_1],
    [referral.teacher_action_2,referral.teacher_action_date_2],
    [referral.teacher_action_3,referral.teacher_action_date_3]
  ].filter(([action])=>String(action||"").trim());
  if(!actions.length)field("الإجراءات","لا توجد إجراءات سابقة مسجلة.");
  for(const [i,[action,date]] of actions.entries())
    field("الإجراء "+(i+1)+(date?" — "+formatDate(date):""),action,true);
  section("نتيجة المتابعة");
  field("حالة التحويل",referral.status==="COMPLETED"?"منتهٍ — تم اتخاذ الإجراء":"مفتوح — قيد المتابعة");
  if(referral.deducted_points&&referral.deducted_points>0)
    field("الإجراء المتعلق بنقاط التميز",referral.deducted_points+" نقطة");
  if(referral.deduction_note)field("ملاحظة الإجراء",referral.deduction_note,true);
  if(referral.status==="COMPLETED"){
    if(referral.completion_note)field("الإجراء النهائي",referral.completion_note,true);
    if(referral.completed_by_name)field("تم الإجراء بواسطة",referral.completed_by_name);
    field("تاريخ إنهاء التحويل",formatDate(referral.completed_at));
  }
  keep(112);
  ctx.fillStyle="#f1f7f9";ctx.beginPath();ctx.roundRect(LEFT,y,WIDTH-LEFT*2,98,11);ctx.fill();
  const closing=words(ctx,"يهدف هذا التحويل إلى تعزيز التعاون بين الأسرة والمدرسة لدعم الطالب والارتقاء بمستواه، وليس إلى إصدار حكم عليه.",14,WIDTH-LEFT*2-30,700);
  closing.forEach((str,i)=>line(ctx,str,RIGHT-16,y+34+i*25,14,navy,700));
  const blob=await imagesToPdf(canvases);
  if(blob.size<4000)throw new Error("تعذر إنتاج ملف التحويل بصورة صحيحة.");
  const safe=(referral.referral_no||"").replace(/[\\/:*?"<>|]/g,"_").slice(0,70);
  return new File([blob],"تحويل الطالب - "+safe+".pdf",{type:"application/pdf",lastModified:Date.now()});
}
