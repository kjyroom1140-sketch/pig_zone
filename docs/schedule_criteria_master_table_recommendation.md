# 기준 정의 마스터 테이블 (테이블 구조)

## 목적

이 테이블은 **기준내용에 대한 표현 방법**을 정의해 두는 곳입니다.  
각 행 = 하나의 “기준 정의”로, **어떤 이름으로 보여 줄지**(`name`)와 **기준내용을 어떤 형태로 입력/표시할지**(`content_type`)를 저장합니다.

---

## 테이블 구조

**테이블명**: `schedule_criteria_definitions`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | SERIAL PRIMARY KEY | PK |
| name | VARCHAR(200) NOT NULL | 표시 이름 (예: 출생일(일령), 횟수, 매일, 주말) |
| content_type | VARCHAR(50) NOT NULL | 기준내용 **표현 방법** (range, count, daily, weekend, monthly, yearly, weekly). 어떤 입력/표시 형태를 쓸지 결정. — `schedule_criteria_content_type_design.md` 참고 |
| sort_order | INTEGER DEFAULT 0 | 정렬 순서 (관리 화면·선택 목록 노출 순) |
| "createdAt" | TIMESTAMPTZ | |
| "updatedAt" | TIMESTAMPTZ | |

