# 농장 일정 관리 설계 제안

## 1. 목표

- **farm_admin.html** 왼쪽 메뉴에 **농장 일정 관리** 메뉴 추가
- 해당 페이지에서 농장별 일정 추가/삭제/관리
- 현재 **admin.html**의 `schedule_items`(전역 템플릿)를 농장별로 관리하려는 요구 반영
- **운영 시설 설정** 저장 시점과의 연동 방식 결정

---

## 2. 현재 구조 정리

| 구분 | 테이블/개념 | 설명 |
|------|-------------|------|
| 전역 마스터 | `schedule_items` | 농장 무관. “기본 일정 템플릿” (구분, 대상장소, 기준, 작업유형, 작업내용 등) |
| 전역 마스터 | `structure_templates` | 시설 종류 (분만사, 자돈사, 비육사 등) |
| 농장별 | `farm_structure` | 농장이 “사용하는” 운영 시설 (`farmId` + `templateId`) |
| 저장 시점 | farm_admin “정보 저장하기” / 운영 시설 저장 | `PUT /api/farms/:id` + `POST /api/farm-structure/:farmId/production` with `templateIds` |

- `schedule_items`는 **structureTemplateId**로 “어떤 시설에 적용되는 일정인지”만 가리키고, **농장과는 무관**합니다.

---

## 3. 제안 ①: “복사 저장” 방식 (요청하신 방식)

### 방식 요약

- **농장 스케줄 전용 테이블**을 하나 둠 (예: `farm_schedule_items`).
- **운영 시설 설정 저장** 시점(저장하기 버튼)에,  
  `schedule_items` 중 **structureTemplateId가 선택한 templateIds에 포함된 행**을  
  해당 농장용으로 **복사**해 `farm_schedule_items`에 넣음.
- 농장 일정 관리 화면에서는 **farm_schedule_items**만 조회/추가/수정/삭제.

### 테이블 예시: `farm_schedule_items`

`schedule_items`와 동일한 “업무 필드” + `farmId`:

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | PK, auto | 농장 일정 항목 ID |
| farmId | FK → farms | 농장 |
| targetType | string | pig / facility |
| structureTemplateId | FK → structure_templates | 대상장소 (선택 시설과 동일) |
| basisTypeId | FK | 기준 유형 |
| ageLabel | string | 일령 표시 |
| dayMin, dayMax | int | 날짜(시작/끝) |
| taskTypeId | FK | 작업유형 |
| description | text | 작업내용 |
| sortOrder | int | 정렬 순서 |
| isActive | boolean | 사용 여부 |
| recurrenceType, recurrenceInterval, … | (schedule_items와 동일) | 반복 일정 |

- **저장 시점**:  
  `POST /api/farm-structure/:farmId/production` 처리 시,  
  1) 기존 `farm_structure` production 덮어쓰기 (현재처럼)  
  2) 기존 해당 farm의 `farm_schedule_items` 삭제 (또는 “덮어쓰기” 정책에 따라 유지 여부 결정)  
  3) `schedule_items`에서 `structureTemplateId IN (templateIds)` 인 행만 조회  
  4) 각 행을 복사해 `farmId`만 넣어 `farm_schedule_items`에 insert  

### 장점

- 농장별로 **완전히 독립된 일정** 관리 가능 (추가/삭제/수정이 다른 농장/전역 템플릿에 영향 없음).
- “농장 일정 관리” 화면은 **farm_schedule_items**만 보면 되어 로직이 단순함.
- 운영 시설을 바꿀 때마다 “이 농장이 쓰는 시설에 맞는 템플릿 일정”을 **한 번에 반영**할 수 있음.

### 단점

- **데이터 중복**: 전역 `schedule_items` 수정(예: 작업내용 문구 변경)이 기존 농장에 **자동 반영되지 않음**.
- “전역 템플릿을 다시 반영하고 싶다”면 **재동기화(다시 복사)** 기능이 필요함 (예: “템플릿으로 초기화” 버튼).

### 결론

- “농장마다 일정을 **마음대로 편집**하고, 전역 템플릿은 **처음 세팅/재적용 시에만** 쓰겠다”는 요구에 잘 맞는 방식입니다.
- 구현 시 **운영 시설 저장 API**에서 “선택된 templateIds에 해당하는 schedule_items → farm_schedule_items 복사”만 추가하면 됩니다.

---

## 4. 제안 ②: “참조 + 선택” 방식 (대안)

### 방식 요약

- **farm_schedule_items**를 “복사본”이 아니라 **“이 농장이 쓰는 전역 일정” 목록**으로만 둠.
- 예: `(id, farmId, scheduleItemId, sortOrder, isActive)`  
  → “이 농장은 전역 일정 ID 3, 5, 7을 쓰고, 순서와 사용 여부만 농장별로 다르게 설정”하는 구조.

- **운영 시설 저장** 시:  
  `schedule_items` 중 `structureTemplateId IN (templateIds)` 인 ID 목록을 구해  
  `farm_schedule_items`를 **덮어쓰기** (기존 삭제 후, 해당 scheduleItemId들만 insert).

- 농장 일정 관리 화면:  
  - 목록: `farm_schedule_items` + join `schedule_items`로 표시.  
  - “추가”: 전역 목록에서 선택해 `farm_schedule_items`에 한 행 추가.  
  - “삭제”: 해당 농장의 `farm_schedule_items` 행만 삭제 (전역 항목은 유지).  
  - “순서/사용 여부”: `farm_schedule_items.sortOrder`, `isActive`만 수정.

### 장점

- **단일 출처**: 전역 `schedule_items` 수정 시, 해당 일정을 쓰는 **모든 농장**에 자동 반영.
- 저장 데이터량이 적음 (내용 복사 없이 참조만).

### 단점

- 농장별로 **작업내용/일령 등 내용을 다르게** 쓰고 싶으면,  
  “참조 + 선택”만으로는 불가하고 **별도 오버라이드 필드**나 “농장 전용 일정” 행을 추가해야 함.
- “농장에서 일정 내용을 마음대로 편집” 요구가 있으면 구조가 복잡해짐.

---

## 5. 권장 방향

- **“농장별로 일정을 추가/삭제/수정해서 관리한다”**는 요구가 명확하므로,  
  **제안 ①(복사 저장)** 을 권장합니다.
- 운영 시설 저장 시 **해당 시설에 해당하는 schedule_items → farm_schedule_items 복사**로  
  “농장 스케줄 테이블을 별도로 만들어 관리”하는 방식이 목표와 잘 맞습니다.

추가로 고려할 점:

1. **복사 시점**  
   - **운영 시설 저장할 때마다** “선택된 시설에 해당하는 일정”으로 farm_schedule_items를 **덮어쓰기**할지,  
   - 아니면 “기존 farm_schedule_items는 두고, **없는 structureTemplateId만** 새로 복사”할지 정책 결정이 필요합니다.  
   - 일반적으로는 “저장 시 **해당 farm의 farm_schedule_items를 선택 시설 기준으로 통째로 다시 만든다**”가 단순합니다.

2. **시설 미선택 일정**  
   - `schedule_items` 중 `structureTemplateId`가 null인 “공통” 일정이 있다면,  
   - 복사 시 “항상 포함”할지, “제외”할지 규칙을 하나 정해 두는 것이 좋습니다.

3. **재동기화**  
   - 나중에 “전역 템플릿이 수정되었으니, 이 농장 일정을 템플릿 기준으로 다시 맞추기”가 필요할 수 있으므로,  
   - “템플릿으로 초기화” 같은 API/버튼을 두는 것을 추천합니다.

---

## 7. 테이블 정리 (구현 기준)

### 7.1 농장에서 스케줄을 관리하기 위한 테이블

| 테이블 | 용도 |
|--------|------|
| **farm_schedule_items** | 농장별 일정 항목. 농장에서 "일정 항목"을 관리할 때 사용하는 **유일한 농장 전용 스케줄 테이블**. farmId + (구분, 대상장소, 기준, 작업유형, 작업내용, 반복 등) 저장. 운영 시설 저장 시 schedule_items에서 선택 시설에 해당하는 행만 복사. API: GET/POST/PUT/DELETE /api/farms/:farmId/schedule-items |

### 7.2 기준 유형·작업 유형 — 농장별 테이블 여부

**농장 전용 테이블 없음.** 둘 다 **전역(시스템 공통) 마스터**로만 운영됩니다.

| 테이블 | 용도 | 농장별 여부 |
|--------|------|-------------|
| **schedule_task_types** | 작업 유형 마스터 (예: 백신 접종, 이동) | **전역 1개**. admin 일정관리 설정과 farm_admin 농장 일정 관리에서 **같은 테이블** 조회/추가/수정. 농장별 테이블 없음. |
| **schedule_basis_types** | 기준 유형 마스터 (예: 전입일, 출산일, 매일) | **전역 1개**. admin·farm_admin 공통 사용. 농장별 테이블 없음. |

farm_schedule_items는 taskTypeId → **farm_schedule_task_types**.id, basisTypeId → **farm_schedule_basis_types**.id 로 참조합니다. (농장 전용 테이블 사용)

### 7.3 농장 전용 테이블 복사 시점

- **farm_schedule_task_types**, **farm_schedule_basis_types** 는 **농장 정보 설정** 페이지에서 **운영 시설 설정** 후 **"저장하기"** 할 때 다음 순서로 채워집니다.
  1. 전역 **schedule_task_types** 전체 → 해당 농장 **farm_schedule_task_types** 로 복사 (originalId 로 원본 id 보관)
  2. 전역 **schedule_basis_types** 전체 → 해당 농장 **farm_schedule_basis_types** 로 복사 (originalId 로 원본 id 보관)
  3. **schedule_items** 중 선택한 시설에 해당하는 행 → **farm_schedule_items** 로 복사 (이때 taskTypeId, basisTypeId 는 위 복사로 생긴 농장 전용 id 로 매핑)
- 따라서 농장별로 작업 유형·기준 유형을 따로 편집할 수 있고, 운영 시설을 다시 저장할 때마다 전역 데이터를 기준으로 농장 전용 테이블이 다시 채워집니다.

---

## 6. 구현 시 체크리스트 (제안 ① 기준)

- [ ] **DB**  
  - `farm_schedule_items` 테이블 생성 (schedule_items 컬럼 + farmId).  
  - FK: farmId → farms, structureTemplateId, basisTypeId, taskTypeId (필요 시).
- [ ] **API**  
  - `GET/POST/PUT/DELETE /api/farms/:farmId/schedule-items` (farm_schedule_items CRUD).  
  - `POST /api/farm-structure/:farmId/production` 내부에서  
    - 기존처럼 farm_structure 저장 후  
    - schedule_items에서 structureTemplateId IN (templateIds) 조회 → farm_schedule_items 복사(덮어쓰기).
- [ ] **farm_admin.html**  
  - 왼쪽 메뉴에 “농장 일정 관리” 추가.  
  - 해당 섹션에서 farm_schedule_items 목록 조회/추가/수정/삭제 UI.  
  - (선택) “템플릿으로 초기화” 버튼 → 위 복사 로직만 다시 실행하는 API 호출.

이렇게 하면 “운영 시설 설정 저장 시 schedule_items → 농장 스케줄 테이블 복사” 방식으로 농장별 일정을 안전하게 관리할 수 있습니다.
