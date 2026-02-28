# 기준내용을 schedule_work_plans 한곳에 모아 저장하는 방법

기준 **정의**(이름, 소속 작업유형)는 `schedule_criterias`에 두고, **기준내용**(시작일·종료일·반복)은 `schedule_work_plans`에만 두어 한곳에서 관리하는 방식입니다.

---

## 1. 역할 분리

| 테이블 | 역할 | 저장 내용 |
|--------|------|-----------|
| **schedule_criterias** | 기준 **정의** | id, jobtype_id, 기준 **이름**(criterias JSON의 name), sort_order. **시작일·종료일·반복은 저장하지 않음.** |
| **schedule_work_plans** | 기초 일정 + **기준내용 일괄** | 시설·구분·작업유형·기준 참조 + **해당 기준에 대한 시작일·종료일·반복** |

→ 기준내용(언제, 얼마나 반복하는지)은 **schedule_work_plans** 한 테이블에만 둡니다.

---

## 2. schedule_work_plans 저장 구조 (제안)

한 행 = “어떤 시설·구분·작업유형·기준” 조합에 대한 **한 건의 기초 일정**이고, 그 **기준내용**을 같은 행에 담습니다.

### 2.1 컬럼 활용

- **structure_templates** (JSONB): 대상 시설(구조 템플릿) 참조
- **schedule_sortations** (JSONB): 구분 참조
- **schedule_jobtypes** (JSONB): 작업유형 참조
- **schedule_criterias** (JSONB): **기준 참조 + 이 plan에서 쓰는 기준내용**을 함께 저장
- **details** (JSONB): 반복 등 추가 상세(필요 시)

### 2.2 schedule_criterias 컬럼에 “참조 + 기준내용” 한꺼번에

`schedule_work_plans.schedule_criterias`에 “어떤 기준(id)을 쓰는지”와 “이 plan에서의 기준내용”을 같이 넣는 방식입니다.

```json
{
  "id": 5,
  "name": "예방접종 일정",
  "start_date": "2025-03-01",
  "end_date": "2026-02-28",
  "recurrence": {
    "frequency": "weekly",
    "interval": 1,
    "by_weekday": [1, 3, 5]
  }
}
```

- **id**: `schedule_criterias.id` (어떤 기준인지)
- **name**: 표시용(기준 이름)
- **start_date**, **end_date**, **recurrence**: **기준내용 전부** → 이 테이블에만 저장

한 plan이 기준 하나만 가리키는 경우는 위처럼 객체 1개, 여러 기준을 묶어 쓰는 경우는 배열로 확장 가능합니다.

```json
[
  { "id": 5, "name": "예방접종", "start_date": "2025-03-01", "end_date": "2026-02-28", "recurrence": { ... } },
  { "id": 7, "name": "검역", "start_date": "2025-04-01", "end_date": null, "recurrence": null }
]
```

---

## 3. schedule_criterias 테이블은 “정의만”

- **criterias** JSON: 이름만 저장 (기간·반복 제거)

```json
[{ "name": "예방접종 일정" }]
```

또는 이름을 컬럼으로 빼면:

```json
[]
```

- **기준 추가/수정**: 이름, jobtype_id, sort_order만 다룸.
- **기준내용 입력/수정**: UI에서는 “기준 선택 → 시작일·종료일·반복 입력” 후 **schedule_work_plans** 한 건을 생성/수정하는 흐름.

---

## 4. 장점

1. **한곳 조회**: 기준내용(시작일·종료일·반복)은 항상 `schedule_work_plans`만 보면 됨.
2. **같은 기준, 다른 내용**: 같은 기준(id)을 여러 plan에서 다른 기간·반복으로 쓸 수 있음 (plan별로 다른 start_date/end_date/recurrence).
3. **기준 정의와 사용 분리**: `schedule_criterias`는 “무슨 기준이 있는지”, `schedule_work_plans`는 “그 기준을 어떻게 쓸지”만 담당.

---

## 5. UI/API 흐름 요약

- **기준 목록**: `schedule_criterias` 조회 (이름, jobtype_id, sort_order).
- **기준내용 보기/저장**:
  - “시설·구분·작업유형·기준”을 선택한 뒤, 시작일·종료일·반복 입력.
  - 저장 시 **schedule_work_plans**에 행이 없으면 INSERT, 있으면 UPDATE.
  - 해당 행의 `schedule_criterias`(및 필요 시 details)에 위 JSON 형태로 기준 id + 기준내용 저장.
- **기초 일정 목록**: `schedule_work_plans` 조회 시 각 행에 기준내용이 이미 포함되므로 별도 조인 불필요.

---

## 6. 정리

- **기준내용(시작일·종료일·반복)은 schedule_work_plans 한곳에만** 두고,
- **schedule_work_plans.schedule_criterias**에 “기준 id/이름 + 이 plan에서의 기준내용(start_date, end_date, recurrence)”을 함께 저장하면,
- 기준 정의는 `schedule_criterias`, 기준내용은 `schedule_work_plans`로 깔끔히 나뉘고, 기준내용은 한 테이블에서만 관리할 수 있습니다.
