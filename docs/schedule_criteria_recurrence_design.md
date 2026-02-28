# 기준내용 반복(Recurrence) 기능 설계

기준내용에 **시작일·종료일**과 함께 **구글 캘린더 스타일 반복**을 저장하기 위한 데이터 구조와 구현 방안입니다.

---

## 1. 반복 유형 요약

| 유형(UI) | 설명 | 저장 시 의미 |
|----------|------|----------------|
| **매일** | 매일 반복 | interval=1, frequency=daily |
| **1주 마다 [요일]** | 매주 선택한 요일 | frequency=weekly, interval=1, byWeekday=[n] |
| **2주 마다 [요일들]** | 2주마다 선택한 요일 | frequency=weekly, interval=2, byWeekday=[n,m] |
| **월 단위** | 매월 같은 날(또는 마지막 날 등) | frequency=monthly |
| **년 1회** | 1년에 한 번 (특정 월·일) | frequency=yearly |

---

## 2. 저장 형식 추천: 단순 JSON (커스텀)

표준 **iCalendar RRULE(RFC 5545)** 도 가능하지만, 한국어 UI와 단순한 유형만 쓰는 경우 **직접 정의한 JSON**이 구현·확장이 쉽습니다.

### 2.1 기준 1건당 criterias JSON 구조 (제안)

현재 한 기준(criteria)의 `criterias`가 **배열**이고, 첫 항목에 `name`, `start_date`, `end_date`를 쓰고 있다고 가정하면, **반복 정보**를 같은 항목에 넣습니다.

```json
[
  {
    "name": "예방접종 일정",
    "start_date": "2025-03-01",
    "end_date": "2026-02-28",
    "recurrence": {
      "frequency": "weekly",
      "interval": 1,
      "by_weekday": [1, 3, 5]
    }
  }
]
```

- **반복 없음**: `recurrence` 없음 또는 `null` → 기존처럼 시작일~종료일만 기간으로 해석.
- **반복 있음**: `recurrence` 객체로 유형·주기·요일/일 등 지정.

### 2.2 recurrence 객체 상세

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `frequency` | `"daily"` \| `"weekly"` \| `"monthly"` \| `"yearly"` | O | 반복 주기 |
| `interval` | number | 기본 1 | N주마다 / N개월마다 등 (주·월에만 의미 있음) |
| `by_weekday` | number[] | 주간일 때 권장 | 요일: 0=일, 1=월, …, 6=토 (ISO: 1=월~7=일로 할 수도 있음) |
| `by_month_day` | number \| null | 월/년일 때 | 월 중 날짜(1–31). null이면 “매월 같은 날”은 start_date의 일 사용 |
| `by_month` | number \| null | 년 1회 | 1–12. null이면 start_date의 월 사용 |

**예시**

- **매일**  
  `{ "frequency": "daily" }`
- **1주 마다 월·수·금**  
  `{ "frequency": "weekly", "interval": 1, "by_weekday": [1, 3, 5] }`
- **2주 마다 월·목**  
  `{ "frequency": "weekly", "interval": 2, "by_weekday": [1, 4] }`
- **월 단위 (매월 같은 날)**  
  `{ "frequency": "monthly" }`  
  → 실제 날짜는 `start_date`의 “일”을 매월 적용 (예: 15일이면 매월 15일).
- **년 1회**  
  `{ "frequency": "yearly" }`  
  → `start_date`의 월·일을 매년 적용.

요일을 **ISO(1=월 ~ 7=일)** 로 할 경우:  
`by_weekday: [1, 3, 5]` = 월, 수, 금.  
JavaScript `Date.getDay()`는 0=일~6=토이므로, UI에서 “요일 선택” 시 0~6을 쓰면 그대로 저장하거나, 저장 시 1~7로 변환해 두는 규칙만 통일하면 됩니다.

---

## 3. DB/API 변경

- **DB**: `schedule_criterias.criterias`는 이미 JSON/JSONB이므로 **스키마 변경 없이** 위 구조를 넣으면 됩니다.
- **API**:  
  - 기준 수정/생성 시 `criterias` 배열의 항목에 `recurrence` 포함해 전달.  
  - 기존 `start_date`, `end_date`는 “반복 기간”의 시작/끝으로 유지.

---

## 4. 프론트 UI 제안

1. **기준내용 패널**  
   - 기존: 시작일, 종료일 입력  
   - 추가: **반복** 드롭다운(또는 라디오)  
     - 반복 없음  
     - 매일  
     - 1주 마다 (요일 선택: 체크박스 7개)  
     - 2주 마다 (요일 선택)  
     - 월 단위  
     - 년 1회  

2. **반복 유형별 입력**  
   - 주간: “몇 주마다”(1 or 2) + “요일”(다중 선택).  
   - 월/년: 별도 “날짜” 입력 없이 `start_date`의 일/월·일 재사용 가능.  
   - 필요하면 “반복 종료일”은 기존 `end_date`로 통일.

3. **저장**  
   - 선택된 기준에 대해 `updateScheduleCriteria(id, { criterias: [{ name, start_date, end_date, recurrence }] })` 형태로 한 번에 저장.

---

## 5. 실제 일정 날짜 계산(캘린더/리스트용)

반복 규칙을 “특정 기간 내 실제 날짜 목록”으로 바꿀 때는:

- **직접 구현**:  
  `start_date`~`end_date` 사이에서 `frequency`/`interval`/`by_weekday` 등에 따라 루프 돌며 날짜 생성.
- **라이브러리 사용**:  
  **rrule.js** 같은 RRULE 라이브러리를 쓰면, 위 JSON을 RRULE 문자열로 변환한 뒤 `rrule.options` 또는 `rrule.after()/before()`로 날짜를 생성할 수 있습니다.  
  처음에는 JSON만 저장하고, 나중에 “캘린더 뷰”를 넣을 때 RRULE 변환 + rrule.js 도입을 검토해도 됩니다.

---

## 6. 요약 권장 사항

- **저장**: `schedule_criterias.criterias` 배열 첫 항목에  
  `start_date`, `end_date`, **`recurrence`** (optional)  
  를 두는 **단순 JSON** 구조를 추천합니다.
- **반복 유형**:  
  매일 / 1주마다(요일) / 2주마다(요일) / 월 단위 / 년 1회  
  만 지원해도 구글 캘린더와 유사한 사용자 경험을 줄 수 있습니다.
- **구현 순서 제안**:  
  1) `recurrence` 타입·JSON 스키마 정의  
  2) 기준내용 UI에 “반복” 선택 + 유형별 입력  
  3) 저장/로드 시 `recurrence` 포함  
  4) (선택) 캘린더/리스트에서 실제 날짜 계산 시 rrule.js 또는 자체 루프로 확장  

원하시면 다음 단계로 `recurrence` 타입 정의(TypeScript)와 기준내용 폼 필드 예시 코드를 구체적으로 적어 드리겠습니다.
