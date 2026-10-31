-- Stage 3: private, human-led early-support workflow.
-- No automated disciplinary labels, point deductions or parent-facing disclosures.
-- Separate records by school; only privileged staff can read or change support plans.

CREATE TABLE IF NOT EXISTS public.phase3_support_plans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL REFERENCES public.schools(id),
 student_id uuid NOT NULL REFERENCES public.students(id),
 concern_kind text NOT NULL CHECK (concern_kind IN ('ACADEMIC','BEHAVIOR','ATTENDANCE','HOMEWORK','OTHER')),
 goal_ar text NOT NULL CHECK (length(trim(goal_ar)) BETWEEN 5 AND 600),
 action_ar text NOT NULL CHECK (length(trim(action_ar)) BETWEEN 5 AND 1200),
 private_note text NOT NULL DEFAULT '' CHECK (length(private_note)<=2000),
 status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','COMPLETED','CLOSED')),
 review_on date,
 created_by uuid NOT NULL REFERENCES public.app_users(id),
 updated_by uuid NOT NULL REFERENCES public.app_users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 CONSTRAINT phase3_review_date_reasonable CHECK (review_on IS NULL OR review_on BETWEEN DATE '2020-01-01' AND DATE '2100-12-31')
);
CREATE INDEX IF NOT EXISTS phase3_plans_by_school ON public.phase3_support_plans(school_id,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS phase3_plans_by_student ON public.phase3_support_plans(student_id,created_at DESC);
REVOKE ALL ON TABLE public.phase3_support_plans FROM PUBLIC,authenticated,anonymous;

-- SPLIT
CREATE OR REPLACE FUNCTION public.phase3_guidance_school()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO public,pg_temp
AS $fn$
DECLARE v_auth uuid;v_user uuid;v_school uuid;
BEGIN
 v_auth:=NULLIF(NULLIF(auth.user_id(),''),'anonymous')::uuid;
 IF v_auth IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 SELECT id,school_id INTO v_user,v_school FROM public.app_users
 WHERE auth_user_id=v_auth AND is_active LIMIT 1;
 IF v_user IS NULL OR NOT EXISTS (
  SELECT 1 FROM public.user_roles WHERE user_id=v_user
   AND role::text IN ('SUPER_ADMIN','SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL','GUIDANCE_COUNSELOR')
 ) THEN RAISE EXCEPTION 'GUIDANCE_ACCESS_REQUIRED'; END IF;
 RETURN v_school;
END
$fn$;

-- SPLIT
CREATE OR REPLACE FUNCTION public.api_phase3_review_queue(
 p_days integer DEFAULT 30,p_grade_id uuid DEFAULT NULL,p_class_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO public,pg_temp
AS $fn$
DECLARE v_school uuid;v_result jsonb;
BEGIN
 v_school:=public.phase3_guidance_school();
 IF p_days IS NULL OR p_days NOT IN (14,30,60,90) THEN RAISE EXCEPTION 'INVALID_WINDOW'; END IF;
 WITH school_students AS (
  SELECT s.id student_id,s.full_name_ar student_name,s.student_no,
   c.id class_id,c.name_ar class_name,g.id grade_id,g.name_ar grade_name
  FROM public.students s
  JOIN public.classes c ON c.id=s.class_id AND c.is_active
  JOIN public.grades g ON g.id=c.grade_id
  JOIN public.departments dep ON dep.id=g.department_id AND dep.school_id=s.school_id
  JOIN public.academic_years ay ON ay.id=c.academic_year_id AND ay.school_id=s.school_id
  WHERE s.school_id=v_school AND s.is_active
    AND (p_grade_id IS NULL OR g.id=p_grade_id)
    AND (p_class_id IS NULL OR c.id=p_class_id)
 ), notes AS (
  SELECT f.student_id,
   COUNT(*) FILTER(WHERE f.note_kind='NEGATIVE')::integer negative_notes,
   COUNT(*) FILTER(WHERE f.note_kind='HOMEWORK')::integer homework_notes,
   COUNT(*) FILTER(WHERE f.note_kind='POSITIVE')::integer positive_notes
  FROM public.student_followup_notes f
  JOIN school_students s ON s.student_id=f.student_id
  WHERE f.school_id=v_school AND f.note_date>=current_date-p_days AND f.note_date<=current_date
  GROUP BY f.student_id
 ), referrals AS (
  SELECT r.student_id,COUNT(*)::integer open_referrals
  FROM public.student_referrals r JOIN school_students s ON s.student_id=r.student_id
  WHERE r.school_id=v_school AND r.status='OPEN' AND r.archive_deleted_at IS NULL
  GROUP BY r.student_id
 ), plans AS (
  SELECT student_id,
   COUNT(*) FILTER(WHERE status IN ('OPEN','IN_PROGRESS'))::integer active_plans,
   COUNT(*) FILTER(WHERE status IN ('OPEN','IN_PROGRESS') AND review_on<current_date)::integer overdue_plans
  FROM public.phase3_support_plans WHERE school_id=v_school
  GROUP BY student_id
 ), rows AS (
  SELECT s.*,
   COALESCE(n.negative_notes,0) negative_notes,
   COALESCE(n.homework_notes,0) homework_notes,
   COALESCE(n.positive_notes,0) positive_notes,
   COALESCE(r.open_referrals,0) open_referrals,
   COALESCE(p.active_plans,0) active_plans,
   COALESCE(p.overdue_plans,0) overdue_plans,
   (COALESCE(n.negative_notes,0)>=2 OR COALESCE(n.homework_notes,0)>=3 OR
    COALESCE(r.open_referrals,0)>0) needs_review
  FROM school_students s
  LEFT JOIN notes n ON n.student_id=s.student_id
  LEFT JOIN referrals r ON r.student_id=s.student_id
  LEFT JOIN plans p ON p.student_id=s.student_id
 )
 SELECT jsonb_build_object(
  'school_name',(SELECT name_ar FROM public.schools WHERE id=v_school),
  'days',p_days,'generated_at',now(),
  'summary',jsonb_build_object(
    'students',count(*),
    'review_candidates',count(*) FILTER(WHERE needs_review),
    'active_plans',COALESCE(sum(active_plans),0),
    'overdue_plans',COALESCE(sum(overdue_plans),0)),
  'students',COALESCE(jsonb_agg(to_jsonb(rows) ORDER BY needs_review DESC,
    open_referrals DESC,negative_notes DESC,student_name),'[]'::jsonb)
 ) INTO v_result FROM rows;
 RETURN v_result;
END
$fn$;

-- SPLIT
CREATE OR REPLACE FUNCTION public.api_phase3_plan_history(p_student_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO public,pg_temp
AS $fn$
DECLARE v_school uuid;v_student record;
BEGIN
 v_school:=public.phase3_guidance_school();
 SELECT s.id,s.full_name_ar,s.student_no INTO v_student FROM public.students s
 WHERE s.id=p_student_id AND s.school_id=v_school AND s.is_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'STUDENT_NOT_IN_SCHOOL'; END IF;
 RETURN jsonb_build_object(
  'student',jsonb_build_object('id',v_student.id,'name',v_student.full_name_ar,'student_no',v_student.student_no),
  'plans',COALESCE((
    SELECT jsonb_agg(to_jsonb(p) ORDER BY p.created_at DESC)
    FROM (
      SELECT sp.id,sp.concern_kind,sp.goal_ar,sp.action_ar,sp.private_note,
       sp.status,sp.review_on,sp.created_at,sp.updated_at,sp.completed_at,
       maker.full_name_ar created_by_name
      FROM public.phase3_support_plans sp
      JOIN public.app_users maker ON maker.id=sp.created_by
      WHERE sp.student_id=p_student_id AND sp.school_id=v_school
      ORDER BY sp.created_at DESC LIMIT 50
    ) p
  ),'[]'::jsonb)
 );
END
$fn$;

-- SPLIT
CREATE OR REPLACE FUNCTION public.api_phase3_save_plan(
 p_id uuid,p_student_id uuid,p_concern_kind text,p_goal text,p_action text,
 p_review_on date,p_private_note text,p_status text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public,pg_temp
AS $fn$
DECLARE v_school uuid;v_actor uuid;v_saved uuid;
BEGIN
 v_school:=public.phase3_guidance_school();
 SELECT id INTO v_actor FROM public.app_users
 WHERE auth_user_id=NULLIF(NULLIF(auth.user_id(),''),'anonymous')::uuid
 AND school_id=v_school AND is_active LIMIT 1;
 IF v_actor IS NULL THEN RAISE EXCEPTION 'GUIDANCE_ACCESS_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.students WHERE id=p_student_id
  AND school_id=v_school AND is_active) THEN RAISE EXCEPTION 'STUDENT_NOT_IN_SCHOOL'; END IF;
 IF p_concern_kind IS NULL OR p_concern_kind NOT IN ('ACADEMIC','BEHAVIOR','ATTENDANCE','HOMEWORK','OTHER')
  OR p_status IS NULL OR p_status NOT IN ('OPEN','IN_PROGRESS','COMPLETED','CLOSED')
  OR length(trim(COALESCE(p_goal,''))) NOT BETWEEN 5 AND 600
  OR length(trim(COALESCE(p_action,''))) NOT BETWEEN 5 AND 1200
  OR length(COALESCE(p_private_note,''))>2000 THEN RAISE EXCEPTION 'INVALID_PLAN_FIELDS'; END IF;
 IF p_review_on IS NOT NULL AND (p_review_on<DATE '2020-01-01' OR p_review_on>DATE '2100-12-31')
 THEN RAISE EXCEPTION 'INVALID_REVIEW_DATE'; END IF;
 IF p_id IS NULL THEN
  INSERT INTO public.phase3_support_plans(school_id,student_id,concern_kind,goal_ar,action_ar,
   review_on,private_note,status,created_by,updated_by,completed_at)
  VALUES(v_school,p_student_id,p_concern_kind,trim(p_goal),trim(p_action),p_review_on,
   COALESCE(p_private_note,''),p_status,v_actor,v_actor,
   CASE WHEN p_status IN ('COMPLETED','CLOSED') THEN now() ELSE NULL END)
  RETURNING id INTO v_saved;
 ELSE
  UPDATE public.phase3_support_plans
  SET concern_kind=p_concern_kind,goal_ar=trim(p_goal),action_ar=trim(p_action),
   review_on=p_review_on,private_note=COALESCE(p_private_note,''),status=p_status,
   updated_by=v_actor,updated_at=now(),
   completed_at=CASE WHEN p_status IN ('COMPLETED','CLOSED') THEN COALESCE(completed_at,now()) ELSE NULL END
  WHERE id=p_id AND school_id=v_school AND student_id=p_student_id
  RETURNING id INTO v_saved;
  IF v_saved IS NULL THEN RAISE EXCEPTION 'PLAN_NOT_FOUND_IN_SCHOOL'; END IF;
 END IF;
 RETURN jsonb_build_object('id',v_saved,'status',p_status);
END
$fn$;

-- SPLIT
REVOKE ALL ON FUNCTION public.phase3_guidance_school() FROM PUBLIC,authenticated,anonymous;

-- SPLIT
GRANT EXECUTE ON FUNCTION public.api_phase3_review_queue(integer,uuid,uuid),
public.api_phase3_plan_history(uuid),
public.api_phase3_save_plan(uuid,uuid,text,text,text,date,text,text)
TO authenticated,anonymous;
