package handlers

import (
	"net/http"
)

// BreedItem for GET /api/breeds (pig_breeds table).
type BreedItem struct {
	ID            int     `json:"id"`
	Code          string  `json:"code"`
	NameKo        string  `json:"nameKo"`
	NameEn        *string `json:"nameEn"`
	Description   *string `json:"description"`
	Characteristics *string `json:"characteristics"`
	Usage         *string `json:"usage"`
}

// BreedsList handles GET /api/breeds.
func (h *Handler) BreedsList(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT id, code, "nameKo", "nameEn", description, characteristics, usage
		FROM pig_breeds
		ORDER BY id ASC
	`)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "데이터를 불러오는 중 오류가 발생했습니다."})
		return
	}
	defer rows.Close()

	var list []BreedItem
	for rows.Next() {
		var b BreedItem
		if err := rows.Scan(&b.ID, &b.Code, &b.NameKo, &b.NameEn, &b.Description, &b.Characteristics, &b.Usage); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "데이터를 불러오는 중 오류가 발생했습니다."})
			return
		}
		list = append(list, b)
	}
	writeJSON(w, http.StatusOK, list)
}
