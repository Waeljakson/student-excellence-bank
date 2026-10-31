-- Stage 4: committee rubric scoring of existing school competitions. No winner is approved automatically.
CREATE TABLE IF NOT EXISTS public.competition_judging_scores(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL REFERENCES public.schools(id),
 competition_id uuid NOT NULL REFERENCES public.competition_announcements(id),
 student_id uuid NOT NULL REFERENCES public.students(id),
 idea_score smallint NOT NULL CHECK (idea_score BETWEEN 0 AND 25),
 quality_score smallint NOT NULL CHECK (quality_score BETWEEN 0 AND 25),
 creativity_score smallint NOT NULL CHECK (creativity_score BETWEEN 0 AND 25),
 presentation_score smallint NOT NULL CHECK (presentation_score BETWEEN 0 AND 25),
 total_score integer GENERATED ALWAYS AS (idea_score+quality_score+creativity_score+presentation_score) STORED,
 reviewer_note text NOT NULL DEFAULT '' CHECK (length(reviewer_note)<=900),
 judged_by uuid NOT NULL REFERENCES public.app_users(id),
 judged_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (competition_id,student_id)
);
CREATE INDEX IF NOT EXISTS competition_judging_school_idx
 ON public.competition_judging_scores(school_id,competition_id,total_score DESC);
REVOKE ALL ON TABLE public.competition_judging_scores FROM PUBLIC,anonymous,authenticated;

CREATE OR REPLACE FUNCTION public.api_admin_competition_judging(p_competition_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_auth uuid;v_actor uuid;v_school uuid;
BEGIN
 v_auth:=NULLIF(NULLIF(auth.user_id(),''),'anonymous')::uuid;
 IF v_auth IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED';END IF;
 SELECT id,school_id INTO v_actor,v_school FROM public.app_users
 WHERE auth_user_id=v_auth AND is_active LIMIT 1;
 IF v_actor IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.user_roles WHERE user_id=v_actor AND role::text IN ('SUPER_ADMIN','SCHOOL_ADMIN','PRINCIPAL')
 ) THEN RAISE EXCEPTION 'ADMIN_REQUIRED';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.competition_announcements WHERE id=p_competition_id AND school_id=v_school
  AND deleted_at IS NULL AND announcement_type='TARGETED_COMPETITION') THEN RAISE EXCEPTION 'COMPETITION_NOT_FOUND';END IF;
 RETURN COALESCE((
 SELECT jsonb_agg(to_jsonb(x) ORDER BY x.total_score DESC,x.student_name)
 FROM (
  SELECT j.student_id,s.full_name_ar student_name,j.idea_score,j.quality_score,
  j.creativity_score,j.presentation_score,j.total_score,j.reviewer_note,j.updated_at,
  RANK() OVER(ORDER BY j.total_score DESC) position,
  u.full_name_ar judged_by_name
  FROM public.competition_judging_scores j
  JOIN public.students s ON s.id=j.student_id AND s.school_id=v_school
  JOIN public.app_users u ON u.id=j.judged_by AND u.school_id=v_school
  WHERE j.competition_id=p_competition_id AND j.school_id=v_school
 ) x),'[]'::jsonb);
END
$function$;

CREATE OR REPLACE FUNCTION public.api_admin_score_competition(p_competition_id uuid, p_student_id uuid, p_idea integer, p_quality integer, p_creativity integer, p_presentation integer, p_note text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_auth uuid;v_actor uuid;v_school uuid;v_score integer;v_status text;v_closed timestamptz;
BEGIN
 v_auth:=NULLIF(NULLIF(auth.user_id(),''),'anonymous')::uuid;
 IF v_auth IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED';END IF;
 SELECT id,school_id INTO v_actor,v_school FROM public.app_users
 WHERE auth_user_id=v_auth AND is_active LIMIT 1;
 IF v_actor IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.user_roles WHERE user_id=v_actor AND role::text IN ('SUPER_ADMIN','SCHOOL_ADMIN','PRINCIPAL')
 ) THEN RAISE EXCEPTION 'ADMIN_REQUIRED'; END IF;
 IF p_idea IS NULL OR p_quality IS NULL OR p_creativity IS NULL OR p_presentation IS NULL OR
  p_idea NOT BETWEEN 0 AND 25 OR p_quality NOT BETWEEN 0 AND 25 OR
  p_creativity NOT BETWEEN 0 AND 25 OR p_presentation NOT BETWEEN 0 AND 25 OR
  length(COALESCE(p_note,''))>900
 THEN RAISE EXCEPTION 'INVALID_JUDGING_SCORE'; END IF;
 SELECT ca.closed_at INTO v_closed FROM public.competition_announcements ca
 WHERE ca.id=p_competition_id AND ca.school_id=v_school AND ca.deleted_at IS NULL
 AND ca.announcement_type='TARGETED_COMPETITION' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'COMPETITION_NOT_FOUND'; END IF;
 IF v_closed IS NULL THEN RAISE EXCEPTION 'CLOSE_COMPETITION_BEFORE_JUDGING';END IF;
 SELECT cp.status INTO v_status FROM public.competition_participants cp
 JOIN public.students s ON s.id=cp.student_id AND s.school_id=v_school AND s.is_active
 WHERE cp.competition_id=p_competition_id AND cp.student_id=p_student_id AND cp.submission_type IS NOT NULL
 FOR UPDATE OF cp;
 IF v_status IS NULL THEN RAISE EXCEPTION 'SUBMISSION_NOT_FOUND'; END IF;
 IF v_status NOT IN ('JOINED') THEN RAISE EXCEPTION 'PARTICIPANT_NOT_ELIGIBLE_FOR_JUDGING';END IF;
 INSERT INTO public.competition_judging_scores(
 school_id,competition_id,student_id,idea_score,quality_score,creativity_score,presentation_score,
 reviewer_note,judged_by)
 VALUES(v_school,p_competition_id,p_student_id,p_idea,p_quality,p_creativity,p_presentation,
 COALESCE(p_note,''),v_actor)
 ON CONFLICT(competition_id,student_id) DO UPDATE
 SET idea_score=excluded.idea_score,quality_score=excluded.quality_score,
 creativity_score=excluded.creativity_score,presentation_score=excluded.presentation_score,
 reviewer_note=excluded.reviewer_note,judged_by=excluded.judged_by,updated_at=now();
 v_score:=p_idea+p_quality+p_creativity+p_presentation;
 INSERT INTO public.audit_logs(school_id,actor_user_id,action,entity_type,entity_id,after_json)
 VALUES(v_school,v_actor,'COMPETITION_JUDGED','competition_participant',
 p_competition_id::text||':'||p_student_id::text,
 jsonb_build_object('total',v_score,'idea',p_idea,'quality',p_quality,
 'creativity',p_creativity,'presentation',p_presentation));
 RETURN jsonb_build_object('student_id',p_student_id,'total_score',v_score,'saved',true);
END
$function$;
GRANT EXECUTE ON FUNCTION public.api_admin_competition_judging(uuid) TO anonymous,authenticated;
GRANT EXECUTE ON FUNCTION public.api_admin_score_competition(uuid,uuid,integer,integer,integer,integer,text) TO anonymous,authenticated;
