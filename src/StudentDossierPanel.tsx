import {useEffect,useState} from 'react';
import {rpc,niceError} from './client';
export default function StudentDossierPanel({students}:{students:Array<{id:string;name?:string}>}){
 const[id,setId]=useState('');const[data,setData]=useState<any>(null);const[error,setError]=useState('');
 useEffect(()=>{if(!id)return;let live=true;rpc<any>('api_student_dossier',{p_student_id:id}).then(x=>{if(live)setData(x)}).catch(e=>{if(live)setError(niceError(e))});return()=>{live=false}},[id]);
 return <main className='sa-root content' dir='rtl'><h1>الملف الشامل للطالب</h1><select value={id} onChange={e=>setId(e.target.value)}><option value=''>اختر الطالب</option>{students.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select>{error&&<p role='alert'>{error}</p>}{data&&<section className='sa-panel'><h2>{data.student?.name}</h2><p>رصيد النقاط: {data.points_balance}</p><p>الشيكات: {data.checks_summary?.checks}</p><p>الميداليات: {data.achievements?.medals}</p></section>}</main>;
}
