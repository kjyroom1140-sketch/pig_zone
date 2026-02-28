package db

import (
	"context"
	"fmt"

	"pig-farm-api/internal/config"

	"github.com/jackc/pgx/v5/pgxpool"
)

// DB wraps pgx pool. Call Close() when shutting down.
type DB struct {
	Pool *pgxpool.Pool
}

// New creates a PostgreSQL connection pool from config.
func New(ctx context.Context, cfg *config.Config) (*DB, error) {
	connStr := fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s",
		cfg.DBUser, cfg.DBPassword, cfg.DBHost, cfg.DBPort, cfg.DBName,
	)
	pool, err := pgxpool.New(ctx, connStr)
	if err != nil {
		return nil, fmt.Errorf("pgxpool.New: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("db ping: %w", err)
	}
	return &DB{Pool: pool}, nil
}

// Close closes the connection pool.
func (db *DB) Close() {
	if db != nil && db.Pool != nil {
		db.Pool.Close()
	}
}
