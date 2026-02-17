# 일정 관리 DB 설계 (현행)

농장 일정을 **구분(돼지/시설), 대상장소, 기준, 날짜(시작~끝), 작업유형, 작업내용**으로 저장·관리하기 위한 구조입니다.

---

## 1. 테이블 구조

### 1.1 작업 유형 마스터 — `schedule_task_types`

**역할:** "무슨 종류의 작업인가"를 정의. 일정 항목에서 작업유형으로 참조.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 고유 ID |
| code | VARCHAR(50) UNIQUE | 코드 (예: VACCINE, MOVE) |
| name | VARCHAR(100) | 작업 유형명 (예: 백신 접종, 이동) |
| category | VARCHAR(50) | 대분류 (vaccine, feed, move 등) |
| description | TEXT | 설명 |
| sortOrder | INTEGER | 목록 정렬 순서 |
| createdAt, updatedAt | TIMESTAMP | |

**예시:** 백신 접종, 사료 전환, 돈사 이동, 검역, 시설 소독, 일상 점검 등.

---

### 1.2 기준 유형 마스터 — `schedule_basis_types`

**역할:** 일정의 "기준"을 정의. 전입일, 출산일, 매일, 주 1회, 전입/종료 이벤트 등.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 고유 ID |
| code | VARCHAR(50) UNIQUE | 코드 (예: ENTRY_DAY, DAILY) |
| name | VARCHAR(100) | 기준명 (예: 전입일, 매일) |
| targetType | VARCHAR(20) NULL | 구분: `pig`(돼지), `facility`(시설) — 일정 항목 구분과 동일 |
| description | TEXT | 설명 |
| sortOrder | INTEGER | 목록 정렬 순서 |
| createdAt, updatedAt | TIMESTAMP | |

**예시:** 전입일, 출산일, 출생일, 이유일, 교배일, 매일, 주 1회, 전입, 종료, 출하후.

---

### 1.3 일정 항목 — `schedule_items`

**역할:** 실제 일정 한 건. 구분·대상장소·기준·날짜 범위·작업유형·작업내용을 저장. 시설 일정은 반복(매일/매주/매월) 설정 가능.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 일정 항목 고유 ID |
| targetType | VARCHAR(20) | 구분: `pig`(돼지), `facility`(시설) |
| structureTemplateId | INTEGER NULL FK → structure_templates | 대상장소 (structure_templates 적용) |
| basisTypeId | INTEGER NULL FK → schedule_basis_types | 기준 (schedule_basis_types 적용) |
| ageLabel | VARCHAR(50) NULL | 일령 표시 (예: 0~21일령, 포유자돈). 돼지 일정용 |
| dayMin | INTEGER NULL | 날짜(시작) — 기준일로부터 일수 |
| dayMax | INTEGER NULL | 날짜(끝) — 기준일로부터 일수 |
| taskTypeId | INTEGER FK → schedule_task_types | 작업유형 |
| description | TEXT NULL | 작업내용 |
| sortOrder | INTEGER | 정렬 순서 |
| isActive | BOOLEAN | 사용 여부 |
| recurrenceType | VARCHAR(20) NULL | 반복 유형: `none` \| `daily` \| `weekly` \| `monthly` \| `yearly`. null이면 1회성 |
| recurrenceInterval | INTEGER NULL | 반복 간격 (기본 1. 2주마다=2 등) |
| recurrenceWeekdays | VARCHAR(20) NULL | 주간 반복 시 요일 (0=일…6=토). 예: `1,4`=월·목 |
| recurrenceMonthDay | INTEGER NULL | 월간 반복 시 일(1–31) |
| recurrenceStartDate | DATE NULL | 반복 시작일 (화면/API에서는 미사용, DB 유지) |
| recurrenceEndDate | DATE NULL | 반복 종료일. null이면 무기한 (화면/API에서는 미사용, DB 유지) |
| createdAt, updatedAt | TIMESTAMP | 생성·수정 시각 |

- **대상장소:** `structure_templates` 테이블을 참조. 시설 종류(분만사, 비육사 등)를 선택.
- **기준:** `schedule_basis_types` 테이블을 참조. 기준일/주기(전입일, 매일 등)를 선택. 구분=시설이면 null 가능.
- **날짜(시작/끝):** 기준일로부터의 일수(dayMin, dayMax)로 저장. 시설 반복 일정은 recurrence* 컬럼 사용.

#### 컬럼별 사용 설명

| 컬럼 | 사용 설명 |
|------|------------|
| **id** | 일정 항목 고유 ID. API·목록에서 수정/삭제 시 식별자로 사용. |
| **targetType** | 구분: `pig`(돼지), `facility`(시설). 돼지 일정은 기준·일령·일수 사용, 시설 일정은 반복(recurrence*) 사용. Admin 목록 필터·모달에서 필수 선택. |
| **structureTemplateId** | 대상장소. `structure_templates` FK. 분만사·교배사·비육사 등 시설 템플릿 선택. null 가능(공통 일정). 목록/모달에서 셀렉트로 지정. |
| **basisTypeId** | 기준. `schedule_basis_types` FK. 전입일·출산일·매일 등. **돼지 일정**에서만 사용. 구분=시설이면 화면에서 숨기고 저장 시 null. |
| **ageLabel** | 일령 표시용 텍스트(예: 0~21일령, 포유자돈). **돼지 일정**용. 목록의 "일령" 열에 표시. |
| **dayMin** | 날짜(시작) — 기준일로부터 일수. **돼지 일정**에서 기준일+일수 계산 시 사용. |
| **dayMax** | 날짜(끝) — 기준일로부터 일수. **돼지 일정**에서 기준일+일수 계산 시 사용. |
| **taskTypeId** | 작업유형. `schedule_task_types` FK. 필수. 환경·이동·번식·기록 등. 목록/모달에서 셀렉트. |
| **description** | 작업내용. 자유 텍스트. 목록 "작업내용" 열·모달에서 입력. |
| **sortOrder** | 정렬 순서. 목록 표시 순서·드래그 정렬 시 갱신. |
| **isActive** | 사용 여부. false면 비노출/비활성 처리. |
| **recurrenceType** | 반복 유형: `none` \| `daily` \| `weekly` \| `monthly` \| `yearly`. **시설 일정**에서만 사용. null이면 1회성. 모달 "시설 설정"에서 선택. |
| **recurrenceInterval** | 반복 간격(기본 1). 2주마다=2 등. recurrenceType이 weekly/monthly/yearly일 때 사용. |
| **recurrenceWeekdays** | 주간 반복 시 요일. 0=일…6=토, 예: `1,4`=월·목. recurrenceType=weekly일 때 사용. |
| **recurrenceMonthDay** | 월간 반복 시 일(1–31). recurrenceType=monthly일 때 사용. |
| **recurrenceStartDate** | 반복 시작일. DB에는 유지, 현재 화면/API에서는 미사용. |
| **recurrenceEndDate** | 반복 종료일. null이면 무기한. DB에는 유지, 현재 화면/API에서는 미사용. |
| **createdAt, updatedAt** | 레코드 생성·수정 시각. Sequelize 자동 관리. |

**컬럼 설명 보완 이력 (schedule_items)**  
- 문서에 누락되어 있던 항목을 아래와 같이 반영함.  
  - `id`: 설명 추가 — "일정 항목 고유 ID".  
  - `ageLabel`: 문서에 없었음 — "일령 표시 (예: 0~21일령, 포유자돈). 돼지 일정용" 추가.  
  - `recurrenceType`, `recurrenceInterval`, `recurrenceWeekdays`, `recurrenceMonthDay`, `recurrenceStartDate`, `recurrenceEndDate`: 반복 일정용 컬럼으로 문서에 없었음 — 위 표에 설명 추가.  
- 모델 `models/ScheduleItem.js`의 `id`에만 comment가 없었음 — 동일 설명으로 comment 추가함.

---

## 2. ER 관계

```
schedule_task_types   (1) ----< (N) schedule_items
schedule_basis_types  (1) ----< (N) schedule_items  [nullable]
structure_templates   (1) ----< (N) schedule_items  [nullable]
```

- **schedule_task_types:** 모든 일정 항목이 하나의 작업 유형에 연결.
- **schedule_basis_types:** 기준이 있을 때 연결 (선택). 전입일·매일·주 1회·전입/종료 등.
- **structure_templates:** 대상장소가 있을 때만 연결 (선택).

---

## 3. Admin — 일정 관리 설정

- **시스템 설정** 하위 메뉴: **일정 관리 설정**
- **작업 유형:** 목록 조회, 추가/수정/삭제 (코드, 이름, 대분류, 설명, 순서).
- **기준 유형:** 목록 조회, 추가/수정/삭제 (코드, 이름, 설명, 순서).
- **일정 항목:** 목록 조회(구분·대상장소·기준·작업유형 필터), 추가/수정/삭제.
  - 모달: 구분(돼지/시설), 대상장소(structure_templates 셀렉트), 기준(schedule_basis_types 셀렉트), 날짜(시작/끝) 일수, 작업유형(작업 유형 테이블 셀렉트), 작업내용.

---

## 4. API

| 용도 | 경로 | 비고 |
|------|------|------|
| 작업 유형 | GET/POST /api/scheduleTaskTypes | 목록·추가 |
| 작업 유형 | PUT/DELETE /api/scheduleTaskTypes/:id | 수정·삭제 |
| 기준 유형 | GET/POST /api/scheduleBasisTypes | 목록·추가 |
| 기준 유형 | PUT/DELETE /api/scheduleBasisTypes/:id | 수정·삭제 |
| 일정 항목 | GET/POST /api/scheduleItems | 쿼리: targetType, structureTemplateId, basisTypeId, taskTypeId |
| 일정 항목 | PUT/DELETE /api/scheduleItems/:id | 수정·삭제 |

---

## 5. 확장 시 고려

- **농장별 오버라이드:** `schedule_items`에 `farm_id`(NULL=공통) 추가 가능.
- **실제 스케줄(날짜 배정):** 별도 테이블(예: `farm_schedule_events`)에서 `schedule_items`를 참조하는 구조로 확장 가능.
