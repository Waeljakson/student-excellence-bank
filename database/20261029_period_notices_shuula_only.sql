-- Restrict period result notices to متوسطة وثانوية مشكاة الشعلة (MISHKAT).
-- School MISHKAT_NADA remains fully usable for all other Bank of Excellence features.
-- The seven functions below are replaced in-place without altering or deleting existing data.
-- Original/PDF downloads are denied for other schools; PDFs already call original access validation.
-- Published batches/records remain untouched.

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
       'published_at',b.published_at,
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
         'total',i.report_data->'sum_total'
       ) ORDER BY g.sort_order,s.full_name_ar)
       FROM public.period_notice_items i
       JOIN public.students s ON s.id=i.student_id AND s.school_id=v_school
       JOIN public.classes c ON c.id=s.class_id
       JOIN public.grades g ON g.id=c.grade_id
       WHERE i.batch_id=b.id),'[]'::jsonb)
     ) ORDER BY b.created_at DESC)
     FROM public.period_notice_batches b WHERE b.school_id=v_school
   ),'[]'::jsonb));
 END;$function$;

CREATE OR REPLACE FUNCTION public.api_period_notice_original(p_notice_id uuid, p_student_no text DEFAULT NULL::text, p_school_code text DEFAULT NULL::text, p_guardian_token text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'neon_auth', 'pg_temp'
AS $function$
DECLARE v_auth uuid:=NULLIF(NULLIF(auth.user_id(),''),'anonymous')::uuid;
        v_item public.period_notice_items%ROWTYPE;
        v_file public.period_notice_original_files%ROWTYPE;
        v_allowed boolean:=false;
BEGIN
 SELECT i.* INTO v_item FROM public.period_notice_items i
 JOIN public.period_notice_batches b ON b.id=i.batch_id AND b.school_id=i.school_id
 WHERE i.id=p_notice_id AND b.published_at IS NOT NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'PERIOD_NOTICE_NOT_PUBLISHED'; END IF;
 IF v_item.school_id IS DISTINCT FROM '6df4961f-2e40-4a37-b75a-98882883ad20'::uuid THEN RAISE EXCEPTION 'PERIOD_NOTICE_SCHOOL_NOT_ENABLED'; END IF;
 SELECT * INTO v_file FROM public.period_notice_original_files
   WHERE notice_item_id=v_item.id AND student_id=v_item.student_id AND school_id=v_item.school_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'PERIOD_NOTICE_ORIGINAL_UNAVAILABLE'; END IF;
 IF v_auth IS NOT NULL AND EXISTS(SELECT 1 FROM public.students s WHERE s.id=v_item.student_id AND s.auth_user_id=v_auth AND s.is_active) THEN
   v_allowed:=true;
 END IF;
 IF v_auth IS NOT NULL AND EXISTS(
   SELECT 1 FROM public.student_guardians sg JOIN public.guardians g ON g.id=sg.guardian_id
   WHERE sg.student_id=v_item.student_id AND g.school_id=v_item.school_id AND g.auth_user_id=v_auth
 ) THEN v_allowed:=true; END IF;
 IF p_guardian_token IS NOT NULL AND length(p_guardian_token)>=40 AND EXISTS(
   SELECT 1 FROM public.guardian_access_links l
   JOIN public.guardians g ON g.id=l.guardian_id
   JOIN public.student_guardians sg ON sg.guardian_id=g.id
   WHERE l.token=p_guardian_token AND l.is_active=true
     AND sg.student_id=v_item.student_id AND g.school_id=v_item.school_id
 ) THEN v_allowed:=true; END IF;
 IF p_student_no IS NOT NULL AND p_school_code IS NOT NULL AND EXISTS(
   SELECT 1 FROM public.students s JOIN public.schools sch ON sch.id=s.school_id
   WHERE s.id=v_item.student_id AND s.is_active AND s.student_no=trim(p_student_no)
     AND sch.id=v_item.school_id AND upper(sch.code)=upper(trim(p_school_code))
 ) THEN v_allowed:=true; END IF;
 IF NOT v_allowed THEN RAISE EXCEPTION 'PERIOD_NOTICE_ACCESS_DENIED'; END IF;
 RETURN jsonb_build_object('name',v_file.file_name,
   'mime',v_file.mime_type,'base64',encode(v_file.content,'base64'));
END $function$;

CREATE OR REPLACE FUNCTION public.api_period_notice_publish(p_batch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 DECLARE v_auth uuid;v_user uuid;v_school uuid;v_count bigint;v_date timestamptz;
 BEGIN
   v_auth:=NULLIF(NULLIF(auth.user_id(),''),'anonymous')::uuid;
   SELECT id,school_id INTO v_user,v_school FROM public.app_users
     WHERE auth_user_id=v_auth AND is_active=true LIMIT 1;
   IF v_user IS NULL OR NOT EXISTS(
     SELECT 1 FROM public.user_roles WHERE user_id=v_user
     AND role IN ('SUPER_ADMIN','SCHOOL_ADMIN')
   ) THEN RAISE EXCEPTION 'PERIOD_NOTICE_ADMIN_REQUIRED'; END IF;
   IF v_school IS DISTINCT FROM '6df4961f-2e40-4a37-b75a-98882883ad20'::uuid THEN RAISE EXCEPTION 'PERIOD_NOTICE_SCHOOL_NOT_ENABLED'; END IF;
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
   UPDATE public.period_notice_batches SET published_at=now()
     WHERE id=p_batch_id RETURNING published_at INTO v_date;
   RETURN jsonb_build_object('published',true,'published_at',v_date,'student_count',v_count);
 END;$function$;

CREATE OR REPLACE FUNCTION public.api_period_notice_stage(p_batch_id uuid, p_file_name text, p_entries jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 DECLARE v_auth uuid;v_user uuid;v_school uuid;v_batch uuid;v_row jsonb;
 v_student uuid;v_sid text;v_name text;v_count int:=0;v_missing jsonb:='[]'::jsonb;
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
     SELECT s.id INTO v_student FROM public.students s
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
   RETURN jsonb_build_object('batch_id',v_batch,'saved',v_count,
     'missing_count',jsonb_array_length(v_missing),'missing',v_missing,
     'published',false,'message','تم حفظ المسودة فقط، ولم يتم نشر أي إشعار');
 END;$function$;

CREATE OR REPLACE FUNCTION public.api_period_notice_stage_originals(p_batch_id uuid, p_files jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'neon_auth', 'pg_temp'
AS $function$
DECLARE v_auth uuid:=NULLIF(NULLIF(auth.user_id(),''),'anonymous')::uuid;v_user uuid;v_school uuid;
        v_row jsonb;v_sid text;v_file_name text;v_raw bytea;v_student uuid;v_item uuid;v_saved int:=0;
BEGIN
 SELECT id,school_id INTO v_user,v_school FROM public.app_users WHERE auth_user_id=v_auth AND is_active=true LIMIT 1;
 IF v_user IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.user_roles WHERE user_id=v_user AND role IN ('SUPER_ADMIN','SCHOOL_ADMIN')
 ) THEN RAISE EXCEPTION 'PERIOD_NOTICE_ADMIN_REQUIRED';END IF;
   IF v_school IS DISTINCT FROM '6df4961f-2e40-4a37-b75a-98882883ad20'::uuid THEN RAISE EXCEPTION 'PERIOD_NOTICE_SCHOOL_NOT_ENABLED'; END IF;
 PERFORM 1 FROM public.period_notice_batches
   WHERE id=p_batch_id AND school_id=v_school AND published_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PERIOD_NOTICE_BATCH_CLOSED'; END IF;
 IF p_files IS NULL OR jsonb_typeof(p_files)<>'array' OR jsonb_array_length(p_files) NOT BETWEEN 1 AND 8 OR length(p_files::text)>850000
 THEN RAISE EXCEPTION 'PERIOD_NOTICE_INVALID_UPLOAD';END IF;
 FOR v_row IN SELECT value FROM jsonb_array_elements(p_files) LOOP
   v_sid:=trim(COALESCE(v_row->>'student_no',''));
   v_file_name:=left(trim(COALESCE(v_row->>'filename','')),180);
   IF v_sid='' OR v_file_name='' OR NOT v_file_name ILIKE '%.xlsx'
   THEN RAISE EXCEPTION 'PERIOD_NOTICE_ORIGINAL_INVALID';END IF;
   SELECT s.id INTO v_student FROM public.students s
    WHERE s.school_id=v_school AND s.student_no=v_sid AND s.is_active=true LIMIT 1;
   IF v_student IS NULL THEN CONTINUE;END IF;
   SELECT i.id INTO v_item FROM public.period_notice_items i
    WHERE i.batch_id=p_batch_id AND i.school_id=v_school AND i.student_id=v_student LIMIT 1;
   IF v_item IS NULL THEN CONTINUE;END IF;
   v_raw:=decode(COALESCE(v_row->>'base64',''),'base64');
   IF octet_length(v_raw) NOT BETWEEN 1000 AND 1500000 OR substring(v_raw FROM 1 FOR 2)<>decode('504b','hex')
   THEN RAISE EXCEPTION 'PERIOD_NOTICE_ORIGINAL_INVALID';END IF;
   INSERT INTO public.period_notice_original_files(notice_item_id,student_id,school_id,file_name,content)
    VALUES(v_item,v_student,v_school,v_file_name,v_raw)
    ON CONFLICT(notice_item_id) DO UPDATE SET file_name=EXCLUDED.file_name,content=EXCLUDED.content,updated_at=now();
   v_saved:=v_saved+1;
 END LOOP;
 RETURN jsonb_build_object('saved',v_saved);
END $function$;

CREATE OR REPLACE FUNCTION public.period_notice_for_student(p_student_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
WITH published AS (
  SELECT i.*,b.published_at,
    ROW_NUMBER() OVER (
      PARTITION BY i.school_id,i.student_id,
        COALESCE(TRIM(i.academic_year),''),
        COALESCE(TRIM(i.semester),''),
        COALESCE(TRIM(i.period_title),'')
      ORDER BY b.published_at DESC,i.updated_at DESC,i.id DESC
    ) AS version_no
  FROM public.period_notice_items i
  JOIN public.period_notice_batches b ON b.id=i.batch_id AND b.school_id=i.school_id AND b.published_at IS NOT NULL
  JOIN public.students s ON s.id=i.student_id AND s.school_id=i.school_id AND s.is_active=true
), current_items AS (
  SELECT * FROM published WHERE version_no=1
), scored AS (
  SELECT i.id,i.student_id,i.school_id,i.academic_year,i.semester,i.period_title,
         s.class_id,c.grade_id,s.full_name_ar AS student_name,
         (i.report_data->>'sum_total')::numeric AS score,
         (i.report_data->>'sum_max')::numeric AS max_score,
         CASE WHEN (i.report_data->>'sum_max')::numeric>0
           THEN ROUND(100*(i.report_data->>'sum_total')::numeric/(i.report_data->>'sum_max')::numeric,4)
           ELSE NULL END AS percent_score
  FROM current_items i
  JOIN public.students s ON s.id=i.student_id AND s.school_id=i.school_id AND s.is_active=true
  JOIN public.classes c ON c.id=s.class_id
), ranked AS (
  SELECT a.*,
    ROW_NUMBER() OVER (
      PARTITION BY school_id,academic_year,semester,period_title,grade_id
      ORDER BY percent_score DESC NULLS LAST,score DESC NULLS LAST,student_name,student_id
    ) AS grade_rank,
    ROW_NUMBER() OVER (
      PARTITION BY school_id,academic_year,semester,period_title,class_id
      ORDER BY percent_score DESC NULLS LAST,score DESC NULLS LAST,student_name,student_id
    ) AS class_rank,
    COUNT(*) OVER (PARTITION BY school_id,academic_year,semester,period_title,grade_id) AS grade_count,
    COUNT(*) OVER (PARTITION BY school_id,academic_year,semester,period_title,class_id) AS class_count
  FROM scored a
), leaders AS (
  SELECT school_id,academic_year,semester,period_title,grade_id,
    jsonb_agg(jsonb_build_object(
      'name',student_name,'rank',grade_rank,'score_percent',percent_score,
      'student_name',student_name,'grade_name',(SELECT g.name_ar FROM public.grades g WHERE g.id=grade_id),
      'percentage',ROUND(percent_score,2),'total',score
    ) ORDER BY grade_rank) AS top_five
  FROM ranked WHERE grade_rank<=5
  GROUP BY school_id,academic_year,semester,period_title,grade_id
)
SELECT COALESCE(jsonb_agg(
  jsonb_build_object(
    'id',i.id,'title',b.title,'academic_year',i.academic_year,
    'semester',i.semester,'period_title',i.period_title,
    'grade',i.source_grade,'class_name',i.source_class,
    'subjects',COALESCE(i.report_data->'subjects','[]'::jsonb),
    'sum_max',i.report_data->'sum_max','sum_total',i.report_data->'sum_total',
    'attendance',i.report_data->'attendance',
    'behavior_excellence',i.report_data->'behavior_excellence',
    'behavior_positive',i.report_data->'behavior_positive',
    'published_at',i.published_at,
    'grade_rank',r.grade_rank,'grade_count',r.grade_count,
    'grade_top_five',COALESCE(l.top_five,'[]'::jsonb),
    'school_rank',r.grade_rank,'school_count',r.grade_count,
    'class_rank',r.class_rank,'class_count',r.class_count,
    'score_percent',r.percent_score,
    'is_top_five',r.grade_rank<=5,
    'school_top_five',COALESCE(l.top_five,'[]'::jsonb),
    'ranking',jsonb_build_object(
      'grade_rank',r.grade_rank,'grade_count',r.grade_count,
      'school_rank',r.grade_rank,'school_count',r.grade_count,
      'class_rank',r.class_rank,'class_count',r.class_count,
      'is_top_five',r.grade_rank<=5,
      'top_five',COALESCE(l.top_five,'[]'::jsonb)
    )
  ) ORDER BY i.published_at DESC,i.updated_at DESC
),'[]'::jsonb)
FROM current_items i
JOIN public.period_notice_batches b ON b.id=i.batch_id AND b.school_id=i.school_id AND b.published_at IS NOT NULL
JOIN ranked r ON r.id=i.id
LEFT JOIN leaders l ON l.school_id=r.school_id
  AND l.academic_year=r.academic_year AND l.semester=r.semester
  AND l.period_title=r.period_title AND l.grade_id=r.grade_id
WHERE i.student_id=p_student_id
  AND i.school_id='6df4961f-2e40-4a37-b75a-98882883ad20'::uuid
$function$;

CREATE OR REPLACE FUNCTION public.period_notice_rank_for_student(p_student_id uuid, p_batch_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
WITH all_results AS (
  SELECT i.student_id, s.full_name_ar, i.batch_id, s.school_id, c.grade_id, s.class_id,
    (i.report_data->>'sum_total')::numeric AS total,
    CASE WHEN (i.report_data->>'sum_max')::numeric > 0
      THEN (i.report_data->>'sum_total')::numeric / (i.report_data->>'sum_max')::numeric
      ELSE NULL END AS pct
  FROM public.period_notice_items i
  JOIN public.period_notice_batches b ON b.id=i.batch_id AND b.school_id=i.school_id AND b.published_at IS NOT NULL
  JOIN public.students s ON s.id=i.student_id AND s.school_id=i.school_id AND s.is_active=true
  JOIN public.classes c ON c.id=s.class_id
  WHERE i.batch_id=p_batch_id
    AND i.school_id='6df4961f-2e40-4a37-b75a-98882883ad20'::uuid
), ranked AS (
  SELECT a.*,
    ROW_NUMBER() OVER(PARTITION BY school_id,batch_id,grade_id
      ORDER BY round(pct*100,4) DESC NULLS LAST,total DESC NULLS LAST,full_name_ar,student_id) AS grade_rank,
    ROW_NUMBER() OVER(PARTITION BY school_id,batch_id,class_id
      ORDER BY round(pct*100,4) DESC NULLS LAST,total DESC NULLS LAST,full_name_ar,student_id) AS class_rank,
    COUNT(*) OVER(PARTITION BY school_id,batch_id,grade_id) AS grade_count,
    COUNT(*) OVER(PARTITION BY school_id,batch_id,class_id) AS class_count
  FROM all_results a
)
SELECT COALESCE((
  SELECT jsonb_build_object(
    'grade_rank',x.grade_rank,
    'grade_count',x.grade_count,
    'school_rank',x.grade_rank,
    'school_count',x.grade_count,
    'class_rank',x.class_rank,
    'class_count',x.class_count,
    'is_top_five',x.grade_rank <= 5,
    'top_five',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'student_name',y.full_name_ar,
        'grade_name',(SELECT g.name_ar FROM public.grades g WHERE g.id=y.grade_id),
        'rank',y.grade_rank,
        'total',y.total,
        'percentage',round(y.pct*100,2)
      ) ORDER BY y.grade_rank)
      FROM ranked y
      WHERE y.school_id=x.school_id AND y.batch_id=x.batch_id
        AND y.grade_id=x.grade_id AND y.grade_rank<=5
    ),'[]'::jsonb)
  )
  FROM ranked x WHERE x.student_id=p_student_id LIMIT 1
),'{}'::jsonb)
$function$;
