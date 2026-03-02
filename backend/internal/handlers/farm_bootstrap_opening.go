package handlers

import (
	"context"
	"database/sql"
	"net/http"
	"time"
)

func (h *Handler) hasFarmsInitializedAtColumn(ctx context.Context) bool {
	var exists bool
	err := h.db.Pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM information_schema.columns
			WHERE table_name = 'farms'
			  AND column_name = 'farm_initialized_at'
		)
	`).Scan(&exists)
	if err != nil {
		return false
	}
	return exists
}

// FarmBootstrapOpeningStatus GET /api/farms/:farmId/bootstrap/opening/status
func (h *Handler) FarmBootstrapOpeningStatus(w http.ResponseWriter, r *http.Request) {
	farmID, _, ok := h.parseFarmIDAndAuth(w, r)
	if !ok {
		return
	}

	if !h.hasFarmsInitializedAtColumn(r.Context()) {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "farm_initialized_at 컬럼이 없습니다. 마이그레이션을 먼저 적용하세요.",
		})
		return
	}

	var initializedAt sql.NullTime
	if err := h.db.Pool.QueryRow(r.Context(), `
		SELECT farm_initialized_at
		FROM farms
		WHERE id = $1
	`, farmID).Scan(&initializedAt); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "farm not found"})
		return
	}

	var initializedAtStr *string
	initialized := initializedAt.Valid
	if initializedAt.Valid {
		formatted := initializedAt.Time.UTC().Format(time.RFC3339)
		initializedAtStr = &formatted
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"farmId":            farmID.String(),
		"initialized":       initialized,
		"farmInitializedAt": initializedAtStr,
	})
}
