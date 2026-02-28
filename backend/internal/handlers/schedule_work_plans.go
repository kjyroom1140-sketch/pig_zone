package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
)

// ScheduleWorkPlansList GET /api/admin/schedule-work-plans
// 전역 기초 일정(schedule_work_plans) 목록. 새 구조: 선택값 ID + criteria_content.
func (h *Handler) ScheduleWorkPlansList(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT swp.id, swp.structure_template_id, swp.sortation_id, swp.jobtype_id, swp.criteria_id, swp.criteria_content::text, swp.work_content, COALESCE(swp.sort_order, 999999), swp."createdAt", swp."updatedAt",
			st.name AS structure_template_name,
			sd.name AS sortation_name,
			jd.name AS jobtype_name,
			cd.name AS criteria_name
		FROM schedule_work_plans swp
		LEFT JOIN structure_templates st ON st.id = swp.structure_template_id
		LEFT JOIN schedule_sortation_definitions sd ON sd.id = swp.sortation_id
		LEFT JOIN schedule_jobtype_definitions jd ON jd.id = swp.jobtype_id
		LEFT JOIN schedule_criteria_definitions cd ON cd.id = swp.criteria_id
		ORDER BY COALESCE(swp.sort_order, 999999) ASC, swp.id ASC
	`)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "기초 일정 목록을 불러오는 중 오류가 발생했습니다.", "detail": err.Error()})
		return
	}
	defer rows.Close()
	var list []map[string]interface{}
	for rows.Next() {
		var id int
		var structTplID, sortID, jobtypeID, criteriaID *int
		var criteriaContentStr *string
		var workContent *string
		var sortOrder int
		var createdAt, updatedAt time.Time
		var structTplName *string
		var sortationName, jobtypeName, criteriaName *string
		if err := rows.Scan(&id, &structTplID, &sortID, &jobtypeID, &criteriaID, &criteriaContentStr, &workContent, &sortOrder, &createdAt, &updatedAt,
			&structTplName, &sortationName, &jobtypeName, &criteriaName); err != nil {
			continue
		}
		plan := map[string]interface{}{
			"id":                   id,
			"structureTemplateId":  structTplID,
			"sortationId":          sortID,
			"jobtypeId":            jobtypeID,
			"criteriaId":           criteriaID,
			"criteriaContent":      ParseJSONBFromText(criteriaContentStr),
			"workContent":          strPtrToInterface(workContent),
			"createdAt":            createdAt.Format(time.RFC3339),
			"updatedAt":            updatedAt.Format(time.RFC3339),
			"structureTemplateName": strPtrToInterface(structTplName),
			"sortationName":        strPtrToInterface(sortationName),
			"jobtypeName":          strPtrToInterface(jobtypeName),
			"criteriaName":         strPtrToInterface(criteriaName),
		}
		list = append(list, plan)
	}
	writeJSON(w, http.StatusOK, list)
}

// ScheduleWorkPlansCreate POST /api/admin/schedule-work-plans
func (h *Handler) ScheduleWorkPlansCreate(w http.ResponseWriter, r *http.Request) {
	var body struct {
		StructureTemplateID *int         `json:"structure_template_id"`
		SortationID         *int         `json:"sortation_id"`
		JobtypeID           *int         `json:"jobtype_id"`
		CriteriaID          *int         `json:"criteria_id"`
		CriteriaContent     *interface{} `json:"criteria_content"`
		WorkContent         *string      `json:"work_content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	criteriaContentJSON := []byte("null")
	if body.CriteriaContent != nil {
		b, _ := json.Marshal(body.CriteriaContent)
		criteriaContentJSON = b
	}
	// 최신순: 새 항목을 맨 위에 두기 위해 sort_order를 기존 최소값 - 1 로 설정
	var nextOrder int
	_ = h.db.Pool.QueryRow(r.Context(), `SELECT COALESCE(MIN(sort_order), 0) - 1 FROM schedule_work_plans`).Scan(&nextOrder)
	var id int
	err := h.db.Pool.QueryRow(r.Context(), `
		INSERT INTO schedule_work_plans (structure_template_id, sortation_id, jobtype_id, criteria_id, criteria_content, work_content, sort_order, "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
		RETURNING id
	`, body.StructureTemplateID, body.SortationID, body.JobtypeID, body.CriteriaID, criteriaContentJSON, body.WorkContent, nextOrder).Scan(&id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "기초 일정 추가 중 오류가 발생했습니다.", "detail": err.Error()})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]interface{}{"id": id})
}

// ScheduleWorkPlansUpdate PUT /api/admin/schedule-work-plans/:id
func (h *Handler) ScheduleWorkPlansUpdate(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 ID입니다."})
		return
	}
	var body struct {
		StructureTemplateID *int         `json:"structure_template_id"`
		SortationID         *int         `json:"sortation_id"`
		JobtypeID           *int         `json:"jobtype_id"`
		CriteriaID          *int         `json:"criteria_id"`
		CriteriaContent     *interface{} `json:"criteria_content"`
		WorkContent         *string      `json:"work_content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	criteriaContentJSON := []byte("null")
	if body.CriteriaContent != nil {
		b, _ := json.Marshal(body.CriteriaContent)
		criteriaContentJSON = b
	}
	_, err = h.db.Pool.Exec(r.Context(), `
		UPDATE schedule_work_plans
		SET structure_template_id = $1, sortation_id = $2, jobtype_id = $3, criteria_id = $4, criteria_content = $5, work_content = $6, "updatedAt" = NOW()
		WHERE id = $7
	`, body.StructureTemplateID, body.SortationID, body.JobtypeID, body.CriteriaID, criteriaContentJSON, body.WorkContent, id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "기초 일정 수정 중 오류가 발생했습니다."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"id": id})
}

// ScheduleWorkPlansDelete DELETE /api/admin/schedule-work-plans/:id
func (h *Handler) ScheduleWorkPlansDelete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 ID입니다."})
		return
	}
	res, err := h.db.Pool.Exec(r.Context(), `DELETE FROM schedule_work_plans WHERE id = $1`, id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "기초 일정 삭제 중 오류가 발생했습니다."})
		return
	}
	if res.RowsAffected() == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "해당 항목을 찾을 수 없습니다."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true})
}

// ScheduleWorkPlansReorder POST /api/admin/schedule-work-plans/reorder
// body: {"id_order": [1, 2, 3]} — 새 순서대로 id 배열
func (h *Handler) ScheduleWorkPlansReorder(w http.ResponseWriter, r *http.Request) {
	var body struct {
		IDOrder []int `json:"id_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || len(body.IDOrder) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "id_order 배열이 필요합니다."})
		return
	}
	tx, err := h.db.Pool.Begin(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "트랜잭션 시작 실패"})
		return
	}
	defer tx.Rollback(r.Context())
	for i, id := range body.IDOrder {
		_, err = tx.Exec(r.Context(), `UPDATE schedule_work_plans SET sort_order = $1, "updatedAt" = NOW() WHERE id = $2`, i, id)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "순서 저장 실패", "detail": err.Error()})
			return
		}
	}
	if err = tx.Commit(r.Context()); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "순서 저장 실패"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true})
}

func strPtrToInterface(s *string) interface{} {
	if s == nil {
		return nil
	}
	return *s
}
