# 기초 일정(criteria_content JSONB) → 농장 일정 등록 시 권장 사항

## 현재 구조 요약

| 구분 | 테이블 | 역할 |
|------|--------|------|
| 전역 마스터 | **schedule_work_plans** | 시설·구분·작업유형·기준 ID + **criteria_content(JSONB)** |
| 농장별 실제 일정 | **farm_schedule_work_plans** | farmId, farmScheduleItemId, plannedStartDate, plannedEndDate 등 |

- **기초 일정 저장** 시: `schedule_work_plans`에 한 행 INSERT (criteria_content에 유형·시작일/종료일·요일 등 저장).
- **농장 일정 등록** 시(현재): `POST /api/farms/:farmId/schedule-work-plans`는 **farmScheduleItemId + plannedStartDate/EndDate**만 받아서 `farm_schedule_work_plans`에 INSERT. **schedule_work_plans / criteria_content는 아직 사용하지 않음.**

---

## 결론: JSONB 유지해도 문제 없음 (추천)

- **criteria_content를 JSONB 한 컬럼에 두는 현재 방식**으로, 차후 “기초 일정 → 농장 일정 스캐줄로 등록”할 때도 **문제 없고, 그대로 두는 것을 추천**합니다.
- 이 경우 **테이블 구조 변경은 필요 없습니다.**

### 이유

1. **해석 로직은 서버/클라이언트에서만 필요**  
   농장 일정으로 등록할 때는 “기간(from~to) + criteria_content”를 받아서, 그 기간 안에 해당하는 **구체적인 날짜들**을 계산해 `farm_schedule_work_plans`에 넣으면 됩니다. 이건 애플리케이션 코드에서 JSON을 파싱해 처리하면 되고, DB 스키마를 바꿀 필요는 없습니다.

2. **유형이 고정·문서화되어 있음**  
   type이 `range` / `daily` / `weekly` / `weekend` / `monthly` / `yearly`로 정해져 있고, type별 필드도 문서(`schedule_work_plans_table_redesign.md` 등)에 정의되어 있어, JSONB 하나로 충분히 다루기 좋습니다.

3. **정규화하면 오히려 복잡해짐**  
   criteria_content를 테이블로 쪼개면 type별로 nullable 컬럼이 많아지거나, 한 기초 일정이 여러 행으로 나가서 JOIN/조회가 복잡해집니다. “기준 1개 = 유형 1개 + 그에 따른 값” 구조라면 JSONB 한 컬럼이 더 단순합니다.

4. **확장성**  
   나중에 type을 추가하거나 필드를 살짝 바꿔도 JSONB는 스키마 변경 없이 대응 가능합니다.

---

## 차후 “기초 일정 → 농장 일정” 연동 시 할 일

테이블 구조 변경 없이, **로직만 추가**하면 됩니다.

1. **날짜 생성 함수**  
   - 입력: `criteria_content`(JSON), 기간 `from`, `to` (날짜).  
   - 출력: 해당 조건에 맞는 **날짜 목록** (또는 (plannedStartDate, plannedEndDate) 쌍).  
   - 예:  
     - `range` → start_date ~ end_date를 기간과 겹치는 구간으로.  
     - `daily` → from~to 매일.  
     - `weekly` → by_weekday 요일만, interval 주기 반영.  
     - `monthly` → 매월 day_of_month.  
     - `yearly` → 매년 month/day.

2. **농장 일정 등록 API/플로우**  
   - 예: “기초 일정에서 가져오기” 시 `schedule_work_plans.id`(또는 선택한 행) + 농장 기간(from~to)을 넘기면,  
   - 서버에서 해당 행의 `criteria_content`를 읽어 위 날짜 생성 함수로 날짜를 구한 뒤,  
   - 각 날짜(또는 구간)마다 `farm_schedule_work_plans`에 INSERT (farmId, farmScheduleItemId, plannedStartDate, plannedEndDate 등).  
   - 이때 **farmScheduleItemId**는 기초 일정의 시설·구분·작업유형·기준에 맞는 농장의 `farm_schedule_items`를 매핑하는 규칙이 필요할 수 있습니다(이 부분은 농장/시설 구조에 따라 설계).

3. **DB는 그대로**  
   - `schedule_work_plans.criteria_content`는 계속 JSONB로 두고, 위 로직에서만 읽어서 사용하면 됩니다.

---

## 테이블 구조를 바꾸는 경우 (선택)

다음과 같은 요구가 있을 때만 고려하면 됩니다.

- **criteria_content를 SQL만으로 자주 조회/집계**해야 하고, type별 조건이 복잡한 경우  
  → JSONB에 **GIN 인덱스**를 걸어 두고, `criteria_content->>'type'` 등으로 필터링하는 정도로도 충분한 경우가 많습니다.  
  → 예: `CREATE INDEX idx_swp_criteria_type ON schedule_work_plans ((criteria_content->>'type'));`

- **한 기초 일정에 “기준내용”이 여러 개**인 구조로 바꾸는 경우  
  (예: 하나의 기초 일정에 range 여러 개, weekly 여러 개 등)  
  → 그때는 `criteria_content`를 JSON 배열로 두거나, `schedule_work_plan_criteria_dates` 같은 별도 테이블을 검토할 수 있습니다.  
  → 현재는 “기준 1개 = 유형 1개”이므로 **지금 구조로는 불필요**합니다.

---

## 요약

| 질문 | 답변 |
|------|------|
| criteria_content를 JSONB로 두어도 농장 일정 스캐줄 등록 시 문제 있나? | **없음. 현재 구조 유지해도 됨.** |
| 테이블 구조 변경이 필요한가? | **필요 없음.** JSONB 유지 + 차후 연동 시 “날짜 생성 로직 + farm_schedule_work_plans INSERT”만 추가하면 됨. |
| 선택 사항 | type으로 자주 검색하면 `(criteria_content->>'type')` 등에 GIN 인덱스 추가 검토. |

위와 같이 **criteria_content(유형·시작일/종료일·요일 등) JSONB 저장은 그대로 두고**, 농장 일정 등록 시에는 이 JSON을 읽어 날짜를 계산한 뒤 `farm_schedule_work_plans`에만 넣는 방식으로 가면 됩니다.
