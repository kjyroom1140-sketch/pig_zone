# 일정관리 재설계 가이드

**admin.html**의 「일정 관리 설정」과 **farm_admin.html**의 「농장 일정 관리」 재설계를 위한 메인 문서입니다.

---

## 0. 현재 상태 (2025년 기준)

- **데이터 초기화** 및 **일정 관련 테이블 DROP** 완료.
- 테이블은 서버 기동 시 **Sequelize sync**로 다시 생성됨 (`node server.js`).
- 재설계 후 admin / farm_admin UI·API를 새 구조에 맞게 구현하면 됨.

**관련 스크립트**
- 데이터만 비우기: `CONFIRM=1 node scripts/reset_schedule_data.js`
- 테이블까지 삭제: `CONFIRM=1 node scripts/drop_schedule_tables.js`

**다른 일정 문서**
- **[schedule_structure_design.md](./schedule_structure_design.md)** — **돈사 작업 일정 새 구조 설계** (구분·대상장소·기준·작업유형 4축, 구분별 대상장소 정리)
- [schedule_item_types_unified_table.md](./schedule_item_types_unified_table.md) — 기준/작업 유형 통합 테이블 설계 (참고용)
- [schedule_item_form_to_db_mapping.md](./schedule_item_form_to_db_mapping.md) — 일정 항목 폼 ↔ DB 매핑
- [table_structures_pig_and_schedule.md](./table_structures_pig_and_schedule.md) — 돈군·이동·일정 테이블 컬럼 구조

---

## 1. 구조 요약 (sync로 재생성되는 테이블 기준)

### 1.1 화면

| 화면 | 파일 | 내용 |
|------|------|------|
| 일정 관리 설정 (전역) | `public/admin.html` | 기준 유형, 작업 유형, **일정 항목**(schedule_items) |
| 농장 일정 관리 | `public/farm_admin.html` | 농장별 기준/작업 유형, **농장 일정 항목**(farm_schedule_items) |

- 전역: **schedule_item_types**(기준+작업 통합), **schedule_items**, **schedule_task_type_structures**
- 농장: **farm_schedule_basis_types**, **farm_schedule_task_types**, **farm_schedule_task_type_structures**, **farm_schedule_items**, **farm_schedule_work_plans**
- 이동 이력: **pig_movements**의 `schedule_item_id`가 `farm_schedule_items.id` 참조

### 1.2 일정 관련 테이블 (FK 순서)

| 순서 | 테이블 | 설명 | 참조 |
|------|--------|------|------|
| 1 | schedule_item_types | 전역 기준/작업 유형 통합 | - |
| 2 | schedule_task_type_structures | 작업 유형 ↔ 시설 템플릿 | schedule_item_types, structure_templates |
| 3 | schedule_items | 전역 일정 항목 | schedule_item_types, structure_templates |
| 4 | farm_schedule_basis_types | 농장별 기준 유형 | farms, schedule_item_types(originalId) |
| 5 | farm_schedule_task_types | 농장별 작업 유형 | farms, schedule_item_types(originalId) |
| 6 | farm_schedule_task_type_structures | 농장 작업 유형 ↔ 시설 | farm_schedule_task_types, structure_templates |
| 7 | farm_schedule_items | 농장 일정 항목 | farm_schedule_task_types, farm_schedule_basis_types, structure_templates |
| 8 | farm_schedule_work_plans | 작업 계획·완료 | farm_schedule_items |
| - | pig_movements | 이동 이력 | schedule_item_id → farm_schedule_items (선택) |

---

## 2. 초기화 vs 수정 — 어떤 쪽이 나을까?

### 2.1 **초기화(데이터 비우기·테이블 정리)**가 맞는 경우

- **실서비스 전**이거나, **테스트/개발 DB**만 정리할 때  
- 현재 일정 데이터를 **완전히 버리고** 새 UI/새 규칙으로 다시 채울 때  
- 테이블 컬럼을 **크게 바꾸거나 줄이고** 싶을 때 (예: 컬럼 삭제·통합·이름 변경)

**장점**: 깔끔한 상태에서 새 설계만 반영 가능.  
**단점**: 기존 일정·작업계획·이동 연계 데이터는 모두 사라짐.

### 2.2 **수정해 가는 것**이 맞는 경우

- **이미 운영 중**이고, 기존 일정·작업계획·이동 이력을 **유지**해야 할 때  
- UI/플로우만 바꾸고 **DB 구조는 그대로** 둘 때  
- 단계적으로 “기준/작업 유형 화면만 바꾸기 → 다음에 일정 항목 화면 바꾸기”처럼 **점진 적용**할 때

**장점**: 데이터 유지, 단계별 배포 가능.  
**단점**: 기존 컬럼/제약이 있어 설계가 다소 제한될 수 있음.

---

## 3. 권장 방향

| 상황 | 권장 |
|------|------|
| 아직 운영 전·개발/테스트 DB | **초기화** 후 새 설계로 테이블·데이터 정리 |
| 이미 실데이터 있음 | **수정** 위주. 필요 시 “일정 항목만 초기화” 등 **일부만** 초기화 검토 |
| 테이블 구조를 바꾸고 싶음 | 설계안 확정 후 **마이그레이션 스크립트**로 컬럼 추가/변경, 필요 시 초기화 스크립트는 **개발 DB에만** 사용 |

---

## 4. 초기화 시 진행 순서 (데이터만 비우기)

테이블은 유지하고 **데이터만** 지우는 경우, FK 순서를 지켜야 합니다.

1. **farm_schedule_work_plans** 삭제  
2. **pig_movements.schedule_item_id** → NULL 처리 (연결만 끊음)  
3. **farm_schedule_items** 삭제  
4. **farm_schedule_task_type_structures** 삭제  
5. **farm_schedule_task_types** 삭제  
6. **farm_schedule_basis_types** 삭제  
7. **schedule_task_type_structures** 삭제  
8. **schedule_items** 삭제  
9. **schedule_item_types** 삭제  

- **데이터만 비우기**: **`scripts/reset_schedule_data.js`** (실행 시 `CONFIRM=1` 필요)
- **테이블까지 삭제**: **`scripts/drop_schedule_tables.js`** (실행 시 `CONFIRM=1` 필요). 삭제 후 서버 기동 시 Sequelize sync로 테이블이 다시 생성됨.

---

## 5. 다음 단계

1. 서버 기동으로 일정 테이블 재생성: `node server.js`
2. admin.html / farm_admin.html과 API를 새 설계에 맞게 수정
3. “기준 유형/작업 유형 통합 화면”, “일정 항목 폼 단순화” 등 화면 설계안 확정 후 이 문서에 변경 목록 이어서 정리
