package handlers

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// FarmListItem for GET /api/admin/farms.
type FarmListItem struct {
	ID        uuid.UUID  `json:"id"`
	FarmName  string     `json:"farmName"`
	FarmCode  string     `json:"farmCode"`
	OwnerID   uuid.UUID  `json:"ownerId"`
	Status    string     `json:"status"`
	CreatedAt time.Time  `json:"createdAt"`
}

// AdminFarms handles GET /api/admin/farms.
func (h *Handler) AdminFarms(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT id, "farmName", "farmCode", "ownerId", status, "createdAt"
		FROM farms
		ORDER BY "createdAt" DESC
	`)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "농장 목록을 가져오는 중 오류가 발생했습니다."})
		return
	}
	defer rows.Close()

	var list []FarmListItem
	for rows.Next() {
		var f FarmListItem
		if err := rows.Scan(&f.ID, &f.FarmName, &f.FarmCode, &f.OwnerID, &f.Status, &f.CreatedAt); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "농장 목록을 가져오는 중 오류가 발생했습니다."})
			return
		}
		list = append(list, f)
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"farms": list})
}

// AdminUserFarms handles GET /api/admin/users/:userId/farms (농장 목록 - 해당 사용자가 등록된 농장).
func (h *Handler) AdminUserFarms(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "userId")
	if userID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "userId가 필요합니다."})
		return
	}
	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT f.id, f."farmName", f."farmCode", f."ownerId", f.status, f."createdAt"
		FROM farms f
		INNER JOIN user_farms uf ON uf."farmId" = f.id AND uf."userId" = $1 AND uf."isActive" = true
		ORDER BY f."createdAt" DESC
	`, userID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "농장 목록을 가져오는 중 오류가 발생했습니다."})
		return
	}
	defer rows.Close()

	var list []FarmListItem
	for rows.Next() {
		var f FarmListItem
		if err := rows.Scan(&f.ID, &f.FarmName, &f.FarmCode, &f.OwnerID, &f.Status, &f.CreatedAt); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "농장 목록을 가져오는 중 오류가 발생했습니다."})
			return
		}
		list = append(list, f)
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"farms": list})
}
