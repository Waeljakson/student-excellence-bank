-- Latest-only period notices (MISHKAT). Historical batches are archived, not deleted.
-- Transactional publication keeps one live batch per school.
ALTER TABLE public.period_notice_batches
 ADD COLUMN IF NOT EXISTS superseded_at timestamptz,
 ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES public.period_notice_batches(id);
WITH ranked AS (
 SELECT id,school_id,
 ROW_NUMBER() OVER(PARTITION BY school_id ORDER BY published_at DESC,created_at DESC,id DESC) AS publish_rank,
 FIRST_VALUE(id) OVER(PARTITION BY school_id ORDER BY published_at DESC,created_at DESC,id DESC) AS latest_id,
 FIRST_VALUE(published_at) OVER(PARTITION BY school_id ORDER BY published_at DESC,created_at DESC,id DESC) AS latest_published
 FROM public.period_notice_batches WHERE published_at IS NOT NULL
)
UPDATE public.period_notice_batches b
 SET superseded_at=r.latest_published,superseded_by=r.latest_id
 FROM ranked r
 WHERE b.id=r.id AND r.publish_rank>1 AND b.superseded_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS only_one_active_period_notice_batch_per_school
 ON public.period_notice_batches(school_id)
 WHERE published_at IS NOT NULL AND superseded_at IS NULL;

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
       'published_at',b.published_at,'is_current',(b.published_at IS NOT NULL AND b.superseded_at IS NULL),
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
         'total',agg.score,'total_max',agg.max_score,'score_complete',agg.is_complete
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
       'superseded_at',h.superseded_at,
       'student_count',(SELECT count(*) FROM public.period_notice_items i WHERE i.batch_id=h.id)
     ) ORDER BY h.published_at DESC)
     FROM public.period_notice_batches h
     WHERE h.school_id=v_school AND h.published_at IS NOT NULL AND h.superseded_at IS NOT NULL
   ),'[]'::jsonb));
 END;$function$
;

CREATE OR REPLACE FUNCTION public.api_period_notice_publish(p_batch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 DECLARE v_auth uuid;v_user uuid;v_school uuid;v_count bigint;v_date timestamptz;v_archived integer:=0;
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
   -- Preserve previous batches for audit, but withdraw them from student/guardian access.
   UPDATE public.period_notice_batches
     SET superseded_at=now(),superseded_by=p_batch_id
     WHERE school_id=v_school AND published_at IS NOT NULL
       AND superseded_at IS NULL AND id<>p_batch_id;
   GET DIAGNOSTICS v_archived=ROW_COUNT;
   UPDATE public.period_notice_batches SET published_at=now()
     WHERE id=p_batch_id AND school_id=v_school
     RETURNING published_at INTO v_date;
   RETURN jsonb_build_object('published',true,'published_at',v_date,'student_count',v_count,'archived_count',v_archived);
 END;$function$
;

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
  JOIN public.period_notice_batches b ON b.id=i.batch_id AND b.school_id=i.school_id AND b.published_at IS NOT NULL AND b.superseded_at IS NULL
  JOIN public.students s ON s.id=i.student_id AND s.school_id=i.school_id AND s.is_active=true
), current_items AS (
  SELECT * FROM published WHERE version_no=1
), scored AS (
  SELECT i.id,i.student_id,i.school_id,i.academic_year,i.semester,i.period_title,
         s.class_id,c.grade_id,s.full_name_ar AS student_name,
         agg.score AS score,
         agg.max_score AS max_score,
         agg.percent_score AS percent_score
  FROM current_items i
  JOIN public.students s ON s.id=i.student_id AND s.school_id=i.school_id AND s.is_active=true
  JOIN public.classes c ON c.id=s.class_id
  CROSS JOIN LATERAL public.period_notice_subject_totals(i.report_data) agg
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
), with_cutoff AS (
  SELECT r.*,
    MAX(CASE WHEN grade_rank=5 THEN ROUND(percent_score,2) END)
      OVER(PARTITION BY school_id,academic_year,semester,period_title,grade_id) AS fifth_pct
  FROM ranked r
), leaders AS (
  SELECT school_id,academic_year,semester,period_title,grade_id,
    jsonb_agg(jsonb_build_object(
      'name',student_name,'rank',grade_rank,'score_percent',percent_score,
      'student_name',student_name,'grade_name',(SELECT g.name_ar FROM public.grades g WHERE g.id=grade_id),
      'percentage',ROUND(percent_score,2),'total',score
    ) ORDER BY grade_rank) AS top_five
  FROM with_cutoff WHERE percent_score IS NOT NULL AND (grade_rank<=5 OR ROUND(percent_score,2)>=fifth_pct)
  GROUP BY school_id,academic_year,semester,period_title,grade_id
)
SELECT COALESCE(jsonb_agg(
  jsonb_build_object(
    'id',i.id,'title',b.title,'academic_year',i.academic_year,
    'semester',i.semester,'period_title',i.period_title,
    'grade',i.source_grade,'class_name',i.source_class,
    'subjects',COALESCE(i.report_data->'subjects','[]'::jsonb),
    'sum_max',r.max_score,'sum_total',r.score,'score_complete',(r.percent_score IS NOT NULL),
    'attendance',i.report_data->'attendance',
    'behavior_excellence',i.report_data->'behavior_excellence',
    'behavior_positive',i.report_data->'behavior_positive',
    'published_at',i.published_at,
    'grade_rank',CASE WHEN r.percent_score IS NOT NULL THEN r.grade_rank END,'grade_count',r.grade_count,
    'grade_top_five',COALESCE(l.top_five,'[]'::jsonb),
    'school_rank',CASE WHEN r.percent_score IS NOT NULL THEN r.grade_rank END,'school_count',r.grade_count,
    'class_rank',CASE WHEN r.percent_score IS NOT NULL THEN r.class_rank END,'class_count',r.class_count,
    'score_percent',r.percent_score,
    'is_top_five',(r.percent_score IS NOT NULL AND (r.grade_rank<=5 OR ROUND(r.percent_score,2)>=r.fifth_pct)),
    'school_top_five',COALESCE(l.top_five,'[]'::jsonb),
    'ranking',jsonb_build_object(
      'grade_rank',CASE WHEN r.percent_score IS NOT NULL THEN r.grade_rank END,'grade_count',r.grade_count,
      'school_rank',CASE WHEN r.percent_score IS NOT NULL THEN r.grade_rank END,'school_count',r.grade_count,
      'class_rank',CASE WHEN r.percent_score IS NOT NULL THEN r.class_rank END,'class_count',r.class_count,
      'is_top_five',(r.percent_score IS NOT NULL AND (r.grade_rank<=5 OR ROUND(r.percent_score,2)>=r.fifth_pct)),
      'top_five',COALESCE(l.top_five,'[]'::jsonb)
    )
  ) ORDER BY i.published_at DESC,i.updated_at DESC
),'[]'::jsonb)
FROM current_items i
JOIN public.period_notice_batches b ON b.id=i.batch_id AND b.school_id=i.school_id AND b.published_at IS NOT NULL AND b.superseded_at IS NULL
JOIN with_cutoff r ON r.id=i.id
LEFT JOIN leaders l ON l.school_id=r.school_id
  AND l.academic_year=r.academic_year AND l.semester=r.semester
  AND l.period_title=r.period_title AND l.grade_id=r.grade_id
WHERE i.student_id=p_student_id
  AND i.school_id='6df4961f-2e40-4a37-b75a-98882883ad20'::uuid
$function$
;

CREATE OR REPLACE FUNCTION public.period_notice_current_grade_rankings(p_school_id uuid)
 RETURNS TABLE(school_id uuid, student_id uuid, batch_id uuid, notice_item_id uuid, grade_id uuid, academic_year text, semester text, period_title text, score_percent numeric, grade_rank bigint, is_eligible boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
WITH published AS (
 SELECT i.*,b.published_at,
 ROW_NUMBER() OVER (PARTITION BY i.school_id,i.student_id,
  COALESCE(TRIM(i.academic_year),''),COALESCE(TRIM(i.semester),''),COALESCE(TRIM(i.period_title),'')
  ORDER BY b.published_at DESC,i.updated_at DESC,i.id DESC) version_no
 FROM public.period_notice_items i
 JOIN public.period_notice_batches b ON b.id=i.batch_id AND b.school_id=i.school_id AND b.published_at IS NOT NULL AND b.superseded_at IS NULL
 JOIN public.students s ON s.id=i.student_id AND s.school_id=i.school_id AND s.is_active
 WHERE i.school_id=p_school_id
), scored AS (
 SELECT i.school_id,i.student_id,i.batch_id,i.id notice_item_id,c.grade_id,
 COALESCE(TRIM(i.academic_year),'') academic_year,
 COALESCE(TRIM(i.semester),'') semester,
 COALESCE(TRIM(i.period_title),'') period_title,
 s.full_name_ar,agg.score,agg.percent_score
 FROM published i
 JOIN public.students s ON s.id=i.student_id AND s.school_id=i.school_id AND s.is_active
 JOIN public.classes c ON c.id=s.class_id
 CROSS JOIN LATERAL public.period_notice_subject_totals(i.report_data) agg
 WHERE i.version_no=1
), ranked AS (
 SELECT sc.*,ROW_NUMBER() OVER(PARTITION BY school_id,academic_year,semester,period_title,grade_id
 ORDER BY percent_score DESC NULLS LAST,score DESC NULLS LAST,full_name_ar,student_id) rn FROM scored sc
), cutoffs AS (
 SELECT r.*, MAX(CASE WHEN rn=5 THEN ROUND(percent_score,2) END)
 OVER(PARTITION BY school_id,academic_year,semester,period_title,grade_id) fifth_pct
 FROM ranked r
)
SELECT school_id,student_id,batch_id,notice_item_id,grade_id,academic_year,semester,period_title,
 percent_score,rn,
 (percent_score IS NOT NULL AND (rn<=5 OR ROUND(percent_score,2)>=fifth_pct))
FROM cutoffs
$function$
;

CREATE OR REPLACE FUNCTION public.period_notice_rank_for_student(p_student_id uuid, p_batch_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
WITH all_results AS (
  SELECT i.student_id, s.full_name_ar, i.batch_id, s.school_id, c.grade_id, s.class_id,
    agg.score AS total,
    agg.percent_score/100 AS pct
  FROM public.period_notice_items i
  JOIN public.period_notice_batches b ON b.id=i.batch_id AND b.school_id=i.school_id AND b.published_at IS NOT NULL AND b.superseded_at IS NULL
  JOIN public.students s ON s.id=i.student_id AND s.school_id=i.school_id AND s.is_active=true
  JOIN public.classes c ON c.id=s.class_id
  CROSS JOIN LATERAL public.period_notice_subject_totals(i.report_data) agg
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
), cutoff AS (
  SELECT r.*,
    MAX(CASE WHEN grade_rank=5 THEN ROUND(pct*100,2) END)
      OVER(PARTITION BY school_id,batch_id,grade_id) AS fifth_pct
  FROM ranked r
)
SELECT COALESCE((
  SELECT jsonb_build_object(
    'grade_rank',CASE WHEN x.pct IS NOT NULL THEN x.grade_rank END,
    'grade_count',x.grade_count,
    'school_rank',CASE WHEN x.pct IS NOT NULL THEN x.grade_rank END,
    'school_count',x.grade_count,
    'class_rank',CASE WHEN x.pct IS NOT NULL THEN x.class_rank END,
    'class_count',x.class_count,
    'is_top_five',(x.pct IS NOT NULL AND (x.grade_rank<=5 OR ROUND(x.pct*100,2)>=x.fifth_pct)),
    'top_five',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'student_name',y.full_name_ar,
        'grade_name',(SELECT g.name_ar FROM public.grades g WHERE g.id=y.grade_id),
        'rank',y.grade_rank,
        'total',y.total,
        'percentage',round(y.pct*100,2)
      ) ORDER BY y.grade_rank)
      FROM cutoff y
      WHERE y.school_id=x.school_id AND y.batch_id=x.batch_id
        AND y.grade_id=x.grade_id AND y.pct IS NOT NULL AND (y.grade_rank<=5 OR ROUND(y.pct*100,2)>=y.fifth_pct)
    ),'[]'::jsonb)
  )
  FROM cutoff x WHERE x.student_id=p_student_id LIMIT 1
),'{}'::jsonb)
$function$
;

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
 WHERE i.id=p_notice_id AND b.published_at IS NOT NULL AND b.superseded_at IS NULL;
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
END $function$
;
