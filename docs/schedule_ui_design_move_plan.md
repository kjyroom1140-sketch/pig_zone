# 일정 관리 UI 설계: 돼지 이동 관리 계획 가독성

돈사 사육 관리에서 **돼지 이동 관리 계획**은 발정주기·교배후 주기·분만시기·출생일 기준 등과 밀접합니다.  
일정 스케줄 화면에서 **이동** 관련 정보를 쉽게 보고 이해할 수 있도록 하는 UI 설계 방안입니다.

---

## 작업 진행 현황 요약

| 단계 | 항목 | 상태 | 비고 |
|------|------|------|------|
| **DB·모델** | schedule_items에 일령(ageLabel) 컬럼 | ✅ 완료 | 모델·마이그레이션·API 반영 |
| **일정 폼** | 구분=돼지일 때만 "일령" 입력란(날짜시작 앞) | ✅ 완료 | admin.html + admin.js |
| **일정 목록** | 일령 컬럼 표시 | ✅ 완료 | 기준 다음, 날짜(시작) 앞 |
| **이동 강조** | 작업유형 "이동" 행 배경·왼쪽 띠 | ✅ 완료 | .schedule-row-move (admin.css) |
| **이동만 필터** | [전체] [이동만] 빠른 버튼 | ✅ 완료 | applyScheduleQuickFilter() |
| **순서 변경** | 드래그 시 ageLabel 유지 | ✅ 완료 | reorderScheduleItems payload |
| **구간 필터** | 발정·교배 / 분만 / 출생·이유 빠른 필터 | ✅ 완료 | 교배사·분만사·자돈사 대상장소 기준 |
| **이동 뷰 표시** | "이동 일정만 표시 중" 라벨 | ✅ 완료 | scheduleViewModeLabel |
| **중기** | 이동 일정 전용 뷰(방안 B) 컬럼 재배치 등 | ⏳ 선택 | 현재는 이동만 필터로 동일 효과 |
| **장기** | 기준별 그룹·타임라인(방안 C) / 요약 카드(방안 D) | ⏳ 미구현 | 설계만 |

**완료된 범위**: 일령 입력·표시, 이동 강조, 이동만/구간별 빠른 필터, 이동 뷰 시 라벨 표시.  
**다음 단계 후보**: 방안 C(기준별 그룹·타임라인) 또는 방안 D(요약 카드).

---

## 1. 요구 맥락 정리

| 구분 | 설명 | 일정에서의 표현 |
|------|------|-----------------|
| **발정주기** | 교배사 등에서 발정·재귀발정 관찰 | 기준: 교배일 / 전입일(교배사), 작업: 관찰·이동 |
| **교배후 주기** | 교배일 ~ 임신 확인, 임신사 이동 | 기준: 교배일, 전입일(임신사), 작업: 이동·관찰 |
| **분만시기** | 분만사 전입 ~ 분만 ~ 이유 | 기준: 전입일(분만사), 출산일, 작업: 이동·사양·위생 |
| **출생일 기준** | 자돈 일령(0~21일 등), 이유 후 이동 | 기준: 출생일, 전입일(자돈사), 작업: 이동·예방접종 등 |

이동 작업은 **어느 구간(기준+일수)** 에서 **어디로/어디서** 이루어지는지 한눈에 보이면 좋습니다.

---

## 2. UI 설계 방안

### 방안 A: 빠른 필터 + 이동 강조 (구현 부담 낮음)

**구성**
- 필터 영역에 **빠른 선택 버튼**: `[전체]` `[이동만]` `[발정·교배]` `[분만]` `[출생·이유]`
  - "이동만": 작업유형 = 이동
  - "발정·교배": 기준 = 교배일 또는 대상장소 = 교배사
  - "분만": 대상장소 = 분만사 또는 기준 = 출산일
  - "출생·이유": 기준 = 출생일 또는 대상장소 = 자돈사
- 테이블에서 **작업유형이 "이동"인 행**만 배경색(연한 파랑/민트) 또는 왼쪽 띠(색 막대)로 강조
- 테이블에 **일령** 컬럼 추가: 구분이 돼지일 때 `ageLabel` 표시 → "언제(일령)" 정보가 날짜(시작) 옆에 보임

**효과**: 기존 목록 구조 유지, 이동 일정만 빠르게 걸러 보고 강조해서 볼 수 있음.

---

### 방안 B: 뷰 전환 (목록 / 이동 요약)

**구성**
- 상단에 뷰 전환: **"전체 일정"** | **"이동 일정"**
- "이동 일정" 선택 시:
  - 작업유형이 "이동"인 항목만 표시 (또는 이동 + "준비" 등 이웃 작업 포함)
  - 테이블 컬럼 순서를 **기준 → 일령 → 날짜(시작)~날짜(끝) → 대상장소 → 작업내용** 등으로 재배치해 "언제·어디서·무엇" 흐름이 읽기 쉽게
  - 선택 시 "이동만" 필터가 자동 적용된 상태로 동일 테이블 사용 가능

**효과**: 이동 계획만 집중해서 볼 수 있는 전용 뷰 제공.

---

### 방안 C: 생애주기(기준)별 그룹 + 타임라인

**구성**
- 일정 목록을 **기준(basis)** 또는 **기준+대상장소**로 그룹화해 접기/펼치기
  - 예: "교배일 기준", "분만사 전입일 기준", "출생일 기준", "자돈사 전입일 기준" …
- 각 그룹 안에서는 **dayMin ~ dayMax**를 가로 막대(타임라인)로 표시
  - 한 행 = 일정 한 건, 막대 길이 = 일수 구간
  - **이동** 작업만 다른 색(예: 파랑)으로 표시
- 그룹 헤더에 요약 문구: 예) "교배일 0~21일: 발정·재귀 관찰, 임신사 이동"

**효과**: 발정주기·교배후·분만·출생일 기준별로 "언제 무슨 일(특히 이동)이 있는지"를 시간축으로 이해하기 쉬움.

---

### 방안 D: 요약 카드 + 상세 테이블

**구성**
- 일정 섹션 상단에 **카드 4개** (또는 탭):
  - **발정·교배 구간**: 교배사/교배일 기준 이동·관찰 요약
  - **임신 구간**: 임신사 전입·이동 요약
  - **분만 전후**: 분만사 전입·출산일·이유 시점 이동 요약
  - **출생·이유 후**: 출생일·자돈사 전입일 기준 이동 요약
- 카드 클릭 시: 해당 기준/대상장소/작업유형에 맞는 **필터가 적용된 기존 테이블**로 이동 (또는 테이블이 해당 조건으로 갱신)

**효과**: "이동이 일어나는 대표 구간"을 먼저 보고, 필요 시 상세 일정 테이블로 드릴다운.

---

### 방안 E: 테이블 컬럼 보강 (즉시 적용 가능)

**구성**
- 테이블에 **일령** 컬럼 추가: `ageLabel` (돼지일 때만 값 있음) → "날짜(시작)" 앞 또는 뒤에 배치
- **기준 + 일수**를 한 칸에: "기준명 (dayMin~dayMax일)" 예) "출생일 (21~21일)", "전입일 (0~0일)"
- 작업유형이 **이동**인 셀에 아이콘(↔ 또는 화살표) 표시
- (선택) **구간 라벨** 컬럼: "발정·교배", "분만", "포유·이유" 등 기준+대상장소 조합으로 자동 분류해 표시

**효과**: 현재 테이블만으로도 "기준·일령·일수·이동 여부"를 한 줄에서 파악 가능.

---

## 3. 추천 조합

1. **단기**: **방안 E** (일령 컬럼 + 이동 아이콘/강조) + **방안 A** (이동만/구간별 빠른 필터)  
   → 기존 화면 변경을 최소화하면서 이동 관련 정보 가독성 확보.

2. **중기**: **방안 B** (이동 일정 전용 뷰) 추가  
   → 이동 계획만 모아서 보고 싶을 때 전용 뷰로 전환.

3. **장기**: **방안 C** (기준별 그룹 + 타임라인) 또는 **방안 D** (요약 카드)  
   → 발정주기·교배후·분만·출생일 기준 흐름을 시각적으로 이해하고 싶을 때 적용.

---

## 4. 데이터 측 보완 (선택)

- **기준 유형(schedule_basis_types)** 에 교배일·출산일·전입일·출생일·이유일 등이 있으면, "구간 라벨"(발정·교배 / 분만 / 출생·이유 등)은 프론트에서 **기준명 + 대상장소** 조합으로 매핑 가능.
- 작업 유형 코드가 **이동 = MOVE** 등으로 통일되어 있으면 "이동만" 필터·강조 로직 구현이 단순해짐.

이 문서는 설계 참고용이며, 구현 시에는 방안 A·E부터 적용한 뒤 사용자 피드백에 따라 B·C·D를 단계적으로 도입하는 것을 권장합니다.

---

## 5. 단계별 구현 가이드: 일령 컬럼 + 이동 강조 + 이동만 필터

아래는 **일령 컬럼**, **이동 행 강조**, **이동만 필터**를 넣을 때 수정하는 위치와 방법입니다. (컬럼 개수 변경으로 colspan은 10 → 11로 통일.)

---

### 5.1 일령 컬럼

**위치**: "기준" 다음, "날짜(시작)" 앞에 "일령" 열 추가.

| 파일 | 수정 내용 |
|------|-----------|
| `public/admin.html` | thead에 `<th width="80">일령</th>` 추가(기준 다음). tbody 초기 로딩/빈 메시지용 `colspan="10"` → `colspan="11"` 로 변경. |
| `public/js/admin.js` | `loadScheduleItems()` 안에서: (1) 로딩/빈/에러 행의 colspan을 `11`로 변경. (2) 데이터 행 생성 시 기준 다음에 `<td>${escapeHtml(s.ageLabel || '')}</td>` 추가. |

**admin.html 예시 (thead):**
```html
<th width="80">기준</th>
<th width="80">일령</th>
<th width="70">날짜(시작)</th>
```

**admin.js 예시 (한 행):**
```javascript
<td>${escapeHtml(basis)}</td>
<td>${escapeHtml(s.ageLabel || '')}</td>
<td>${s.dayMin != null ? s.dayMin : '-'}</td>
```

---

### 5.2 이동 강조

**위치**: 작업유형이 "이동"인 행에만 클래스 추가 → CSS로 배경/왼쪽 띠 적용.

| 파일 | 수정 내용 |
|------|-----------|
| `public/js/admin.js` | `loadScheduleItems()`에서 각 행을 만들 때, `s.taskType && s.taskType.name === '이동'` 이면 `<tr class="clickable-row schedule-row-move" ...>` 처럼 `schedule-row-move` 클래스 추가. |
| `public/css/admin.css` | `.schedule-row-move` 스타일 추가: 배경색(예: `background-color: #e8f4fc`) 또는 왼쪽 테두리(예: `border-left: 4px solid #0ea5e9`). |

**admin.js 예시:**
```javascript
const isMove = s.taskType && s.taskType.name === '이동';
const rowClass = 'clickable-row' + (isMove ? ' schedule-row-move' : '');
return `<tr class="${rowClass}" data-schedule-item-id="${s.id}" ...>`;
```

**admin.css 예시:**
```css
.schedule-row-move { background-color: #e8f4fc; }
/* 또는 */
.schedule-row-move { border-left: 4px solid #0ea5e9; }
```

---

### 5.3 이동만 필터 (빠른 버튼)

**위치**: 필터 영역에 `[전체]` `[이동만]` 버튼 추가. "이동만" 클릭 시 작업유형 셀렉트를 "이동"으로 맞춘 뒤 조회.

| 파일 | 수정 내용 |
|------|-----------|
| `public/admin.html` | "조회" 버튼 앞에 빠른 필터 버튼 추가. 예: `<button type="button" class="btn btn-outline-secondary btn-sm" onclick="applyScheduleQuickFilter('all')">전체</button>` `<button type="button" class="btn btn-outline-primary btn-sm" onclick="applyScheduleQuickFilter('move')">이동만</button>` |
| `public/js/admin.js` | `applyScheduleQuickFilter(kind)` 함수 추가: `kind === 'move'`일 때 `scheduleTaskTypes`에서 `name === '이동'`인 항목의 `id`를 찾아 `scheduleFilterTaskType` value로 설정, 없으면 `''`. `kind === 'all'`이면 작업유형을 `''`로 설정. 마지막에 `loadScheduleItems()` 호출. 일정 섹션 진입 시 작업유형 목록이 없을 수 있으므로, "이동만"에서 목록이 비어 있으면 먼저 `loadScheduleTaskTypes()`를 await 한 뒤 적용하도록 처리하면 안전함. |

**admin.js 함수 예시:**
```javascript
async function applyScheduleQuickFilter(kind) {
    const selTask = document.getElementById('scheduleFilterTaskType');
    if (!selTask) return;
    if (kind === 'all') {
        selTask.value = '';
    } else if (kind === 'move') {
        if (scheduleTaskTypes.length === 0) await loadScheduleTaskTypes();
        const moveType = scheduleTaskTypes.find(t => t.name === '이동');
        selTask.value = moveType ? String(moveType.id) : '';
    }
    await loadScheduleItems();
}
```

---

### 5.4 reorderScheduleItems 시 ageLabel 유지

**위치**: 순서 변경 저장 시 기존 항목의 `ageLabel`을 payload에 포함해 PUT 요청이 누락되지 않도록 함.

| 파일 | 수정 내용 |
|------|-----------|
| `public/js/admin.js` | `reorderScheduleItems()` 안의 `body: JSON.stringify({ ... })`에 `ageLabel: s.ageLabel ?? null` 추가. (이미 다른 필드들이 있으므로 그 목록에 ageLabel만 추가.) |

---

### 5.5 체크리스트

- [x] admin.html: thead에 "일령" 열 추가, colspan 11로 변경
- [x] admin.js: loadScheduleItems에서 colspan 11, 일령 td, schedule-row-move 클래스
- [x] admin.css: .schedule-row-move 스타일
- [x] admin.html: [전체] [이동만] 버튼
- [x] admin.js: applyScheduleQuickFilter(), 필요 시 loadScheduleTaskTypes 호출
- [x] admin.js: reorderScheduleItems payload에 ageLabel 포함
