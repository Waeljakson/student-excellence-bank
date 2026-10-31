type SchoolMessage={id:string;title_ar:string;published_at:string};
const prefix="bank-school-mobile-alert:";
const scope=(school:string,student:string)=>school+":"+student;
function read(key:string){try{return localStorage.getItem(key)}catch{return null}}
function write(key:string,value:string){try{localStorage.setItem(key,value)}catch{}}
export function mobileSchoolAlertsSupported(){
 return typeof window!=="undefined"&&"Notification" in window&&window.isSecureContext;
}
export function mobileSchoolAlertsEnabled(school:string,student:string){
 return mobileSchoolAlertsSupported()&&Notification.permission==="granted"&&
 read(prefix+scope(school,student))==="enabled";
}
export async function enableMobileSchoolAlerts(school:string,student:string){
 if(!mobileSchoolAlertsSupported())return false;
 const permission=await Notification.requestPermission();
 if(permission!=="granted")return false;
 write(prefix+scope(school,student),"enabled");return true;
}
export function disableMobileSchoolAlerts(school:string,student:string){
 write(prefix+scope(school,student),"disabled");
}
export async function notifyNewSchoolMessages(school:string,student:string,messages:SchoolMessage[]){
 if(!school||!student)return;
 const key=prefix+"last:"+scope(school,student);
 const previous=read(key);
 const newest=Math.max(0,...messages.map(m=>new Date(m.published_at).getTime()).filter(Number.isFinite));
 // First observation establishes a baseline, without notifying for historical notices.
 if(previous===null){write(key,String(Math.max(newest,Date.now())));return}
 const before=Number(previous)||0;
 if(newest<=before)return;
 write(key,String(newest));
 if(!mobileSchoolAlertsEnabled(school,student))return;
 try{
  const count=messages.filter(m=>new Date(m.published_at).getTime()>before).length;
  const title="إشعار جديد من بنك التميز الطلابي";
  const body=count>1?"لديك "+count+" رسائل جديدة من المدرسة. افتح البوابة للاطلاع عليها.":"وصلتك رسالة جديدة من المدرسة. افتح البوابة للاطلاع عليها.";
  const opts:NotificationOptions={body,tag:"mishkat-new-school-messages",icon:import.meta.env.BASE_URL+"icon-192.svg"};
  if("serviceWorker" in navigator){
   const registration=await navigator.serviceWorker.ready;
   await registration.showNotification(title,opts);
  }else{
   new Notification(title,opts);
  }
 }catch{ /* Browser may block OS notifications even after permission. Messages remain in the portal. */ }
}
