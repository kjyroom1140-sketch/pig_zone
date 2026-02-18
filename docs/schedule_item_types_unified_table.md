# 일정 기준 유형·작업 유형 통합 테이블 설계

기존 **schedule_basis_types**(기준 유형)와 **schedule_task_types**(작업 유형)를 하나의 테이블 **schedule_item_types**로 통합한 설계 문서입니다.  
**참고:** 일정관리 재설계 과정에서 해당 테이블을 DROP한 뒤, 서버 기동 시 **Sequelize sync**로 다시 생성됩니다. 마이그레이션 스크립트(`migrate_to_schedule_item_types.js`)는 기존 DB에서 통합 전→후 전환 시에만 사용하며, 현재는 sync로 빈 테이블이 생성되는 구조입니다. 상세 현황: [schedule_redesign_guide.md](./schedule_redesign_guide.md).

---

## 1. 통합 전 구조 (현재)

| 테이블 | 용도 | schedule_items 연동 |
|--------|------|---------------------|
| schedule_basis_types | 기준 유형 (전입일, 매일, 매주 등) | basisTypeId → id |
| schedule_task_types | 작업 유형 (백신, 이동 등) | taskTypeId → id |

---

## 2. 통합 후 구조

### 2.1 신규 테이블: schedule_item_types

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | SERIAL PRIMARY KEY | 고유 ID |
| **kind** | VARCHAR(10) NOT NULL | 'basis' (기준) \| 'task' (작업) |
| code | VARCHAR(50) | 코드 (ENTRY_DAY, VACCINE 등) |
| name | VARCHAR(100) NOT NULL | 표시명 |
| targetType | VARCHAR(20) | 구분: pig, facility (기준 유형용) |
| description | TEXT | 설명 (기준 유형용) |
| category | VARCHAR(50) | 대분류 (작업 유형용: vaccine, move 등) |
| sortOrder | INTEGER DEFAULT 0 | 정렬 순서 |
| appliesToAllStructures | BOOLEAN DEFAULT true | 전체 시설 적용 여부 (작업 유형용) |
| createdAt | TIMESTAMP | 생성 시각 |
| updatedAt | TIMESTAMP | 수정 시각 |

- **kind='basis'**: 기준 유형. targetType, description 사용. category, appliesToAllStructures는 null/기본값.
- **kind='task'**: 작업 유형. category, appliesToAllStructures 사용. targetType, description은 null 가능.

### 2.2 참조 관계 (마이그레이션 후)

| 참조하는 쪽 | 컬럼 | 참조 대상 |
|-------------|------|-----------|
| schedule_items | basisTypeId | schedule_item_types.id (kind='basis'인 행) |
| schedule_items | taskTypeId | schedule_item_types.id (kind='task'인 행) |
| schedule_task_type_structures | scheduleTaskTypeId | schedule_item_types.id (kind='task') |
| farm_schedule_basis_types | originalId | schedule_item_types.id (kind='basis') |
| farm_schedule_task_types | originalId | schedule_item_types.id (kind='task') |

---

## 3. 마이그레이션 순서

1. **schedule_item_types** 테이블 생성
2. **schedule_basis_types** 데이터 → schedule_item_types (kind='basis'), old_id → new_id 매핑 저장
3. **schedule_task_types** 데이터 → schedule_item_types (kind='task'), old_id → new_id 매핑 저장
4. **schedule_items**의 basisTypeId, taskTypeId를 새 ID로 UPDATE
5. **schedule_task_type_structures**의 scheduleTaskTypeId를 새 ID로 UPDATE
6. **farm_schedule_basis_types**의 originalId를 새 ID로 UPDATE
7. **farm_schedule_task_types**의 originalId를 새 ID로 UPDATE
8. 기존 FK 제거 후 schedule_item_types 로 새 FK 설정
9. 기존 테이블 백업용으로 이름 변경 (schedule_basis_types_backup, schedule_task_types_backup)

---

## 4. 마이그레이션 실행

```bash
node scripts/migrate_to_schedule_item_types.js
```

- 이미 통합이 적용된 DB에서는 자동으로 건너뜀.
- 기존 테이블은 `schedule_basis_types_backup`, `schedule_task_types_backup` 으로 이름만 변경되며 데이터는 유지됨.

---

## 5. 적용 후 코드 변경 사항 (마이그레이션 실행 후 필요)

- **모델**: `ScheduleBasisType`, `ScheduleTaskType` 대신 `ScheduleItemType` 사용 (kind로 구분). 기존 모델은 백업 테이블용으로만 유지하거나 제거.
- **models/index.js**: ScheduleItemType 등록, ScheduleItem.belongsTo(ScheduleItemType, …) 로 basisTypeId/taskTypeId 연결, ScheduleTaskTypeStructure → schedule_item_types 참조로 수정.
- **API**: `scheduleBasisTypes.js` / `scheduleTaskTypes.js` 를 `scheduleItemTypes.js` 로 통합하거나, 기존 라우트에서 ScheduleItemType을 조회해 kind로 필터 (GET ?kind=basis | ?kind=task).
- **admin UI**: 기준 유형·작업 유형 목록을 같은 API에서 kind 파라미터로 요청하도록 수정.

실제 모델·라우트·admin 수정은 마이그레이션 실행 후 별도 작업으로 진행하면 됩니다.
