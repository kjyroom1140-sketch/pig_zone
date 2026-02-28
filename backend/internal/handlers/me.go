package handlers

import (
	"net/http"

	"pig-farm-api/internal/middleware"
)

// MeResponse matches Express GET /api/auth/me.
type MeResponse struct {
	User          User    `json:"user"`
	CurrentFarmID *string `json:"currentFarmId"`
	Position      *string `json:"position"` // 직책: user_farms.position 또는 role (첫 번째 활성 농장)
}

// Me handles GET /api/auth/me (requires Auth middleware).
func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "로그인이 필요합니다."})
		return
	}
	row, err := h.UserByID(r.Context(), claims.UserID)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "사용자를 찾을 수 없습니다."})
		return
	}
	user := userFromRow(*row)

	var position *string
	_ = h.db.Pool.QueryRow(r.Context(), `SELECT COALESCE(uf.position, uf.role) FROM user_farms uf WHERE uf."userId" = $1 AND uf."isActive" = true ORDER BY uf."createdAt" ASC LIMIT 1`, claims.UserID).Scan(&position)

	writeJSON(w, http.StatusOK, MeResponse{User: user, CurrentFarmID: nil, Position: position})
}
