-- 레거시 농장 일정 테이블 정리 스크립트
-- 대상:
--   f_schedule_* / form_schedule_* / farm_schedule_*_master
-- 주의:
-- - 현재 구조는 schedule_* + farmId + is_deleted 통합 모델입니다.
-- - 실행 전 백업 권장.
--
-- 실행:
--   node scripts/run_sql.js scripts/drop_legacy_farm_schedule_tables.sql

DO $$
BEGIN
  -- f_schedule_* (신규 복제 방식)
  EXECUTE 'DROP TABLE IF EXISTS f_schedule_work_plans CASCADE';
  EXECUTE 'DROP TABLE IF EXISTS f_schedule_criterias CASCADE';
  EXECUTE 'DROP TABLE IF EXISTS f_schedule_jobtypes CASCADE';
  EXECUTE 'DROP TABLE IF EXISTS f_schedule_sortations CASCADE';
  EXECUTE 'DROP TABLE IF EXISTS f_schedule_criteria_definitions CASCADE';
  EXECUTE 'DROP TABLE IF EXISTS f_schedule_jobtype_definitions CASCADE';
  EXECUTE 'DROP TABLE IF EXISTS f_schedule_sortation_definitions CASCADE';

  -- form_schedule_* (구버전 복제 방식)
  EXECUTE 'DROP TABLE IF EXISTS form_schedule_work_plans CASCADE';
  EXECUTE 'DROP TABLE IF EXISTS form_schedule_criterias CASCADE';
  EXECUTE 'DROP TABLE IF EXISTS form_schedule_jobtypes CASCADE';
  EXECUTE 'DROP TABLE IF EXISTS form_schedule_sortations CASCADE';
  EXECUTE 'DROP TABLE IF EXISTS form_schedule_criteria_definitions CASCADE';
  EXECUTE 'DROP TABLE IF EXISTS form_schedule_jobtype_definitions CASCADE';
  EXECUTE 'DROP TABLE IF EXISTS form_schedule_sortation_definitions CASCADE';

  -- farm_schedule_*_master (초기 농장 마스터 분리 방식)
  EXECUTE 'DROP TABLE IF EXISTS farm_schedule_work_plans_master CASCADE';
  EXECUTE 'DROP TABLE IF EXISTS farm_schedule_criterias CASCADE';
  EXECUTE 'DROP TABLE IF EXISTS farm_schedule_jobtypes CASCADE';
  EXECUTE 'DROP TABLE IF EXISTS farm_schedule_sortations CASCADE';
  EXECUTE 'DROP TABLE IF EXISTS farm_schedule_criteria_definitions CASCADE';
  EXECUTE 'DROP TABLE IF EXISTS farm_schedule_jobtype_definitions CASCADE';
  EXECUTE 'DROP TABLE IF EXISTS farm_schedule_sortation_definitions CASCADE';
END $$;

