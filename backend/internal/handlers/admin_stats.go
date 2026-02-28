package handlers

import (
	"net/http"
)

// AdminStats handles GET /api/admin/stats.
func (h *Handler) AdminStats(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var users, farms, userFarms int
	if err := h.db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&users); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "통계 정보를 가져오는 중 오류가 발생했습니다."})
		return
	}
	if err := h.db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM farms`).Scan(&farms); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "통계 정보를 가져오는 중 오류가 발생했습니다."})
		return
	}
	if err := h.db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM user_farms`).Scan(&userFarms); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "통계 정보를 가져오는 중 오류가 발생했습니다."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"stats": map[string]int{
			"users":     users,
			"farms":     farms,
			"userFarms": userFarms,
		},
	})
}
