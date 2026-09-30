export const DEFAULT_SCHOOL_NAME="مدارس المشكاة الأهلية";
const NAME_KEY="mishkat-current-school-name";
const CODE_KEY="mishkat-current-school-code";

export function setCurrentSchoolBrand(name?:string|null,code?:string|null){
  if(typeof window==="undefined")return;
  try{
    const clean=String(name||"").trim();
    if(clean)window.sessionStorage.setItem(NAME_KEY,clean);
    else window.sessionStorage.removeItem(NAME_KEY);
    const c=String(code||"").trim();
    if(c)window.sessionStorage.setItem(CODE_KEY,c);
    else window.sessionStorage.removeItem(CODE_KEY);
  }catch{}
}

export function clearCurrentSchoolBrand(){
  if(typeof window==="undefined")return;
  try{window.sessionStorage.removeItem(NAME_KEY);window.sessionStorage.removeItem(CODE_KEY)}catch{}
}

export function getCurrentSchoolName(){
  if(typeof window==="undefined")return DEFAULT_SCHOOL_NAME;
  try{return window.sessionStorage.getItem(NAME_KEY)||DEFAULT_SCHOOL_NAME}catch{return DEFAULT_SCHOOL_NAME}
}

export function getCurrentSchoolCode(){
  if(typeof window==="undefined")return "";
  try{return window.sessionStorage.getItem(CODE_KEY)||""}catch{return ""}
}
