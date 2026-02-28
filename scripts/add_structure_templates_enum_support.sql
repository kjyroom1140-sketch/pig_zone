-- structure_templates.category enum에 'support' 값 추가
-- 오류: enum_structure_templates_category 열거형의 입력 값이 잘못됨: "support"
-- 위 오류가 날 때 이 스크립트를 DB에 실행하세요. (psql 또는 DB 클라이언트에서 실행)
-- PostgreSQL: enum에 값 추가. 한 번만 실행. 이미 있으면 "already exists" 오류는 무시.
ALTER TYPE enum_structure_templates_category ADD VALUE 'support';
