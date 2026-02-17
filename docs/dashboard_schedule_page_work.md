# 일정(작업) 관리 페이지 작업 진행 문서

대시보드의 **일정(작업) 관리** 페이지(`dashboard-schedule.html`) 기능 확장을 위한 작업 정의·현황·계획 문서입니다.

**데이터 소스 방침**  
- 그리드에 표시하는 **일정(작업) 내용**은 **`farm_schedule_work_plans`**(작업 계획·완료 테이블)에서 불러와 표시한다.  
- 작업 계획에는 예정 시작/종료일, 완료일, 작업유형(이동/환경 등)이 있으며, 일정 정의(작업명·대상·기준 등)는 `farm_schedule_items`와 JOIN하여 보여준다.  
- 상세 설계·단계는 `docs/dashboard_schedule_register_and_completion.md` 참고.

---

## 1. 목적 및 범위

| 항목 | 내용 |
|------|------|
| **대상 페이지** | `public/dashboard-schedule.html` (URL: `/dashboard-schedule.html?farmId=xxx`) |
| **목적** | 농장별 **일정(작업)** 을 시설 구조 × 일자 그리드에서 조회·관리할 수 있도록 구현 |
| **범위** | 그리드에 일정 표시, 검색/필터, 주 이동, 필요 시 일정 추가/수정/삭제 및 “한 달 보기” 등 |

---

## 2. 현재 구현 상태

### 2.1 구현된 것

| 구분 | 내용 | 비고 |
|------|------|------|
| **페이지** | `dashboard-schedule.html` 단일 페이지, 공통 헤더·네비 주입 | `dashboard-common.js` |
| **레이아웃** | 상단: 검색 입력란, 주 네비(‹ 📅 ›) / 하단: 농장 구조(행) × 7일(열) 테이블 | `dashboard-schedule.js` |
| **농장 구조** | `GET /api/farm-facilities/:farmId/tree` 로 건물→층→돈사→방→칸 트리 로드 | 접기/펼치기(▶▼) 지원 |
| **7일 열** | 해당 주 일요일 기준 7일, 요일·오늘·휴일 스타일 적용 | `getScheduleWeekStart`, `getDayType`, `renderScheduleGrid` |
| **스타일** | `admin.css`, `dashboard.css`, `farm_facilities.css` | 기존 유지 |

### 2.2 구현 완료 (접힘/펼침 규칙)

| 구분 | 내용 |
|------|------|
| **일정 표시 규칙** | **접힌 행**: 해당 노드와 그 하위 전체의 일정을 묶어 셀에 표시. **펼친 행**: 부모 행에는 일정 없음, 펼쳐진 자식 행에만 해당 범위 일정 표시. |
| **돼지 일정** | **targetType === 'pig'** 인 일정은 **해당 칸/방에 돼지가 있는 경우에만** 표시. 칸(section)은 `currentPigCount > 0`, 방/돈사/층/건물은 하위 중 하나라도 돼지가 있으면 `hasPigs` 로 묶어 표시. **시설 일정(`facility`)은 돼지 유무와 무관하게 항상 표시**되므로, **빈 방/돈사에도 시설 일정이 보임**. |
| **데이터 (현재)** | 현재는 `GET /api/farms/:farmId/schedule-items` + `GET /api/farm-structure/:farmId/production` 로 표시. **전환 목표**: 그리드 표시 데이터를 **`GET /api/farms/:farmId/schedule-work-plans`**(주 구간 from/to, 선택 시 taskTypeCategory)에서 불러와 **farm_schedule_work_plans** 기준으로 예정일·완료 표시. |

**현재 일정 표시 데이터 흐름 (상세)**  
1. **데이터 로드**: (1) `GET /api/farm-facilities/:farmId/tree` → 건물·층·돈사·방·칸 트리(각 칸에 `currentPigCount` 포함). (2) `GET /api/farm-structure/:farmId/production` → 운영 시설 목록. (3) `GET /api/farms/:farmId/schedule-items` → 농장 일정 항목 전체.  
2. **행별 scope**: 돈사명과 운영 시설명을 매칭해 각 돈사·방·칸 행에 `scopeTemplateIds`(해당 시설 유형의 structureTemplateId) 부여.  
3. **행별 hasPigs**: 칸은 `currentPigCount > 0`이면 true, 방/돈사/층/건물은 하위 중 하나라도 돼지 있으면 true.  
4. **셀에 표시할 일정** (`getItemsForRow`): 해당 행의 `scopeTemplateIds`에 맞는 일정만 후보. 이때 **targetType이 pig/sow/boar/non_breeding**이면 **hasPigs가 true인 행에만** 표시. **targetType이 facility(시설)**이면 **hasPigs와 관계없이 항상 표시**.  
→ 따라서 **돼지 이동이 없어 빈 방이라도**, 그 돈사/방에 매핑된 **시설(facility) 일정**은 그대로 표시됨. 빈 방에 작업 안 보이게 하려면 “시설 일정도 hasPigs일 때만 표시”하도록 로직 변경하거나, “빈 방 일정 숨기기” 필터를 추가하는 방안을 검토할 수 있음.

### 2.3 구현 완료 (검색·주 이동·한 달 보기)

| 구분 | 내용 |
|------|------|
| **검색** | `#scheduleSearchInput` 입력 시 시설명·통계(label/stats)로 구조 행 필터. 일치하는 행 또는 그 부모가 펼쳐진 자식만 표시. Esc로 검색어 지우기. |
| **오늘** | 주 네비 옆 "오늘" 버튼으로 해당 주를 이번 주로 이동. |
| **한 달 달력** | 📅 클릭 시 해당 주가 포함된 한 달 모달 표시. 날짜 클릭 시 그 날이 포함된 주로 이동 후 모달 닫기. |

### 2.4 미구현 / 보완 대상

| 구분 | 내용 |
|------|------|
| **데이터 소스 전환** | 그리드 표시를 **farm_schedule_work_plans** 기준으로 전환. `GET .../schedule-work-plans?from=&to=` 로 주(7일) 구간 조회 후, plannedStartDate~plannedEndDate·roomId/sectionId·taskTypeCategory로 셀 매핑. |
| **일자별 매핑** | 작업 계획의 **plannedStartDate·plannedEndDate** 기준으로 해당 주 7일 셀에 “이 날에 예정/완료” 표시. (현재는 주 전체 동일 일정 목록 표시.) |
| **일정(계획) 추가/수정/삭제** | 작업 계획 추가·완료 체크 UI. 일정 정의 CRUD는 farm_admin 등에서 진행. `docs/dashboard_schedule_register_and_completion.md` 참고. |

---

## 3. 관련 문서 및 API

### 3.1 참고 문서

| 문서 | 설명 |
|------|------|
| `docs/dashboard_page_split_design.md` | 대시보드 페이지 분할 설계, 일정 페이지 역할 |
| `docs/farm_schedule_design.md` | 농장 일정 관리 설계, farm_schedule_items, 전역 템플릿 복사 방식 |
| `docs/schedule_template_db_design.md` | 일정 DB 구조(schedule_task_types, schedule_basis_types, schedule_items 등) |
| `docs/schedule_ui_design_move_plan.md` | 일정 UI(이동 강조, 필터, 기준별 그룹 등) |
| `docs/facility_structure_overview.md` | 시설 구조(건물·층·돈사·방·칸) 개요 |
| **`docs/dashboard_schedule_register_and_completion.md`** | **농장 직접 일정 등록 + 작업 완료 유무 체크·관리** 단계·방식 정리 |

### 3.2 사용 API

| API | 용도 |
|-----|------|
| `GET /api/farm-facilities/:farmId/tree` | 농장 구조 트리(그리드 행 구성) — **이미 사용 중** |
| **`GET /api/farms/:farmId/schedule-work-plans`** | **그리드 표시 주 데이터.** 쿼리: from, to(주 구간), taskTypeCategory(이동/환경 등). 셀별 예정·완료 표시에 사용. |
| `GET /api/farms/:farmId/schedule-items` | 일정 정의 — work-plans와 JOIN하여 라벨/상세 표시용. 구조·scope 매칭용. |
| `GET /api/farm-structure/:farmId/production` | 돈사↔운영시설 매칭 — **이미 사용 중** |
| `PATCH /api/farms/:farmId/schedule-work-plans/:id` | 작업 계획 완료 체크/해제 (completedDate 설정) |
| `POST /api/farms/:farmId/schedule-work-plans` | 작업 계획 추가 (선택). 일정 정의 CRUD는 farm_admin 등에서. |

### 3.3 그리드 표시 데이터 구조 요약

- **주 데이터**: **farm_schedule_work_plans** — farmId, farmScheduleItemId, taskTypeCategory(이동/환경 등), roomId, sectionId, plannedStartDate, plannedEndDate, completedDate, completedBy 등. 해당 주(from~to) 구간으로 조회.
- **일정 정의 보조**: farm_schedule_items(farmScheduleItemId로 JOIN) — 작업명·대상·기준·taskType 등. 셀 라벨·툴팁에 사용.
- **그리드 매핑**: “특정 일자” “해당 주 7일”에 주(7일) 각 날짜에 대해 **plannedStartDate ≤ 해당일 ≤ plannedEndDate** 인 작업 계획을 해당 셀에 표시. completedDate 있으면 완료(✓) 표시. roomId/sectionId·구조 트리 행과 매칭.

---

## 4. 작업 목표 및 단계 제안

### 4.1 목표 정리

1. **그리드에 일정 표시**: 선택한 주(7일)와 농장 구조(행)를 기준으로, 해당 기간·대상에 맞는 일정을 셀 또는 행 단위로 표시.
2. **검색**: 시설명·일정 내용 등으로 그리드 행/표시 필터.
3. **주 이동**: 현재와 동일 유지(‹ ›), 필요 시 “오늘” 버튼 추가.
4. **한 달 보기**(선택): 📅 클릭 시 해당 주가 포함된 한 달 뷰 또는 모달.
5. **일정 CRUD**(선택·단계 분리): 셀/행 클릭으로 추가·수정·삭제. 또는 “목록 + 그리드” 병행.

### 4.2 그리드–일정 매핑 방향

- **행**: 농장 구조 트리(건물·층·돈사·방·칸) — 이미 구현. “시설 유형(structure_template)” 기준으로 일정을 묶어 표시할지, “실제 시설 노드(방/칸)” 기준으로 할지 정리 필요.
- **열**: 해당 주 7일(일별).
- **셀 내용 후보**  
  - A) **해당 일자에 “해당 시설(또는 시설 유형)에 매핑된 일정”** 을 요약 표시(텍스트·배지).  
  - B) **기준일(전입일 등) + dayMin~dayMax** 로 “이 날에 해당하는 작업”을 계산해 표시.  
  - C) **시설 반복 일정**은 해당 주의 요일/일자에 맞춰 표시.  
- 우선 **A 또는 단순 “이 시설 유형의 일정 목록”을 해당 주 7일과 엮어 표시**하는 방식으로 시작하고, B/C는 단계적으로 확장하는 것을 권장.

### 4.3 단계별 작업 제안

| 단계 | 작업 | 산출물/기준 |
|------|------|-------------|
| **1** | **작업 계획 API 연동** | 주(7일) from~to로 `GET .../schedule-work-plans?from=&to=` 호출, 응답을 그리드용 구조로 보관 (일정 정의 JOIN 포함) |
| **2** | **그리드 셀에 작업 계획 표시** | plannedStartDate~plannedEndDate·roomId/sectionId 기준으로 셀에 예정·완료(✓) 표시. 접힌 행은 하위 묶음 규칙 유지. |
| **3** | **검색·필터** | 시설명 검색 + taskTypeCategory(이동만/환경만 등) 필터. |
| **4** | **한 달 보기** | 📅 클릭 → 한 달 모달, 날짜 클릭 시 해당 주로 이동 (현재 구현 유지). |
| **5** | **완료 체크 UI** | 셀 또는 작업 계획 배지 클릭 시 PATCH .../schedule-work-plans/:id (completedDate 설정/해제), 그리드 갱신. |

---

## 5. 기술적 참고 사항

### 5.1 프론트

- **스크립트**: `public/js/dashboard-schedule.js` (즉시 실행 함수, `window.dashboardFarmId` 또는 URL의 farmId 사용).
- **구조 트리**: `dashboardTreeData`, `dashboardExpandedNodes`, `getFlattenedTreeRows()` — 행 생성에 사용.
- **일자**: `scheduleWeekStartDate` (해당 주 일요일), `renderScheduleGrid()` 내 7일 헤더·셀 렌더링.

### 5.2 백엔드

- **라우트**: `routes/farmScheduleItems.js` → `app.use('/api/farms', ...)` 로 `GET/POST/PUT/DELETE .../schedule-items` 제공.
- **모델**: `FarmScheduleItem`, `FarmScheduleTaskType`, `FarmScheduleBasisType` (농장별 복사 구조).

### 5.3 설계 결정 필요

- 그리드 **행 단위**를 “실제 시설 노드(방/칸)”까지 쓸지, “시설 유형(돈사/방 유형)” 단위로 묶을지.
- “해당 일자에 표시할 일정”을 **서버에서 주(시작일~종료일) + farmId로 계산해 내려줄 API**를 둘지, **클라이언트에서 schedule-items 목록을 받아 날짜/기준 계산**할지.

---

## 6. 요약 체크리스트

- [x] 레이아웃·구조 트리·7일 열·검색·오늘·한 달 보기 (현재 구현)
- [ ] **작업 계획 API 연동**: `GET .../schedule-work-plans?from=&to=` 로 그리드 표시 데이터 로드
- [ ] **그리드 셀 ↔ farm_schedule_work_plans 매핑**: plannedStartDate~plannedEndDate·roomId/sectionId 기준 셀 표시, 완료(✓) 표시
- [ ] **완료 체크 UI**: 셀/배지 클릭 시 PATCH work-plan, 그리드 갱신
- [ ] (선택) taskTypeCategory 필터(이동만/환경만 등)

이 문서는 **일정관리 페이지가 farm_schedule_work_plans를 주 데이터로 표시**하는 것을 전제로 합니다. 작업 계획·테이블 설계·API 상세는 `docs/dashboard_schedule_register_and_completion.md`를 참고하세요.
