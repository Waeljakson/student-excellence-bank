-- 2026-10-29: Each student sees only the latest published notice for the same
-- academic year, semester and period. Previous published batches stay in the
-- database for administrative audit. Grade rankings are recomputed from
-- current visible notices, even when a corrected batch was published later.

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
$function$;
