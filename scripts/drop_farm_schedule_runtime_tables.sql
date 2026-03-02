-- (정리/삭제) 구버전 농장 일정 실행 테이블 제거
-- 대상:
--   farm_schedule_task_types
--   farm_schedule_basis_types
--   farm_schedule_items
--   farm_schedule_work_plans
--
-- 현재는 농장 일정 관리를 재설계 예정이며, UI(디자인)만 유지합니다.
--
-- 실행: node scripts/run_sql.js scripts/drop_farm_schedule_runtime_tables.sql

DO $$
BEGIN
  -- 참조 순서 고려: work_plans -> items -> basis/task
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='farm_schedule_work_plans') THEN
    EXECUTE 'DROP TABLE IF EXISTS farm_schedule_work_plans CASCADE';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='farm_schedule_items') THEN
    EXECUTE 'DROP TABLE IF EXISTS farm_schedule_items CASCADE';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='farm_schedule_basis_types') THEN
    EXECUTE 'DROP TABLE IF EXISTS farm_schedule_basis_types CASCADE';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='farm_schedule_task_types') THEN
    EXECUTE 'DROP TABLE IF EXISTS farm_schedule_task_types CASCADE';
  END IF;
END $$;

