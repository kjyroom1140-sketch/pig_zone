-- sortation 테이블을 schedule_sortation_definitions 로 이름 변경 (이전 이름으로 복원)
-- 실행: 이미 sortation 으로 변경된 DB를 이전 테이블명으로 되돌릴 때 사용

ALTER TABLE IF EXISTS sortation RENAME TO schedule_sortation_definitions;
