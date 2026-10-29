-- Grade-level top-five ranking for published period notices.
-- Run against the excellence_bank database. Non-destructive function updates only.
-- School scope + published batch + grade_id define each ranking cohort.
-- school_rank/school_count/school_top_five remain compatibility aliases for grade-level values.

CREATE OR REPLACE FUNCTION public.period_notice_for_student(p_student_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
WITH scored AS (
  SELECT i.id,i.batch_id,i.student_id,i.school_id,s.class_id,c.grade_id,
    s.full_name_ar AS student_name,
    (i.report_data->>'sum_total')::numeric AS score,
    (i.report_data->>'sum_max')::numeric AS max_score,
    CASE WHEN (i.report_data->>'sum_max')::numeric>0
      THEN ROUND(100*(i.report_data->>'sum_total')::numeric/(i.report_data->>'sum_max')::numeric,4)
      ELSE NULL END AS percent_score
  FROM public.period_notice_items i
  JOIN public.period_notice_batches b ON b.id=i.batch_id
    AND b.school_id=i.school_id AND b.published_at IS NOT NULL
  JOIN public.students s ON s.id=i.student_id AND s.school_id=i.school_id AND s.is_active=true
  JOIN public.classes c ON c.id=s.class_id
), ranked AS (
  SELECT a.*,
    ROW_NUMBER() OVER(PARTITION BY school_id,batch_id,grade_id
      ORDER BY percent_score DESC NULLS LAST,score DESC NULLS LAST,student_name,student_id) AS grade_rank,
    ROW_NUMBER() OVER(PARTITION BY school_id,batch_id,class_id
      ORDER BY percent_score DESC NULLS LAST,score DESC NULLS LAST,student_name,student_id) AS class_rank,
    COUNT(*) OVER(PARTITION BY school_id,batch_id,grade_id) AS grade_count,
    COUNT(*) OVER(PARTITION BY school_id,batch_id,class_id) AS class_count
  FROM scored a
), leaders AS (
  SELECT school_id,batch_id,grade_id,
    jsonb_agg(jsonb_build_object(
      'name',student_name,'rank',grade_rank,'score_percent',percent_score
    ) ORDER BY grade_rank) AS top_five
  FROM ranked
  WHERE grade_rank <= 5
  GROUP BY school_id,batch_id,grade_id
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
    'published_at',b.published_at,
    'ranking',public.period_notice_rank_for_student(p_student_id,i.batch_id),
    'grade_rank',r.grade_rank,'grade_count',r.grade_count,
    'grade_top_five',COALESCE(l.top_five,'[]'::jsonb),
    'school_rank',r.grade_rank,'school_count',r.grade_count,
    'class_rank',r.class_rank,'class_count',r.class_count,
    'score_percent',r.percent_score,
    'is_top_five',r.grade_rank<=5,
    'school_top_five',COALESCE(l.top_five,'[]'::jsonb)
  ) ORDER BY b.published_at DESC,i.created_at DESC
),'[]'::jsonb)
FROM public.period_notice_items i
JOIN public.period_notice_batches b ON b.id=i.batch_id AND b.school_id=i.school_id
  AND b.published_at IS NOT NULL
JOIN ranked r ON r.id=i.id
LEFT JOIN leaders l ON l.school_id=r.school_id AND l.batch_id=r.batch_id AND l.grade_id=r.grade_id
WHERE i.student_id=p_student_id
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
    (i.report_data->>'sum_total')::numeric AS total,
    CASE WHEN (i.report_data->>'sum_max')::numeric > 0
      THEN (i.report_data->>'sum_total')::numeric / (i.report_data->>'sum_max')::numeric
      ELSE NULL END AS pct
  FROM public.period_notice_items i
  JOIN public.period_notice_batches b ON b.id=i.batch_id AND b.school_id=i.school_id AND b.published_at IS NOT NULL
  JOIN public.students s ON s.id=i.student_id AND s.school_id=i.school_id AND s.is_active=true
  JOIN public.classes c ON c.id=s.class_id
  WHERE i.batch_id=p_batch_id
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
$function$
;
