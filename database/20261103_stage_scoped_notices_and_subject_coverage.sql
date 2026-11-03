-- Keep one published result batch PER SCHOOL STAGE (middle / secondary).
-- Preserve all existing middle school results and archives without changing marks or wallets.
ALTER TABLE public.period_notice_batches ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id);
UPDATE public.period_notice_batches b
SET department_id=x.department_id
FROM (
 SELECT i.batch_id,MIN(g.department_id::text)::uuid AS department_id
 FROM public.period_notice_items i
 JOIN public.students s ON s.id=i.student_id AND s.school_id=i.school_id
 JOIN public.classes c ON c.id=s.class_id
 JOIN public.grades g ON g.id=c.grade_id
 GROUP BY i.batch_id
 HAVING COUNT(DISTINCT g.department_id)=1
) x
WHERE b.id=x.batch_id AND b.department_id IS NULL;
DO $block$
BEGIN
 IF EXISTS(
 SELECT 1 FROM public.period_notice_batches b
 WHERE b.published_at IS NOT NULL AND b.department_id IS NULL
 ) THEN RAISE EXCEPTION 'PUBLISHED_NOTICE_STAGE_UNRESOLVED'; END IF;
 IF EXISTS(
 SELECT 1 FROM public.period_notice_batches b
 JOIN public.period_notice_items i ON i.batch_id=b.id
 JOIN public.students s ON s.id=i.student_id AND s.school_id=b.school_id
 JOIN public.classes c ON c.id=s.class_id JOIN public.grades g ON g.id=c.grade_id
 WHERE b.department_id IS DISTINCT FROM g.department_id
 ) THEN RAISE EXCEPTION 'MIXED_NOTICE_STAGE'; END IF;
END $block$;
ALTER TABLE public.period_notice_batches DROP CONSTRAINT IF EXISTS published_notice_requires_stage;
ALTER TABLE public.period_notice_batches ADD CONSTRAINT published_notice_requires_stage
 CHECK (published_at IS NULL OR department_id IS NOT NULL);
DROP INDEX IF EXISTS public.only_one_active_period_notice_batch_per_school;
CREATE UNIQUE INDEX IF NOT EXISTS one_published_notice_batch_per_school_stage
 ON public.period_notice_batches(school_id,department_id)
 WHERE published_at IS NOT NULL AND superseded_at IS NULL;

-- Only subjects ungraded for EVERY uploaded student in the relevant grade
-- are excluded. If even one student has a grade, the subject stays required
-- for every student in that grade; missing grades invalidate the final percentage.
CREATE OR REPLACE FUNCTION public.period_notice_refresh_subject_scope(p_batch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public,pg_temp
AS $scope$
DECLARE v_department uuid;v_updated integer:=0;v_excluded jsonb;
BEGIN
 SELECT department_id INTO v_department FROM public.period_notice_batches
 WHERE id=p_batch_id AND published_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOTICE_BATCH_CLOSED';END IF;
 IF v_department IS NULL THEN RETURN jsonb_build_object('excluded_subjects','[]'::jsonb,'updated',0);END IF;
 WITH source AS (
 SELECT i.id, g.id grade_id,
    trim(regexp_replace(replace(lower(COALESCE(x.subj->>'subject','')),'*',''),'[[:space:]]+',' ','g')) normalized,
    x.subj, x.ord,
    (NULLIF(x.subj->>'total','') IS NOT NULL) AS recorded
 FROM public.period_notice_items i
 JOIN public.students s ON s.id=i.student_id AND s.school_id=i.school_id
 JOIN public.classes c ON c.id=s.class_id
 JOIN public.grades g ON g.id=c.grade_id
 CROSS JOIN LATERAL jsonb_array_elements(COALESCE(i.report_data->'subjects','[]'::jsonb)) WITH ORDINALITY AS x(subj,ord)
 WHERE i.batch_id=p_batch_id
 ), coverage AS (
 SELECT grade_id,normalized,BOOL_OR(recorded) AS any_recorded
 FROM source GROUP BY grade_id,normalized
 ), normalized_items AS (
 SELECT src.id,jsonb_agg(
   CASE WHEN NOT cover.any_recorded
     THEN jsonb_set(src.subj,'{excluded_from_total}','true'::jsonb,true)
     ELSE src.subj-'excluded_from_total'
   END ORDER BY src.ord) AS subjects
 FROM source src
 JOIN coverage cover ON cover.grade_id=src.grade_id AND cover.normalized=src.normalized
 GROUP BY src.id
 ), writeback AS (
 UPDATE public.period_notice_items i
 SET report_data=jsonb_set(i.report_data,'{subjects}',normalized_items.subjects),
 updated_at=now()
 FROM normalized_items
 WHERE i.id=normalized_items.id
 AND i.report_data->'subjects' IS DISTINCT FROM normalized_items.subjects
 RETURNING i.id
 )
 SELECT COUNT(*) INTO v_updated FROM writeback;
 SELECT COALESCE(jsonb_agg(DISTINCT jsonb_build_object('grade',g.name_ar,'subject',y.subj->>'subject')),'[]'::jsonb)
 INTO v_excluded
 FROM public.period_notice_items i
 JOIN public.students s ON s.id=i.student_id
 JOIN public.classes c ON c.id=s.class_id JOIN public.grades g ON g.id=c.grade_id
 CROSS JOIN LATERAL jsonb_array_elements(i.report_data->'subjects') y(subj)
 WHERE i.batch_id=p_batch_id AND y.subj->>'excluded_from_total'='true';
 RETURN jsonb_build_object('updated',v_updated,'excluded_subjects',v_excluded);
END $scope$;
REVOKE ALL ON FUNCTION public.period_notice_refresh_subject_scope(uuid) FROM PUBLIC,anonymous,authenticated;

CREATE OR REPLACE FUNCTION public.period_notice_subject_totals(p_report jsonb)
 RETURNS TABLE(score numeric,max_score numeric,percent_score numeric,is_complete boolean)
 LANGUAGE sql IMMUTABLE SET search_path TO public,pg_temp
AS $total$
WITH per_subject AS(
 SELECT NULLIF(x->>'total','')::numeric received,
        NULLIF(x->>'maximum','')::numeric possible
 FROM jsonb_array_elements(COALESCE(p_report->'subjects','[]'::jsonb)) x
 WHERE COALESCE(x->>'excluded_from_total','false')<>'true'
), summed AS(
 SELECT COUNT(*) subjects,
        COUNT(*) FILTER(WHERE received IS NULL OR possible IS NULL OR possible<=0 OR received<0 OR received>possible) invalid,
        SUM(received) score,SUM(possible) maximum
 FROM per_subject
)
SELECT CASE WHEN subjects>0 AND invalid=0 AND maximum>0 THEN score END,
       CASE WHEN subjects>0 AND invalid=0 AND maximum>0 THEN maximum END,
       CASE WHEN subjects>0 AND invalid=0 AND maximum>0 THEN ROUND(score*100/maximum,4) END,
       subjects>0 AND invalid=0 AND maximum>0
FROM summed
$total$;
REVOKE ALL ON FUNCTION public.period_notice_subject_totals(jsonb) FROM PUBLIC,anonymous,authenticated;


-- Stage-safe upload, stage-specific publish/archive and admin reporting.
CREATE OR REPLACE FUNCTION public.api_period_notice_stage(p_batch_id uuid, p_file_name text, p_entries jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 DECLARE v_auth uuid;v_user uuid;v_school uuid;v_batch uuid;v_row jsonb;
 v_student uuid;v_department uuid;v_batch_department uuid;v_sid text;v_name text;v_count int:=0;v_missing jsonb:='[]'::jsonb;
 BEGIN
   v_auth:=NULLIF(NULLIF(auth.user_id(),''),'anonymous')::uuid;
   SELECT id,school_id INTO v_user,v_school FROM public.app_users
     WHERE auth_user_id=v_auth AND is_active=true LIMIT 1;
   IF v_user IS NULL OR NOT EXISTS(
     SELECT 1 FROM public.user_roles WHERE user_id=v_user
     AND role IN ('SUPER_ADMIN','SCHOOL_ADMIN')
   ) THEN RAISE EXCEPTION 'PERIOD_NOTICE_ADMIN_REQUIRED'; END IF;
   IF v_school IS DISTINCT FROM '6df4961f-2e40-4a37-b75a-98882883ad20'::uuid THEN RAISE EXCEPTION 'PERIOD_NOTICE_SCHOOL_NOT_ENABLED'; END IF;
   IF p_entries IS NULL OR jsonb_typeof(p_entries)<>'array'
     OR jsonb_array_length(p_entries) NOT BETWEEN 1 AND 100
     OR length(p_entries::text)>900000
     OR char_length(COALESCE(p_file_name,'')) NOT BETWEEN 1 AND 180
   THEN RAISE EXCEPTION 'PERIOD_NOTICE_INVALID_UPLOAD'; END IF;
   IF p_batch_id IS NULL THEN
     INSERT INTO public.period_notice_batches(school_id,created_by,title)
       VALUES(v_school,v_user,'إشعارات الفترة الأولى')
       RETURNING id INTO v_batch;
   ELSE
     SELECT id INTO v_batch FROM public.period_notice_batches
       WHERE id=p_batch_id AND school_id=v_school AND published_at IS NULL FOR UPDATE;
     IF v_batch IS NULL THEN RAISE EXCEPTION 'PERIOD_NOTICE_BATCH_CLOSED';END IF;
   END IF;
   FOR v_row IN SELECT value FROM jsonb_array_elements(p_entries) LOOP
     v_sid:=trim(COALESCE(v_row->>'student_no',''));
     v_name:=trim(COALESCE(v_row->>'student_name',''));
     IF char_length(v_sid) NOT BETWEEN 4 AND 20 OR v_name=''
       OR jsonb_typeof(v_row->'subjects') IS DISTINCT FROM 'array'
       OR length(v_row::text)>14000 THEN
       RAISE EXCEPTION 'PERIOD_NOTICE_ROW_INVALID'; END IF;
     SELECT s.id,g.department_id INTO v_student,v_department
     FROM public.students s JOIN public.classes c ON c.id=s.class_id
     JOIN public.grades g ON g.id=c.grade_id
     JOIN public.departments dep ON dep.id=g.department_id AND dep.school_id=s.school_id
     WHERE s.school_id=v_school AND s.student_no=v_sid AND s.is_active=true LIMIT 1;
     IF v_student IS NULL THEN
       INSERT INTO public.period_notice_import_issues(
         batch_id,school_id,student_no,student_name,source_file,imported_entry
       ) VALUES(v_batch,v_school,v_sid,v_name,p_file_name,v_row)
       ON CONFLICT(batch_id,student_no) DO UPDATE
         SET student_name=EXCLUDED.student_name,source_file=EXCLUDED.source_file,
           imported_entry=EXCLUDED.imported_entry,updated_at=now(),resolved_at=NULL;
       v_missing:=v_missing||jsonb_build_array(jsonb_build_object(
         'student_no',v_sid,'student_name',v_name,'error','الطالب غير موجود في هذه المدرسة'));
       CONTINUE;
     END IF;
     SELECT b.department_id INTO v_batch_department FROM public.period_notice_batches b
       WHERE b.id=v_batch AND b.school_id=v_school FOR UPDATE;
     IF v_batch_department IS NULL THEN
       UPDATE public.period_notice_batches b
       SET department_id=v_department,
           title=CASE WHEN b.title='إشعارات الفترة الأولى'
             THEN b.title||' — '||(SELECT dep.name_ar FROM public.departments dep WHERE dep.id=v_department)
             ELSE b.title END
       WHERE b.id=v_batch AND b.school_id=v_school;
     ELSIF v_batch_department IS DISTINCT FROM v_department THEN
       RAISE EXCEPTION 'PERIOD_NOTICE_MIXED_STAGES'; 
     END IF;
     INSERT INTO public.period_notice_items(
       batch_id,school_id,student_id,academic_year,semester,period_title,
       source_grade,source_class,source_file,report_data
     ) VALUES(
       v_batch,v_school,v_student,
       left(COALESCE(v_row->>'academic_year',''),35),
       left(COALESCE(v_row->>'semester',''),65),
       left(COALESCE(v_row->>'period_title',''),75),
       left(COALESCE(v_row->>'grade_name',''),90),
       left(COALESCE(v_row->>'class_name',''),30),
       p_file_name,
       jsonb_build_object(
         'subjects',v_row->'subjects','sum_max',v_row->'sum_max',
         'sum_total',v_row->'sum_total',
         'attendance',v_row->'attendance',
         'behavior_excellence',v_row->'behavior_excellence',
         'behavior_positive',v_row->'behavior_positive'
       )
     ) ON CONFLICT(batch_id,student_id) DO UPDATE
       SET academic_year=EXCLUDED.academic_year,semester=EXCLUDED.semester,
         period_title=EXCLUDED.period_title,source_grade=EXCLUDED.source_grade,
         source_class=EXCLUDED.source_class,source_file=EXCLUDED.source_file,
         report_data=EXCLUDED.report_data,updated_at=now();
     UPDATE public.period_notice_import_issues
       SET resolved_at=now(),updated_at=now()
       WHERE batch_id=v_batch AND student_no=v_sid AND resolved_at IS NULL;
     v_count:=v_count+1;
   END LOOP;
   PERFORM public.period_notice_refresh_subject_scope(v_batch);
   RETURN jsonb_build_object('batch_id',v_batch,'saved',v_count,
     'missing_count',jsonb_array_length(v_missing),'missing',v_missing,
     'published',false,'message','تم حفظ المسودة فقط، ولم يتم نشر أي إشعار');
 END;$function$


CREATE OR REPLACE FUNCTION public.api_period_notice_publish(p_batch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 DECLARE v_auth uuid;v_user uuid;v_school uuid;v_count bigint;v_date timestamptz;v_archived integer:=0;v_department uuid;
 BEGIN
   v_auth:=NULLIF(NULLIF(auth.user_id(),''),'anonymous')::uuid;
   SELECT id,school_id INTO v_user,v_school FROM public.app_users
     WHERE auth_user_id=v_auth AND is_active=true LIMIT 1;
   IF v_user IS NULL OR NOT EXISTS(
     SELECT 1 FROM public.user_roles WHERE user_id=v_user
     AND role IN ('SUPER_ADMIN','SCHOOL_ADMIN')
   ) THEN RAISE EXCEPTION 'PERIOD_NOTICE_ADMIN_REQUIRED'; END IF;
   IF v_school IS DISTINCT FROM '6df4961f-2e40-4a37-b75a-98882883ad20'::uuid THEN RAISE EXCEPTION 'PERIOD_NOTICE_SCHOOL_NOT_ENABLED'; END IF;
   -- Serialize publish operations within the school to maintain exactly one active batch.
   PERFORM 1 FROM public.schools WHERE id=v_school FOR UPDATE;
   SELECT b.department_id INTO v_department FROM public.period_notice_batches b
     WHERE b.id=p_batch_id AND b.school_id=v_school AND b.published_at IS NULL FOR UPDATE;
   IF v_department IS NULL THEN RAISE EXCEPTION 'PERIOD_NOTICE_STAGE_REQUIRED';END IF;
   IF EXISTS (
     SELECT 1 FROM public.period_notice_items i
     JOIN public.students s ON s.id=i.student_id AND s.school_id=v_school
     JOIN public.classes c ON c.id=s.class_id JOIN public.grades g ON g.id=c.grade_id
     WHERE i.batch_id=p_batch_id AND g.department_id IS DISTINCT FROM v_department
   ) THEN RAISE EXCEPTION 'PERIOD_NOTICE_MIXED_STAGES';END IF;
   PERFORM 1 FROM public.period_notice_batches
     WHERE id=p_batch_id AND school_id=v_school AND published_at IS NULL FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'PERIOD_NOTICE_BATCH_CLOSED';END IF;
   SELECT count(*) INTO v_count FROM public.period_notice_items
     WHERE batch_id=p_batch_id AND school_id=v_school;
   IF v_count=0 THEN RAISE EXCEPTION 'PERIOD_NOTICE_EMPTY_BATCH';END IF;
   IF EXISTS(SELECT 1 FROM public.period_notice_items i
     LEFT JOIN public.period_notice_original_files o ON o.notice_item_id=i.id
     WHERE i.batch_id=p_batch_id AND i.school_id=v_school AND o.notice_item_id IS NULL)
   THEN RAISE EXCEPTION 'PERIOD_NOTICE_ORIGINAL_MISSING';END IF;
   -- Re-evaluate curriculum coverage using all students uploaded to this department.
   PERFORM public.period_notice_refresh_subject_scope(p_batch_id);
   -- Preserve other stages; archive only the previous batch in this department.
   -- Previous middle-school results remain active while secondary results publish.
   UPDATE public.period_notice_batches
     SET superseded_at=now(),superseded_by=p_batch_id
     WHERE school_id=v_school AND department_id=v_department AND published_at IS NOT NULL
       AND superseded_at IS NULL AND id<>p_batch_id;
   GET DIAGNOSTICS v_archived=ROW_COUNT;
   UPDATE public.period_notice_batches SET published_at=now()
     WHERE id=p_batch_id AND school_id=v_school
     RETURNING published_at INTO v_date;
   RETURN jsonb_build_object('published',true,'published_at',v_date,'student_count',v_count,'archived_count',v_archived,'department_id',v_department);
 END;$function$


CREATE OR REPLACE FUNCTION public.api_period_notice_admin_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 DECLARE v_auth uuid;v_user uuid;v_school uuid;
 BEGIN
   v_auth:=NULLIF(NULLIF(auth.user_id(),''),'anonymous')::uuid;
   SELECT id,school_id INTO v_user,v_school FROM public.app_users
     WHERE auth_user_id=v_auth AND is_active=true LIMIT 1;
   IF v_user IS NULL OR NOT EXISTS(
     SELECT 1 FROM public.user_roles WHERE user_id=v_user
     AND role IN ('SUPER_ADMIN','SCHOOL_ADMIN')
   ) THEN RAISE EXCEPTION 'PERIOD_NOTICE_ADMIN_REQUIRED'; END IF;
   IF v_school IS DISTINCT FROM '6df4961f-2e40-4a37-b75a-98882883ad20'::uuid THEN RAISE EXCEPTION 'PERIOD_NOTICE_SCHOOL_NOT_ENABLED'; END IF;
   RETURN jsonb_build_object('batches',COALESCE((
     SELECT jsonb_agg(jsonb_build_object(
       'id',b.id,'title',b.title,'created_at',b.created_at,
       'published_at',b.published_at,'department_name',(SELECT dep.name_ar FROM public.departments dep WHERE dep.id=b.department_id),'is_current',(b.published_at IS NOT NULL AND b.superseded_at IS NULL),
       'unmatched_count',(SELECT count(*) FROM public.period_notice_import_issues m
         WHERE m.batch_id=b.id AND m.resolved_at IS NULL),
       'unmatched',COALESCE((SELECT jsonb_agg(jsonb_build_object(
         'student_no',m.student_no,'student_name',m.student_name,'source_file',m.source_file,
         'error','الطالب غير موجود في سجلات المدرسة'
       ) ORDER BY m.student_name) FROM public.period_notice_import_issues m
         WHERE m.batch_id=b.id AND m.resolved_at IS NULL),'[]'::jsonb),
       'student_count',(SELECT count(*) FROM public.period_notice_items i WHERE i.batch_id=b.id),
       'items',COALESCE((SELECT jsonb_agg(jsonb_build_object(
         'id',i.id,'student_no',s.student_no,'student_name',s.full_name_ar,
         'grade_name',g.name_ar,'class_name',c.name_ar,
         'academic_year',i.academic_year,'semester',i.semester,
         'period_title',i.period_title,'source_file',i.source_file,
         'subject_count',jsonb_array_length(COALESCE(i.report_data->'subjects','[]'::jsonb)),
         'subjects',COALESCE(i.report_data->'subjects','[]'::jsonb),
         'total',agg.score,'total_max',agg.max_score,'score_complete',agg.is_complete,
         'excluded_subjects',COALESCE((
           SELECT jsonb_agg(t->>'subject' ORDER BY t->>'subject') FROM jsonb_array_elements(i.report_data->'subjects') t
           WHERE t->>'excluded_from_total'='true'
         ),'[]'::jsonb)
       ) ORDER BY g.sort_order,s.full_name_ar)
       FROM public.period_notice_items i
       JOIN public.students s ON s.id=i.student_id AND s.school_id=v_school
       JOIN public.classes c ON c.id=s.class_id
       JOIN public.grades g ON g.id=c.grade_id
       CROSS JOIN LATERAL public.period_notice_subject_totals(i.report_data) agg
       WHERE i.batch_id=b.id),'[]'::jsonb)
     ) ORDER BY b.created_at DESC)
     FROM public.period_notice_batches b
     WHERE b.school_id=v_school AND (b.published_at IS NULL OR b.superseded_at IS NULL)
   ),'[]'::jsonb),
   'archived_batches',COALESCE((
     SELECT jsonb_agg(jsonb_build_object(
       'id',h.id,'title',h.title,'published_at',h.published_at,
       'superseded_at',h.superseded_at,'department_name',(SELECT dep.name_ar FROM public.departments dep WHERE dep.id=h.department_id),
       'student_count',(SELECT count(*) FROM public.period_notice_items i WHERE i.batch_id=h.id)
     ) ORDER BY h.published_at DESC)
     FROM public.period_notice_batches h
     WHERE h.school_id=v_school AND h.published_at IS NOT NULL AND h.superseded_at IS NOT NULL
   ),'[]'::jsonb));
 END;$function$
