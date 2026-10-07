-- 2026-10-07
-- Behavioral Excellence winners receive +20 excellence points exactly once per cycle.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS wallet_behavioral_winner_bonus_once_idx
ON public.wallet_transactions(student_id,reference_type,reference_id)
WHERE reference_type='BEHAVIORAL_EXCELLENCE_WINNER';

CREATE OR REPLACE FUNCTION public.award_behavioral_excellence_winner_bonus()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $behavioral_winner_bonus$
BEGIN
  INSERT INTO public.wallet_transactions(
    school_id,
    student_id,
    transaction_type,
    points_delta,
    actor_user_id,
    reference_type,
    reference_id,
    note
  )
  VALUES(
    NEW.school_id,
    NEW.student_id,
    'BONUS',
    20,
    NEW.published_by,
    'BEHAVIORAL_EXCELLENCE_WINNER',
    NEW.cycle_id,
    'مكافأة الفوز في برنامج التميز السلوكي — 20 نقطة تميز'
  )
  ON CONFLICT (student_id,reference_type,reference_id)
    WHERE reference_type='BEHAVIORAL_EXCELLENCE_WINNER'
  DO NOTHING;

  RETURN NEW;
END;
$behavioral_winner_bonus$;

DROP TRIGGER IF EXISTS behavioral_excellence_winner_bonus_trg
ON public.behavioral_excellence_winners;

CREATE TRIGGER behavioral_excellence_winner_bonus_trg
AFTER INSERT ON public.behavioral_excellence_winners
FOR EACH ROW
EXECUTE FUNCTION public.award_behavioral_excellence_winner_bonus();

-- Backfill already-published winners.
INSERT INTO public.wallet_transactions(
  school_id,
  student_id,
  transaction_type,
  points_delta,
  actor_user_id,
  reference_type,
  reference_id,
  note
)
SELECT
  w.school_id,
  w.student_id,
  'BONUS',
  20,
  w.published_by,
  'BEHAVIORAL_EXCELLENCE_WINNER',
  w.cycle_id,
  'مكافأة الفوز في برنامج التميز السلوكي — 20 نقطة تميز'
FROM public.behavioral_excellence_winners w
WHERE NOT EXISTS(
  SELECT 1
  FROM public.wallet_transactions wt
  WHERE wt.student_id=w.student_id
    AND wt.reference_type='BEHAVIORAL_EXCELLENCE_WINNER'
    AND wt.reference_id=w.cycle_id
)
ON CONFLICT (student_id,reference_type,reference_id)
  WHERE reference_type='BEHAVIORAL_EXCELLENCE_WINNER'
DO NOTHING;

COMMIT;

NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst','reload schema');
