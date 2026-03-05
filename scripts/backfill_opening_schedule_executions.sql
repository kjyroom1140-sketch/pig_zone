-- 과거 opening 반영분을 schedule_executions(completed, opening_section)로 백필
-- 적용 전 DB 백업 권장

BEGIN;

-- 0) 자동 work plan 명칭 통일
UPDATE schedule_work_plans
SET work_content = '재고두수등록(초기값)',
    "updatedAt" = NOW()
WHERE work_content = '[AUTO] opening 초기값 저장'
  AND COALESCE(is_deleted, false) = false;

-- 1) farm별 자동 work plan 없으면 생성
WITH target_farms AS (
  SELECT DISTINCT sil.farm_id
  FROM section_inventory_ledger sil
  WHERE sil.ref_type = 'opening'
),
missing_farms AS (
  SELECT tf.farm_id
  FROM target_farms tf
  WHERE NOT EXISTS (
    SELECT 1
    FROM schedule_work_plans swp
    WHERE swp."farmId" = tf.farm_id
      AND COALESCE(swp.is_deleted, false) = false
      AND swp.work_content = '재고두수등록(초기값)'
  )
)
INSERT INTO schedule_work_plans (
  "farmId",
  structure_template_id,
  sortation_id,
  jobtype_id,
  criteria_id,
  criteria_content,
  work_content,
  sort_order,
  is_deleted,
  "createdAt",
  "updatedAt"
)
SELECT
  mf.farm_id,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '재고두수등록(초기값)',
  (
    SELECT COALESCE(MIN(swp2.sort_order), 0) - 1
    FROM schedule_work_plans swp2
    WHERE (swp2."farmId" = mf.farm_id OR swp2."farmId" IS NULL)
      AND COALESCE(swp2.is_deleted, false) = false
  ),
  false,
  NOW(),
  NOW()
FROM missing_farms mf;

-- 2) opening 원장 기준으로 섹션/일자 단위 집계
WITH opening_base AS (
  SELECT
    sil.farm_id,
    sil.section_id,
    sil.occurred_at::date AS entry_date,
    SUM(CASE WHEN sil.direction = 'IN' THEN sil.head_count ELSE 0 END)::int AS head_count
  FROM section_inventory_ledger sil
  WHERE sil.ref_type = 'opening'
  GROUP BY sil.farm_id, sil.section_id, sil.occurred_at::date
),
opening_with_work_plan AS (
  SELECT
    ob.farm_id,
    ob.section_id,
    ob.entry_date,
    ob.head_count,
    (
      SELECT swp.id
      FROM schedule_work_plans swp
      WHERE swp."farmId" = ob.farm_id
        AND COALESCE(swp.is_deleted, false) = false
        AND swp.work_content = '재고두수등록(초기값)'
      ORDER BY swp.id ASC
      LIMIT 1
    ) AS work_plan_id
  FROM opening_base ob
)
INSERT INTO schedule_executions (
  farm_id,
  work_plan_id,
  section_id,
  execution_type,
  scheduled_date,
  status,
  completed_at,
  completed_by,
  result_ref_type,
  result_ref_id,
  idempotency_key,
  memo,
  created_at,
  updated_at
)
SELECT
  owp.farm_id,
  owp.work_plan_id,
  owp.section_id,
  'inspection',
  owp.entry_date,
  'completed',
  NOW(),
  f."ownerId",
  'opening_section',
  owp.section_id,
  ('backfill-opening-section-' || owp.section_id::text || '-' || to_char(owp.entry_date, 'YYYYMMDD')),
  ('source=opening_backfill; entryDate=' || to_char(owp.entry_date, 'YYYY-MM-DD') || '; headCount=' || owp.head_count::text),
  NOW(),
  NOW()
FROM opening_with_work_plan owp
JOIN farms f
  ON f.id = owp.farm_id
WHERE owp.work_plan_id IS NOT NULL
  AND f."ownerId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM schedule_executions se
    WHERE se.farm_id = owp.farm_id
      AND se.section_id = owp.section_id
      AND se.scheduled_date = owp.entry_date
      AND se.result_ref_type = 'opening_section'
      AND se.status = 'completed'
  );

COMMIT;
