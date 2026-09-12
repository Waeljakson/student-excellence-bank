-- Secure one-time bootstrap for the first system administrator.
-- Uses an advisory transaction lock to prevent two users claiming the role at the same time.

CREATE OR REPLACE FUNCTION claim_first_super_admin(p_auth_user_id uuid, p_email text, p_name text)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_school_id uuid;
  v_user_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('mishkat-excellence-first-admin'));

  IF EXISTS (
    SELECT 1
    FROM user_roles
    WHERE role = 'SUPER_ADMIN'::app_role
  ) THEN
    RAISE EXCEPTION 'تم تفعيل مدير النظام الأول مسبقًا';
  END IF;

  SELECT id INTO v_school_id
  FROM schools
  WHERE code = 'MISHKAT'
  LIMIT 1;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'المدرسة غير مهيأة في قاعدة البيانات';
  END IF;

  INSERT INTO app_users(school_id, auth_user_id, full_name_ar, email, is_active)
  VALUES(
    v_school_id,
    p_auth_user_id,
    COALESCE(NULLIF(BTRIM(p_name), ''), NULLIF(BTRIM(p_email), ''), 'مدير النظام'),
    NULLIF(BTRIM(p_email), ''),
    true
  )
  ON CONFLICT (auth_user_id)
  DO UPDATE SET
    full_name_ar = EXCLUDED.full_name_ar,
    email = COALESCE(EXCLUDED.email, app_users.email),
    is_active = true,
    updated_at = now()
  RETURNING id INTO v_user_id;

  INSERT INTO user_roles(user_id, role)
  VALUES(v_user_id, 'SUPER_ADMIN'::app_role)
  ON CONFLICT DO NOTHING;

  INSERT INTO audit_logs(school_id, actor_user_id, action, entity_type, entity_id, after_json)
  VALUES(
    v_school_id,
    v_user_id,
    'CLAIM_FIRST_SUPER_ADMIN',
    'app_user',
    v_user_id::text,
    jsonb_build_object('email', p_email)
  );

  RETURN v_user_id;
END;
$$;
