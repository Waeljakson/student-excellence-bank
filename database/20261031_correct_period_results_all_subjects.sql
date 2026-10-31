-- Correction: derive final grade from ALL subjects, not row-35 last-subject cells.
-- Missing/invalid subjects produce no percentage or rank until a corrected report is published.
-- No source Excel sheets or imported raw subject scores are altered.
CREATE OR REPLACE FUNCTION public.period_notice_subject_totals(p_report jsonb)
 RETURNS TABLE(score numeric, max_score numeric, percent_score numeric, is_complete boolean)
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
WITH per_subject AS (
 SELECT NULLIF(x->>'total','')::numeric AS received, NULLIF(x->>'maximum','')::numeric AS possible
 FROM jsonb_array_elements(COALESCE(p_report->'subjects','[]'::jsonb)) x
), totals AS (
 SELECT count(*) subjects, count(*) FILTER(WHERE received IS NULL OR possible IS NULL OR possible<=0 OR received<0 OR received>possible) invalid,
 SUM(received) score, SUM(possible) maximum
 FROM per_subject
)
SELECT
 CASE WHEN subjects>0 AND invalid=0 AND maximum>0 THEN score END,
 CASE WHEN subjects>0 AND invalid=0 AND maximum>0 THEN maximum END,
 CASE WHEN subjects>0 AND invalid=0 AND maximum>0 THEN round(score*100/maximum,4) END,
 (subjects>0 AND invalid=0 AND maximum>0)
FROM totals
$function$

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
JOIN public.period_notice_batches b ON b.id=i.batch_id AND b.school_id=i.school_id AND b.published_at IS NOT NULL
JOIN with_cutoff r ON r.id=i.id
LEFT JOIN leaders l ON l.school_id=r.school_id
  AND l.academic_year=r.academic_year AND l.semester=r.semester
  AND l.period_title=r.period_title AND l.grade_id=r.grade_id
WHERE i.student_id=p_student_id
  AND i.school_id='6df4961f-2e40-4a37-b75a-98882883ad20'::uuid
$function$

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
  JOIN public.period_notice_batches b ON b.id=i.batch_id AND b.school_id=i.school_id AND b.published_at IS NOT NULL
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
         'total',agg.score,'total_max',agg.max_score,'score_complete',agg.is_complete
       ) ORDER BY g.sort_order,s.full_name_ar)
       FROM public.period_notice_items i
       JOIN public.students s ON s.id=i.student_id AND s.school_id=v_school
       JOIN public.classes c ON c.id=s.class_id
       JOIN public.grades g ON g.id=c.grade_id
       CROSS JOIN LATERAL public.period_notice_subject_totals(i.report_data) agg
       WHERE i.batch_id=b.id),'[]'::jsonb)
     ) ORDER BY b.created_at DESC)
     FROM public.period_notice_batches b WHERE b.school_id=v_school
   ),'[]'::jsonb));
 END;$function$
REVOKE ALL ON FUNCTION public.period_notice_subject_totals(jsonb) FROM PUBLIC,authenticated,anonymous;
