// SQL 파일을 순서대로 실행하는 유틸리티.
// 실행 예시:
//   cd backend
//   go run ./cmd/run-sql ../scripts/ensure_schedule_executions_opening_prerequisites.sql
package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"pig-farm-api/internal/config"
	"pig-farm-api/internal/db"

	"github.com/joho/godotenv"
)

func main() {
	if len(os.Args) < 2 {
		log.Fatalf("사용법: go run ./cmd/run-sql <sql-file-1> [sql-file-2 ...]")
	}

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

	for _, inputPath := range os.Args[1:] {
		if strings.TrimSpace(inputPath) == "" {
			continue
		}
		resolvedPath := inputPath
		if !filepath.IsAbs(resolvedPath) {
			if cwd, err := os.Getwd(); err == nil {
				resolvedPath = filepath.Join(cwd, resolvedPath)
			}
		}
		sqlBytes, err := os.ReadFile(resolvedPath)
		if err != nil {
			log.Fatalf("SQL 파일 읽기 실패 (%s): %v", resolvedPath, err)
		}
		sqlText := strings.TrimSpace(string(sqlBytes))
		if sqlText == "" {
			log.Printf("빈 SQL 파일 스킵: %s", resolvedPath)
			continue
		}
		log.Printf("실행 시작: %s", resolvedPath)
		if _, err := database.Pool.Exec(ctx, sqlText); err != nil {
			log.Fatalf("SQL 실행 실패 (%s): %v", resolvedPath, err)
		}
		log.Printf("실행 완료: %s", resolvedPath)
	}

	fmt.Println("모든 SQL 실행 완료")
}
