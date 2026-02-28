// enum_structure_templates_category에 'support' 값 추가.
// 실행: backend 폴더에서 go run ./cmd/add-enum-support
package main

import (
	"context"
	"log"
	"os"
	"path/filepath"
	"strings"

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

	_, err = database.Pool.Exec(ctx, `ALTER TYPE enum_structure_templates_category ADD VALUE 'support'`)
	if err != nil {
		if strings.Contains(err.Error(), "already exists") {
			log.Println("'support'는 이미 enum에 있습니다. 완료.")
			return
		}
		log.Fatalf("enum 값 추가 실패: %v", err)
	}
	log.Println("enum_structure_templates_category에 'support' 추가됨.")
}
