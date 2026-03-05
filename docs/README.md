# 설계 문서 목록

이 폴더의 모든 설계 문서 인덱스입니다.  
전체 프로젝트 문서는 루트의 [PROJECT.md](../PROJECT.md)를 참조하세요.

---

## 실행 가이드

| 문서 | 설명 |
|------|------|
| [RUN.md](RUN.md) | 서버 실행 방법 (HTTP/HTTPS, 포트 안내) |

---

## 데이터베이스 설계

| 문서 | 설명 |
|------|------|
| [FARM_TABLE_STRUCTURE.md](FARM_TABLE_STRUCTURE.md) | `farms` 테이블 전체 컬럼 정의 |
| [facility_structure_overview.md](facility_structure_overview.md) | 시설 구조 계층 (건물→동→방→칸) |
| [backend_jsonb_read_convention.md](backend_jsonb_read_convention.md) | JSONB 읽기/쓰기 컨벤션 |

---

## 일정 관리

| 문서 | 설명 |
|------|------|
| [일정관리_페이지_계획서.md](일정관리_페이지_계획서.md) | 일정 관리 기능 전체 계획 |
| [schedule_tables_structure.md](schedule_tables_structure.md) | 일정 관련 테이블 구조 요약 |
| [일정_칼럼_구조_정리.md](일정_칼럼_구조_정리.md) | 일정 컬럼 구조 |
| [schedule_add_documentation.md](schedule_add_documentation.md) | 예정 추가 API 문서 |
| [schedule_executions_rollout_checklist.md](schedule_executions_rollout_checklist.md) | 일정 실행 롤아웃 체크리스트 |
| [schedule_criteria_recurrence_design.md](schedule_criteria_recurrence_design.md) | 기준 반복 주기 설계 (미구현, 차후 예정) |
| [schedule_criteria_master_table_recommendation.md](schedule_criteria_master_table_recommendation.md) | 기준 마스터 테이블 권고안 |
| [schedule_work_plans_table_redesign.md](schedule_work_plans_table_redesign.md) | 작업계획 테이블 재설계 |
| [schedule_work_plans_table_columns.md](schedule_work_plans_table_columns.md) | 작업계획 테이블 컬럼 정의 |
| [schedule_work_plans_save_mapping.md](schedule_work_plans_save_mapping.md) | 작업계획 저장 데이터 매핑 |
| [schedule_work_plans_criteria_content_centralized.md](schedule_work_plans_criteria_content_centralized.md) | 기준 콘텐츠 중앙화 설계 |
| [일정마스터_이동_대상시설_추천.md](일정마스터_이동_대상시설_추천.md) | 이동 대상 시설 추천 로직 |

---

## 돈군·개체·재고 관리

| 문서 | 설명 |
|------|------|
| [돈군_개체_재고_MVP_기준서.md](돈군_개체_재고_MVP_기준서.md) | MVP 핵심 원칙 및 운영 기준 |
| [돈군_개체_재고_MVP_작업목록.md](돈군_개체_재고_MVP_작업목록.md) | MVP 구현 작업 목록 |
| [예정작업_등록_화면흐름_설계.md](예정작업_등록_화면흐름_설계.md) | 예정 작업 등록 화면 흐름 |
