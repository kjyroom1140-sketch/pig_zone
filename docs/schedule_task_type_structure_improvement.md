# 작업 유형 테이블 구조 개선 검토

작업 유형(`schedule_task_types`, `farm_schedule_task_types`)을 **구조적으로 개선할 필요가 있는지**와, 개선 시 어떤 방향이 맞는지 정리한 문서입니다.

---

## 1. 현재 구조 요약

| 테이블 | 주요 컬럼 | 비고 |
|--------|-----------|------|
| **schedule_task_types** (전역) | id, code, name, **category**, sortOrder, **appliesToAllStructures** | 농장 저장 시 farm 쪽으로 복사. **description** 컬럼은 미사용으로 삭제 권장. |
| **farm_schedule_task_types** (농장) | 동일 + farmId, originalId | |
| **schedule_task_type_structures** / **farm_schedule_task_type_structures** | task_type_id, structure_template_id | appliesToAllStructures=false일 때 "어느 시설에만 적용할지" |

- **category**: VARCHAR(50), 자유 문자열. 예: `vaccine`, `move`, `feed`, `environment`. 작업 계획(`farm_schedule_work_plans`)의 **taskTypeCategory**로 복사되어 "이동만", "환경만" 필터에 사용됨.
- **appliesToAllStructures**: 이미 도입됨. 특정 시설만 적용 시 연결 테이블 사용. (docs: `schedule_task_type_scope_improvement.md`)

---

## 2. 현재 구조의 한계

| 항목 | 내용 |
|------|------|
| **category 값 비표준** | 코드/화면에서 `category === 'environment'` 등으로 비교할 때, 실제 DB에는 `환경`, `시설환경` 등 다른 값이 들어갈 수 있어 **필터·분기 로직이 불안정**해짐. |
| **전입/시설 구분 불명확** | "작업 추가 시 전입 vs 시설"을 나누려면, **일정 항목(farm_schedule_items)의 targetType**만으로 판단해야 함. 작업 유형 자체에는 "이게 전입용인지 시설용인지"가 없어, **전입 전용 작업 유형**을 정할 때 코드나 이름에 의존하게 됨. |
| **시설 세부(관리/환경/방역) 미정의** | 시설 작업을 "관리·환경·방역"으로 나누려면, 현재는 **category**에 임의 문자열을 넣는 수밖에 없음. 어떤 값이 "관리"인지 "방역"인지 **정의된 코드 집합이 없음**. |
| **대분류만 있고 계층 없음** | category가 한 단계뿐이라, "시설 > 환경", "돼지 > 백신" 같은 **2단계 그룹**을 쓰려면 별도 컬럼이나 테이블이 필요함. |

---

## 3. 개선 필요 여부 결론

**필수로 바꿀 필요는 없지만**, 아래를 쓰려면 **구조적 개선을 추천**합니다.

- **빈방 작업 추가**: 전입 vs 시설 구분, 시설은 "관리/환경/방역" 선택 후 작업 내용 입력.
- **그리드/API 필터**: "전입만", "시설만", "시설 중 방역만" 등 안정적으로 필터링.
- **통계/리포트**: 작업 유형 대분류·시설 세부항목별 집계.

**현 구조만으로도** "category에 값을 잘만 넣어 두면" 동작은 가능하지만, **값이 제각각이면** 화면/API마다 조건이 달라지고 유지보수가 어려워집니다. 그래서 **최소한 "카테고리 표준화"**를 권장하고, 여유가 있으면 **작업 유형에 적용 대상(돼지/시설) 또는 카테고리 마스터 테이블**을 두는 방안을 권장합니다.

---

## 4. 개선 방안

### 4.1 방안 A: category 값 표준화만 (최소 변경, 추천 1순위)

**내용**  
테이블 스키마는 그대로 두고, **category에 넣을 수 있는 값**을 문서·코드에서 **고정 코드 집합**으로 정의합니다.

| 코드(소문자) | 의미 | 용도 |
|--------------|------|------|
| entry | 전입 | 빈방 작업 추가 시 "전입" 선택, 돈군 생성 연동 |
| move | 이동 | 돈군 이동·합사·분리 |
| vaccine | 백신·건강 | 백신, 검역, 투약 |
| feed | 사료·급여 | 사료 전환, 급여 |
| facility_management | 시설·관리 | 점검, 정리, 설비 |
| facility_environment | 시설·환경 | 환기, 온도, 습도 |
| facility_disinfection | 시설·방역 | 소독, 세척, 방역 |
| other | 기타 | 위에 해당하지 않는 작업 |

**구현**  
- **마이그레이션**: 기존 category 값을 위 코드로 **매핑** (예: `환경` → `facility_environment`, `방역` → `facility_disinfection`).  
- **admin/farm_admin**: 작업 유형 추가·수정 시 category를 **셀렉트**로만 선택하게 하고, 위 코드만 저장.  
- **API/화면**: `category === 'entry'` / `category === 'facility_management'` 등으로 분기.  
- **문서**: `schedule_task_type_structure_improvement.md` 또는 `schedule_target_type_recommendation.md`에 "작업 유형 category 코드 정의" 절을 두고 유지.

**장점**  
- 스키마 변경 없음.  
- 전입/시설/시설 세부(관리·환경·방역)를 안정적으로 구분 가능.  

**단점**  
- 새 대분류가 생기면 코드/문서를 수정해야 함.  
- "이 작업 유형이 돼지용인지 시설용인지"는 **일정 항목의 targetType** 또는 **category 값으로 추론**해야 함 (entry, facility_* → 시설/돼지 구분 가능).

---

### 4.2 방안 B: 작업 유형에 targetType(scope) 추가

**내용**  
`schedule_task_types` / `farm_schedule_task_types`에 **targetType** (또는 **scope**) 컬럼을 추가합니다.

| 컬럼 | 타입 | NULL | 설명 |
|------|------|------|------|
| targetType | VARCHAR(20) | Y | `pig` \| `facility`. 이 작업 유형이 **돼지 일정용**인지 **시설 일정용**인지. NULL이면 둘 다 허용(기존 호환). |

- **전입**: targetType = `pig` (또는 전입 전용 값 `entry`를 쓰려면 category와 조합).  
- **시설(관리·환경·방역)**: targetType = `facility`, category로 관리/환경/방역 구분.

**효과**  
- "작업 추가 모달에서 전입 vs 시설"을 **작업 유형 목록만으로** 필터 가능 (해당 targetType만 노출).  
- 일정 항목의 targetType과 불일치하는 작업 유형을 선택하는 실수를 줄일 수 있음 (선택 사항: 저장 시 검증).

**마이그레이션**  
- 기존 행: category 또는 code로 추론해 targetType 채우기 (예: `entry`, `vaccine`, `move`, `feed` → pig; `facility_*` → facility).  
- 새 행: 작업 유형 추가 시 targetType 필수 또는 기본값 지정.

---

### 4.3 방안 C: 카테고리 마스터 테이블 추가

**내용**  
**작업 유형 카테고리**를 별도 테이블로 두고, 작업 유형은 그 테이블을 FK로 참조합니다.

| 테이블 | 역할 |
|--------|------|
| **schedule_task_type_categories** (전역) | id, code, name, targetType(pig/facility), sortOrder. 예: (entry, 전입, pig), (facility_management, 시설·관리, facility), (facility_environment, 시설·환경, facility), (facility_disinfection, 시설·방역, facility), (vaccine, 백신, pig), … |
| **schedule_task_types** | **categoryId** INTEGER FK → schedule_task_type_categories (기존 category 문자열 대체 또는 병행) |

- 농장 쪽도 **farm_schedule_task_type_categories**를 두거나, 전역 카테고리만 참조하도록 farm_schedule_task_types에 **categoryId** (전역 카테고리 참조)를 둘 수 있음.

**장점**  
- 카테고리 추가·이름 변경이 **한 곳**에서만 이뤄짐.  
- targetType을 카테고리에 두면, "전입/시설" 및 "시설 중 관리/환경/방역" 필터가 모두 카테고리 기준으로 통일됨.  

**단점**  
- 테이블·API·화면이 늘어남.  
- 기존 category 문자열을 마이그레이션해 categoryId로 옮겨야 함.

---

## 5. 결론: 기존 category만 사용 + description 컬럼 삭제

**새 컬럼(targetType)을 추가하지 않고, 이미 있는 category 컬럼만 표준화해서 사용**하는 방식을 권장합니다.  
동시에 **사용하지 않는 description 컬럼은 삭제**합니다.

| 구분 | 내용 |
|------|------|
| **전입/시설 구분** | **category** 값으로 구분. 예: `entry` → 전입, `facility_management` / `facility_environment` / `facility_disinfection` → 시설(관리·환경·방역). 코드에서 `category === 'entry'` 또는 `category?.startsWith('facility_')` 등으로 분기. |
| **targetType 컬럼** | **추가하지 않음.** category만으로 전입·시설·시설 세부를 구분 가능. |
| **description 컬럼** | **삭제.** UI·API에서 미사용이므로 모델·라우트에서 제거하고, DB에서도 `ALTER TABLE ... DROP COLUMN description` 로 제거 권장. |

**정리**:  
- **category**에 표준 코드 집합(§4.1 표)만 넣고, admin/farm_admin에서 **category 셀렉트**로만 선택하게 하면 전입/시설/시설 세부 구분이 가능함.  
- **description**은 작업 유형 목록·폼에서 쓰이지 않으므로 컬럼 삭제로 정리.

---

## 6. 추천 작업 요약

| 항목 | 내용 |
|------|------|
| **category** | 표준 코드(entry, move, vaccine, feed, facility_management, facility_environment, facility_disinfection, other) 정의 + admin/farm_admin에서 셀렉트로만 저장. 기존 데이터는 필요 시 매핑 마이그레이션. |
| **description** | `schedule_task_types`, `farm_schedule_task_types` 두 테이블에서 **컬럼 삭제**. 모델·라우트·프론트에서 해당 필드 제거 완료. **DB**에서 실제 컬럼을 지우려면 아래 SQL 실행. |

**DB에서 description 컬럼 제거 (선택)**  
이미 모델·API·프론트에서는 description을 제거했으므로, DB에 해당 컬럼이 남아 있어도 앱은 동작합니다. 테이블 정의를 맞추려면 다음을 실행하면 됩니다.

```sql
-- PostgreSQL
ALTER TABLE schedule_task_types DROP COLUMN IF EXISTS description;
ALTER TABLE farm_schedule_task_types DROP COLUMN IF EXISTS description;
```

---

## 7. (참고) targetType 추가·마스터 테이블

- **targetType 컬럼 추가(방안 B)**: 전입/시설을 컬럼으로 명시하고 싶을 때만 검토. 현재는 category만으로 충분하다고 가정.
- **카테고리 마스터 테이블(방안 C)**: 카테고리 종류가 매우 많아지고 이름/순서를 자주 바꿀 때만 검토.

---

## 8. 참고 문서

- `schedule_task_type_scope_improvement.md` — 적용 대상(전체 시설 vs 특정 장소)  
- `schedule_target_type_recommendation.md` — 구분·카테고리 확장  
- `schedule_work_add_empty_barn_design.md` — 빈방 작업 추가(전입 vs 시설)  
- `schedule_template_db_design.md` — 현재 일정 DB 구조
