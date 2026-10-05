-- 2026-10-05
-- School-admin role promotion + targeted competition participant outcomes.
-- Safe, school-scoped, and reusable across Mishkat Al-Shaala and Mishkat Al-Nada.

BEGIN;

ALTER TABLE public.competition_participants
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'JOINED',
  ADD COLUMN IF NOT EXISTS excluded_at timestamptz,
  ADD COLUMN IF NOT EXISTS excluded_by uuid REFERENCES public.app_users(id),
  ADD COLUMN IF NOT EXISTS winner_at timestamptz,
  ADD COLUMN IF NOT EXISTS winner_by uuid REFERENCES public.app_users(id);

UPDATE public.competition_participants
SET status='JOINED'
WHERE status IS NULL OR status NOT IN ('JOINED','EXCLUDED','WINNER');

CREATE OR REPLACE FUNCTION public.api_admin_set_staff_vice_principal(
  p_staff_id uuid,
  p_enabled boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  v_auth uuid;
  v_actor uuid;
  v_school uuid;
  v_staff public.staff_directory%ROWTYPE;
  v_old_job text;
BEGIN
  v_auth:=NULLIF(auth.user_id(),'')::uuid;

  SELECT au.id,au.school_id
  INTO v_actor,v_school
  FROM public.app_users au
  WHERE au.auth_user_id=v_auth AND au.is_active=true
  LIMIT 1;

  IF v_actor IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id=v_actor AND ur.role IN ('SUPER_ADMIN','SCHOOL_ADMIN')
  ) THEN
    RAISE EXCEPTION 'SCHOOL_ADMIN_REQUIRED';
  END IF;

  SELECT * INTO v_staff
  FROM public.staff_directory
  WHERE id=p_staff_id AND school_id=v_school AND is_active=true
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'STAFF_NOT_FOUND'; END IF;
  IF v_staff.linked_app_user_id IS NULL THEN RAISE EXCEPTION 'STAFF_ACCOUNT_REQUIRED'; END IF;

  v_old_job:=v_staff.job_title_ar;

  IF COALESCE(p_enabled,false) THEN
    IF v_staff.job_title_ar NOT IN ('معلم','وكيل المدرسة') THEN
      RAISE EXCEPTION 'VICE_ROLE_SOURCE_INVALID';
    END IF;

    UPDATE public.staff_directory
    SET job_title_ar='وكيل المدرسة',updated_at=now()
    WHERE id=v_staff.id;

    DELETE FROM public.user_roles
    WHERE user_id=v_staff.linked_app_user_id AND role='TEACHER';

    INSERT INTO public.user_roles(user_id,role)
    VALUES(v_staff.linked_app_user_id,'VICE_PRINCIPAL')
    ON CONFLICT DO NOTHING;
  ELSE
    IF v_staff.job_title_ar<>'وكيل المدرسة' THEN
      RAISE EXCEPTION 'VICE_ROLE_SOURCE_INVALID';
    END IF;

    UPDATE public.staff_directory
    SET job_title_ar='معلم',updated_at=now()
    WHERE id=v_staff.id;

    DELETE FROM public.user_roles
    WHERE user_id=v_staff.linked_app_user_id AND role='VICE_PRINCIPAL';

    INSERT INTO public.user_roles(user_id,role)
    VALUES(v_staff.linked_app_user_id,'TEACHER')
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.audit_logs(
    school_id,actor_user_id,action,entity_type,entity_id,before_json,after_json
  ) VALUES(
    v_school,v_actor,
    CASE WHEN COALESCE(p_enabled,false) THEN 'GRANT_VICE_PRINCIPAL' ELSE 'REVOKE_VICE_PRINCIPAL' END,
    'staff_directory',v_staff.id::text,
    jsonb_build_object('job_title_ar',v_old_job),
    jsonb_build_object(
      'job_title_ar',CASE WHEN COALESCE(p_enabled,false) THEN 'وكيل المدرسة' ELSE 'معلم' END,
      'linked_app_user_id',v_staff.linked_app_user_id
    )
  );

  RETURN jsonb_build_object(
    'ok',true,
    'staff_id',v_staff.id,
    'app_user_id',v_staff.linked_app_user_id,
    'job_title_ar',CASE WHEN COALESCE(p_enabled,false) THEN 'وكيل المدرسة' ELSE 'معلم' END,
    'role',CASE WHEN COALESCE(p_enabled,false) THEN 'VICE_PRINCIPAL' ELSE 'TEACHER' END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.api_admin_competition_participants(
  p_competition_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  v_auth uuid;
  v_actor uuid;
  v_school uuid;
BEGIN
  v_auth:=NULLIF(auth.user_id(),'')::uuid;

  SELECT au.id,au.school_id
  INTO v_actor,v_school
  FROM public.app_users au
  WHERE au.auth_user_id=v_auth AND au.is_active=true
  LIMIT 1;

  IF v_actor IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id=v_actor AND ur.role IN ('SUPER_ADMIN','SCHOOL_ADMIN','PRINCIPAL')
  ) THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED';
  END IF;

  IF NOT EXISTS(
    SELECT 1
    FROM public.competition_announcements ca
    WHERE ca.id=p_competition_id
      AND ca.school_id=v_school
      AND ca.deleted_at IS NULL
      AND ca.announcement_type='TARGETED_COMPETITION'
  ) THEN
    RAISE EXCEPTION 'COMPETITION_NOT_FOUND';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'student_id',s.id,
      'student_no',s.student_no,
      'student_name',s.full_name_ar,
      'grade_name',g.name_ar,
      'class_name',cl.name_ar,
      'joined_at',cp.joined_at,
      'status',COALESCE(cp.status,'JOINED'),
      'excluded_at',cp.excluded_at,
      'winner_at',cp.winner_at
    ) ORDER BY
      CASE COALESCE(cp.status,'JOINED') WHEN 'WINNER' THEN 0 WHEN 'JOINED' THEN 1 ELSE 2 END,
      cp.joined_at,
      s.full_name_ar
    )
    FROM public.competition_participants cp
    JOIN public.students s ON s.id=cp.student_id
    LEFT JOIN public.classes cl ON cl.id=s.class_id
    LEFT JOIN public.grades g ON g.id=cl.grade_id
    WHERE cp.competition_id=p_competition_id
      AND s.school_id=v_school
  ),'[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.api_admin_set_competition_participant_status(
  p_competition_id uuid,
  p_student_id uuid,
  p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  v_auth uuid;
  v_actor uuid;
  v_school uuid;
  v_action text:=upper(trim(COALESCE(p_action,'')));
  v_title text;
  v_student_name text;
  v_current text;
BEGIN
  v_auth:=NULLIF(auth.user_id(),'')::uuid;

  SELECT au.id,au.school_id
  INTO v_actor,v_school
  FROM public.app_users au
  WHERE au.auth_user_id=v_auth AND au.is_active=true
  LIMIT 1;

  IF v_actor IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id=v_actor AND ur.role IN ('SUPER_ADMIN','SCHOOL_ADMIN')
  ) THEN
    RAISE EXCEPTION 'SCHOOL_ADMIN_REQUIRED';
  END IF;

  SELECT ca.title_ar INTO v_title
  FROM public.competition_announcements ca
  WHERE ca.id=p_competition_id
    AND ca.school_id=v_school
    AND ca.deleted_at IS NULL
    AND ca.announcement_type='TARGETED_COMPETITION'
  LIMIT 1;

  IF v_title IS NULL THEN RAISE EXCEPTION 'COMPETITION_NOT_FOUND'; END IF;

  SELECT s.full_name_ar,COALESCE(cp.status,'JOINED')
  INTO v_student_name,v_current
  FROM public.competition_participants cp
  JOIN public.students s ON s.id=cp.student_id
  WHERE cp.competition_id=p_competition_id
    AND cp.student_id=p_student_id
    AND s.school_id=v_school
  LIMIT 1
  FOR UPDATE OF cp;

  IF v_student_name IS NULL THEN RAISE EXCEPTION 'COMPETITION_PARTICIPANT_NOT_FOUND'; END IF;

  IF v_action='EXCLUDE' THEN
    UPDATE public.competition_participants
    SET status='EXCLUDED',
        excluded_at=now(),
        excluded_by=v_actor,
        winner_at=NULL,
        winner_by=NULL
    WHERE competition_id=p_competition_id AND student_id=p_student_id;

  ELSIF v_action='RESTORE' THEN
    UPDATE public.competition_participants
    SET status='JOINED',
        excluded_at=NULL,
        excluded_by=NULL,
        winner_at=NULL,
        winner_by=NULL
    WHERE competition_id=p_competition_id AND student_id=p_student_id;

  ELSIF v_action='WINNER' THEN
    IF v_current='EXCLUDED' THEN RAISE EXCEPTION 'COMPETITION_PARTICIPANT_EXCLUDED'; END IF;

    UPDATE public.competition_participants
    SET status='JOINED',winner_at=NULL,winner_by=NULL
    WHERE competition_id=p_competition_id AND status='WINNER' AND student_id<>p_student_id;

    UPDATE public.competition_participants
    SET status='WINNER',
        excluded_at=NULL,
        excluded_by=NULL,
        winner_at=now(),
        winner_by=v_actor
    WHERE competition_id=p_competition_id AND student_id=p_student_id;
  ELSE
    RAISE EXCEPTION 'COMPETITION_PARTICIPANT_ACTION_INVALID';
  END IF;

  INSERT INTO public.audit_logs(
    school_id,actor_user_id,action,entity_type,entity_id,before_json,after_json
  ) VALUES(
    v_school,v_actor,
    CASE v_action
      WHEN 'WINNER' THEN 'COMPETITION_WINNER_APPROVED'
      WHEN 'EXCLUDE' THEN 'COMPETITION_PARTICIPANT_EXCLUDED'
      ELSE 'COMPETITION_PARTICIPANT_RESTORED'
    END,
    'competition_participant',
    p_competition_id::text||':'||p_student_id::text,
    jsonb_build_object('status',v_current),
    jsonb_build_object(
      'competition_id',p_competition_id,
      'competition_title',v_title,
      'student_id',p_student_id,
      'student_name',v_student_name,
      'status',CASE v_action WHEN 'WINNER' THEN 'WINNER' WHEN 'EXCLUDE' THEN 'EXCLUDED' ELSE 'JOINED' END
    )
  );

  RETURN jsonb_build_object(
    'ok',true,
    'competition_id',p_competition_id,
    'student_id',p_student_id,
    'student_name',v_student_name,
    'status',CASE v_action WHEN 'WINNER' THEN 'WINNER' WHEN 'EXCLUDE' THEN 'EXCLUDED' ELSE 'JOINED' END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.api_student_join_competition(
  p_competition_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  v_auth uuid;
  v_student public.students%ROWTYPE;
  v_comp public.competition_announcements%ROWTYPE;
  v_status text;
BEGIN
  v_auth:=NULLIF(auth.user_id(),'')::uuid;
  IF v_auth IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  SELECT * INTO v_student
  FROM public.students
  WHERE auth_user_id=v_auth AND is_active=true
  LIMIT 1;

  IF NOT FOUND THEN RAISE EXCEPTION 'STUDENT_ACCOUNT_REQUIRED'; END IF;

  SELECT * INTO v_comp
  FROM public.competition_announcements
  WHERE id=p_competition_id
    AND school_id=v_student.school_id
    AND deleted_at IS NULL
    AND announcement_type='TARGETED_COMPETITION'
    AND is_published=true
  LIMIT 1;

  IF NOT FOUND THEN RAISE EXCEPTION 'COMPETITION_NOT_FOUND'; END IF;
  IF now()<v_comp.starts_at THEN RAISE EXCEPTION 'COMPETITION_NOT_STARTED'; END IF;
  IF v_comp.ends_at IS NOT NULL AND now()>v_comp.ends_at THEN RAISE EXCEPTION 'COMPETITION_ENDED'; END IF;

  IF jsonb_array_length(COALESCE(v_comp.target_class_ids,'[]'::jsonb))>0
     AND NOT EXISTS(
       SELECT 1
       FROM jsonb_array_elements_text(v_comp.target_class_ids) j(value)
       WHERE j.value::uuid=v_student.class_id
     ) THEN
    RAISE EXCEPTION 'COMPETITION_NOT_FOR_CLASS';
  END IF;

  SELECT status INTO v_status
  FROM public.competition_participants
  WHERE competition_id=p_competition_id AND student_id=v_student.id
  LIMIT 1;

  IF v_status='EXCLUDED' THEN RAISE EXCEPTION 'COMPETITION_PARTICIPANT_EXCLUDED'; END IF;
  IF v_status IN ('JOINED','WINNER') THEN
    RETURN jsonb_build_object('ok',true,'already_joined',true,'status',v_status);
  END IF;

  INSERT INTO public.competition_participants(competition_id,student_id,joined_at,status)
  VALUES(p_competition_id,v_student.id,now(),'JOINED')
  ON CONFLICT(competition_id,student_id) DO UPDATE SET
    status='JOINED',
    excluded_at=NULL,
    excluded_by=NULL;

  RETURN jsonb_build_object('ok',true,'already_joined',false,'status','JOINED');
END;
$$;

CREATE OR REPLACE FUNCTION public.api_student_competition_memberships()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  v_auth uuid;
  v_student uuid;
BEGIN
  v_auth:=NULLIF(auth.user_id(),'')::uuid;
  SELECT id INTO v_student
  FROM public.students
  WHERE auth_user_id=v_auth AND is_active=true
  LIMIT 1;

  IF v_student IS NULL THEN RAISE EXCEPTION 'STUDENT_ACCOUNT_REQUIRED'; END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'competition_id',cp.competition_id,
      'joined_at',cp.joined_at,
      'status',COALESCE(cp.status,'JOINED')
    ) ORDER BY cp.joined_at DESC)
    FROM public.competition_participants cp
    WHERE cp.student_id=v_student
  ),'[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.api_student_competition_history()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  v_auth uuid;
  v_student uuid;
  v_school uuid;
BEGIN
  v_auth:=NULLIF(auth.user_id(),'')::uuid;

  SELECT id,school_id INTO v_student,v_school
  FROM public.students
  WHERE auth_user_id=v_auth AND is_active=true
  LIMIT 1;

  IF v_student IS NULL THEN RAISE EXCEPTION 'STUDENT_ACCOUNT_REQUIRED'; END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'competition_id',ca.id,
      'title_ar',ca.title_ar,
      'body_ar',ca.body_ar,
      'reward_ar',ca.reward_ar,
      'joined_at',cp.joined_at,
      'status',COALESCE(cp.status,'JOINED'),
      'winner_at',cp.winner_at
    ) ORDER BY cp.joined_at DESC)
    FROM public.competition_participants cp
    JOIN public.competition_announcements ca ON ca.id=cp.competition_id
    WHERE cp.student_id=v_student
      AND ca.school_id=v_school
  ),'[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.api_guardian_competition_history(
  p_student_no text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  v_student uuid;
  v_school uuid;
BEGIN
  SELECT id,school_id INTO v_student,v_school
  FROM public.students
  WHERE student_no=trim(COALESCE(p_student_no,'')) AND is_active=true
  LIMIT 1;

  IF v_student IS NULL THEN RAISE EXCEPTION 'STUDENT_NOT_FOUND'; END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'competition_id',ca.id,
      'title_ar',ca.title_ar,
      'body_ar',ca.body_ar,
      'reward_ar',ca.reward_ar,
      'joined_at',cp.joined_at,
      'status',COALESCE(cp.status,'JOINED'),
      'winner_at',cp.winner_at
    ) ORDER BY cp.joined_at DESC)
    FROM public.competition_participants cp
    JOIN public.competition_announcements ca ON ca.id=cp.competition_id
    WHERE cp.student_id=v_student
      AND ca.school_id=v_school
  ),'[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.api_admin_set_staff_vice_principal(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.api_admin_competition_participants(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.api_admin_set_competition_participant_status(uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.api_student_join_competition(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.api_student_competition_memberships() TO authenticated;
GRANT EXECUTE ON FUNCTION public.api_student_competition_history() TO authenticated;
GRANT EXECUTE ON FUNCTION public.api_guardian_competition_history(text) TO anonymous,authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
