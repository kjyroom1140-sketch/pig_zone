package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
)

// ScheduleWorkTypeItem for schedule_work_types.
type ScheduleWorkTypeItem struct {
	ID             int     `json:"id"`
	Code           *string `json:"code"`
	Name           string  `json:"name"`
	Description    *string `json:"description"`
	AppliesToScope string  `json:"appliesToScope"`
	DivisionID     *int    `json:"divisionId"`
	SortOrder      int     `json:"sortOrder"`
}

// ScheduleWorkTypesList GET /api/schedule-work-types (?appliesToScope=pig|facility|both)
func (h *Handler) ScheduleWorkTypesList(w http.ResponseWriter, r *http.Request) {
	scope := r.URL.Query().Get("appliesToScope")
	var rows interface {
		Next() bool
		Scan(dest ...interface{}) error
		Close()
	}
	var err error
	if scope == "pig" || scope == "facility" || scope == "both" {
		rows, err = h.db.Pool.Query(r.Context(), `
			SELECT id, code, name, description, "appliesToScope", "divisionId", "sortOrder"
			FROM schedule_work_types WHERE "appliesToScope" = $1 OR "appliesToScope" = 'both'
			ORDER BY "sortOrder" ASC, id ASC
		`, scope)
	} else {
		rows, err = h.db.Pool.Query(r.Context(), `
			SELECT id, code, name, description, "appliesToScope", "divisionId", "sortOrder"
			FROM schedule_work_types ORDER BY "sortOrder" ASC, id ASC
		`)
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "작업유형 대분류 목록을 불러오는 중 오류가 발생했습니다."})
		return
	}
	defer rows.Close()
	var list []ScheduleWorkTypeItem
	for rows.Next() {
		var d ScheduleWorkTypeItem
		var code, desc *string
		var divID *int
		if err := rows.Scan(&d.ID, &code, &d.Name, &desc, &d.AppliesToScope, &divID, &d.SortOrder); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "작업유형 대분류 목록을 불러오는 중 오류가 발생했습니다."})
			return
		}
		d.Code = code
		d.Description = desc
		d.DivisionID = divID
		list = append(list, d)
	}
	writeJSON(w, http.StatusOK, list)
}

// ScheduleWorkTypesCreate POST /api/schedule-work-types
func (h *Handler) ScheduleWorkTypesCreate(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Code            *string `json:"code"`
		Name            string  `json:"name"`
		Description     *string `json:"description"`
		AppliesToScope  string  `json:"appliesToScope"`
		DivisionID      *int    `json:"divisionId"`
		SortOrder       *int    `json:"sortOrder"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	scope := body.AppliesToScope
	if scope == "" {
		scope = "pig"
	}
	sortOrder := 0
	if body.SortOrder != nil {
		sortOrder = *body.SortOrder
	}
	var id int
	err := h.db.Pool.QueryRow(r.Context(), `
		INSERT INTO schedule_work_types (code, name, description, "appliesToScope", "divisionId", "sortOrder", "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING id
	`, body.Code, body.Name, body.Description, scope, body.DivisionID, sortOrder).Scan(&id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "작업유형 대분류 추가 중 오류가 발생했습니다."})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"id": id, "code": body.Code, "name": body.Name, "description": body.Description,
		"appliesToScope": scope, "divisionId": body.DivisionID, "sortOrder": sortOrder,
	})
}

// ScheduleWorkTypesUpdate PUT /api/schedule-work-types/:id
func (h *Handler) ScheduleWorkTypesUpdate(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 ID입니다."})
		return
	}
	var body struct {
		Code            *string `json:"code"`
		Name            *string `json:"name"`
		Description     *string `json:"description"`
		AppliesToScope  *string `json:"appliesToScope"`
		DivisionID      *int    `json:"divisionId"`
		SortOrder       *int    `json:"sortOrder"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	var code, name, desc, scope interface{}
	var divID *int
	var sortOrder int
	row := h.db.Pool.QueryRow(r.Context(), `SELECT code, name, description, "appliesToScope", "divisionId", "sortOrder" FROM schedule_work_types WHERE id = $1`, id)
	if err := row.Scan(&code, &name, &desc, &scope, &divID, &sortOrder); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "작업유형 대분류를 찾을 수 없습니다."})
		return
	}
	if body.Code != nil {
		code = *body.Code
	}
	if body.Name != nil {
		name = *body.Name
	}
	if body.Description != nil {
		desc = body.Description
	}
	if body.AppliesToScope != nil {
		scope = *body.AppliesToScope
	}
	if body.DivisionID != nil {
		divID = body.DivisionID
	}
	if body.SortOrder != nil {
		sortOrder = *body.SortOrder
	}
	_, err = h.db.Pool.Exec(r.Context(), `
		UPDATE schedule_work_types SET code = $1, name = $2, description = $3, "appliesToScope" = $4, "divisionId" = $5, "sortOrder" = $6, "updatedAt" = NOW() WHERE id = $7
	`, code, name, desc, scope, divID, sortOrder, id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "작업유형 대분류 수정 중 오류가 발생했습니다."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"id": id, "code": code, "name": name, "description": desc, "appliesToScope": scope, "divisionId": divID, "sortOrder": sortOrder})
}

// ScheduleWorkTypesDelete DELETE /api/schedule-work-types/:id
func (h *Handler) ScheduleWorkTypesDelete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 ID입니다."})
		return
	}
	res, err := h.db.Pool.Exec(r.Context(), `DELETE FROM schedule_work_types WHERE id = $1`, id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "작업유형 대분류 삭제 중 오류가 발생했습니다."})
		return
	}
	if res.RowsAffected() == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "작업유형 대분류를 찾을 수 없습니다."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "삭제되었습니다."})
}
