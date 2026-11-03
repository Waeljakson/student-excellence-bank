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
    trim(regexp_replace(regexp_replace(lower(COALESCE(x.subj->>'subject','')),'^\\*+','','g'),'\\s+',' ','g')) normalized,
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
