package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
)

// ScheduleBaseItem for schedule_bases (optional division).
type ScheduleBaseItem struct {
	ID           int                    `json:"id"`
	Name         string                 `json:"name"`
	Description  *string                 `json:"description"`
	DivisionID   *int                   `json:"divisionId"`
	SortOrder    int                    `json:"sortOrder"`
	Division     *ScheduleDivisionBrief `json:"division,omitempty"`
}

// ScheduleDivisionBrief for include.
type ScheduleDivisionBrief struct {
	ID   int    `json:"id"`
	Code string `json:"code"`
	Name string `json:"name"`
}

// ScheduleBasesList GET /api/schedule-bases (?divisionId=)
func (h *Handler) ScheduleBasesList(w http.ResponseWriter, r *http.Request) {
	divisionIdStr := r.URL.Query().Get("divisionId")
	query := `
		SELECT b.id, b.name, b.description, b."divisionId", b."sortOrder",
		       d.id, d.code, d.name
		FROM schedule_bases b
		LEFT JOIN schedule_divisions d ON d.id = b."divisionId"
		WHERE ($1::text = '' OR $1 IS NULL OR b."divisionId"::text = $1)
		ORDER BY b."sortOrder" ASC, b.id ASC
	`
	var divParam interface{}
	if divisionIdStr != "" {
		divParam = divisionIdStr
	} else {
		divParam = nil
	}
	rows, err := h.db.Pool.Query(r.Context(), query, divParam)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "기준 유형 목록을 불러오는 중 오류가 발생했습니다."})
		return
	}
	defer rows.Close()
	var list []ScheduleBaseItem
	for rows.Next() {
		var b ScheduleBaseItem
		var desc *string
		var divID *int
		var dID *int
		var dCode, dName *string
		if err := rows.Scan(&b.ID, &b.Name, &desc, &divID, &b.SortOrder, &dID, &dCode, &dName); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "기준 유형 목록을 불러오는 중 오류가 발생했습니다."})
			return
		}
		b.Description = desc
		b.DivisionID = divID
		if dID != nil && dCode != nil && dName != nil {
			b.Division = &ScheduleDivisionBrief{ID: *dID, Code: *dCode, Name: *dName}
		}
		list = append(list, b)
	}
	writeJSON(w, http.StatusOK, list)
}

// ScheduleBasesCreate POST /api/schedule-bases
func (h *Handler) ScheduleBasesCreate(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name        string `json:"name"`
		Description *string `json:"description"`
		DivisionID  *int    `json:"divisionId"`
		SortOrder   *int    `json:"sortOrder"`
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
		INSERT INTO schedule_bases (name, description, "divisionId", "sortOrder", "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id
	`, body.Name, body.Description, body.DivisionID, sortOrder).Scan(&id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "기준 유형 추가 중 오류가 발생했습니다."})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"id": id, "name": body.Name, "description": body.Description, "divisionId": body.DivisionID, "sortOrder": sortOrder,
	})
}

// ScheduleBasesUpdate PUT /api/schedule-bases/:id
func (h *Handler) ScheduleBasesUpdate(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 ID입니다."})
		return
	}
	var body struct {
		Name        *string `json:"name"`
		Description *string `json:"description"`
		DivisionID  *int    `json:"divisionId"`
		SortOrder   *int    `json:"sortOrder"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	var name, desc string
	var divID *int
	var sortOrder int
	row := h.db.Pool.QueryRow(r.Context(), `SELECT name, description, "divisionId", "sortOrder" FROM schedule_bases WHERE id = $1`, id)
	if err := row.Scan(&name, &desc, &divID, &sortOrder); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "기준 유형을 찾을 수 없습니다."})
		return
	}
	if body.Name != nil {
		name = *body.Name
	}
	if body.Description != nil {
		desc = *body.Description
	}
	if body.DivisionID != nil {
		divID = body.DivisionID
	}
	if body.SortOrder != nil {
		sortOrder = *body.SortOrder
	}
	_, err = h.db.Pool.Exec(r.Context(), `
		UPDATE schedule_bases SET name = $1, description = $2, "divisionId" = $3, "sortOrder" = $4, "updatedAt" = NOW() WHERE id = $5
	`, name, desc, divID, sortOrder, id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "기준 유형 수정 중 오류가 발생했습니다."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"id": id, "name": name, "description": desc, "divisionId": divID, "sortOrder": sortOrder})
}

// ScheduleBasesDelete DELETE /api/schedule-bases/:id
func (h *Handler) ScheduleBasesDelete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 ID입니다."})
		return
	}
	res, err := h.db.Pool.Exec(r.Context(), `DELETE FROM schedule_bases WHERE id = $1`, id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "기준 유형 삭제 중 오류가 발생했습니다."})
		return
	}
	if res.RowsAffected() == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "기준 유형을 찾을 수 없습니다."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "삭제되었습니다."})
}
