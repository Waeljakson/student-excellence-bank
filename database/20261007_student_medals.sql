-- 2026-10-07
-- Permanent student medals + 3-day celebration support.
-- Uses existing badges/student_badges as the canonical medal ledger.

BEGIN;

ALTER TABLE public.badges
  ADD COLUMN IF NOT EXISTS medal_kind text NOT NULL DEFAULT 'HONOR',
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS badges_school_source_unique
ON public.badges(school_id,source_type,source_id)
WHERE source_type IS NOT NULL AND source_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.ensure_student_medal(
  p_school_id uuid,
  p_student_id uuid,
  p_name_ar text,
  p_description_ar text,
  p_icon_key text,
  p_medal_kind text,
  p_source_type text,
  p_source_id uuid,
  p_awarded_by uuid,
  p_awarded_at timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $ensure_medal$
DECLARE
  v_badge uuid;
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM public.students s
    WHERE s.id=p_student_id AND s.school_id=p_school_id
  ) THEN
    RAISE EXCEPTION 'STUDENT_NOT_FOUND';
  END IF;

  SELECT b.id INTO v_badge
  FROM public.badges b
  WHERE b.school_id=p_school_id
    AND b.source_type=p_source_type
    AND b.source_id=p_source_id
  LIMIT 1;

  IF v_badge IS NULL THEN
    INSERT INTO public.badges(
      school_id,name_ar,description_ar,icon_key,is_active,
      medal_kind,source_type,source_id
    ) VALUES(
      p_school_id,
      COALESCE(NULLIF(trim(p_name_ar),''),'ميدالية تميز'),
      NULLIF(trim(COALESCE(p_description_ar,'')),''),
      COALESCE(NULLIF(trim(p_icon_key),''),'🏅'),
      true,
      COALESCE(NULLIF(trim(p_medal_kind),''),'HONOR'),
      p_source_type,
      p_source_id
    )
    ON CONFLICT (school_id,source_type,source_id)
      WHERE source_type IS NOT NULL AND source_id IS NOT NULL
    DO UPDATE SET
      name_ar=EXCLUDED.name_ar,
      description_ar=EXCLUDED.description_ar,
      icon_key=EXCLUDED.icon_key,
      medal_kind=EXCLUDED.medal_kind,
      is_active=true
    RETURNING id INTO v_badge;
  END IF;

  INSERT INTO public.student_badges(
    student_id,badge_id,awarded_by,awarded_at
  ) VALUES(
    p_student_id,v_badge,p_awarded_by,COALESCE(p_awarded_at,now())
  )
  ON CONFLICT(student_id,badge_id) DO NOTHING;

  RETURN v_badge;
END;
$ensure_medal$;

CREATE OR REPLACE FUNCTION public.student_medals_json(p_student_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $student_medals$
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',sb.id,
      'badge_id',b.id,
      'name_ar',b.name_ar,
      'description_ar',b.description_ar,
      'icon_key',COALESCE(NULLIF(b.icon_key,''),'🏅'),
      'medal_kind',COALESCE(b.medal_kind,'HONOR'),
      'source_type',b.source_type,
      'source_id',b.source_id,
      'awarded_at',sb.awarded_at
    )
    ORDER BY sb.awarded_at DESC,b.name_ar
  ),'[]'::jsonb)
  FROM public.student_badges sb
  JOIN public.badges b ON b.id=sb.badge_id
  WHERE sb.student_id=p_student_id
    AND b.is_active=true;
$student_medals$;

-- Behavioral Excellence: medal is created at winner publication.
CREATE OR REPLACE FUNCTION public.behavioral_winner_medal_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $behavioral_medal$
DECLARE
  v_title text;
BEGIN
  SELECT c.title_ar INTO v_title
  FROM public.behavioral_excellence_cycles c
  WHERE c.id=NEW.cycle_id;

  PERFORM public.ensure_student_medal(
    NEW.school_id,
    NEW.student_id,
    COALESCE(v_title,'التميز السلوكي'),
    'ميدالية التميز السلوكي — المركز '||NEW.grade_rank::text||' على مستوى الصف',
    '★',
    'BEHAVIORAL',
    'BEHAVIORAL_EXCELLENCE',
    NEW.cycle_id,
    NEW.published_by,
    NEW.published_at
  );
  RETURN NEW;
END;
$behavioral_medal$;

DROP TRIGGER IF EXISTS behavioral_winner_medal_trg
ON public.behavioral_excellence_winners;

CREATE TRIGGER behavioral_winner_medal_trg
AFTER INSERT ON public.behavioral_excellence_winners
FOR EACH ROW
EXECUTE FUNCTION public.behavioral_winner_medal_trigger();

-- Targeted competitions: award/revoke medal when winner status changes.
CREATE OR REPLACE FUNCTION public.competition_winner_medal_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $competition_medal$
DECLARE
  v_school uuid;
  v_title text;
  v_badge uuid;
BEGIN
  SELECT ca.school_id,ca.title_ar
  INTO v_school,v_title
  FROM public.competition_announcements ca
  WHERE ca.id=NEW.competition_id
    AND ca.deleted_at IS NULL
  LIMIT 1;

  IF v_school IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status='WINNER' AND (
    TG_OP='INSERT'
    OR OLD.status IS DISTINCT FROM 'WINNER'
    OR OLD.winner_at IS DISTINCT FROM NEW.winner_at
  ) THEN
    PERFORM public.ensure_student_medal(
      v_school,
      NEW.student_id,
      COALESCE(v_title,'مسابقة مدرسية'),
      'ميدالية الفوز في مسابقة «'||COALESCE(v_title,'مسابقة مدرسية')||'»',
      '🏆',
      'COMPETITION',
      'TARGETED_COMPETITION',
      NEW.competition_id,
      NEW.winner_by,
      NEW.winner_at
    );
  ELSIF TG_OP='UPDATE' AND OLD.status='WINNER' AND NEW.status<>'WINNER' THEN
    SELECT id INTO v_badge
    FROM public.badges
    WHERE school_id=v_school
      AND source_type='TARGETED_COMPETITION'
      AND source_id=NEW.competition_id
    LIMIT 1;

    IF v_badge IS NOT NULL THEN
      DELETE FROM public.student_badges
      WHERE student_id=NEW.student_id AND badge_id=v_badge;
    END IF;
  END IF;

  RETURN NEW;
END;
$competition_medal$;

DROP TRIGGER IF EXISTS competition_winner_medal_trg
ON public.competition_participants;

CREATE TRIGGER competition_winner_medal_trg
AFTER INSERT OR UPDATE OF status,winner_at,winner_by
ON public.competition_participants
FOR EACH ROW
EXECUTE FUNCTION public.competition_winner_medal_trigger();

-- Backfill all already-published behavioral winners using their original publication time.
DO $backfill_behavioral$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT w.*,c.title_ar
    FROM public.behavioral_excellence_winners w
    JOIN public.behavioral_excellence_cycles c ON c.id=w.cycle_id
  LOOP
    PERFORM public.ensure_student_medal(
      r.school_id,r.student_id,COALESCE(r.title_ar,'التميز السلوكي'),
      'ميدالية التميز السلوكي — المركز '||r.grade_rank::text||' على مستوى الصف',
      '★','BEHAVIORAL','BEHAVIORAL_EXCELLENCE',r.cycle_id,r.published_by,r.published_at
    );
  END LOOP;
END;
$backfill_behavioral$;

-- Backfill all current targeted-competition winners using their original winner time.
DO $backfill_competitions$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT cp.student_id,cp.competition_id,cp.winner_at,cp.winner_by,
           ca.school_id,ca.title_ar
    FROM public.competition_participants cp
    JOIN public.competition_announcements ca ON ca.id=cp.competition_id
    WHERE cp.status='WINNER'
      AND cp.winner_at IS NOT NULL
      AND ca.deleted_at IS NULL
  LOOP
    PERFORM public.ensure_student_medal(
      r.school_id,r.student_id,COALESCE(r.title_ar,'مسابقة مدرسية'),
      'ميدالية الفوز في مسابقة «'||COALESCE(r.title_ar,'مسابقة مدرسية')||'»',
      '🏆','COMPETITION','TARGETED_COMPETITION',r.competition_id,r.winner_by,r.winner_at
    );
  END LOOP;
END;
$backfill_competitions$;

-- Generic/manual honor path for academic excellence or any future school honoring.
CREATE OR REPLACE FUNCTION public.api_admin_award_student_medal(
  p_student_id uuid,
  p_title_ar text,
  p_description_ar text DEFAULT NULL,
  p_medal_kind text DEFAULT 'HONOR'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $manual_medal$
DECLARE
  v_auth uuid;
  v_actor uuid;
  v_school uuid;
  v_source uuid:=gen_random_uuid();
  v_badge uuid;
BEGIN
  v_auth:=NULLIF(auth.user_id(),'')::uuid;
  SELECT au.id,au.school_id INTO v_actor,v_school
  FROM public.app_users au
  WHERE au.auth_user_id=v_auth AND au.is_active=true
  LIMIT 1;

  IF v_actor IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id=v_actor
      AND ur.role IN ('SUPER_ADMIN','SCHOOL_ADMIN','GUIDANCE_COUNSELOR','PRINCIPAL')
  ) THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED';
  END IF;

  v_badge:=public.ensure_student_medal(
    v_school,p_student_id,p_title_ar,p_description_ar,
    CASE upper(COALESCE(p_medal_kind,'')) WHEN 'ACADEMIC' THEN '🎓' ELSE '🏅' END,
    upper(COALESCE(NULLIF(trim(p_medal_kind),''),'HONOR')),
    'MANUAL_HONOR',v_source,v_actor,now()
  );

  INSERT INTO public.audit_logs(
    school_id,actor_user_id,action,entity_type,entity_id,after_json
  ) VALUES(
    v_school,v_actor,'STUDENT_MEDAL_AWARDED','student',p_student_id::text,
    jsonb_build_object(
      'badge_id',v_badge,
      'title_ar',p_title_ar,
      'medal_kind',upper(COALESCE(NULLIF(trim(p_medal_kind),''),'HONOR'))
    )
  );

  RETURN jsonb_build_object('ok',true,'badge_id',v_badge,'awarded_at',now());
END;
$manual_medal$;

-- Student reads own permanent medals.
CREATE OR REPLACE FUNCTION public.api_student_medals()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $my_medals$
DECLARE
  v_auth uuid;
  v_student uuid;
BEGIN
  v_auth:=NULLIF(auth.user_id(),'')::uuid;
  SELECT s.id INTO v_student
  FROM public.students s
  WHERE s.auth_user_id=v_auth AND s.is_active=true
  LIMIT 1;

  IF v_student IS NULL THEN RAISE EXCEPTION 'STUDENT_ACCOUNT_REQUIRED'; END IF;
  RETURN public.student_medals_json(v_student);
END;
$my_medals$;

-- Guardian access follows the same three portal access modes:
-- token, student-number/school-code, or authenticated guardian.
CREATE OR REPLACE FUNCTION public.api_guardian_student_medals(
  p_student_id uuid,
  p_student_no text DEFAULT NULL,
  p_school_code text DEFAULT NULL,
  p_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $guardian_medals$
DECLARE
  v_auth uuid;
  v_allowed boolean:=false;
BEGIN
  IF p_student_id IS NULL THEN RAISE EXCEPTION 'STUDENT_NOT_FOUND'; END IF;

  IF NULLIF(trim(COALESCE(p_token,'')),'') IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1
      FROM public.guardian_access_links l
      JOIN public.student_guardians sg ON sg.guardian_id=l.guardian_id
      WHERE l.token=p_token
        AND l.is_active=true
        AND sg.student_id=p_student_id
    ) INTO v_allowed;
  ELSIF NULLIF(trim(COALESCE(p_student_no,'')),'') IS NOT NULL
    AND NULLIF(trim(COALESCE(p_school_code,'')),'') IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1
      FROM public.students s
      JOIN public.schools sch ON sch.id=s.school_id
      WHERE s.id=p_student_id
        AND s.is_active=true
        AND s.student_no=trim(p_student_no)
        AND upper(sch.code)=upper(trim(p_school_code))
    ) INTO v_allowed;
  ELSE
    v_auth:=NULLIF(auth.user_id(),'')::uuid;
    SELECT EXISTS(
      SELECT 1
      FROM public.guardians g
      JOIN public.student_guardians sg ON sg.guardian_id=g.id
      WHERE g.auth_user_id=v_auth
        AND sg.student_id=p_student_id
    ) INTO v_allowed;
  END IF;

  IF NOT v_allowed THEN RAISE EXCEPTION 'GUARDIAN_REQUIRED'; END IF;
  RETURN public.student_medals_json(p_student_id);
END;
$guardian_medals$;

GRANT EXECUTE ON FUNCTION public.api_admin_award_student_medal(uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.api_student_medals() TO authenticated;
GRANT EXECUTE ON FUNCTION public.api_guardian_student_medals(uuid,text,text,text) TO authenticated,anonymous;

COMMIT;

NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst','reload schema');
