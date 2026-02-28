package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
)

// ScheduleDivisionItem for schedule_divisions.
type ScheduleDivisionItem struct {
	ID        int     `json:"id"`
	Code      *string `json:"code"`
	Name      string  `json:"name"`
	SortOrder int     `json:"sortOrder"`
}

// ScheduleDivisionsList GET /api/schedule-divisions
func (h *Handler) ScheduleDivisionsList(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT id, code, name, "sortOrder" FROM schedule_divisions ORDER BY "sortOrder" ASC, id ASC
	`)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "구분 목록을 불러오는 중 오류가 발생했습니다."})
		return
	}
	defer rows.Close()
	var list []ScheduleDivisionItem
	for rows.Next() {
		var d ScheduleDivisionItem
		var code *string
		if err := rows.Scan(&d.ID, &code, &d.Name, &d.SortOrder); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "구분 목록을 불러오는 중 오류가 발생했습니다."})
			return
		}
		d.Code = code
		list = append(list, d)
	}
	writeJSON(w, http.StatusOK, list)
}

// ScheduleDivisionsCreate POST /api/schedule-divisions
func (h *Handler) ScheduleDivisionsCreate(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Code      *string `json:"code"`
		Name      string  `json:"name"`
		SortOrder *int    `json:"sortOrder"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	sortOrder := 0
	if body.SortOrder != nil {
		sortOrder = *body.SortOrder
	}
	var id int
	err := h.db.Pool.QueryRow(r.Context(), `
		INSERT INTO schedule_divisions (code, name, "sortOrder", "createdAt", "updatedAt")
		VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id
	`, body.Code, body.Name, sortOrder).Scan(&id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "구분 추가 중 오류가 발생했습니다."})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]interface{}{"id": id, "code": body.Code, "name": body.Name, "sortOrder": sortOrder})
}

// ScheduleDivisionsUpdate PUT /api/schedule-divisions/:id
func (h *Handler) ScheduleDivisionsUpdate(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 ID입니다."})
		return
	}
	var body struct {
		Code      *string `json:"code"`
		Name      *string `json:"name"`
		SortOrder *int    `json:"sortOrder"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	var code, name interface{}
	var sortOrder int
	row := h.db.Pool.QueryRow(r.Context(), `SELECT code, name, "sortOrder" FROM schedule_divisions WHERE id = $1`, id)
	if err := row.Scan(&code, &name, &sortOrder); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "구분을 찾을 수 없습니다."})
		return
	}
	if body.Code != nil {
		code = *body.Code
	}
	if body.Name != nil {
		name = *body.Name
	}
	if body.SortOrder != nil {
		sortOrder = *body.SortOrder
	}
	_, err = h.db.Pool.Exec(r.Context(), `
		UPDATE schedule_divisions SET code = $1, name = $2, "sortOrder" = $3, "updatedAt" = NOW() WHERE id = $4
	`, code, name, sortOrder, id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "구분 수정 중 오류가 발생했습니다."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"id": id, "code": code, "name": name, "sortOrder": sortOrder})
}

// ScheduleDivisionsDelete DELETE /api/schedule-divisions/:id
func (h *Handler) ScheduleDivisionsDelete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 ID입니다."})
		return
	}
	res, err := h.db.Pool.Exec(r.Context(), `DELETE FROM schedule_divisions WHERE id = $1`, id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "구분 삭제 중 오류가 발생했습니다."})
		return
	}
	if res.RowsAffected() == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "구분을 찾을 수 없습니다."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "삭제되었습니다."})
}
