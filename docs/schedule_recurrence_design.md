# 구글 캘린더식 반복 일정 구현 방안

매일·주간·월별 등 **반복 규칙**을 한 번 등록하면, 캘린더에서 **해당 기간의 실제 일정(발생)** 이 자동으로 쌓이도록 하는 기능 설계입니다.

---

## 0. 현재 테이블에 컬럼만 추가해 구현 가능한가? → **가능**

- **별도 테이블 없이** `schedule_items`에 **반복용 컬럼만 추가**하면 됩니다.
- 기존 행은 새 컬럼이 모두 null → “반복 없음”으로 처리하면 되고, 기존 API/화면은 그대로 둔 채 **반복 일정용 API·UI만 추가**하면 됩니다.
- **돼지 일정**(전입일+일수)은 지금처럼 `basisTypeId` + `dayMin`/`dayMax`만 쓰고, **시설 반복 일정**만 `recurrenceType` 등 새 컬럼을 채워서 사용하는 식으로 나누면 됩니다.

| 구분 | 사용하는 컬럼 | 비고 |
|------|----------------|------|
| 돼지 일정 (기존) | targetType, structureTemplateId, basisTypeId, dayMin, dayMax, taskTypeId, description … | recurrence* 는 null |
| 시설 반복 일정 (신규) | targetType=facility, structureTemplateId, taskTypeId, description + **recurrenceType, recurrenceStartDate** 등 | dayMin/dayMax 는 사용 안 해도 됨 |

---

## 1. 동작 방식 요약 (구글 캘린더와 동일 개념)

| 단계 | 설명 |
|------|------|
| **등록** | 사용자가 "매일", "매주 월요일", "매월 15일" 같은 **반복 규칙**과 제목·작업내용을 입력 |
| **저장** | DB에는 **규칙 1건**만 저장 (반복되는 일정을 매번 넣지 않음) |
| **표시** | 캘린더/목록을 볼 때 **조회 기간(start~end)** 을 넘기면, 서버가 규칙을 **해당 기간 안에서 확장**해 여러 개의 **발생(occurrence)** 으로 만들어 반환 |

즉, **반복 규칙 1개 → 기간별로 “가상의 일정” 여러 개**로 바꿔 주는 **확장(expand)** 단계가 필요합니다.

---

## 2. 데이터 구조 제안

### 2-1. 반복 규칙 저장 (schedule_items 확장)

현재 `schedule_items`는 **돼지 일정**(기준일+일수)과 **시설 일정**(매일/주 1회 등)을 함께 쓰고 있으므로, **같은 테이블에 반복용 컬럼만 추가**하는 방식을 추천합니다.

| 컬럼 (추가) | 타입 | 설명 |
|-------------|------|------|
| `recurrenceType` | VARCHAR(20) | `none` \| `daily` \| `weekly` \| `monthly` \| `yearly` |
| `recurrenceInterval` | INT | 간격 (예: 2 = 2주마다, 2달마다) 기본 1 |
| `recurrenceWeekdays` | VARCHAR(20) | 주간일 때 요일 (예: `1,3,5` = 월수금, 0=일요일) |
| `recurrenceMonthDay` | INT | 월간일 때 일(1~31). null이면 “매월 같은 요일” 등 다른 의미 가능 |
| `recurrenceEndDate` | DATE | 반복 종료일. null이면 무기한 |
| `recurrenceStartDate` | DATE | 반복 시작일 (해당 일부터 확장). null이면 생성일 등 사용 |

- **반복 없음**: `recurrenceType = 'none'` (또는 null). 기존처럼 **1회성** 일정.
- **매일**: `recurrenceType = 'daily'`, `recurrenceInterval = 1`
- **매주 월·목**: `recurrenceType = 'weekly'`, `recurrenceWeekdays = '1,4'` (요일 코드)
- **매월 15일**: `recurrenceType = 'monthly'`, `recurrenceMonthDay = 15`

시작/종료 **시간**이 필요하면 `startTime`, `endTime`(TIME) 컬럼을 추가해 같은 방식으로 확장 시 각 occurrence에 붙이면 됩니다.

### 2-2. 대안: RRULE 문자열 하나로 저장

표준 **iCal RRULE**을 쓰고 싶다면:

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `recurrenceRule` | TEXT | 예: `FREQ=WEEKLY;BYDAY=MO,TH;INTERVAL=1` |

- 장점: 표준이고, 라이브러리(`rrule` 등)로 파싱·확장 가능  
- 단점: 직접 다루기 어렵고, UI에서 “매주 월·목”처럼 고르게 하려면 RRULE↔UI 변환 필요

**추천**: 먼저는 **2-1처럼 단순 컬럼**으로 구현하고, 나중에 규칙이 복잡해지면 RRULE 컬럼을 추가해 혼용해도 됩니다.

---

## 3. “확장(Expand)” 로직

**입력**
- 반복 규칙 1건 (위 컬럼들)
- 조회 기간: `rangeStart` (Date), `rangeEnd` (Date)

**출력**
- 해당 기간에 걸치는 **발생(occurrence)** 배열. 각 항목은 `{ date, scheduleItemId, title, ... }` 형태.

**알고리즘 개요**
1. `recurrenceType === 'none'`(또는 null)이면:  
   `recurrenceStartDate`(또는 일정의 단일 날짜)가 range 안에 있으면 1건만 반환.
2. **daily**: `recurrenceStartDate`부터 `recurrenceEndDate`(또는 rangeEnd)까지 `recurrenceInterval`일마다 날짜 생성 → range와 겹치는 것만 반환.
3. **weekly**: 시작일부터 주 단위로 진행, `recurrenceWeekdays`에 해당하는 요일만 날짜 생성 → range와 겹치는 것만 반환.
4. **monthly**: 매월 `recurrenceMonthDay`일(또는 “N째 주 요일”)에 해당하는 날짜 생성 → range와 겹치는 것만 반환.
5. **yearly**: 매년 같은 월·일 생성 → range와 겹치는 것만 반환.

요일은 **0=일, 1=월, …, 6=토** 등 한 가지 체계로 통일해 두는 것이 좋습니다.

---

## 4. API 설계 예시

### 4-1. “기간별 발생 목록” API (캘린더/목록용)

```
GET /api/scheduleItems/occurrences?start=2025-02-01&end=2025-02-28
```

- `start`, `end`: 조회 기간 (YYYY-MM-DD).
- **처리**:  
  - 반복 있는 일정: 위 **확장 로직**으로 해당 기간의 발생만 생성.  
  - 반복 없는 일정: `recurrenceStartDate`(또는 단일 날짜)가 기간 안에 있으면 1건 포함.  
- **응답**:  
  - `{ occurrences: [ { id, date, scheduleItemId, targetType, structureName, taskTypeName, description, ... } ] }`  
  - `id`는 “가상 id” (예: `scheduleItemId + date` 조합)로 중복 없게.

이 API가 **구글 캘린더처럼 “화면에 그리는 일정”** 역할을 합니다.

### 4-2. 기존 “템플릿 목록” API 유지

```
GET /api/scheduleItems
```

- 지금처럼 **반복 규칙(템플릿)** 목록만 반환.  
- “일정 관리 설정” 화면에서는 이걸 그대로 쓰면 됩니다.

정리하면,
- **설정 화면**: `GET /api/scheduleItems` → 반복 규칙 CRUD.
- **캘린더/일정 보기**: `GET /api/scheduleItems/occurrences?start=&end=` → 기간별로 **자동 반복 확장된 일정** 사용.

---

## 5. 구현 단계 제안

| 단계 | 내용 |
|------|------|
| **1. DB** | `schedule_items`에 `recurrenceType`, `recurrenceInterval`, `recurrenceWeekdays`, `recurrenceMonthDay`, `recurrenceStartDate`, `recurrenceEndDate` 추가 (마이그레이션). |
| **2. 확장 유틸** | `expandRecurrence(scheduleItem, rangeStart, rangeEnd)` 함수 구현 (daily → weekly → monthly 순). |
| **3. API** | `GET /api/scheduleItems/occurrences?start=&end=` 추가. 내부에서 반복 있는 항목은 확장, 없는 항목은 단일 날짜만 넣어서 반환. |
| **4. UI (등록)** | 일정 추가/수정 폼에 “반복” 선택: 없음 / 매일 / 매주(요일 선택) / 매월(일 선택) 등. 선택에 따라 위 컬럼 값 저장. |
| **5. UI (표시)** | 캘린더 또는 “기간별 일정 목록”에서 `occurrences` API 호출해 표시. |

---

## 6. 요일·월 코드 예시 (한국 기준)

- 요일: `0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토`  
  - 매주 월·목: `recurrenceWeekdays = '1,4'`
- 월: 1~12  
- 일: 1~31 (매월 15일 → `recurrenceMonthDay = 15`)

---

## 7. 정리

- **등록**: “매일 / 주간 / 월별” 등을 **반복 규칙 1건**으로 저장 (현재 테이블 + 반복 컬럼).
- **표시**: 조회 기간을 넘기면 서버에서 **반복 규칙을 기간 안에서만 확장**해 **occurrences** 로 내려줌.
- 이렇게 하면 구글 캘린더처럼 **한 번 등록한 반복 일정이, 볼 때마다 자동으로 반복**되게 할 수 있습니다.

원하면 다음 단계로 **`expandRecurrence` 의사코드(또는 Node 예시 코드)** 와 **마이그레이션 SQL 초안**을 이어서 작성할 수 있습니다.
