-- Reconcile a previously mistaken 25-point top-five bonus without changing immutable wallet entries.
-- A compensating CORRECTION entry is written when a student is no longer eligible.
-- Computation uses published subject totals and the official fifth-place percentage cutoff.
CREATE TABLE IF NOT EXISTS public.period_notice_top_five_awards (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL REFERENCES public.schools(id),
 student_id uuid NOT NULL REFERENCES public.students(id),
 batch_id uuid NOT NULL REFERENCES public.period_notice_batches(id),
 notice_item_id uuid NOT NULL REFERENCES public.period_notice_items(id),
 grade_id uuid NOT NULL REFERENCES public.grades(id),
 academic_year text NOT NULL, semester text NOT NULL, period_title text NOT NULL,
 score_percent numeric(9,4) NOT NULL,
 grade_rank integer NOT NULL CHECK(grade_rank>0),
 award_points integer NOT NULL DEFAULT 25 CHECK(award_points=25),
 awarded_at timestamptz NOT NULL DEFAULT now(),
 reversed_at timestamptz,
 correction_reason text,
 CONSTRAINT period_top_five_once_per_student_period UNIQUE(school_id,student_id,academic_year,semester,period_title)
);
ALTER TABLE public.period_notice_top_five_awards
 ADD COLUMN IF NOT EXISTS reversed_at timestamptz,
 ADD COLUMN IF NOT EXISTS correction_reason text;
CREATE UNIQUE INDEX IF NOT EXISTS wallet_once_period_top_five_idx
 ON public.wallet_transactions(student_id,reference_type,reference_id) WHERE reference_type='PERIOD_TOP_FIVE';
CREATE INDEX IF NOT EXISTS period_top_five_awards_batch_idx
 ON public.period_notice_top_five_awards(batch_id,grade_id);
REVOKE ALL ON TABLE public.period_notice_top_five_awards FROM PUBLIC,authenticated,anonymous;
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
 JOIN public.period_notice_batches b ON b.id=i.batch_id AND b.school_id=i.school_id AND b.published_at IS NOT NULL
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

CREATE OR REPLACE FUNCTION public.period_notice_grant_top_five_bonus(p_batch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_school uuid;v_actor uuid;v_awarded int:=0;v_reversed int:=0;v_restored int:=0;
BEGIN
 SELECT school_id,created_by INTO v_school,v_actor FROM public.period_notice_batches
 WHERE id=p_batch_id AND published_at IS NOT NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TOP_FIVE_REQUIRES_PUBLISHED_BATCH';END IF;
 IF v_school IS DISTINCT FROM '6df4961f-2e40-4a37-b75a-98882883ad20'::uuid
 THEN RAISE EXCEPTION 'TOP_FIVE_SCHOOL_NOT_ENABLED';END IF;
 PERFORM pg_advisory_xact_lock(hashtext('period-top-five-bonus'),hashtext(v_school::text));

 WITH invalidated AS (
 UPDATE public.period_notice_top_five_awards a
 SET reversed_at=now(),correction_reason='تصحيح احتساب النسبة: المجموع الحقيقي هو مجموع درجات جميع المواد'
 FROM public.period_notice_current_grade_rankings(v_school) r
 WHERE r.school_id=a.school_id AND r.student_id=a.student_id
 AND r.academic_year=a.academic_year AND r.semester=a.semester AND r.period_title=a.period_title
 AND r.batch_id=p_batch_id AND NOT r.is_eligible
 AND a.reversed_at IS NULL
 RETURNING a.id,a.school_id,a.student_id
 ), deducted AS (
 INSERT INTO public.wallet_transactions(school_id,student_id,transaction_type,points_delta,actor_user_id,
 reference_type,reference_id,note)
 SELECT school_id,student_id,'CORRECTION',-25,v_actor,'PERIOD_TOP_FIVE_CORRECTION',id,
 'تصحيح مكافأة نتائج الفترة: إعادة حساب مجموع كل المواد بدلاً من درجة المادة الأخيرة (-25)'
 FROM invalidated RETURNING id
 )
 SELECT count(*) INTO v_reversed FROM deducted;

 WITH restored AS (
 UPDATE public.period_notice_top_five_awards a
 SET reversed_at=NULL,correction_reason=NULL
 FROM public.period_notice_current_grade_rankings(v_school) r
 WHERE r.school_id=a.school_id AND r.student_id=a.student_id
 AND r.academic_year=a.academic_year AND r.semester=a.semester AND r.period_title=a.period_title
 AND r.batch_id=p_batch_id AND r.is_eligible
 AND a.reversed_at IS NOT NULL
 RETURNING a.id,a.school_id,a.student_id
 ), credited AS (
 INSERT INTO public.wallet_transactions(school_id,student_id,transaction_type,points_delta,actor_user_id,
 reference_type,reference_id,note)
 SELECT school_id,student_id,'CORRECTION',25,v_actor,'PERIOD_TOP_FIVE_REINSTATE',id,
 'استعادة مكافأة التفوق بعد مراجعة المجموع الحقيقي لجميع المواد (+25)'
 FROM restored RETURNING id
 )
 SELECT count(*) INTO v_restored FROM credited;

 WITH created AS (
 INSERT INTO public.period_notice_top_five_awards(
 school_id,student_id,batch_id,notice_item_id,grade_id,academic_year,semester,period_title,
 score_percent,grade_rank,award_points)
 SELECT school_id,student_id,batch_id,notice_item_id,grade_id,academic_year,semester,period_title,
 score_percent,grade_rank,25
 FROM public.period_notice_current_grade_rankings(v_school)
 WHERE batch_id=p_batch_id AND is_eligible
 ON CONFLICT (school_id,student_id,academic_year,semester,period_title) DO NOTHING
 RETURNING id,school_id,student_id
 ), credited AS (
 INSERT INTO public.wallet_transactions(school_id,student_id,transaction_type,points_delta,actor_user_id,
 reference_type,reference_id,note)
 SELECT school_id,student_id,'BONUS',25,v_actor,'PERIOD_TOP_FIVE',id,
 'مكافأة تفوق نتائج الفترة: أحد الخمسة الأوائل أو متعادل مع الخامس بمجموع جميع المواد'
 FROM created
 ON CONFLICT (student_id,reference_type,reference_id) WHERE reference_type='PERIOD_TOP_FIVE' DO NOTHING
 RETURNING id
 )
 SELECT count(*) INTO v_awarded FROM credited;
 RETURN jsonb_build_object('batch_id',p_batch_id,'new_awards',v_awarded,
 'corrected_awards',v_reversed,'restored_awards',v_restored,'points_per_student',25);
END
$function$

CREATE OR REPLACE FUNCTION public.period_notice_auto_bonus_on_publish()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
 IF OLD.published_at IS NULL AND NEW.published_at IS NOT NULL THEN
  PERFORM public.period_notice_grant_top_five_bonus(NEW.id);
 END IF;
 RETURN NEW;
END
$function$

CREATE OR REPLACE FUNCTION public.phase2_level_for_student(p_student uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE earned bigint;points_bal bigint;v_school uuid;v_title text;v_min int;v_next int;v_next_name text;
BEGIN
 SELECT school_id INTO v_school FROM public.students WHERE id=p_student AND is_active LIMIT 1;
 IF v_school IS NULL THEN RETURN '{}'::jsonb; END IF;
 SELECT COALESCE(SUM(points_delta),0)::bigint INTO earned
 FROM public.wallet_transactions WHERE student_id=p_student AND school_id=v_school AND transaction_type::text IN ('EARN','BONUS','REVERSE','CORRECTION');
 earned:=GREATEST(0,earned);
 SELECT COALESCE(points_balance,0) INTO points_bal FROM public.student_wallet_balances WHERE student_id=p_student AND school_id=v_school;
 points_bal:=COALESCE(points_bal,0);
 SELECT x.title,x.threshold INTO v_title,v_min FROM (VALUES
   (0,'بداية التميز'),(50,'البرونزي'),(100,'الفضي'),(200,'الذهبي'),
   (350,'البلاتيني'),(500,'الماسي'),(750,'سفير التميز')) x(threshold,title)
 WHERE x.threshold<=earned ORDER BY x.threshold DESC LIMIT 1;
 SELECT x.title,x.threshold INTO v_next_name,v_next FROM (VALUES
   (50,'البرونزي'),(100,'الفضي'),(200,'الذهبي'),(350,'البلاتيني'),
   (500,'الماسي'),(750,'سفير التميز')) x(threshold,title)
 WHERE x.threshold>earned ORDER BY x.threshold LIMIT 1;
 RETURN jsonb_build_object('name',v_title,'earned',earned,'balance',points_bal,
  'threshold',v_min,'next_name',v_next_name,'next_threshold',v_next,
  'remaining',CASE WHEN v_next IS NULL THEN 0 ELSE v_next-earned END,
  'percent',CASE WHEN v_next IS NULL THEN 100 ELSE GREATEST(0,LEAST(100,round(100.0*(earned-v_min)/NULLIF(v_next-v_min,0)))) END,
  'levels',jsonb_build_array(jsonb_build_object('name','البرونزي','points',50),
   jsonb_build_object('name','الفضي','points',100),jsonb_build_object('name','الذهبي','points',200),
   jsonb_build_object('name','البلاتيني','points',350),jsonb_build_object('name','الماسي','points',500),
   jsonb_build_object('name','سفير التميز','points',750)));
END
$function$

REVOKE ALL ON FUNCTION public.period_notice_current_grade_rankings(uuid) FROM PUBLIC,authenticated,anonymous;
REVOKE ALL ON FUNCTION public.period_notice_grant_top_five_bonus(uuid) FROM PUBLIC,authenticated,anonymous;
DROP TRIGGER IF EXISTS period_notice_publish_top_five_bonus ON public.period_notice_batches;
CREATE TRIGGER period_notice_publish_top_five_bonus
 AFTER UPDATE OF published_at ON public.period_notice_batches
 FOR EACH ROW WHEN (OLD.published_at IS NULL AND NEW.published_at IS NOT NULL)
 EXECUTE FUNCTION public.period_notice_auto_bonus_on_publish();
-- Idempotent backfill/reconciliation for the published first period of 1447-1448.
SELECT public.period_notice_grant_top_five_bonus('615ab9fc-4c7a-4f3d-a39f-3c45fffe382e'::uuid);
