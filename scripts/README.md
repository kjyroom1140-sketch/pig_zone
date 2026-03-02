# scripts

이 폴더의 파일들은 **현재 프로젝트 웹서비스(Go API + Next.js)** 에 필요한 보조 도구입니다.

| 구분 | 용도 |
|------|------|
| **실행 시 필요** | 서버 시작/종료 시 `start-servers.bat`, `stop.bat` 이 `server-manager.js` 를 사용합니다. |
| **DB 설정/변경 시** | 최초 DB 구축이나 스키마 변경 시 `run_sql.js` 로 `*.sql` 파일을 적용합니다. 웹서비스는 이미 맞춰진 DB에 연결만 합니다. |

## 서버 관리

- **server-manager.js** – Go API(8080) + Next.js(3000) 시작/종료. `start-servers.bat` / `stop.bat` 에서 사용.

## DB 마이그레이션

- **\*.sql** – 스키마/마이그레이션 SQL. 참고 및 수동 적용용.
- **run_sql.js** – SQL 파일 실행기.  
  사용: `node scripts/run_sql.js scripts/파일명.sql`  
  (프로젝트 루트에서 실행, `.env` 의 `POSTGRES_*` 사용. `npm install pg` 필요)

예:

```bash
node scripts/run_sql.js scripts/add_structure_templates_theme_color.sql
node scripts/run_sql.js scripts/add_farms_info_columns.sql
```

**참고:** 과거 버전의 농장 일정 관리 기능은 제거되었습니다.  
(`farm_schedule_task_types`, `farm_schedule_basis_types`, `farm_schedule_items`, `farm_schedule_work_plans` 및 관련 API/프론트 호출 제거)
