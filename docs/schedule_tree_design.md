# 일정 항목 트리 구조 설계 (대상장소 → 구분 → 기준 / 작업유형 → 작업내용)

일정 관리 설정 페이지에서 **대상장소 - 구분 - 기준 - 작업유형 - 작업내용** 순으로 데이터가 저장·표시되며, 이 순서를 DB에서 **트리 구조로 정확히 연결**하도록 설계한 문서입니다.

---

## 1. 트리 구조 개요

```
structure_templates (대상장소)  ← 루트
  │
  └── schedule_division_structures (N:M)
        └── schedule_divisions (구분)
              ├── schedule_bases (기준)          [basis.divisionId → 구분]
              └── schedule_work_types (작업유형)  [work_type.divisionId → 구분, nullable=전 구분 공통]
                    └── schedule_work_detail_types (작업내용) [work_detail_type.workTypeId → 작업유형]
```

- **일정 항목(schedule_items)** 은 이 트리의 **경로 한 줄**을 선택한 것과 같다.
- 저장 필드 순서: `structureTemplateId` → `divisionId` → `basisId` → `workDetailTypeId` (작업내용이 작업유형을 통해 연결).

---

## 2. 테이블별 역할 및 FK (트리 연결)

| 계층 | 테이블 | 설명 | 트리 연결 (FK) |
|------|--------|------|----------------|
| 0 | **structure_templates** | 대상장소 (분만사, 자돈사 등) | 루트 |
| 1 | **schedule_division_structures** | 대상장소 ↔ 구분 N:M | structureTemplateId, divisionId |
| 1 | **schedule_divisions** | 구분 (모돈, 자돈, 시설 등) | — |
| 2 | **schedule_bases** | 기준 (전입일, 출생일 등) | **divisionId** → schedule_divisions |
| 2 | **schedule_work_types** | 작업유형 대분류 (이동, 사양 등) | **divisionId** (nullable) → schedule_divisions |
| 3 | **schedule_work_detail_types** | 작업내용/세부 (분만사 이동 등) | **workTypeId** → schedule_work_types |
| 리프 | **schedule_items** | 일정 항목 (실제 일정 한 건) | structureTemplateId, divisionId, basisId, workDetailTypeId |

- `schedule_work_types.divisionId`: **NULL** = 전 구분 공통, **값 있음** = 해당 구분 전용 작업유형.
- `schedule_bases.divisionId`: **NULL** = 전 구분 공통, **값 있음** = 해당 구분 전용 기준.

---

## 3. schedule_items 검증 규칙 (트리 일관성)

일정 항목 저장 시 다음이 만족되어야 합니다.

1. **(대상장소, 구분)**  
   `schedule_division_structures` 에 (structureTemplateId, divisionId) 조합이 존재해야 함.  
   (전체 시설 일정은 structureTemplateId null 등 예외 처리.)

2. **(구분, 기준)**  
   `schedule_bases.divisionId` IS NULL OR `schedule_bases.divisionId` = schedule_items.divisionId.

3. **(구분, 작업유형)**  
   `schedule_work_types.divisionId` IS NULL OR `schedule_work_types.divisionId` = schedule_items.divisionId  
   (그리고 workDetailType.workTypeId = 해당 work_type.id).

4. **(작업유형, 작업내용)**  
   `schedule_work_detail_types.workTypeId` = 작업유형 ID (이미 FK로 보장).

애플리케이션(API/관리 화면)에서 위 규칙을 검증하면 트리와 항상 일치하게 저장할 수 있습니다.

---

## 4. 기존 N:M 테이블과의 관계

- **schedule_work_type_divisions**  
  작업유형이 **어떤 구분에서 선택 가능한지** 추가로 제한할 때 사용.  
  `schedule_work_types.divisionId` 가 NULL인 경우 “전 구분 공통”이지만, 이 테이블로 “실제로는 일부 구분만” 제한 가능.

- **schedule_work_type_structures**  
  작업유형이 **어떤 대상장소에서 선택 가능한지** 제한할 때 사용.

- **schedule_work_detail_type_divisions / schedule_work_detail_type_structures**  
  작업내용(세부)이 **어떤 구분/대상장소에서 선택 가능한지** 제한할 때 사용.

트리 구조는 **FK 체인(divisionId, workTypeId)** 으로 정의하고, 위 N:M은 **선택 가능 범위(스코프)** 제한용으로 둡니다.

---

## 5. ER 요약 (트리 관점)

```
structure_templates
  └── schedule_division_structures ──► schedule_divisions
                                          ├── schedule_bases (divisionId)
                                          └── schedule_work_types (divisionId, nullable)
                                                └── schedule_work_detail_types (workTypeId)
                                                      └── schedule_items (structureTemplateId, divisionId, basisId, workDetailTypeId)
```

이 설계에 따라 **schedule_work_types** 에 `divisionId` 컬럼을 추가하고, 모델·마이그레이션을 반영하면 “대상장소 → 구분 → 기준 / 작업유형 → 작업내용” 순서가 DB에서 트리로 정확히 연결됩니다.
