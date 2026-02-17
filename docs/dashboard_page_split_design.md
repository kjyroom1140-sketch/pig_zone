# 대시보드 페이지 분할 설계

현재 `dashboard.html`(단일 페이지 + 섹션 전환)을 **페이지 분할 방식**으로 재구성하기 위한 구체 설계입니다.

---

## 1. 목표

- 실시간 모니터링 / 일정 관리 / 이동 관리 / 보고서 관리를 **각각 별도 HTML 페이지**로 분리
- URL로 화면 직접 접근·북마크·공유 가능
- 농장 컨텍스트(`farmId`)는 쿼리스트링으로 유지
- 헤더·네비는 모든 대시보드 페이지에서 **동일한 형태**로 유지

---

## 2. URL 및 파일 구조

**대시보드 진입 주소는 `dashboard.html` 하나를 사용한다.**  
(별도 "진입용" URL을 두지 않고, 농장 선택 등에서 곧바로 `dashboard.html?farmId=xxx` 로 연결. farmId 있으면 해당 페이지에서 **실시간 모니터링**을 메인으로 표시.)

| 메뉴 | URL | 파일 | 비고 |
|------|-----|------|------|
| **대시보드 진입 / 실시간 모니터링** | `/dashboard.html?farmId=xxx` | `dashboard.html` | farmId 있으면 실시간 모니터링 메인 |
| **일정 관리** | `/dashboard-schedule.html?farmId=xxx` | `dashboard-schedule.html` | 기존 일정 그리드 이전 |
| **이동 관리** | `/dashboard-move.html?farmId=xxx` | `dashboard-move.html` | 신규(플레이스홀더 가능) |
| **보고서 관리** | `/dashboard-report.html?farmId=xxx` | `dashboard-report.html` | 신규(플레이스홀더 가능) |
| 농장 환경 설정 | `/farm_admin.html?farmId=xxx` | 기존 `farm_admin.html` | 링크만 연결 |

- (호환) `dashboard-monitoring.html?farmId=xxx` 로 들어온 경우 → `dashboard.html?farmId=xxx` 로 리다이렉트해 두면 기존 링크 유지 가능.
- **farmId 없이 접근 시**: `select-farm.html`로 유도 또는 `dashboard.html`(farmId 없음)에서 "농장 선택" 안내

---

## 3. 공통 레이아웃 (모든 대시보드 페이지 공유)

모든 대시보드 계열 페이지는 **동일한 상단 구조**를 가진다.

### 3.1 헤더 (기존과 동일)

```
[ 🐷 양돈농장 관리 시스템 ]  [ 관리 시스템 ]     [ 🏢 현재 농장명 ]     [ 역할 ] [ 사용자명 ] [ 로그아웃 ]
```

- 좌: 로고/타이틀, 시스템 배지  
- 중: 현재 농장명 (`currentFarmName`)  
- 우: 사용자 정보, 로그아웃  

### 3.2 네비게이션 바 (공통)

헤더 바로 아래 한 줄. **현재 페이지에 해당하는 메뉴만 active**.

```
[ 📺 실시간 모니터링 ]  [ 📅 일정 관리 ]  [ ↔️ 이동 관리 ]  [ 📊 보고서 관리 ]  [ ⚙️ 농장 환경 설정 ]
```

- 각 항목은 **해당 HTML로 이동하는 링크** (같은 `farmId` 쿼리 유지)
- 농장 환경 설정: 권한 있을 때만 표시 (기존 로직 유지)

### 3.3 링크 href 규칙

- **대시보드 진입**: `dashboard.html?farmId=xxx` (진입 시 이 주소 사용, 해당 페이지에서 실시간 모니터링 메인)
- 일정 관리: `dashboard-schedule.html?farmId=xxx`
- 이동 관리: `dashboard-move.html?farmId=xxx`
- 보고서 관리: `dashboard-report.html?farmId=xxx`
- 농장 환경 설정: `farm_admin.html?farmId=xxx`

---

## 3.4 공통 헤더·메뉴 유지 방식 (중요)

**질문**: 특정 페이지에서 헤더/메뉴를 수정하면 다른 페이지도 자동으로 같은 구조가 되나요?

| 방식 | 한 페이지만 수정 시 다른 페이지 반영 | 설명 |
|------|--------------------------------------|------|
| **A. 각 HTML에 헤더·메뉴 복사** | ❌ **아니오. 각 페이지별로 수정해야 함.** | 모든 대시보드 HTML에 `<header>`, `<nav>` 마크업을 그대로 복사해 넣는 경우. 한 파일만 바꿔도 다른 파일에는 적용되지 않음. |
| **B. 공통 조각 주입(권장)** | ✅ **예. 한 곳만 수정하면 모든 페이지에 반영됨.** | 헤더·메뉴 HTML을 **한 파일**에 두고, 각 페이지는 빈 placeholder만 두고, JS가 로드 시 해당 조각을 fetch해서 넣음. |

### 권장: B. 공통 조각 주입

- **공통 파일 1개**: `partials/dashboard-header-nav.html` (또는 `templates/dashboard-layout.html`)  
  - 내용: `<header class="admin-header">...</header>` + `<nav class="dashboard-nav">...</nav>` 전체.
- **각 대시보드 페이지**  
  - 상단에 placeholder만 둠. 예: `<div id="dashboard-header-nav-placeholder"></div>`  
  - `dashboard-common.js`에서:  
    1. 페이지 로드 시 `fetch('/partials/dashboard-header-nav.html')` (또는 정적 경로)  
    2. 응답 HTML을 `#dashboard-header-nav-placeholder`에 `innerHTML`로 삽입  
    3. 그다음 `farmId`로 링크 href 보정, 사용자/농장명 표시, active 처리, 로그아웃 바인딩
- **효과**: 헤더·메뉴 구조/문구/링크를 **`dashboard-header-nav.html` 한 파일만 수정**하면, 이 조각을 쓰는 모든 대시보드 페이지에 동일하게 적용됨. 각 페이지별로 고칠 필요 없음.

### 구현 시 주의

- `fetch`는 보통 같은 origin에서만 HTML 조각을 불러옴. Express에서 `public/partials/dashboard-header-nav.html`을 두면 `/partials/dashboard-header-nav.html`로 요청 가능.
- placeholder는 `<body>` 직후 등, 메인 콘텐츠 위에 한 번만 두면 됨.

---

## 4. 페이지별 역할

### 4.1 dashboard.html (대시보드 진입 + 실시간 모니터링)

- **역할**: 진입 주소이자 실시간 모니터링 메인. farmId 있으면 이 페이지에서 실시간 모니터링(첫 섹션) 표시 또는 “콘텐츠 준비 중” 안내.
- **내용**  
  - 공통 헤더 + 네비 (현재: “대시보드” active)  
  - 메인: “대시보드” 타이틀, 짧은 설명, 농장 설정 링크  
- **동작**  
  - `farmId` 없으면 농장 선택 유도 또는 `select-farm.html`로 이동  
  - `farmId` 있으면 사용자·농장명 표시 후 실시간 모니터링 메인

### 4.2 dashboard-monitoring.html (호환용, 선택)

- **역할**: 예전 링크 호환. 이 주소로 들어오면 `dashboard.html?farmId=xxx` 로 리다이렉트.
- **내용**  
  - 공통 헤더 + 네비 (“실시간 모니터링” active)  
  - 메인: 플레이스홀더 또는 추후 시설/칸별 현황 등
- **동작**  
  - `farmId` 필수, 없으면 대시보드 또는 농장 선택으로 유도

### 4.3 dashboard-schedule.html (일정 관리)

- **역할**: 기존 `dashboard.html` 내 “일정 관리” 섹션 전체 이전.
- **내용**  
  - 공통 헤더 + 네비 (“일정 관리” active)  
  - 상단: 검색, 주 네비게이션(‹ 📅 ›)  
  - 메인: 농장 구조(행) × 7일(열) 그리드 테이블
- **이전 대상**  
  - HTML: `#dashboardSectionSchedule` 블록  
  - 스크립트: `loadDashboardScheduleData`, `loadDashboardFacilitiesTree`, `renderScheduleGrid`, `getFlattenedTreeRows`, `getScheduleWeekStart`, `getDayType`, `bindScheduleWeekArrows`, `dashboardToggleNode`, 관련 변수(`dashboardTreeData`, `dashboardExpandedNodes`, `scheduleWeekStartDate`)
- **스타일**: `dashboard.css`, `farm_facilities.css` 등 기존 유지

### 4.4 dashboard-move.html (이동 관리)

- **역할**: 돈군/개체 이동 관리 전용.
- **내용**  
  - 공통 헤더 + 네비 (“이동 관리” active)  
  - 메인: 플레이스홀더 문구 또는 추후 이동 목록/등록 UI
- **동작**  
  - `farmId` 필수

### 4.5 dashboard-report.html (보고서 관리)

- **역할**: 보고서/통계 전용.
- **내용**  
  - 공통 헤더 + 네비 (“보고서 관리” active)  
  - 메인: 플레이스홀더 또는 추후 보고서 목록/필터
- **동작**  
  - `farmId` 필수

---

## 5. farmId 및 공통 초기화

### 5.1 farmId 획득

- **우선**: `URLSearchParams(window.location.search).get('farmId')`
- **선택**: 부재 시 `sessionStorage.getItem('dashboardFarmId')` 등으로 보완 가능 (동일 설계 내에서 일관되게 사용)

### 5.2 farmId 없을 때

- `dashboard.html`: “농장을 선택해 주세요” 문구 + 농장 선택/`select-farm.html` 링크
- 그 외 페이지: `dashboard.html` 또는 `select-farm.html`로 이동  
  - 예: `location.href = '/dashboard.html';` 또는 `location.href = '/select-farm.html';`

### 5.3 공통 스크립트 (제안)

- **파일**: `public/js/dashboard-common.js`
- **역할**  
  - `farmId` 읽기, 없을 때 리다이렉트/메시지  
  - 헤더: 사용자명, 농장명, 역할 표시 (`/api/auth/me` 등)  
  - 네비: 현재 페이지에 맞는 active 클래스 부여  
  - 로그아웃 공통 처리  
- 각 페이지는 이 스크립트를 포함하고, 필요 시 페이지별 스크립트만 추가

### 5.4 공통 스타일

- 모든 대시보드 페이지: `admin.css`, `dashboard.css`  
- 일정 페이지: 추가로 `farm_facilities.css` (기존과 동일)

---

## 6. 네비게이션 active 처리

- 각 HTML에서 **현재 페이지 식별자**를 하나 정한다 (예: `data-dashboard-page="schedule"`를 `<body>` 또는 `<main>`에 지정).
- `dashboard-common.js` 로드 후:
  - `document.querySelectorAll('.dashboard-nav-item')` 순회
  - `a.getAttribute('href')`에 현재 페이지 경로가 포함되어 있으면 해당 링크에 `active` 클래스 부여
  - 또는 `data-dashboard-page`와 네비의 `data-section`(또는 href)을 매칭해 active 부여

---

## 7. 구현 순서 제안

| 단계 | 작업 | 산출물 |
|------|------|--------|
| 1 | **공통 헤더·네비 조각** 생성 | `partials/dashboard-header-nav.html` (헤더+네비 전체 마크업) |
| 2 | **공통 스크립트** 작성 (조각 주입 포함) | `dashboard-common.js`: fetch 조각 → placeholder에 삽입, farmId/active/로그아웃 처리 |
| 3 | `dashboard.html` 수정 | placeholder + 공통 JS만 두기, 섹션 제거 |
| 4 | `dashboard-schedule.html` 신규 | placeholder + 일정 그리드, schedule 전용 JS |
| 5 | `dashboard-monitoring.html` 신규 | placeholder + 플레이스홀더 |
| 6 | `dashboard-move.html` 신규 | placeholder + 플레이스홀더 |
| 7 | `dashboard-report.html` 신규 | placeholder + 플레이스홀더 |
| 8 | `select-farm.html` 링크 | “대시보드” 클릭 시 `dashboard.html?farmId=xxx` 로 연결 (실시간 모니터링 메인) |

---

## 8. 디렉터리 구조 (반영 후)

```
public/
├── dashboard.html              # 진입/요약
├── dashboard-monitoring.html   # 실시간 모니터링
├── dashboard-schedule.html     # 일정 관리 (기존 섹션 이전)
├── dashboard-move.html         # 이동 관리
├── dashboard-report.html       # 보고서 관리
├── partials/
│   └── dashboard-header-nav.html   # 공통 헤더+네비 (한 곳만 수정 → 모든 페이지 반영)
├── js/
│   ├── dashboard-common.js     # 공통: partial 로드 주입, farmId, 헤더/네비 보정, active, 로그아웃
│   └── (기존 farm_schedule 등 유지)
├── css/
│   ├── admin.css
│   ├── dashboard.css
│   └── farm_facilities.css
├── farm_admin.html
├── select-farm.html
└── ...
```

---

## 9. 요약

- **5개 대시보드 계열 페이지**: `dashboard`, `dashboard-monitoring`, `dashboard-schedule`, `dashboard-move`, `dashboard-report`
- **공통**: 헤더 + 네비는 **한 파일**(`partials/dashboard-header-nav.html`)에만 두고, JS로 각 페이지에 주입 → **한 곳만 수정하면 모든 페이지에 동일 적용**
- **farmId** 쿼리 유지, `dashboard-common.js`로 초기화·네비 active·로그아웃
- **일정**: 기존 `dashboard.html`의 일정 섹션 + 스크립트를 `dashboard-schedule.html`로 이전
- **모니터링/이동/보고서**: 우선 플레이스홀더로 페이지만 구성 후, 기능은 단계적으로 추가

이 설계대로 구현하면 URL 기반 페이지 분할과 북마크/공유가 가능하고, 이후 기능 확장 시에도 파일 단위로 역할이 나뉘어 유지보수하기 좋습니다.
