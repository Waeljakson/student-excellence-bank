-- 2026-10-05
-- Bridge the per-school student-exit feature through long-lived cached admin RPCs.
-- This avoids dependency on Neon Data API discovering newly-created RPC names.

BEGIN;

CREATE OR REPLACE FUNCTION public.api_admin_point_rules()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $admin_point_rules_bridge$
DECLARE
  v_auth uuid;
  v_app uuid;
  v_school uuid;
  v_school_name text;
  v_enabled boolean:=false;
  v_rules jsonb;
  v_control jsonb;
BEGIN
  v_auth:=NULLIF(auth.user_id(),'')::uuid;

  SELECT au.id,au.school_id,s.name_ar
  INTO v_app,v_school,v_school_name
  FROM public.app_users au
  JOIN public.schools s ON s.id=au.school_id
  WHERE au.auth_user_id=v_auth AND au.is_active=true
  LIMIT 1;

  IF v_app IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id=v_app AND role IN ('SUPER_ADMIN','SCHOOL_ADMIN')
  ) THEN
    RAISE EXCEPTION 'SUPER_ADMIN_REQUIRED';
  END IF;

  SELECT COALESCE(fs.student_exit_enabled,false)
  INTO v_enabled
  FROM public.school_feature_settings fs
  WHERE fs.school_id=v_school;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id',pr.id,
        'name_ar',pr.name_ar,
        'description_ar',pr.description_ar,
        'points',pr.default_points,
        'is_mega',pr.is_mega,
        'is_active',pr.is_active
      )
      ORDER BY pr.sort_order,pr.name_ar
    ),
    '[]'::jsonb
  )
  INTO v_rules
  FROM public.point_rules pr
  WHERE pr.school_id=v_school;

  v_control:=jsonb_build_object(
    'id','00000000-0000-0000-0000-00000000e001',
    'name_ar','__STUDENT_EXIT_FEATURE__',
    'description_ar',v_school_name,
    'points',CASE WHEN COALESCE(v_enabled,false) THEN 1 ELSE 2 END,
    'is_mega',false,
    'is_active',true
  );

  RETURN v_rules || jsonb_build_array(v_control);
END;
$admin_point_rules_bridge$;

CREATE OR REPLACE FUNCTION public.api_admin_set_point_rule(
  p_rule_id uuid,
  p_points integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $admin_set_point_rule_bridge$
DECLARE
  v_auth uuid;
  v_app uuid;
  v_school uuid;
  v_school_name text;
  v_name text;
  v_enabled boolean;
  v_feature_id constant uuid:='00000000-0000-0000-0000-00000000e001'::uuid;
BEGIN
  v_auth:=NULLIF(auth.user_id(),'')::uuid;

  SELECT au.id,au.school_id,s.name_ar
  INTO v_app,v_school,v_school_name
  FROM public.app_users au
  JOIN public.schools s ON s.id=au.school_id
  WHERE au.auth_user_id=v_auth AND au.is_active=true
  LIMIT 1;

  IF v_app IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id=v_app AND role IN ('SUPER_ADMIN','SCHOOL_ADMIN')
  ) THEN
    RAISE EXCEPTION 'SUPER_ADMIN_REQUIRED';
  END IF;

  IF p_rule_id=v_feature_id THEN
    IF p_points NOT IN (1,2) THEN
      RAISE EXCEPTION 'FEATURE_TOGGLE_VALUE_INVALID';
    END IF;

    v_enabled:=(p_points=1);

    INSERT INTO public.school_feature_settings(
      school_id,student_exit_enabled,updated_at,updated_by
    ) VALUES(
      v_school,v_enabled,now(),v_app
    )
    ON CONFLICT (school_id) DO UPDATE
    SET student_exit_enabled=EXCLUDED.student_exit_enabled,
        updated_at=now(),
        updated_by=v_app;

    INSERT INTO public.audit_logs(
      school_id,actor_user_id,action,entity_type,entity_id,after_json
    ) VALUES(
      v_school,v_app,
      CASE WHEN v_enabled THEN 'ENABLE_STUDENT_EXIT_FEATURE' ELSE 'DISABLE_STUDENT_EXIT_FEATURE' END,
      'school_feature_settings',v_school::text,
      jsonb_build_object(
        'student_exit_enabled',v_enabled,
        'school_name',v_school_name,
        'source','api_admin_set_point_rule_bridge'
      )
    );

    RETURN jsonb_build_object(
      'ok',true,
      'feature','student_exit',
      'school_id',v_school,
      'school_name',v_school_name,
      'student_exit_enabled',v_enabled
    );
  END IF;

  IF p_points IS NULL OR p_points<1 OR p_points>100 THEN
    RAISE EXCEPTION 'POINT_VALUE_RANGE';
  END IF;

  UPDATE public.point_rules
  SET default_points=p_points,min_points=p_points,max_points=p_points
  WHERE id=p_rule_id AND school_id=v_school
  RETURNING name_ar INTO v_name;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'RULE_NOT_FOUND';
  END IF;

  RETURN jsonb_build_object(
    'ok',true,
    'rule_id',p_rule_id,
    'name_ar',v_name,
    'points',p_points
  );
END;
$admin_set_point_rule_bridge$;

GRANT EXECUTE ON FUNCTION public.api_admin_point_rules() TO authenticated;
GRANT EXECUTE ON FUNCTION public.api_admin_set_point_rule(uuid,integer) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst','reload schema');
