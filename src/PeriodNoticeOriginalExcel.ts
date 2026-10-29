import JSZip from "jszip";

/**
 * Extract one authentic Excel notice per student WITHOUT rebuilding its cells.
 * The original worksheet XML, formatting, merged cells, print page settings,
 * drawings and image bytes are retained exactly as uploaded by the school.
 * All other students' worksheets and drawing XML are physically removed.
 */
type Request={sheetName:string;studentNo:string};
export type OriginalNoticeUpload={student_no:string;filename:string;base64:string};

const NS_WORKBOOK="http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_REL="http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_PACKAGE_REL="http://schemas.openxmlformats.org/package/2006/relationships";
const NS_CONTENT="http://schemas.openxmlformats.org/package/2006/content-types";

function parseXml(xml:string):Document{
  const doc=new DOMParser().parseFromString(xml,"application/xml");
  if(doc.querySelector("parsererror"))throw new Error("تعذر قراءة تنسيق ملف الإشعارات الأصلي.");
  return doc;
}
function dirname(path:string){return path.slice(0,path.lastIndexOf("/"))}
function relatedFile(path:string){
  const index=path.lastIndexOf("/");
  return path.slice(0,index)+"/_rels/"+path.slice(index+1)+".rels";
}
function resolvePath(baseDir:string,target:string){
  if(target.startsWith("/"))return target.slice(1);
  const parts=baseDir.split("/").filter(Boolean);
  for(const piece of target.split("/")){
    if(piece===".."||piece==="."){
      if(piece==="..")parts.pop();
    }else if(piece)parts.push(piece);
  }
  return parts.join("/");
}
function toBase64(data:Uint8Array){
  let result="";
  for(let i=0;i<data.length;i+=16384)
    result+=String.fromCharCode(...data.subarray(i,i+16384));
  return btoa(result);
}

export async function splitOriginalExcelNotices(buffer:ArrayBuffer,requests:Request[]):Promise<OriginalNoticeUpload[]>{
  if(!requests.length)return [];
  const source=await JSZip.loadAsync(buffer);
  const workbookPart=source.file("xl/workbook.xml");
  const relationshipPart=source.file("xl/_rels/workbook.xml.rels");
  const typesPart=source.file("[Content_Types].xml");
  if(!workbookPart||!relationshipPart||!typesPart)
    throw new Error("ملف الإشعارات لا يحتوي على مستند Excel أصلي صالح.");

  const workbook=await parseXml(await workbookPart.async("string"));
  const relationships=await parseXml(await relationshipPart.async("string"));
  const types=await parseXml(await typesPart.async("string"));
  const sheetElements=Array.from(workbook.getElementsByTagNameNS(NS_WORKBOOK,"sheet"));
  const relationshipElements=Array.from(relationships.getElementsByTagNameNS(NS_PACKAGE_REL,"Relationship"));
  const map=new Map(relationshipElements.map(x=>[x.getAttribute("Id")||"",x]));
  const originalFiles=Object.keys(source.files).filter(path=>!source.files[path].dir);
  const output:OriginalNoticeUpload[]=[];

  for(const request of requests){
    const sheet=sheetElements.find(s=>s.getAttribute("name")===request.sheetName);
    if(!sheet)throw new Error("تعذر العثور على الورقة الأصلية للطالب "+request.studentNo);
    const linkId=sheet.getAttributeNS(NS_REL,"id")||sheet.getAttribute("r:id")||"";
    const link=map.get(linkId);
    const worksheetPath=resolvePath("xl",link?.getAttribute("Target")||"");
    if(!link||!source.file(worksheetPath))
      throw new Error("تعذر استخراج ورقة الطالب الأصلية "+request.studentNo);

    const keep=new Set([
      "[Content_Types].xml","_rels/.rels","docProps/core.xml","docProps/app.xml",
      "xl/workbook.xml","xl/_rels/workbook.xml.rels","xl/styles.xml",worksheetPath
    ]);
    const sheetRels=relatedFile(worksheetPath);
    const drPaths:string[]=[];
    if(source.file(sheetRels)){
      keep.add(sheetRels);
      const sr=parseXml(await source.file(sheetRels)!.async("string"));
      for(const child of Array.from(sr.getElementsByTagNameNS(NS_PACKAGE_REL,"Relationship"))){
        const path=resolvePath(dirname(worksheetPath),child.getAttribute("Target")||"");
        if(source.file(path)){
          keep.add(path);
          if(path.startsWith("xl/drawings/")&&!path.includes("/_rels/"))drPaths.push(path);
        }
      }
    }
    for(const drawing of drPaths){
      const drRels=relatedFile(drawing);
      if(!source.file(drRels))continue;
      keep.add(drRels);
      const dr=parseXml(await source.file(drRels)!.async("string"));
      for(const child of Array.from(dr.getElementsByTagNameNS(NS_PACKAGE_REL,"Relationship"))){
        const path=resolvePath(dirname(drawing),child.getAttribute("Target")||"");
        if(source.file(path)&&path.startsWith("xl/media/"))keep.add(path);
      }
    }

    const zip=await JSZip.loadAsync(buffer);
    const wb=parseXml(await zip.file("xl/workbook.xml")!.async("string"));
    const allSheets=Array.from(wb.getElementsByTagNameNS(NS_WORKBOOK,"sheet"));
    const sheetsContainer=wb.getElementsByTagNameNS(NS_WORKBOOK,"sheets")[0];
    for(const x of allSheets)if(x.getAttribute("name")!==request.sheetName)sheetsContainer.removeChild(x);
    for(const x of Array.from(wb.getElementsByTagNameNS(NS_WORKBOOK,"definedNames")))
      x.parentNode?.removeChild(x);
    zip.file("xl/workbook.xml",new XMLSerializer().serializeToString(wb));

    const rels=parseXml(await zip.file("xl/_rels/workbook.xml.rels")!.async("string"));
    for(const x of Array.from(rels.getElementsByTagNameNS(NS_PACKAGE_REL,"Relationship"))){
      const type=x.getAttribute("Type")||"";
      if(type.endsWith("/worksheet")&&x.getAttribute("Id")!==linkId)x.parentNode?.removeChild(x);
      else if(!type.endsWith("/worksheet")&&!type.endsWith("/styles"))x.parentNode?.removeChild(x);
    }
    zip.file("xl/_rels/workbook.xml.rels",new XMLSerializer().serializeToString(rels));

    const ct=parseXml(await zip.file("[Content_Types].xml")!.async("string"));
    for(const x of Array.from(ct.getElementsByTagNameNS(NS_CONTENT,"Override"))){
      const path=(x.getAttribute("PartName")||"").replace(/^\//,"");
      if(!keep.has(path))x.parentNode?.removeChild(x);
    }
    zip.file("[Content_Types].xml",new XMLSerializer().serializeToString(ct));
    for(const path of originalFiles)if(!keep.has(path))zip.remove(path);
    const isolated=await zip.generateAsync({type:"uint8array",compression:"DEFLATE",compressionOptions:{level:6}});
    output.push({
      student_no:request.studentNo,
      filename:"إشعار نتائج الطالب - "+request.studentNo+".xlsx",
      base64:toBase64(isolated)
    });
  }
  return output;
}
