# schedule_work_plans 테이블 컬럼 정리

## 1. 최초 생성 시 (create_schedule_work_plans_table.sql)

| 컬럼명 | 타입 | NULL | 설명 |
|--------|------|------|------|
| **id** | SERIAL (PRIMARY KEY) | N | 기본키 |
| **structure_templates** | JSONB | Y | 대상장소 참조 JSON (구 구조) |
| **schedule_sortations** | JSONB | Y | 구분 참조 JSON (구 구조) |
| **schedule_criterias** | JSONB | Y | 기준 참조 JSON (구 구조) |
| **schedule_jobtypes** | JSONB | Y | 작업유형 참조 JSON (구 구조) |
| **details** | JSONB | Y | 반복 등 상세 JSON (구 구조) |
| **"createdAt"** | TIMESTAMPTZ | N | 생성 일시 (DEFAULT now()) |
| **"updatedAt"** | TIMESTAMPTZ | N | 수정 일시 (DEFAULT now()) |

---

## 2. 리디자인 마이그레이션 후 추가되는 컬럼 (schedule_work_plans_redesign_columns.sql)

| 컬럼명 | 타입 | NULL | 설명 |
|--------|------|------|------|
| **structure_template_id** | INTEGER | Y | 사육시설 선택값 → structure_templates(id) FK |
| **sortation_id** | INTEGER | Y | 구분 선택값 → schedule_sortations(id) FK |
| **jobtype_id** | INTEGER | Y | 작업유형 선택값 → schedule_jobtypes(id) FK |
| **criteria_id** | INTEGER | Y | 기준 선택값 → schedule_criterias(id) FK |
| **criteria_content** | JSONB | Y | 기준내용 (type: range/daily/weekly/weekend/monthly/yearly 등) |

---

## 3. 현재 API(백엔드)가 사용하는 컬럼

**List (GET /api/admin/schedule-work-plans)**  
- `id`, `structure_template_id`, `sortation_id`, `jobtype_id`, `criteria_id`, `criteria_content`, `"createdAt"`, `"updatedAt"`  
- JOIN으로 `structure_template_name`, `sortations_json`, `jobtypes_json`, `criterias_json` 조회

**Create (POST)**  
- INSERT: `structure_template_id`, `sortation_id`, `jobtype_id`, `criteria_id`, `criteria_content`, `"createdAt"`, `"updatedAt"`

**Update (PUT)**  
- UPDATE: `structure_template_id`, `sortation_id`, `jobtype_id`, `criteria_id`, `criteria_content`, `"updatedAt"`

→ **리디자인 마이그레이션을 적용해야** 위 API가 동작합니다.  
마이그레이션 미적용 시 `structure_template_id` 등이 없어 500 에러가 납니다.

---

## 4. 마이그레이션 적용 후 테이블에 존재하는 컬럼 (전체)

| 컬럼명 | 타입 | 비고 |
|--------|------|------|
| id | SERIAL / INTEGER | PK |
| structure_templates | JSONB | 구 구조 (선택 시 DROP 가능) |
| schedule_sortations | JSONB | 구 구조 (선택 시 DROP 가능) |
| schedule_criterias | JSONB | 구 구조 (선택 시 DROP 가능) |
| schedule_jobtypes | JSONB | 구 구조 (선택 시 DROP 가능) |
| details | JSONB | 구 구조 (선택 시 DROP 가능) |
| "createdAt" | TIMESTAMPTZ | |
| "updatedAt" | TIMESTAMPTZ | |
| structure_template_id | INTEGER | FK, 리디자인 추가 |
| sortation_id | INTEGER | FK, 리디자인 추가 |
| jobtype_id | INTEGER | FK, 리디자인 추가 |
| criteria_id | INTEGER | FK, 리디자인 추가 |
| criteria_content | JSONB | 리디자인 추가 |

---

## 5. 사용하지 않는 컬럼 제거

구 구조 JSON 컬럼(`structure_templates`, `schedule_sortations`, `schedule_criterias`, `schedule_jobtypes`, `details`)은 현재 API에서 사용하지 않습니다. 제거하려면:

```bash
node scripts/run_sql.js scripts/schedule_work_plans_drop_unused_columns.sql
```

또는 `scripts/schedule_work_plans_drop_unused_columns.sql` 내용을 PostgreSQL에서 직접 실행하세요.

---

## 6. DB에서 실제 컬럼 확인하는 방법

PostgreSQL에서:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'schedule_work_plans'
ORDER BY ordinal_position;
```

또는 `\d schedule_work_plans` (psql)
