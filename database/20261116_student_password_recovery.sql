-- 2026-11-16: authorized admin lookup for student password recovery.
CREATE OR REPLACE FUNCTION public.api_admin_student_auth_target(p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $function$
DECLARE
  v_auth uuid;
  v_user uuid;
  v_school uuid;
  v_student record;
  v_allowed boolean:=false;
BEGIN
  v_auth:=NULLIF(NULLIF(auth.user_id(),''),'anonymous')::uuid;
  IF v_auth IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  SELECT id,school_id INTO v_user,v_school
  FROM public.app_users
  WHERE auth_user_id=v_auth AND is_active=true
  LIMIT 1;

  IF v_user IS NULL THEN RAISE EXCEPTION 'APP_USER_REQUIRED'; END IF;

  v_allowed:=EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id=v_user
      AND role IN ('SUPER_ADMIN','SCHOOL_ADMIN','PRINCIPAL','GUIDANCE_COUNSELOR')
  );
  IF NOT v_allowed THEN RAISE EXCEPTION 'STUDENT_PASSWORD_RESET_FORBIDDEN'; END IF;

  SELECT id,student_no,full_name_ar,auth_user_id
  INTO v_student
  FROM public.students
  WHERE id=p_student_id AND school_id=v_school AND is_active=true
  LIMIT 1;

  IF v_student.id IS NULL THEN RAISE EXCEPTION 'STUDENT_NOT_FOUND'; END IF;

  RETURN jsonb_build_object(
    'student_id',v_student.id,
    'student_no',v_student.student_no,
    'student_name',v_student.full_name_ar,
    'auth_user_id',v_student.auth_user_id,
    'claimed',(v_student.auth_user_id IS NOT NULL)
  );
END
$function$;
