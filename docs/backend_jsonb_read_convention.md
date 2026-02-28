# 백엔드 JSONB 읽기/출력 규칙 (DB 환경에 맞춤)

## DB 환경

- **DB**: PostgreSQL  
- **드라이버**: pgx v5  
- **JSONB 컬럼**: `schedule_sortations.sortations`, `schedule_jobtypes.jobtypes`, `schedule_criterias.criterias`, `schedule_work_plans.criteria_content` 등

pgx v5에서는 JSONB 컬럼을 `*[]byte`로 스캔할 때 환경에 따라 실패할 수 있어, **읽기 방식**을 아래 규칙으로 통일했다.

---

## API에서 JSONB를 읽을 때 (SELECT → 응답)

1. **SELECT**  
   JSONB 컬럼은 반드시 **`컬럼::text`** 로 조회한다.  
   예: `SELECT id, sortations::text, ...`, `SELECT swp.criteria_content::text, ss.sortations::text, ...`

2. **스캔**  
   위에서 받은 컬럼은 Go에서 **`*string`** 으로 스캔한다.

3. **파싱**  
   `handlers.ParseJSONBFromText(s *string) interface{}` 로 파싱해 API 응답용 `interface{}`로 쓴다.

**공통 헬퍼**: `internal/handlers/jsonb.go`  
- `ParseJSONBFromText(s *string) interface{}` — `::text` + `*string` 스캔 결과용  
- `ParseJSONBFromBytes(b *[]byte) interface{}` — 이미 `[]byte`로 읽은 경우용 (필요 시만 사용)

---

## API에서 JSONB를 쓸 때 (INSERT / UPDATE)

- JSONB 컬럼에는 **`[]byte(JSON문자열)`** 로 전달하면 된다.  
  예: `body.CriteriaContent` → `json.Marshal` → `[]byte` 로 INSERT/UPDATE

---

## 적용 위치

| 핸들러 | JSONB 컬럼 | 적용 |
|--------|------------|------|
| ScheduleSortationsList | sortations | `sortations::text` + `*string` + `ParseJSONBFromText` |
| ScheduleCriteriasList | criterias | `criterias::text` + `*string` + `ParseJSONBFromText` |
| ScheduleJobtypesList | jobtypes | `jobtypes::text` + `*string` + `ParseJSONBFromText` |
| ScheduleWorkPlansList | criteria_content, sortations, jobtypes, criterias (JOIN) | 모두 `::text` + `*string` + `ParseJSONBFromText` |

새로 JSONB를 읽어 API에 내려주는 핸들러를 추가할 때도 위 규칙을 따르면 된다.
