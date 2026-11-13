import {useState} from "react";
import {ASSESSMENT_ANNOUNCEMENT_IMAGE} from "./assessment-announcement-image";
import "./assessment-announcement.css";

export default function AssessmentAnnouncementBanner(){
  const[open,setOpen]=useState(false);
  const now=Date.now();
  const ends=new Date("2026-11-18T23:59:59+03:00").getTime();
  if(now>ends)return null;
  return <>
    <section className="assessment-announcement-card" aria-label="إعلان مقياس الاستخدام المفرط للألعاب الإلكترونية">
      <div className="assessment-announcement-head">
        <div><span>إعلان هام</span><h3>مقياس الاستخدام المفرط للألعاب الإلكترونية وتأثيرها على الطلاب</h3></div>
        <button type="button" onClick={()=>setOpen(true)}>تكبير الإعلان</button>
      </div>
      <button type="button" className="assessment-announcement-image-btn" onClick={()=>setOpen(true)} aria-label="تكبير إعلان المقياس">
        <img src={ASSESSMENT_ANNOUNCEMENT_IMAGE} alt="إعلان مقياس الاستخدام المفرط للألعاب الإلكترونية وتأثيرها على الطلاب"/>
      </button>
    </section>
    {open&&<div className="assessment-announcement-overlay" role="dialog" aria-modal="true" aria-label="إعلان المقياس" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}>
      <section className="assessment-announcement-modal">
        <button type="button" className="assessment-announcement-close" onClick={()=>setOpen(false)} aria-label="إغلاق الإعلان">×</button>
        <img src={ASSESSMENT_ANNOUNCEMENT_IMAGE} alt="إعلان مقياس الاستخدام المفرط للألعاب الإلكترونية وتأثيرها على الطلاب"/>
      </section>
    </div>}
  </>;
}