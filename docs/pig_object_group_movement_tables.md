# 돼지 객체·돈군·이동 관리 테이블 설계

기존 문서(`pig_management_tables_recommendation.md`, `pig_movement_design_recommendation.md`, `facility_structure_overview.md`)를 바탕으로, **객체 관리**, **돈군 관리**, **이동 관리**용 테이블 구체안을 정리한 문서입니다.

---

## 1. 전체 구조 요약

| 테이블 | 역할 | 비고 |
|--------|------|------|
| **pigs** (객체 관리) | 한 마리 단위 관리. 개체 ID, 품종, 성별, **소속 돈군(pig_group_id)** 등 | 돈군 UUID 컬럼으로 "이 객체가 어느 돈군 소속인지" 식별 |
| **pig_groups** (돈군 관리) | 한 무리 단위. 두수, 입식일, 현재 칸(section), 품종·상태 등 | 일정·이동·사육의 기본 단위 |
| **(선택) section_group_occupancy** (돈군 배치) | 칸별·돈군별 재적. 어느 칸에 어느 돈군이 몇 두 있는지, 입주/퇴거 시점 | **사육 두수**는 이 테이블 또는 pig_groups 기준. 한 칸에 여러 돈군 공존 시 유리 |
| **pig_movements** (이동 관리) | 이동 이벤트 1건 = 1행. 출발/도착 칸, 돈군, 일시, 두수 등 | 돈군 합·분할 시에도 1회 이동당 1행으로 기록, **사별(칸/방/돈사) 조회** 가능 |

- 시설 계층: `farm_buildings` → `farm_barns` → `farm_rooms` → `farm_sections` (기존 유지).
- **현재 위치**는 돈군·객체 쪽에 두고, **이동 이력**은 이동 테이블에만 둡니다.

**특정 방의 칸에 돼지 몇 마리 있는지(사육 두수) — 이동 테이블이 아니라 돈군·배치 테이블 참고**

- **사육 두수 확인은 이동 테이블을 기준으로 하지 않는다.** 이동 테이블(pig_movements)은 “언제, 어디서→어디로, 몇 두” **이력**만 담고 있어서, 현재 시점 “이 칸에 몇 마리”를 구하려면 모든 이동을 역산해야 하며 복잡하고 오류에 취약하다.
- **현재 시점 “해당 방의 칸에 돼지 몇 마리 있는지”** 는 **돈군 테이블(pig_groups)** 또는 **(선택) 칸–돈군 배치(section_group_occupancy)** 를 참고한다.
  - **pig_groups** 만 쓸 때: `WHERE current_section_id = :sectionId AND status = 'active'` 인 돈군들의 **headcount 합계** = 그 칸에 있는 **현재 두수**.
  - **section_group_occupancy** 를 쓸 때: `WHERE section_id = :sectionId AND ended_at IS NULL` 인 행들의 **headcount 합계** = 그 칸에 있는 현재 두수.
- 이동 테이블은 **과거 이동 이력·사별 이동 조회**용으로만 사용하고, **사육 두수(현재 두수)** 는 항상 돈군(또는 배치) 테이블에서만 구한다. 이동이 발생할 때마다 돈군의 current_section_id·headcount(또는 배치 테이블)를 갱신해 두면, 사육 두수는 그 테이블만 보면 된다.

---

## 1.1 시나리오: RFID 전자이표를 일부 돼지에만 사용 (돈군 + 객체 혼합 관리)

일부 돈사만 **RFID 전자이표**를 운영하고, **모든 돼지에 쓰지 않고 일부 개체에만** RFID를 부착하는 경우를 정리한 시나리오입니다.

| 구분 | 내용 |
|------|------|
| **돈군 관리** | 모든 돼지 무리를 **돈군(pig_groups)** 단위로 관리. 두수, 입식일, 현재 칸, 이동 등은 돈군 기준으로 공통 적용. |
| **객체 관리** | **RFID를 부착한 개체만** 객체 테이블(`pigs`)에 등록. RFID 미부착 개체는 객체 행을 만들지 않고, 돈군의 headcount에만 포함. |
| **관계** | 한 돈군 안에 “객체로 등록된 마리(RFID)” + “객체 미등록 마리(두수만)”가 함께 있을 수 있음. |

**데이터 의미**

- **pig_groups.headcount** = 해당 돈군의 **전체 두수** (RFID 유무와 무관).
- **pigs** 테이블 행 수 = **RFID 등으로 개체 관리하는 마리 수**만 해당.
- 따라서 `headcount >= COUNT(pigs WHERE pig_group_id = 해당 돈군)` 이며, 차이는 “객체 미등록(비RFID 등)” 두수.

**운영 시 유의점**

- RFID 부착 시: 해당 개체를 `pigs`에 1건 등록하고 `pig_group_id`를 현재 돈군으로 설정. **돈군은 이미 출생/입식 등록 시 생성되어 있으므로** `pig_groups.headcount`는 올리지 않으며, **해당 칸의 사육 두수는 변하지 않는다.**
- RFID 미부착 개체: 별도 행 없음. 이동·합·분할은 **돈군 단위**로만 처리하면 됨.
- 돈군 분할 시: RFID 부착 개체는 새 돈군 중 하나에 소속되도록 각 `pigs.pig_group_id`를 갱신. 나머지 두수는 돈군 headcount·이동 테이블로만 반영.
- “이 돈군에 RFID 개체가 몇 두인지”는 `COUNT(*) FROM pigs WHERE pig_group_id = ?` 로 조회.

**객체 테이블 확장**  
객체가 **RFID 부착 개체인지** 구분하려면 `pigs` 테이블에 아래처럼 두면 됩니다.

- **ear_tag_type** (VARCHAR): `'rfid'` / `'barcode'` / `'none'` 등. RFID 운영 돈사에서 부착한 개체는 `'rfid'`.
- **rfid_tag_id** (VARCHAR, NULL 허용): 전자이표에서 읽은 RFID ID. NULL이면 비RFID 또는 미등록.

이렇게 하면 “돈군은 전부 관리 + 객체는 RFID 부착분만 관리”하는 혼합 시나리오를 일관되게 다룰 수 있습니다.

---

## 1.2 시나리오: 입식/출생 시 방별 돈군 형성 + 분할 시 "어느 방에 몇 %" 기록

처음 **입식**되거나 **출생**한 시점에는 **방(room) 단위로 돈군이 형성**되고, 그 방에 **몇 마리인지**를 저장한 뒤, 이후 **이동·분할** 시에는 **어느 방에 몇 %** 갔는지 비율로 남기고 싶은 경우를 위한 시나리오입니다.

**입식/출생 시 — 방별 돈군 형성, 방에 몇 마리 저장**

- **입식**: 특정 **방(또는 그 방의 한 칸)** 에 넣을 때, 그 방(칸) 기준으로 **돈군 1개 생성**. `pig_groups`에 current_section_id = 해당 방의 칸, headcount = **그 방에 들어간 마리 수** 저장.
- **출생**: 특정 **방**에서 출생한 경우에도 그 방(칸) 기준으로 **돈군 1개 생성**, headcount = **그 방에 있는(출생 포함) 마리 수** 저장.
- "그 방에 몇 마리"는 **pig_groups.headcount** 와 current_section_id(그 방의 section)로 표현.

**출생 등록 시 같은 돈군으로 묶는 날짜 간격 — 최대 3일**

- 해당 **방**에 이미 출생한 돼지가 있고, 그 출생일이 **3일 이내**이면 **같은 돈군에 포함**한다. (새 돈군을 만들지 않고, 기존 돈군의 headcount를 올린다.)
- **날짜 간격**: 같은 방에서 **가장 최근 출생일(또는 해당 돈군의 대표일)** 로부터 **3일 이내**에 출생한 경우 → **그 돈군에 포함**. 3일을 초과하면 **새 돈군 1개 생성** 후 해당 출생을 그 돈군에 넣는다.
- **객체 테이블(pigs)은 돈군 두수와 무관하게 기본으로 만들지 않음.** 해당 방에 돈군이 10마리( headcount=10 )이어도 **객체 테이블에는 0행**이어도 된다. 돈군만으로 “그 방에 10마리”를 관리.
- **객체 테이블 행은 “개별가 확인된 경우”에만 생성.** 생일이 다른 돼지를 **개별 출생 등록**했더라도, **RFID 등으로 그 개체가 개별 식별된 경우에만** 객체(pigs) 테이블에 1행을 만든다. RFID 미부착·개별 미확인인 출생은 돈군 headcount만 반영하고, pigs 행은 만들지 않음.
- 정리: **돈군** = “같은 방에서 3일 이내 출생한 무리” 단위, headcount로 두수 관리. **객체** = RFID 등으로 **개별가 확인된 마리만** pigs 에 1행, pig_group_id 로 소속 돈군 연결.

**출생(또는 방/칸) 등록 후 나중에 RFID 태그 장착·객체 등록하는 경우**

- 어느 **방·칸에서 출생을 등록**하면 그 시점에 **돈군이 먼저 생성**되고, 해당 칸의 사육 두수는 **돈군의 headcount**로 이미 반영된다.
- **이후** 작업자가 RFID 태그를 장착하고 **객체(pigs) 등록**을 하는 경우, **그 칸의 사육 두수는 변화가 없다.** (해당 마리는 이미 돈군 headcount에 포함되어 있기 때문.)
- 이때 수행하는 작업은 **해당 칸의 돈군에 객체만 연결**하는 것이다: `pigs` 테이블에 1건 INSERT하고 `pig_group_id` = 그 돈군 id, `rfid_tag_id` 등 설정. **pig_groups.headcount는 올리지 않는다.**

**분할 시 — "어느 방에 몇 %" 기록**

- **원칙**: 분할 시 **목적지(방/칸)마다 이동 행 1건**을 두고, 각 행에 **원 돈군 대비 비율(%)** 을 넣는다.
- **pig_movements** 에 추가 컬럼 (4.2절 참고):
  - **source_group_id** (UUID, NULL): **분할 시 원 돈군** id. 같은 분할 이벤트끼리 묶을 때 사용.
  - **split_percentage** (INTEGER 0~100, NULL): **분할 시** "원 돈군 중 이 목적지(to_section_id)로 간 비율(%)". 예: 60 이면 60%.
- **기록 예**: 원 돈군 A(100두)가 방1(60%), 방2(40%)로 분할 → 원 돈군 A 종료. 새 돈군 A1 → 방1 이동 행: headcount=60, source_group_id=A, split_percentage=60. 새 돈군 A2 → 방2 이동 행: headcount=40, source_group_id=A, split_percentage=40. 방 단위 조회는 to_section_id → farm_sections → room_id 조인으로 "방별 분할 비율" 집계.

---

## 2. 객체 관리 테이블 (pigs)

**객체 테이블은 돈군 두수와 무관하게 기본으로 생성하지 않는다.** 해당 방에 돈군 10마리가 있어도 pigs 테이블에는 0행이어도 된다.  
**생일이 다른 개별 출생을 등록한 경우에도**, **RFID 등으로 그 개체가 개별 식별된 경우에만** 객체(pigs) 행을 만든다.  
즉, **RFID로 인해 개별 객체가 확인된 경우에만** 객체 테이블 행을 형성한다. **돈군 UUID(`pig_group_id`)** 로 “이 개체가 어느 돈군에 속하는지”를 저장한다.

### 2.1 테이블: `pigs`

| 컬럼 | 타입 | NULL | 설명 |
|------|------|------|------|
| id | UUID | N | PK, 기본값 UUID |
| farm_id | UUID | N | FK → farms.id |
| **pig_group_id** | **UUID** | **Y** | **FK → pig_groups.id. 이 개체가 속한 돈군. NULL = 미편입/돈군 미사용** |
| individual_no | VARCHAR(50) | Y | 개체 번호(귀표 등) |
| **ear_tag_type** | **VARCHAR(20)** | **Y** | **귀표 유형. 'rfid'(전자이표), 'barcode', 'none' 등. RFID 일부 적용 시 RFID 부착 개체만 'rfid'** |
| **rfid_tag_id** | **VARCHAR(100)** | **Y** | **RFID 전자이표 ID. 전자이표에서 읽은 값. NULL이면 비RFID/미등록** |
| breed_type | VARCHAR(50) | Y | 품종 (pig_breeds 참조 또는 코드) |
| gender | VARCHAR(20) | Y | 성별 (암컷/수컷 등) |
| birth_date | DATE | Y | 출생일 |
| entry_date | DATE | Y | 전입/입식일 |
| status | VARCHAR(30) | Y | 상태 (사육중, 출하, 폐사 등) |
| created_at | TIMESTAMP | N | |
| updated_at | TIMESTAMP | N | |

- **pig_group_id**: 이 객체가 속한 돈군. RFID 등으로 개별 확인된 경우에만 pigs 행을 만들 때, 해당 돈군 id를 넣는다. 분할 시 새 돈군 id로 갱신.
- 돈군별 두수: 돈군 테이블의 **headcount** = 해당 돈군 **전체 두수** (객체 행 수와 무관). 객체 테이블은 “개별 확인된 마리”만 있으므로 `COUNT(*) FROM pigs WHERE pig_group_id = ?` = 그 돈군 내 **객체로 등록된(RFID 등) 두수**, headcount − COUNT = 객체 미등록(두수만 관리) 두수.
- **ear_tag_type**, **rfid_tag_id**: **객체 행은 RFID 등으로 개별가 확인된 경우에만 생성**하므로, 이 컬럼으로 전자이표 유형·ID를 저장·조회.

---

## 3. 돈군 관리 테이블 (pig_groups)

"한 무리" 단위. 일정·이동·사육의 기본 단위로 사용합니다.

### 3.1 테이블: `pig_groups`

| 컬럼 | 타입 | NULL | 설명 |
|------|------|------|------|
| id | UUID | N | PK (DB 내부 식별자) |
| farm_id | UUID | N | FK → farms.id |
| **group_no** | **VARCHAR(30)** | **Y** | **돈군 번호(사람이 보는 식별자). 생성 일시 기반 → 3.3절 참고** |
| current_section_id | UUID | Y | FK → farm_sections.id. 현재 있는 칸(주된 위치) |
| entry_date | DATE | Y | 입식/전입일 |
| birth_date | DATE | Y | 출생일 |
| breed_type | VARCHAR(50) | Y | 대표 품종 |
| headcount | INTEGER | Y | 두수 (객체 테이블 사용 시 COUNT로 보정 가능) |
| status | VARCHAR(30) | Y | active, split, merged, closed 등 |
| parent_group_id | UUID | Y | FK → pig_groups.id. 분할 시 “원래 돈군” 참조 |
| created_at | TIMESTAMP | N | 돈군 번호(group_no) 생성에 사용 (3.3절) |
| updated_at | TIMESTAMP | N | |

- **분할**: 원 돈군 status='split' 등으로 종료, 나뉜 무리마다 새 행 생성(새 UUID + 새 group_no), parent_group_id로 원 돈군 연결.
- **합병**: 한쪽 종료 후 다른 쪽에 두수 합치거나, “합병된 새 돈군” 1건 생성 후 객체들의 pig_group_id만 갱신.

### 3.3 돈군 번호(group_no) 생성 방법 — 만든 날짜·시간 기반

- **원칙**: 돈군을 **만든 시점(created_at)** 의 날짜·시간 값을 이용해 **돈군 번호**를 만든다.
  - DB PK는 그대로 **UUID**를 쓰고, 사람이 읽기 쉬운 **돈군 번호**는 별도 컬럼 `group_no`(VARCHAR)에 저장한다.
- **권장 형식** (생성 일시 초 단위까지 사용):
  - `YYYYMMDDHHmmss`  
    예: 2025년 6월 15일 14시 30분 22초 → `20250615143022`
  - **같은 초에 여러 돈군 생성**될 수 있으면 충돌 방지:
    - **방법 A**: 초 뒤에 **일련번호** 붙이기. 예: `20250615143022-1`, `20250615143022-2` (같은 초 생성 건 수로 부여)
    - **방법 B**: **밀리초**까지 사용. 예: `20250615143022123` (초 + 밀리초 3자리)
- **구현**: INSERT 직후 `created_at`으로 `group_no`를 계산해 업데이트하거나, 애플리케이션에서 생성 시점의 현재 시각으로 만들어 INSERT 시 함께 넣는다.
- **이동만 할 때**: 같은 돈군이 칸만 바꿀 뿐이면 **돈군을 새로 만들지 않는다**. 기존 돈군의 `group_no`·`id`는 그대로 두고, `current_section_id`와 이동 테이블만 갱신한다.

### 3.4 섞임·분할·합침 — 언제 새 돈군을 만들고, 언제 유지할지

| 상황 | 새 돈군 만드는가? | 처리 방법 |
|------|-------------------|-----------|
| **그냥 이동** | 안 만듦 | 돈군 A가 칸1→칸2로 이동. A의 id·group_no 유지, current_section_id만 칸2로 변경, 이동 테이블에 1행만 추가. |
| **두 돈군이 같은 칸에 있음(섞임)** | 안 만듦 | A돈군, B돈군이 같은 칸에 같이 있는 상태. A와 B는 그대로 두 개 유지. "한 칸에 여러 돈군"이므로 section_group_occupancy(또는 current_section_id)로 "이 칸에 A n두, B m두"만 기록. 새 돈군 생성 없음. |
| **섞였다가 다시 흩어짐** | 안 만듦 | 같은 칸에 있던 A를 칸1로, B를 칸2로 보내는 이동만 기록. A→칸1, B→칸2 이동 2건. A·B 돈군은 그대로, id·group_no 변경 없음. |
| **한 돈군을 둘로 나눔(분할)** | 만듦 | 원 돈군(예: A)은 종료(status='split'). 나뉜 각 무리마다 새 돈군 1개 생성 → 새 UUID + 그 시점 created_at으로 새 group_no 부여. parent_group_id = A.id. 이동 테이블에는 "새 돈군1 원칸→칸1", "새 돈군2 원칸→칸2" 각 1행. |
| **두 돈군을 하나로 합침(합병)** | 선택 | (1) 한쪽에 흡수: A는 유지, B는 종료. B 소속 객체/두수를 A로 옮기고, 이동 테이블에 "B가 B칸→A현재칸" 1행( movement_type='merge'). (2) 합병된 새 돈군: A·B 둘 다 종료, 새 돈군 C 1개 생성(새 id + 그 시점 created_at으로 group_no). A·B 소속을 모두 C로 옮기고, 이동 테이블에 A출발→도착, B출발→도착 각 1행. |
| **섞였다가 "하나로 합친 뒤" 다시 나눔** | 만듦 | 1단계: A와 B를 합병 → (1)이면 A 1개만 남기거나, (2)면 새 돈군 C 1개 생성. 2단계: C를 분할 → C 종료, 나뉜 무리마다 새 돈군 C1, C2 생성(각각 새 id·group_no, parent_group_id=C). 이동 이력은 "A,B → C → C1, C2" 순서로 조회 가능. |

**정리**: 이동만 하면 돈군 ID/번호는 그대로 둔다. 같은 칸에 있어도 "합치지 않기로 하면" A·B 두 돈군 유지, 새 돈군 안 만든다. 의도적으로 "한 무리로 합친다"고 할 때만 합병(한쪽 흡수 또는 새 돈군 1개 생성). 한 무리를 "둘 이상으로 나눈다"고 할 때만 분할(원 돈군 종료 + 나뉜 만큼 새 돈군 생성, 각각 생성 시점으로 group_no 부여).

### 3.2 (선택) 칸–돈군 배치: `section_group_occupancy`

한 칸에 여러 돈군이 함께 있을 때 “어느 칸에 어느 돈군이 몇 두 있는지” 현재 시점 기록.

| 컬럼 | 타입 | NULL | 설명 |
|------|------|------|------|
| id | UUID | N | PK |
| section_id | UUID | N | FK → farm_sections.id |
| pig_group_id | UUID | N | FK → pig_groups.id |
| headcount | INTEGER | N | 해당 칸에서 이 돈군의 두수 |
| started_at | TIMESTAMP | Y | 해당 칸 입주 시점 |
| ended_at | TIMESTAMP | Y | 해당 칸 퇴거 시점 (NULL이면 현재 재적) |
| created_at | TIMESTAMP | N | |
| updated_at | TIMESTAMP | N | |

- “이 칸에 현재 어떤 돈군들이 있는지”: `WHERE section_id = ? AND ended_at IS NULL`.

**돈군이 한 섹션에서 다른 섹션으로 이동할 때** — 배치 테이블에는 **새 행이 1개만** 생깁니다.  
  - **기존 행(출발 칸)** : 해당 돈군의 "현재 재적" 행 1건에 `ended_at = 이동 일시` 로 **갱신**하여 퇴거 처리. (새로 만드는 게 아님.)  
  - **도착 칸** : `section_id = 도착 칸`, `pig_group_id`, `headcount`, `started_at = 이동 일시`, `ended_at = NULL` 인 **새 행 1건 INSERT**.  
  - 따라서 "이동 1번"당 **INSERT 1건 + UPDATE 1건**이며, **행이 2개 새로 만들어지지는 않습니다.**

---

## 4. 이동 관리 테이블 (pig_movements) — 추천안

돈군이 **합쳐지고 나뉘는 경우**와 **사별(칸/방/돈사) 이동 기록 조회**를 모두 고려한 설계입니다.

### 4.1 설계 원칙

- **이동 1건 = 1행**: 한 번의 “이동 이벤트”당 레코드 1개.
- **돈군 단위 기록**: 한 행은 “한 돈군이 한 출발칸 → 한 도착칸으로 이동”을 나타냄.  
  - 분할 시: 나뉜 돈군마다 새 UUID 부여 후, 각각에 대해 이동 행 1건씩 생성.  
  - 합병 시: “A돈군 칸1→칸2”, “B돈군 칸3→칸2”처럼 돈군별로 각각 1행씩 두면, 나중에 돈군·사별 조회가 모두 가능.
- **사별 조회**: `from_section_id`, `to_section_id`를 두고, `farm_sections`와 조인해 room_id, barn_id로 필터하면 “해당 방/돈사 기준 이동 기록” 조회 가능.

### 4.2 테이블: `pig_movements`

| 컬럼 | 타입 | NULL | 설명 |
|------|------|------|------|
| id | UUID | N | PK |
| farm_id | UUID | N | FK → farms.id (사별/농장별 조회용) |
| pig_group_id | UUID | Y | FK → pig_groups.id. 이동한 돈군. NULL이면 “돈군 미지정 두수 이동” 등 |
| from_section_id | UUID | Y | FK → farm_sections.id. 출발 칸 (전입은 NULL 가능) |
| to_section_id | UUID | Y | FK → farm_sections.id. 도착 칸 (출하·폐사는 NULL 가능) |
| moved_at | TIMESTAMP | N | 이동 일시 |
| headcount | INTEGER | Y | 이동 두수 |
| **split_percentage** | **INTEGER** | **Y** | **분할 시 원 돈군 대비 이 목적지(to)로 간 비율(0~100). 일반이동/전입/출하 시 NULL** |
| movement_type | VARCHAR(30) | Y | transfer(일반이동), entry(전입), shipment(출하), merge, split 등 |
| **source_group_id** | **UUID** | **Y** | **분할 시 원 돈군 id(FK → pig_groups). 같은 분할 이벤트 행 묶을 때 사용** |
| schedule_item_id | UUID | Y | FK → farm_schedule_items.id (해당 시 선택). 일정 연계 |
| moved_by | UUID | Y | FK → users.id (실행자) |
| memo | TEXT | Y | 비고 |
| created_at | TIMESTAMP | N | |

### 4.3 사별 이동 기록 조회 방법

- **특정 칸(section) 기준**  
  - “이 칸에서 나간 이동”: `WHERE from_section_id = :sectionId`  
  - “이 칸으로 들어온 이동”: `WHERE to_section_id = :sectionId`  
  - “이 칸과 관련된 모든 이동”: `WHERE from_section_id = :sectionId OR to_section_id = :sectionId`  
  - 기간 조건: `moved_at BETWEEN :start AND :end` 추가.

- **특정 방(room) 기준**  
  - `farm_sections`에서 해당 room_id의 section id 목록 조회 후,  
  - `from_section_id IN (:sectionIds) OR to_section_id IN (:sectionIds)` 로 조회.

- **특정 돈사(barn) 기준**  
  - 해당 barn_id의 section id 목록 조회 후,  
  - 동일하게 `from_section_id IN (:sectionIds) OR to_section_id IN (:sectionIds)` 로 조회.

- **돈군 기준**  
  - “이 돈군의 모든 이동 이력”: `WHERE pig_group_id = :groupId ORDER BY moved_at`.

이렇게 하면 **돈군 합·분할**은 돈군 테이블 + 이동 테이블에 “돈군별 1건 1행”으로 남기고, **사별 조회**는 section_id(및 room/barn 조인)만으로 일관되게 처리할 수 있습니다.

### 4.4 돈군 합침·분할 시 이동 테이블 활용

| 상황 | 이동 테이블 기록 방식 |
|------|------------------------|
| **일반 이동** | pig_group_id, from_section_id, to_section_id, moved_at, headcount 1행. source_group_id, split_percentage = NULL. |
| **돈군 분할** | 원 돈군은 pig_groups에서 status 종료. 나뉜 각 목적지(방/칸)마다 이동 1행: pig_group_id=새 돈군 id, source_group_id=원 돈군 id, split_percentage=원 돈군 대비 비율(0~100). movement_type=split. 방별 비율 조회는 source_group_id+moved_at으로 묶고 to_section_id→room 조인. |
| **돈군 합침** | “A돈군 출발칸→도착칸” 1행, “B돈군 출발칸→도착칸” 1행 식으로 돈군별 1행. source_group_id, split_percentage=NULL. movement_type=merge. |
| **전입** | to_section_id만 두고 from_section_id=NULL, movement_type='entry'. source_group_id, split_percentage = NULL. |
| **출하** | from_section_id만 두고 to_section_id=NULL, movement_type='shipment'. source_group_id, split_percentage = NULL. |

---

## 5. 테이블 관계도 (요약)

```
[farms]
    │
    ├── [pigs]          ── pig_group_id ──► [pig_groups]
    │                         │                    │
    │                         │                    ├── current_section_id ──► [farm_sections]
    │                         │                    └── parent_group_id ──────► [pig_groups]
    │                         │
    ├── [pig_groups]    ── current_section_id ──► [farm_sections]
    │
    └── [pig_movements] ── pig_group_id ────────► [pig_groups]
                        ── from_section_id ────► [farm_sections]
                        ── to_section_id ─────► [farm_sections]
                        ── schedule_item_id ───► [farm_schedule_items] (선택)
```

---

## 6. 구현 순서 제안

| 단계 | 내용 |
|------|------|
| 1 | **pig_groups** 테이블 생성 — 돈군 기본 정보, current_section_id, status, parent_group_id 등 |
| 2 | **pig_movements** 테이블 생성 — from/to section, pig_group_id, moved_at, headcount, movement_type |
| 3 | **pigs** 테이블 생성(또는 기존 개체 테이블에 **pig_group_id** 컬럼 추가) — 객체가 어느 돈군에 속하는지 저장 |
| 4 | (선택) **section_group_occupancy** — 한 칸에 여러 돈군 공존 시 배치 이력/현황 |

이 순서로 하면 “돈군 + 이동”으로 먼저 사별 조회·합·분할 대응을 하고, 그 다음 객체 테이블에 돈군 UUID를 연결하는 방식으로 확장할 수 있습니다.

---

## 7. 참고 문서

- `docs/pig_management_tables_recommendation.md` — 객체/돈군/이동 역할, 객체에 돈군 컬럼 추가, 분할·합병 시 ID 부여
- `docs/pig_movement_design_recommendation.md` — 이동은 별도 테이블, 1건 1행, 현재 위치는 돈군/객체에 보관
- `docs/facility_structure_overview.md` — farm_buildings / farm_barns / farm_rooms / farm_sections 계층
