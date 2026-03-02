# schedule_work_plans 테이블 구조 변경 — 선택값 + 기준내용

사육시설·구분·작업유형·기준을 **각 컬럼에 선택한 값(ID)**으로 저장하고, **기준내용**은 유형(시작~종료일 / 매일 / 주말 / 월 / 년)에 따라 조건 선택 후 입력한 값을 **criteria_content** 한 컬럼에 저장하는 구조입니다.

**실행 순서:** DB에 새 컬럼을 추가한 뒤 앱을 사용하세요.  
`node scripts/run_sql.js scripts/schedule_work_plans_redesign_columns.sql` 실행 후 Go 서버·프론트를 띄우면 됩니다.

---

## 1. 변경 후 테이블 구조

| 컬럼명 | 타입 | NULL | 설명 |
|--------|------|------|------|
| **id** | SERIAL (INTEGER) | N (PK) | 기본키 |
| **structure_template_id** | INTEGER | Y | 사육시설 선택값 → structure_templates.id |
| **sortation_id** | INTEGER | Y | 구분 선택값 → schedule_sortations.id |
| **jobtype_id** | INTEGER | Y | 작업유형 선택값 → schedule_jobtypes.id |
| **criteria_id** | INTEGER | Y | 기준 선택값 → schedule_criterias.id |
| **criteria_content** | JSONB | Y | 기준내용 (유형별 시작·종료일, 매일/주말/월/년 조건 — 아래 2절) |
| **"createdAt"** | TIMESTAMPTZ | N | 생성 일시 |
| **"updatedAt"** | TIMESTAMPTZ | N | 수정 일시 |

기존 JSON 컬럼(structure_templates, schedule_sortations, schedule_criterias, schedule_jobtypes, details)은 마이그레이션 후 제거하거나, 과거 데이터 호환용으로 잠시 둘 수 있습니다.

---

## 2. criteria_content 저장 형식 (기준내용)

**type**으로 어떤 입력인지 구분하고, 나머지 필드는 type에 따라만 채우면 됩니다.

### 2.1 type: `"range"` — 시작일 ~ 종료일

```json
{
  "type": "range",
  "start_date": "2025-03-01",
  "end_date": "2026-02-28"
}
```

### 2.2 type: `"daily"` — 매일

```json
{
  "type": "daily",
  "start_date": "2025-03-01",
  "end_date": "2026-02-28"
}
```

- 기간 없이 “무한 매일”이면 start_date/end_date 생략 또는 null.

### 2.3 type: `"weekly"` — N주마다 특정 요일

```json
{
  "type": "weekly",
  "interval": 1,
  "by_weekday": [1, 3, 5],
  "start_date": "2025-03-01",
  "end_date": "2026-02-28"
}
```

- **by_weekday**: 0=일, 1=월, …, 6=토
- **interval**: 1=매주, 2=2주마다

### 2.4 type: `"weekend"` — 주말(토·일)

```json
{
  "type": "weekend",
  "start_date": "2025-03-01",
  "end_date": "2026-02-28"
}
```

- 내부적으로 by_weekday = [0, 6] 또는 [6, 0]으로 해석 가능.

### 2.5 type: `"monthly"` — 월 단위

```json
{
  "type": "monthly",
  "day_of_month": 15,
  "start_date": "2025-03-01",
  "end_date": "2026-12-31"
}
```

- **day_of_month**: 1~31. 매월 마지막 날이면 예: 31 또는 별도 값 `"last"` 사용 가능.

### 2.6 type: `"yearly"` — 년 1회

```json
{
  "type": "yearly",
  "month": 3,
  "day": 15
}
```

또는 한 날짜로만 저장:

```json
{
  "type": "yearly",
  "date": "03-15"
}
```

- **month**: 1~12, **day**: 1~31. 또는 **date**: "MM-DD".

---

## 3. UI 흐름 요약

1. **사육시설** 선택 → `structure_template_id` 저장  
2. **구분** 선택 → `sortation_id` 저장  
3. **작업유형** 선택 → `jobtype_id` 저장  
4. **기준** 선택 → `criteria_id` 저장  
5. **기준내용**  
   - 유형 선택: **시작~종료일** / **매일** / **주말** / **월** / **년**  
   - 선택한 유형에 맞게 입력 (시작·종료일, 요일, 일, 월 등)  
   → **criteria_content** JSON으로 저장  

---

## 4. 요약

- **선택값 4개**: 사육시설·구분·작업유형·기준 → 각각 **structure_template_id**, **sortation_id**, **jobtype_id**, **criteria_id** 컬럼에 ID로 저장.  
- **기준내용**: **criteria_content** (JSONB) 한 컬럼에, **type**으로 구분해  
  - 시작~종료일(**range**),  
  - **매일(daily)**,  
  - **주말(weekend)**,  
  - **월(monthly)**,  
  - **년(yearly)**  
  에 따라 위 형식으로 저장하면 됩니다.
