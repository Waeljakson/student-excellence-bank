-- 2026-11-04: independent period-notice publication by grade, not entire secondary department.
-- Previously published first-secondary and middle-school batches remain untouched.
ALTER TABLE public.period_notice_batches
 ADD COLUMN IF NOT EXISTS grade_id uuid REFERENCES public.grades(id);
WITH unique_grades AS (
 SELECT i.batch_id,MIN(g.id::text)::uuid grade_id
 FROM public.period_notice_items i
 JOIN public.students s ON s.id=i.student_id AND s.school_id=i.school_id
 JOIN public.classes c ON c.id=s.class_id JOIN public.grades g ON g.id=c.grade_id
 GROUP BY i.batch_id HAVING count(DISTINCT g.id)=1
)
UPDATE public.period_notice_batches b SET grade_id=g.grade_id
FROM unique_grades g WHERE b.id=g.batch_id AND b.grade_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS one_current_notice_batch_per_grade
 ON public.period_notice_batches(school_id,grade_id)
 WHERE grade_id IS NOT NULL AND published_at IS NOT NULL AND superseded_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS one_legacy_multi_grade_notice_per_department
 ON public.period_notice_batches(school_id,department_id)
 WHERE grade_id IS NULL AND published_at IS NOT NULL AND superseded_at IS NULL;
DROP INDEX IF EXISTS public.one_published_notice_batch_per_school_stage;

CREATE OR REPLACE FUNCTION public.api_period_notice_stage(p_batch_id uuid, p_file_name text, p_entries jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 DECLARE v_auth uuid;v_user uuid;v_school uuid;v_batch uuid;v_row jsonb;
 v_student uuid;v_department uuid;v_batch_department uuid;v_grade uuid;v_batch_grade uuid;v_actual_grade text;v_sid text;v_name text;v_count int:=0;v_missing jsonb:='[]'::jsonb;
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
     SELECT s.id,g.department_id,g.id,g.name_ar INTO v_student,v_department,v_grade,v_actual_grade
     FROM public.students s JOIN public.classes c ON c.id=s.class_id
     JOIN public.grades g ON g.id=c.grade_id
     JOIN public.departments dep ON dep.id=g.department_id AND dep.school_id=s.school_id
     WHERE s.school_id=v_school AND s.student_no=v_sid AND s.is_active=true LIMIT 1;
     IF v_student IS NOT NULL
       AND trim(COALESCE(v_row->>'grade_name',''))<>v_actual_grade THEN
       RAISE EXCEPTION 'PERIOD_NOTICE_STUDENT_GRADE_MISMATCH: %',v_sid;
     END IF;
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
     SELECT b.department_id,b.grade_id INTO v_batch_department,v_batch_grade FROM public.period_notice_batches b
       WHERE b.id=v_batch AND b.school_id=v_school FOR UPDATE;
     IF v_batch_department IS NULL THEN
       UPDATE public.period_notice_batches b
       SET department_id=v_department,grade_id=v_grade,
           title=CASE WHEN b.title='إشعارات الفترة الأولى'
             THEN b.title||' — '||(SELECT dep.name_ar FROM public.departments dep WHERE dep.id=v_department)
             ELSE b.title END
       WHERE b.id=v_batch AND b.school_id=v_school;
     ELSIF v_batch_department IS DISTINCT FROM v_department THEN
       RAISE EXCEPTION 'PERIOD_NOTICE_MIXED_STAGES'; 
     ELSIF v_batch_grade IS NULL THEN
       UPDATE public.period_notice_batches SET grade_id=v_grade
       WHERE id=v_batch AND school_id=v_school;
     ELSIF v_batch_grade IS DISTINCT FROM v_grade THEN
       RAISE EXCEPTION 'PERIOD_NOTICE_MIXED_GRADES'; 
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
;

CREATE OR REPLACE FUNCTION public.api_period_notice_publish(p_batch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 DECLARE v_auth uuid;v_user uuid;v_school uuid;v_count bigint;v_date timestamptz;v_archived integer:=0;v_department uuid;v_grade uuid;v_conflict integer:=0;
 BEGIN
   v_auth:=NULLIF(NULLIF(auth.user_id(),''),'anonymous')::uuid;
   SELECT id,school_id INTO v_user,v_school FROM public.app_users
     WHERE auth_user_id=v_auth AND is_active=true LIMIT 1;
   IF v_user IS NULL OR NOT EXISTS(
     SELECT 1 FROM public.user_roles WHERE user_id=v_user
     AND role IN ('SUPER_ADMIN','SCHOOL_ADMIN')
   ) THEN RAISE EXCEPTION 'PERIOD_NOTICE_ADMIN_REQUIRED'; END IF;
   IF v_school IS DISTINCT FROM '6df4961f-2e40-4a37-b75a-98882883ad20'::uuid THEN RAISE EXCEPTION 'PERIOD_NOTICE_SCHOOL_NOT_ENABLED'; END IF;
   -- Serialize publishing per school; allow separate currently published grades.
   PERFORM 1 FROM public.schools WHERE id=v_school FOR UPDATE;
   SELECT b.department_id,b.grade_id INTO v_department,v_grade FROM public.period_notice_batches b
     WHERE b.id=p_batch_id AND b.school_id=v_school AND b.published_at IS NULL FOR UPDATE;
   IF v_department IS NULL THEN RAISE EXCEPTION 'PERIOD_NOTICE_STAGE_REQUIRED';END IF;
   IF v_grade IS NULL THEN RAISE EXCEPTION 'PERIOD_NOTICE_GRADE_REQUIRED';END IF;
   -- Legacy active middle-school result batches contain multiple grades.
   -- Do not silently override or duplicate them via a single-grade release.
   IF EXISTS(SELECT 1 FROM public.period_notice_batches old
      WHERE old.school_id=v_school AND old.department_id=v_department
      AND old.grade_id IS NULL AND old.published_at IS NOT NULL AND old.superseded_at IS NULL)
   THEN RAISE EXCEPTION 'PERIOD_NOTICE_LEGACY_STAGE_REQUIRES_FULL_UPDATE';END IF;
   IF EXISTS (
     SELECT 1 FROM public.period_notice_items i
     JOIN public.students s ON s.id=i.student_id AND s.school_id=v_school
     JOIN public.classes c ON c.id=s.class_id JOIN public.grades g ON g.id=c.grade_id
     WHERE i.batch_id=p_batch_id AND (g.department_id IS DISTINCT FROM v_department OR g.id IS DISTINCT FROM v_grade)
   ) THEN RAISE EXCEPTION 'PERIOD_NOTICE_MIXED_STAGES';END IF;
   PERFORM 1 FROM public.period_notice_batches
     WHERE id=p_batch_id AND school_id=v_school AND published_at IS NULL FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'PERIOD_NOTICE_BATCH_CLOSED';END IF;
   SELECT count(*) INTO v_count FROM public.period_notice_items
     WHERE batch_id=p_batch_id AND school_id=v_school;
   IF v_count=0 THEN RAISE EXCEPTION 'PERIOD_NOTICE_EMPTY_BATCH';END IF;
   IF EXISTS(
      SELECT 1 FROM public.period_notice_import_issues issue
      WHERE issue.batch_id=p_batch_id AND issue.school_id=v_school
        AND issue.resolved_at IS NULL
   ) THEN RAISE EXCEPTION 'PERIOD_NOTICE_UNMATCHED_STUDENTS'; END IF;
   IF EXISTS(SELECT 1 FROM public.period_notice_items i
     LEFT JOIN public.period_notice_original_files o ON o.notice_item_id=i.id
     WHERE i.batch_id=p_batch_id AND i.school_id=v_school AND o.notice_item_id IS NULL)
   THEN RAISE EXCEPTION 'PERIOD_NOTICE_ORIGINAL_MISSING';END IF;
   -- Re-evaluate curriculum coverage for this single grade's uploaded students.
   PERFORM public.period_notice_refresh_subject_scope(p_batch_id);
   -- Archive only the SAME grade; keep other secondary grades and all middle-school notices active.
   UPDATE public.period_notice_batches
     SET superseded_at=now(),superseded_by=p_batch_id
     WHERE school_id=v_school AND department_id=v_department AND grade_id=v_grade AND published_at IS NOT NULL
       AND superseded_at IS NULL AND id<>p_batch_id;
   GET DIAGNOSTICS v_archived=ROW_COUNT;
   UPDATE public.period_notice_batches SET published_at=now()
     WHERE id=p_batch_id AND school_id=v_school
     RETURNING published_at INTO v_date;
   RETURN jsonb_build_object('published',true,'published_at',v_date,'student_count',v_count,'archived_count',v_archived,'department_id',v_department,'grade_id',v_grade);
 END;$function$
;

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
       'published_at',b.published_at,'grade_name',(SELECT g.name_ar FROM public.grades g WHERE g.id=b.grade_id),'missing_originals',(SELECT count(*) FROM public.period_notice_items pi LEFT JOIN public.period_notice_original_files po ON po.notice_item_id=pi.id WHERE pi.batch_id=b.id AND po.notice_item_id IS NULL),'department_name',(SELECT dep.name_ar FROM public.departments dep WHERE dep.id=b.department_id),'is_current',(b.published_at IS NOT NULL AND b.superseded_at IS NULL),
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
       'superseded_at',h.superseded_at,'grade_name',(SELECT g.name_ar FROM public.grades g WHERE g.id=h.grade_id),'department_name',(SELECT dep.name_ar FROM public.departments dep WHERE dep.id=h.department_id),
       'student_count',(SELECT count(*) FROM public.period_notice_items i WHERE i.batch_id=h.id)
     ) ORDER BY h.published_at DESC)
     FROM public.period_notice_batches h
     WHERE h.school_id=v_school AND h.published_at IS NOT NULL AND h.superseded_at IS NOT NULL
   ),'[]'::jsonb));
 END;$function$
;
