-- Student referrals: optional WhatsApp contact lookup for a referral already
-- visible to the signed-in staff member. This does NOT send any message.
-- No bearer token, guardian portal link or medical/disciplinary notes are exposed.
CREATE OR REPLACE FUNCTION public.api_referral_whatsapp_contacts(p_referral_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO public,pg_temp
AS $function$
DECLARE
  v_auth uuid;
  v_user uuid;
  v_school uuid;
  v_student uuid;
  v_school_name text;
  v_student_name text;
  v_visible boolean := false;
  v_guardians jsonb := '[]'::jsonb;
BEGIN
  v_auth := NULLIF(NULLIF(auth.user_id(),''),'anonymous')::uuid;
  IF v_auth IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  SELECT au.id,au.school_id INTO v_user,v_school
  FROM public.app_users au
  WHERE au.auth_user_id=v_auth AND au.is_active=true
  LIMIT 1;
  IF v_user IS NULL THEN RAISE EXCEPTION 'APP_USER_REQUIRED'; END IF;

  -- Reuse the exact existing referrals visibility policy (teacher's own,
  -- assigned vice principal, or assigned guidance counsellor). Checking role
  -- labels alone here could reveal a different school's family contacts.
  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements(public.api_student_referrals('ALL')) AS x(referral)
    WHERE x.referral->>'id'=p_referral_id::text
  ) INTO v_visible;
  IF NOT v_visible THEN RAISE EXCEPTION 'REFERRAL_NOT_ACCESSIBLE'; END IF;

  SELECT r.student_id,school.name_ar,s.full_name_ar
  INTO v_student,v_school_name,v_student_name
  FROM public.student_referrals r
  JOIN public.students s ON s.id=r.student_id AND s.school_id=r.school_id AND s.is_active=true
  JOIN public.schools school ON school.id=r.school_id
  WHERE r.id=p_referral_id AND r.school_id=v_school AND r.archive_deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'REFERRAL_NOT_ACCESSIBLE'; END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',g.id,
      'name',g.full_name_ar,
      'mobile',g.mobile,
      'relationship',COALESCE(sg.relationship,''),
      'is_primary',sg.is_primary
    )
    ORDER BY sg.is_primary DESC,g.created_at,g.id
  ),'[]'::jsonb)
  INTO v_guardians
  FROM public.student_guardians sg
  JOIN public.guardians g ON g.id=sg.guardian_id AND g.school_id=v_school
  WHERE sg.student_id=v_student
    AND NULLIF(btrim(g.mobile),'') IS NOT NULL;

  RETURN jsonb_build_object(
    'school_name',v_school_name,
    'student_name',v_student_name,
    'guardians',v_guardians
  );
END
$function$;

REVOKE ALL ON FUNCTION public.api_referral_whatsapp_contacts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.api_referral_whatsapp_contacts(uuid) TO anonymous,authenticated;
