// schedule_executions opening 연계 반영 상태 점검 유틸리티.
// 실행 예시:
//   cd backend
//   go run ./cmd/check-schedule-rollout
package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"pig-farm-api/internal/config"
	"pig-farm-api/internal/db"

	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load(".env")
	if dir, err := os.Getwd(); err == nil {
		if root := filepath.Join(dir, ".."); root != "" {
			_ = godotenv.Load(filepath.Join(root, ".env"))
		}
	}

	cfg := config.Load()
	ctx := context.Background()
	database, err := db.New(ctx, cfg)
	if err != nil {
		log.Fatalf("DB 연결 실패: %v", err)
	}
	defer database.Close()

	mustPrintRegclass(ctx, database, "public.schedule_executions")
	mustPrintRegclass(ctx, database, "public.uq_schedule_executions_idempotency")
	mustPrintRegclass(ctx, database, "public.idx_schedule_executions_farm_date_status")
	mustPrintRegclass(ctx, database, "public.idx_schedule_executions_farm_section_date")

	mustPrintColumnExists(ctx, database, "pig_groups", "birth_date")
	mustPrintColumnExists(ctx, database, "farm_sections", "entryDate")
	mustPrintColumnExists(ctx, database, "farm_sections", "birthDate")

	mustPrintWorkContentCount(ctx, database, "재고두수등록(초기값)")
	mustPrintWorkContentCount(ctx, database, "[AUTO] opening 초기값 저장")
	mustPrintOpeningExecutionCount(ctx, database)
}

func mustPrintRegclass(ctx context.Context, database *db.DB, name string) {
	var reg *string
	if err := database.Pool.QueryRow(ctx, `SELECT to_regclass($1)::text`, name).Scan(&reg); err != nil {
		log.Fatalf("regclass 조회 실패 (%s): %v", name, err)
	}
	if reg == nil {
		fmt.Printf("[MISSING] %s\n", name)
		return
	}
	fmt.Printf("[OK] %s -> %s\n", name, *reg)
}

func mustPrintColumnExists(ctx context.Context, database *db.DB, tableName, columnName string) {
	var exists bool
	if err := database.Pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM information_schema.columns
			WHERE table_schema = 'public'
			  AND table_name = $1
			  AND column_name = $2
		)
	`, tableName, columnName).Scan(&exists); err != nil {
		log.Fatalf("컬럼 존재 조회 실패 (%s.%s): %v", tableName, columnName, err)
	}
	if exists {
		fmt.Printf("[OK] column %s.%s\n", tableName, columnName)
		return
	}
	fmt.Printf("[MISSING] column %s.%s\n", tableName, columnName)
}

func mustPrintWorkContentCount(ctx context.Context, database *db.DB, workContent string) {
	var cnt int
	if err := database.Pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM schedule_work_plans
		WHERE COALESCE(is_deleted, false) = false
		  AND work_content = $1
	`, workContent).Scan(&cnt); err != nil {
		log.Fatalf("work_content 집계 실패 (%s): %v", workContent, err)
	}
	fmt.Printf("[INFO] schedule_work_plans(work_content='%s') = %d\n", workContent, cnt)
}

func mustPrintOpeningExecutionCount(ctx context.Context, database *db.DB) {
	var cnt int
	if err := database.Pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM schedule_executions
		WHERE result_ref_type = 'opening_section'
	`).Scan(&cnt); err != nil {
		log.Fatalf("opening_section 집계 실패: %v", err)
	}
	fmt.Printf("[INFO] schedule_executions(result_ref_type='opening_section') = %d\n", cnt)
}
