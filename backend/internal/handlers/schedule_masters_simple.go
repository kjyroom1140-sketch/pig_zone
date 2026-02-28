package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
)

// ScheduleSortationsList GET /api/schedule-sortations (?structure_template_id= 시설별 필터)
// schedule_sortation_definitions 가 있으면 LEFT JOIN 해서 sortation_name 반환. 테이블 없으면 JOIN 없이 조회.
func (h *Handler) ScheduleSortationsList(w http.ResponseWriter, r *http.Request) {
	q := `
		SELECT ss.id, ss.structure_template_id, ss.sortations::text, COALESCE(ss.sort_order, 0),
		       sd.name AS sortation_name,
		       (NULLIF(ss.sortations::jsonb->0->>'sortation_definition_id', '')::int) AS sortation_definition_id
		FROM schedule_sortations ss
		LEFT JOIN schedule_sortation_definitions sd ON sd.id = (NULLIF(ss.sortations::jsonb->0->>'sortation_definition_id', '')::int)
		WHERE 1=1
	`
	args := []interface{}{}
	argNum := 1
	if idStr := r.URL.Query().Get("structure_template_id"); idStr != "" {
		if id, err := strconv.Atoi(idStr); err == nil {
			q += ` AND ss.structure_template_id = $` + strconv.Itoa(argNum)
			args = append(args, id)
			argNum++
		}
	}
	q += ` ORDER BY COALESCE(ss.sort_order, 0) ASC, ss.id ASC`
	rows, err := h.db.Pool.Query(r.Context(), q, args...)
	if err != nil {
		errStr := err.Error()
		if strings.Contains(errStr, "does not exist") || strings.Contains(errStr, "invalid input syntax") || strings.Contains(errStr, "cannot cast") {
			scheduleSortationsListFallback(h, w, r)
			return
		}
		log.Printf("[schedule_sortations] list failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "목록 조회 실패"})
		return
	}
	defer rows.Close()
	var list []map[string]interface{}
	for rows.Next() {
		var id int
		var structID *int
		var sortations *string
		var sortOrder int
		var sortationName *string
		var sortationDefID *int
		if err := rows.Scan(&id, &structID, &sortations, &sortOrder, &sortationName, &sortationDefID); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "목록 조회 실패"})
			return
		}
		item := map[string]interface{}{"id": id, "structure_template_id": structID, "sortations": ParseJSONBFromText(sortations), "sort_order": sortOrder}
		if sortationName != nil {
			item["sortation_name"] = *sortationName
		}
		if sortationDefID != nil {
			item["sortation_definition_id"] = *sortationDefID
		}
		list = append(list, item)
	}
	writeJSON(w, http.StatusOK, list)
}

func scheduleSortationsListFallback(h *Handler, w http.ResponseWriter, r *http.Request) {
	q := `SELECT id, structure_template_id, sortations::text, COALESCE(sort_order, 0) FROM schedule_sortations WHERE 1=1`
	args := []interface{}{}
	if idStr := r.URL.Query().Get("structure_template_id"); idStr != "" {
		if id, err := strconv.Atoi(idStr); err == nil {
			q += ` AND structure_template_id = $1`
			args = append(args, id)
		}
	}
	q += ` ORDER BY COALESCE(sort_order, 0) ASC, id ASC`
	rows, err := h.db.Pool.Query(r.Context(), q, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "목록 조회 실패"})
		return
	}
	defer rows.Close()
	var list []map[string]interface{}
	for rows.Next() {
		var id int
		var structID *int
		var sortations *string
		var sortOrder int
		if err := rows.Scan(&id, &structID, &sortations, &sortOrder); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "목록 조회 실패"})
			return
		}
		item := map[string]interface{}{"id": id, "structure_template_id": structID, "sortations": ParseJSONBFromText(sortations), "sort_order": sortOrder}
		if sortations != nil {
			if parsed := ParseJSONBFromText(sortations); parsed != nil {
				if arr, ok := parsed.([]interface{}); ok && len(arr) > 0 {
					if m, ok := arr[0].(map[string]interface{}); ok && m["sortation_definition_id"] != nil {
						if defID, ok := numFromInterface(m["sortation_definition_id"]); ok {
							item["sortation_definition_id"] = defID
						}
					}
				}
			}
		}
		list = append(list, item)
	}
	writeJSON(w, http.StatusOK, list)
}

func numFromInterface(v interface{}) (int, bool) {
	switch n := v.(type) {
	case float64:
		return int(n), true
	case int:
		return n, true
	default:
		return 0, false
	}
}

// ScheduleSortationsCreate POST /api/schedule-sortations
// sortation_definition_id 가 있으면 sortations = [{ "sortation_definition_id": id }] 로 저장
func (h *Handler) ScheduleSortationsCreate(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name                 string      `json:"name"`
		StructureTemplateID  *int        `json:"structure_template_id"`
		SortationDefinitionID *int       `json:"sortation_definition_id"`
		Sortations          interface{} `json:"sortations"`
		SortOrder           *int        `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	if body.StructureTemplateID == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "시설(structure_template_id)이 필요합니다."})
		return
	}
	var sortationsJSON string
	if body.SortationDefinitionID != nil {
		b, _ := json.Marshal([]map[string]interface{}{{"sortation_definition_id": *body.SortationDefinitionID}})
		sortationsJSON = string(b)
	} else if body.Sortations != nil {
		b, _ := json.Marshal(body.Sortations)
		sortationsJSON = string(b)
	} else {
		if body.Name == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "구분 이름 또는 sortation_definition_id가 필요합니다."})
			return
		}
		b, _ := json.Marshal([]map[string]string{{"name": body.Name}})
		sortationsJSON = string(b)
	}
	sortOrder := 0
	if body.SortOrder != nil {
		sortOrder = *body.SortOrder
	}
	var id int
	err := h.db.Pool.QueryRow(r.Context(), `INSERT INTO schedule_sortations (structure_template_id, sortations, sort_order, "createdAt", "updatedAt") VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id`, body.StructureTemplateID, []byte(sortationsJSON), sortOrder).Scan(&id)
	if err != nil {
		log.Printf("[schedule_sortations] INSERT failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "생성 실패", "detail": err.Error()})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]interface{}{"id": id, "structure_template_id": body.StructureTemplateID, "sortations": sortationsJSON})
}

// ScheduleSortationsUpdate PUT /api/schedule-sortations/:id
func (h *Handler) ScheduleSortationsUpdate(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 ID입니다."})
		return
	}
	var body struct {
		StructureTemplateID *int        `json:"structure_template_id"`
		Sortations         interface{} `json:"sortations"`
		SortOrder          *int        `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	var structID *int
	var sortations *string
	var currentOrder *int
	if err := h.db.Pool.QueryRow(r.Context(), `SELECT structure_template_id, sortations, sort_order FROM schedule_sortations WHERE id = $1`, id).Scan(&structID, &sortations, &currentOrder); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "구분을 찾을 수 없습니다."})
		return
	}
	var sortationsPayload []byte
	if body.Sortations != nil {
		b, _ := json.Marshal(body.Sortations)
		sortationsPayload = b
	} else if sortations != nil && *sortations != "" {
		sortationsPayload = []byte(*sortations)
	}
	if body.StructureTemplateID != nil {
		structID = body.StructureTemplateID
	}
	orderVal := 0
	if currentOrder != nil {
		orderVal = *currentOrder
	}
	if body.SortOrder != nil {
		orderVal = *body.SortOrder
	}
	_, err = h.db.Pool.Exec(r.Context(), `UPDATE schedule_sortations SET structure_template_id = $1, sortations = $2, sort_order = $3, "updatedAt" = NOW() WHERE id = $4`, structID, sortationsPayload, orderVal, id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "수정 실패"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"id": id})
}

// ScheduleSortationsDelete DELETE /api/schedule-sortations/:id (하위 작업유형·기준 함께 삭제)
func (h *Handler) ScheduleSortationsDelete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 ID입니다."})
		return
	}
	ctx := r.Context()
	// 하위 기준 삭제(해당 구분의 작업유형에 속한 기준) → 작업유형 삭제 → 구분 삭제
	_, _ = h.db.Pool.Exec(ctx, `DELETE FROM schedule_criterias WHERE jobtype_id IN (SELECT id FROM schedule_jobtypes WHERE sortation_id = $1)`, id)
	_, _ = h.db.Pool.Exec(ctx, `DELETE FROM schedule_jobtypes WHERE sortation_id = $1`, id)
	res, err := h.db.Pool.Exec(ctx, `DELETE FROM schedule_sortations WHERE id = $1`, id)
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

// ScheduleSortationDefinitionsList GET /api/schedule-sortation-definitions
// 테이블이 없으면 빈 배열 반환 (500 대신 200)
func (h *Handler) ScheduleSortationDefinitionsList(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Pool.Query(r.Context(), `SELECT id, name, COALESCE(sort_order, 0) FROM schedule_sortation_definitions ORDER BY COALESCE(sort_order, 0) ASC, id ASC`)
	if err != nil {
		if strings.Contains(err.Error(), "does not exist") {
			writeJSON(w, http.StatusOK, []map[string]interface{}{})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "목록 조회 실패"})
		return
	}
	defer rows.Close()
	var list []map[string]interface{}
	for rows.Next() {
		var id int
		var name string
		var sortOrder int
		if err := rows.Scan(&id, &name, &sortOrder); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "목록 조회 실패"})
			return
		}
		list = append(list, map[string]interface{}{"id": id, "name": name, "sort_order": sortOrder})
	}
	writeJSON(w, http.StatusOK, list)
}

// ScheduleSortationDefinitionsCreate POST /api/schedule-sortation-definitions
func (h *Handler) ScheduleSortationDefinitionsCreate(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name      string `json:"name"`
		SortOrder *int   `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	if body.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "이름은 필수입니다."})
		return
	}
	sortOrder := 0
	if body.SortOrder != nil {
		sortOrder = *body.SortOrder
	}
	var id int
	err := h.db.Pool.QueryRow(r.Context(), `INSERT INTO schedule_sortation_definitions (name, sort_order, "createdAt", "updatedAt") VALUES ($1, $2, NOW(), NOW()) RETURNING id`, body.Name, sortOrder).Scan(&id)
	if err != nil {
		log.Printf("[schedule_sortation_definitions] INSERT failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "생성 실패", "detail": err.Error()})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]interface{}{"id": id})
}

// ScheduleSortationDefinitionsUpdate PUT /api/schedule-sortation-definitions/:id
func (h *Handler) ScheduleSortationDefinitionsUpdate(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 ID입니다."})
		return
	}
	var body struct {
		Name      string `json:"name"`
		SortOrder *int   `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	var name string
	var sortOrder int
	if err := h.db.Pool.QueryRow(r.Context(), `SELECT name, COALESCE(sort_order, 0) FROM schedule_sortation_definitions WHERE id = $1`, id).Scan(&name, &sortOrder); err != nil {
		if strings.Contains(err.Error(), "does not exist") {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "구분 정의 테이블이 없습니다. 스크립트로 테이블을 생성해 주세요."})
			return
		}
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "구분 정의를 찾을 수 없습니다."})
		return
	}
	if body.Name != "" {
		name = body.Name
	}
	if body.SortOrder != nil {
		sortOrder = *body.SortOrder
	}
	_, err = h.db.Pool.Exec(r.Context(), `UPDATE schedule_sortation_definitions SET name = $1, sort_order = $2, "updatedAt" = NOW() WHERE id = $3`, name, sortOrder, id)
	if err != nil {
		if strings.Contains(err.Error(), "does not exist") {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "구분 정의 테이블이 없습니다. 스크립트로 테이블을 생성해 주세요."})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "수정 실패"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"id": id})
}

// ScheduleSortationDefinitionsDelete DELETE /api/schedule-sortation-definitions/:id
func (h *Handler) ScheduleSortationDefinitionsDelete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 ID입니다."})
		return
	}
	res, err := h.db.Pool.Exec(r.Context(), `DELETE FROM schedule_sortation_definitions WHERE id = $1`, id)
	if err != nil {
		if strings.Contains(err.Error(), "does not exist") {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "구분 정의 테이블이 없습니다. 스크립트로 테이블을 생성해 주세요."})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "삭제 중 오류가 발생했습니다."})
		return
	}
	if res.RowsAffected() == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "구분 정의를 찾을 수 없습니다."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "삭제되었습니다."})
}

// ScheduleCriteriasList GET /api/schedule-criterias
// schedule_criteria_definitions 가 있으면 LEFT JOIN 해서 criteria_name, content_type 반환. 테이블 없으면 JOIN 없이 조회.
func (h *Handler) ScheduleCriteriasList(w http.ResponseWriter, r *http.Request) {
	q := `
		SELECT sc.id, sc.jobtype_id, sc.criterias::text, COALESCE(sc.sort_order, 0),
		       d.name AS criteria_name, d.content_type AS content_type,
		       (NULLIF(sc.criterias::jsonb->0->>'criteria_definition_id', '')::int) AS criteria_definition_id
		FROM schedule_criterias sc
		LEFT JOIN schedule_criteria_definitions d ON d.id = (NULLIF(sc.criterias::jsonb->0->>'criteria_definition_id', '')::int)
		ORDER BY COALESCE(sc.sort_order, 0) ASC, sc.id ASC
	`
	rows, err := h.db.Pool.Query(r.Context(), q)
	if err != nil {
		log.Printf("[schedule_criterias] list with definitions failed: %v", err)
		scheduleCriteriasListFallback(h, w, r)
		return
	}
	defer rows.Close()
	var list []map[string]interface{}
	for rows.Next() {
		var id int
		var jobtypeID *int
		var criterias *string
		var sortOrder int
		var criteriaName, contentType *string
		var criteriaDefID *int
		if err := rows.Scan(&id, &jobtypeID, &criterias, &sortOrder, &criteriaName, &contentType, &criteriaDefID); err != nil {
			log.Printf("[schedule_criterias] scan failed: %v", err)
			scheduleCriteriasListFallback(h, w, r)
			return
		}
		item := map[string]interface{}{"id": id, "jobtype_id": jobtypeID, "criterias": ParseJSONBFromText(criterias), "sort_order": sortOrder}
		if criteriaName != nil {
			item["criteria_name"] = *criteriaName
		}
		if contentType != nil {
			item["content_type"] = *contentType
		}
		if criteriaDefID != nil {
			item["criteria_definition_id"] = *criteriaDefID
		}
		list = append(list, item)
	}
	writeJSON(w, http.StatusOK, list)
}

func scheduleCriteriasListFallback(h *Handler, w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Pool.Query(r.Context(), `SELECT id, jobtype_id, criterias::text, COALESCE(sort_order, 0) FROM schedule_criterias ORDER BY COALESCE(sort_order, 0) ASC, id ASC`)
	if err != nil {
		if strings.Contains(err.Error(), "does not exist") {
			writeJSON(w, http.StatusOK, []interface{}{})
			return
		}
		log.Printf("[schedule_criterias] fallback list failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "목록 조회 실패"})
		return
	}
	defer rows.Close()
	var list []map[string]interface{}
	for rows.Next() {
		var id int
		var jobtypeID *int
		var criterias *string
		var sortOrder int
		if err := rows.Scan(&id, &jobtypeID, &criterias, &sortOrder); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "목록 조회 실패"})
			return
		}
		item := map[string]interface{}{"id": id, "jobtype_id": jobtypeID, "criterias": ParseJSONBFromText(criterias), "sort_order": sortOrder}
		if criterias != nil {
			if parsed := ParseJSONBFromText(criterias); parsed != nil {
				if arr, ok := parsed.([]interface{}); ok && len(arr) > 0 {
					if m, ok := arr[0].(map[string]interface{}); ok && m["criteria_definition_id"] != nil {
						if defID, ok := numFromInterface(m["criteria_definition_id"]); ok {
							item["criteria_definition_id"] = defID
						}
					}
				}
			}
		}
		list = append(list, item)
	}
	writeJSON(w, http.StatusOK, list)
}

// ScheduleCriteriasCreate POST /api/schedule-criterias
// - criteria_definition_id 가 있으면 criterias = [{ "criteria_definition_id": id }] 로 저장
// - 없으면 name + criterias(또는 기존 방식) 지원
func (h *Handler) ScheduleCriteriasCreate(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name                 string      `json:"name"`
		JobtypeID             *int        `json:"jobtype_id"`
		CriteriaDefinitionID  *int        `json:"criteria_definition_id"`
		Criterias             interface{} `json:"criterias"`
		SortOrder             *int        `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	if body.JobtypeID == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "작업유형(jobtype_id)이 필요합니다."})
		return
	}
	var criteriasJSON string
	if body.CriteriaDefinitionID != nil {
		b, _ := json.Marshal([]map[string]interface{}{{"criteria_definition_id": *body.CriteriaDefinitionID}})
		criteriasJSON = string(b)
	} else if body.Criterias != nil {
		b, _ := json.Marshal(body.Criterias)
		criteriasJSON = string(b)
	} else {
		if body.Name == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "기준 이름 또는 criteria_definition_id가 필요합니다."})
			return
		}
		b, _ := json.Marshal([]map[string]string{{"name": body.Name}})
		criteriasJSON = string(b)
	}
	sortOrder := 0
	if body.SortOrder != nil {
		sortOrder = *body.SortOrder
	}
	var id int
	err := h.db.Pool.QueryRow(r.Context(), `INSERT INTO schedule_criterias (jobtype_id, criterias, sort_order, "createdAt", "updatedAt") VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id`, body.JobtypeID, []byte(criteriasJSON), sortOrder).Scan(&id)
	if err != nil {
		log.Printf("[schedule_criterias] INSERT failed: %v", err)
		if strings.Contains(err.Error(), "does not exist") || strings.Contains(err.Error(), "column") {
			err2 := h.db.Pool.QueryRow(r.Context(), `INSERT INTO schedule_criterias (jobtype_id, criterias, sort_order, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id`, body.JobtypeID, []byte(criteriasJSON), sortOrder).Scan(&id)
			if err2 != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "생성 실패", "detail": err2.Error()})
				return
			}
		} else {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "생성 실패", "detail": err.Error()})
			return
		}
	}
	writeJSON(w, http.StatusCreated, map[string]interface{}{"id": id})
}

// ScheduleCriteriasUpdate PUT /api/schedule-criterias/:id
func (h *Handler) ScheduleCriteriasUpdate(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 ID입니다."})
		return
	}
	var body struct {
		JobtypeID  *int        `json:"jobtype_id"`
		Criterias  interface{} `json:"criterias"`
		SortOrder  *int        `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	var jobtypeID *int
	var criterias *string
	var currentOrder *int
	if err := h.db.Pool.QueryRow(r.Context(), `SELECT jobtype_id, criterias, sort_order FROM schedule_criterias WHERE id = $1`, id).Scan(&jobtypeID, &criterias, &currentOrder); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "기준을 찾을 수 없습니다."})
		return
	}
	if body.JobtypeID != nil {
		jobtypeID = body.JobtypeID
	}
	var criteriasPayload []byte
	if body.Criterias != nil {
		b, _ := json.Marshal(body.Criterias)
		criteriasPayload = b
	} else if criterias != nil && *criterias != "" {
		criteriasPayload = []byte(*criterias)
	}
	orderVal := 0
	if currentOrder != nil {
		orderVal = *currentOrder
	}
	if body.SortOrder != nil {
		orderVal = *body.SortOrder
	}
	_, err = h.db.Pool.Exec(r.Context(), `UPDATE schedule_criterias SET jobtype_id = $1, criterias = $2, sort_order = $3, "updatedAt" = NOW() WHERE id = $4`, jobtypeID, criteriasPayload, orderVal, id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "수정 실패"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"id": id})
}

// ScheduleCriteriasDelete DELETE /api/schedule-criterias/:id
func (h *Handler) ScheduleCriteriasDelete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 ID입니다."})
		return
	}
	res, err := h.db.Pool.Exec(r.Context(), `DELETE FROM schedule_criterias WHERE id = $1`, id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "기준 삭제 중 오류가 발생했습니다."})
		return
	}
	if res.RowsAffected() == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "기준을 찾을 수 없습니다."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "삭제되었습니다."})
}

// ScheduleCriteriaDefinitionsList GET /api/schedule-criteria-definitions
// 테이블/컬럼이 없거나 조회 실패 시 500 대신 빈 배열 반환
func (h *Handler) ScheduleCriteriaDefinitionsList(w http.ResponseWriter, r *http.Request) {
	emptyList := []map[string]interface{}{}
	rows, err := h.db.Pool.Query(r.Context(), `SELECT id, name, content_type, COALESCE(sort_order, 0) FROM schedule_criteria_definitions ORDER BY COALESCE(sort_order, 0) ASC, id ASC`)
	if err != nil {
		log.Printf("[schedule_criteria_definitions] list failed: %v", err)
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(emptyList)
		return
	}
	defer rows.Close()
	var list []map[string]interface{}
	for rows.Next() {
		var id int
		var name, contentType string
		var sortOrder int
		if err := rows.Scan(&id, &name, &contentType, &sortOrder); err != nil {
			log.Printf("[schedule_criteria_definitions] scan failed: %v", err)
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(emptyList)
			return
		}
		list = append(list, map[string]interface{}{"id": id, "name": name, "content_type": contentType, "sort_order": sortOrder})
	}
	writeJSON(w, http.StatusOK, list)
}

// ScheduleCriteriaDefinitionsCreate POST /api/schedule-criteria-definitions
func (h *Handler) ScheduleCriteriaDefinitionsCreate(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name        string `json:"name"`
		ContentType string `json:"content_type"`
		SortOrder   *int   `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	if body.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "이름은 필수입니다."})
		return
	}
	if body.ContentType == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "기준내용 유형(content_type)은 필수입니다."})
		return
	}
	sortOrder := 0
	if body.SortOrder != nil {
		sortOrder = *body.SortOrder
	}
	var id int
	err := h.db.Pool.QueryRow(r.Context(), `INSERT INTO schedule_criteria_definitions (name, content_type, sort_order, "createdAt", "updatedAt") VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id`, body.Name, body.ContentType, sortOrder).Scan(&id)
	if err != nil {
		errStr := err.Error()
		if strings.Contains(errStr, "does not exist") || strings.Contains(errStr, "column") {
			// snake_case 컬럼(created_at, updated_at) 테이블이면 재시도
			err2 := h.db.Pool.QueryRow(r.Context(), `INSERT INTO schedule_criteria_definitions (name, content_type, sort_order, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id`, body.Name, body.ContentType, sortOrder).Scan(&id)
			if err2 == nil {
				writeJSON(w, http.StatusCreated, map[string]interface{}{"id": id})
				return
			}
			errStr = err2.Error()
			log.Printf("[schedule_criteria_definitions] INSERT (snake_case) failed: %v", err2)
		} else {
			log.Printf("[schedule_criteria_definitions] INSERT failed: %v", err)
		}
		if strings.Contains(errStr, "does not exist") || strings.Contains(errStr, "column") {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "기준 정의 테이블이 없거나 스키마가 맞지 않습니다. scripts/run_create_schedule_criteria_definitions.js 또는 create_schedule_criteria_definitions_table.sql 로 테이블을 생성해 주세요."})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "생성 실패", "detail": errStr})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]interface{}{"id": id})
}

// ScheduleCriteriaDefinitionsUpdate PUT /api/schedule-criteria-definitions/:id
func (h *Handler) ScheduleCriteriaDefinitionsUpdate(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 ID입니다."})
		return
	}
	var body struct {
		Name        string `json:"name"`
		ContentType string `json:"content_type"`
		SortOrder   *int   `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	var name, contentType string
	var sortOrder int
	if err := h.db.Pool.QueryRow(r.Context(), `SELECT name, content_type, COALESCE(sort_order, 0) FROM schedule_criteria_definitions WHERE id = $1`, id).Scan(&name, &contentType, &sortOrder); err != nil {
		if strings.Contains(err.Error(), "does not exist") {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "기준 정의 테이블이 없습니다. scripts/run_create_schedule_criteria_definitions.js 로 테이블을 생성해 주세요."})
			return
		}
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "기준 정의를 찾을 수 없습니다."})
		return
	}
	if body.Name != "" {
		name = body.Name
	}
	if body.ContentType != "" {
		contentType = body.ContentType
	}
	if body.SortOrder != nil {
		sortOrder = *body.SortOrder
	}
	_, err = h.db.Pool.Exec(r.Context(), `UPDATE schedule_criteria_definitions SET name = $1, content_type = $2, sort_order = $3, "updatedAt" = NOW() WHERE id = $4`, name, contentType, sortOrder, id)
	if err != nil {
		if strings.Contains(err.Error(), "does not exist") {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "기준 정의 테이블이 없습니다. scripts/run_create_schedule_criteria_definitions.js 로 테이블을 생성해 주세요."})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "수정 실패"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"id": id})
}

// ScheduleCriteriaDefinitionsDelete DELETE /api/schedule-criteria-definitions/:id
func (h *Handler) ScheduleCriteriaDefinitionsDelete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 ID입니다."})
		return
	}
	res, err := h.db.Pool.Exec(r.Context(), `DELETE FROM schedule_criteria_definitions WHERE id = $1`, id)
	if err != nil {
		if strings.Contains(err.Error(), "does not exist") {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "기준 정의 테이블이 없습니다. scripts/run_create_schedule_criteria_definitions.js 로 테이블을 생성해 주세요."})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "삭제 중 오류가 발생했습니다."})
		return
	}
	if res.RowsAffected() == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "기준 정의를 찾을 수 없습니다."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "삭제되었습니다."})
}

// ScheduleJobtypesList GET /api/schedule-jobtypes
// schedule_jobtype_definitions 가 있으면 LEFT JOIN 해서 jobtype_name 반환. 테이블 없으면 JOIN 없이 조회.
func (h *Handler) ScheduleJobtypesList(w http.ResponseWriter, r *http.Request) {
	q := `
		SELECT sj.id, sj.sortation_id, sj.jobtypes::text, COALESCE(sj.sort_order, 0),
		       jd.name AS jobtype_name,
		       (NULLIF(sj.jobtypes::jsonb->0->>'jobtype_definition_id', '')::int) AS jobtype_definition_id
		FROM schedule_jobtypes sj
		LEFT JOIN schedule_jobtype_definitions jd ON jd.id = (NULLIF(sj.jobtypes::jsonb->0->>'jobtype_definition_id', '')::int)
		ORDER BY COALESCE(sj.sort_order, 0) ASC, sj.id ASC
	`
	rows, err := h.db.Pool.Query(r.Context(), q)
	if err != nil {
		errStr := err.Error()
		if strings.Contains(errStr, "does not exist") || strings.Contains(errStr, "invalid input syntax") || strings.Contains(errStr, "cannot cast") {
			scheduleJobtypesListFallback(h, w, r)
			return
		}
		log.Printf("[schedule_jobtypes] list failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "목록 조회 실패"})
		return
	}
	defer rows.Close()
	var list []map[string]interface{}
	for rows.Next() {
		var id int
		var sortationID *int
		var jobtypes *string
		var sortOrder int
		var jobtypeName *string
		var jobtypeDefID *int
		if err := rows.Scan(&id, &sortationID, &jobtypes, &sortOrder, &jobtypeName, &jobtypeDefID); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "목록 조회 실패"})
			return
		}
		item := map[string]interface{}{"id": id, "sortation_id": sortationID, "jobtypes": ParseJSONBFromText(jobtypes), "sort_order": sortOrder}
		if jobtypeName != nil {
			item["jobtype_name"] = *jobtypeName
		}
		if jobtypeDefID != nil {
			item["jobtype_definition_id"] = *jobtypeDefID
		}
		list = append(list, item)
	}
	writeJSON(w, http.StatusOK, list)
}

func scheduleJobtypesListFallback(h *Handler, w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Pool.Query(r.Context(), `SELECT id, sortation_id, jobtypes::text, COALESCE(sort_order, 0) FROM schedule_jobtypes ORDER BY COALESCE(sort_order, 0) ASC, id ASC`)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "목록 조회 실패"})
		return
	}
	defer rows.Close()
	var list []map[string]interface{}
	for rows.Next() {
		var id int
		var sortationID *int
		var jobtypes *string
		var sortOrder int
		if err := rows.Scan(&id, &sortationID, &jobtypes, &sortOrder); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "목록 조회 실패"})
			return
		}
		item := map[string]interface{}{"id": id, "sortation_id": sortationID, "jobtypes": ParseJSONBFromText(jobtypes), "sort_order": sortOrder}
		if jobtypes != nil {
			if parsed := ParseJSONBFromText(jobtypes); parsed != nil {
				if arr, ok := parsed.([]interface{}); ok && len(arr) > 0 {
					if m, ok := arr[0].(map[string]interface{}); ok && m["jobtype_definition_id"] != nil {
						if defID, ok := numFromInterface(m["jobtype_definition_id"]); ok {
							item["jobtype_definition_id"] = defID
						}
					}
				}
			}
		}
		list = append(list, item)
	}
	writeJSON(w, http.StatusOK, list)
}

// ScheduleJobtypesCreate POST /api/schedule-jobtypes
// jobtype_definition_id 가 있으면 jobtypes = [{ "jobtype_definition_id": id }] 로 저장
func (h *Handler) ScheduleJobtypesCreate(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name                 string      `json:"name"`
		SortationID          *int        `json:"sortation_id"`
		JobtypeDefinitionID  *int        `json:"jobtype_definition_id"`
		Jobtypes             interface{} `json:"jobtypes"`
		SortOrder            *int        `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	if body.SortationID == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "구분(sortation_id)이 필요합니다."})
		return
	}
	var jobtypesJSON string
	if body.JobtypeDefinitionID != nil {
		b, _ := json.Marshal([]map[string]interface{}{{"jobtype_definition_id": *body.JobtypeDefinitionID}})
		jobtypesJSON = string(b)
	} else if body.Jobtypes != nil {
		b, _ := json.Marshal(body.Jobtypes)
		jobtypesJSON = string(b)
	} else {
		if body.Name == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "작업유형 이름 또는 jobtype_definition_id가 필요합니다."})
			return
		}
		b, _ := json.Marshal([]map[string]string{{"name": body.Name}})
		jobtypesJSON = string(b)
	}
	sortOrder := 0
	if body.SortOrder != nil {
		sortOrder = *body.SortOrder
	}
	var id int
	err := h.db.Pool.QueryRow(r.Context(), `INSERT INTO schedule_jobtypes (sortation_id, jobtypes, sort_order, "createdAt", "updatedAt") VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id`, body.SortationID, []byte(jobtypesJSON), sortOrder).Scan(&id)
	if err != nil {
		log.Printf("[schedule_jobtypes] INSERT failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "생성 실패", "detail": err.Error()})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]interface{}{"id": id})
}

// ScheduleJobtypesUpdate PUT /api/schedule-jobtypes/:id
func (h *Handler) ScheduleJobtypesUpdate(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 ID입니다."})
		return
	}
	var body struct {
		SortationID *int        `json:"sortation_id"`
		Jobtypes    interface{} `json:"jobtypes"`
		SortOrder   *int        `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	var sortationID *int
	var jobtypes *string
	var currentOrder *int
	if err := h.db.Pool.QueryRow(r.Context(), `SELECT sortation_id, jobtypes, sort_order FROM schedule_jobtypes WHERE id = $1`, id).Scan(&sortationID, &jobtypes, &currentOrder); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "작업유형을 찾을 수 없습니다."})
		return
	}
	if body.SortationID != nil {
		sortationID = body.SortationID
	}
	var jobtypesPayload []byte
	if body.Jobtypes != nil {
		b, _ := json.Marshal(body.Jobtypes)
		jobtypesPayload = b
	} else if jobtypes != nil && *jobtypes != "" {
		jobtypesPayload = []byte(*jobtypes)
	}
	orderVal := 0
	if currentOrder != nil {
		orderVal = *currentOrder
	}
	if body.SortOrder != nil {
		orderVal = *body.SortOrder
	}
	_, err = h.db.Pool.Exec(r.Context(), `UPDATE schedule_jobtypes SET sortation_id = $1, jobtypes = $2, sort_order = $3, "updatedAt" = NOW() WHERE id = $4`, sortationID, jobtypesPayload, orderVal, id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "수정 실패"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"id": id})
}

// ScheduleJobtypesDelete DELETE /api/schedule-jobtypes/:id (하위 기준 함께 삭제)
func (h *Handler) ScheduleJobtypesDelete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 ID입니다."})
		return
	}
	ctx := r.Context()
	_, _ = h.db.Pool.Exec(ctx, `DELETE FROM schedule_criterias WHERE jobtype_id = $1`, id)
	res, err := h.db.Pool.Exec(ctx, `DELETE FROM schedule_jobtypes WHERE id = $1`, id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "작업유형 삭제 중 오류가 발생했습니다."})
		return
	}
	if res.RowsAffected() == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "작업유형을 찾을 수 없습니다."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "삭제되었습니다."})
}

// ScheduleJobtypeDefinitionsList GET /api/schedule-jobtype-definitions
func (h *Handler) ScheduleJobtypeDefinitionsList(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Pool.Query(r.Context(), `SELECT id, name, COALESCE(sort_order, 0) FROM schedule_jobtype_definitions ORDER BY COALESCE(sort_order, 0) ASC, id ASC`)
	if err != nil {
		if strings.Contains(err.Error(), "does not exist") {
			writeJSON(w, http.StatusOK, []map[string]interface{}{})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "목록 조회 실패"})
		return
	}
	defer rows.Close()
	var list []map[string]interface{}
	for rows.Next() {
		var id int
		var name string
		var sortOrder int
		if err := rows.Scan(&id, &name, &sortOrder); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "목록 조회 실패"})
			return
		}
		list = append(list, map[string]interface{}{"id": id, "name": name, "sort_order": sortOrder})
	}
	writeJSON(w, http.StatusOK, list)
}

// ScheduleJobtypeDefinitionsCreate POST /api/schedule-jobtype-definitions
func (h *Handler) ScheduleJobtypeDefinitionsCreate(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name      string `json:"name"`
		SortOrder *int   `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	if body.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "이름은 필수입니다."})
		return
	}
	sortOrder := 0
	if body.SortOrder != nil {
		sortOrder = *body.SortOrder
	}
	var id int
	err := h.db.Pool.QueryRow(r.Context(), `INSERT INTO schedule_jobtype_definitions (name, sort_order, "createdAt", "updatedAt") VALUES ($1, $2, NOW(), NOW()) RETURNING id`, body.Name, sortOrder).Scan(&id)
	if err != nil {
		log.Printf("[schedule_jobtype_definitions] INSERT failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "생성 실패", "detail": err.Error()})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]interface{}{"id": id})
}

// ScheduleJobtypeDefinitionsUpdate PUT /api/schedule-jobtype-definitions/:id
func (h *Handler) ScheduleJobtypeDefinitionsUpdate(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 ID입니다."})
		return
	}
	var body struct {
		Name      string `json:"name"`
		SortOrder *int   `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	var name string
	var sortOrder int
	if err := h.db.Pool.QueryRow(r.Context(), `SELECT name, COALESCE(sort_order, 0) FROM schedule_jobtype_definitions WHERE id = $1`, id).Scan(&name, &sortOrder); err != nil {
		if strings.Contains(err.Error(), "does not exist") {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "작업유형 정의 테이블이 없습니다. 스크립트로 테이블을 생성해 주세요."})
			return
		}
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "작업유형 정의를 찾을 수 없습니다."})
		return
	}
	if body.Name != "" {
		name = body.Name
	}
	if body.SortOrder != nil {
		sortOrder = *body.SortOrder
	}
	_, err = h.db.Pool.Exec(r.Context(), `UPDATE schedule_jobtype_definitions SET name = $1, sort_order = $2, "updatedAt" = NOW() WHERE id = $3`, name, sortOrder, id)
	if err != nil {
		if strings.Contains(err.Error(), "does not exist") {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "작업유형 정의 테이블이 없습니다. 스크립트로 테이블을 생성해 주세요."})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "수정 실패"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"id": id})
}

// ScheduleJobtypeDefinitionsDelete DELETE /api/schedule-jobtype-definitions/:id
func (h *Handler) ScheduleJobtypeDefinitionsDelete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 ID입니다."})
		return
	}
	res, err := h.db.Pool.Exec(r.Context(), `DELETE FROM schedule_jobtype_definitions WHERE id = $1`, id)
	if err != nil {
		if strings.Contains(err.Error(), "does not exist") {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "작업유형 정의 테이블이 없습니다. 스크립트로 테이블을 생성해 주세요."})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "삭제 중 오류가 발생했습니다."})
		return
	}
	if res.RowsAffected() == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "작업유형 정의를 찾을 수 없습니다."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "삭제되었습니다."})
}

// ScheduleDivisionStructuresList GET /api/schedule-division-structures (?divisionId= & structureTemplateId=)
func (h *Handler) ScheduleDivisionStructuresList(w http.ResponseWriter, r *http.Request) {
	divID := r.URL.Query().Get("divisionId")
	tplID := r.URL.Query().Get("structureTemplateId")
	query := `
		SELECT ds.id, ds."divisionId", ds."structureTemplateId", ds."sortOrder", d.id, d.code, d.name, st.id, st.name, st.category
		FROM schedule_division_structures ds
		LEFT JOIN schedule_divisions d ON d.id = ds."divisionId"
		LEFT JOIN structure_templates st ON st.id = ds."structureTemplateId"
		WHERE ($1::text = '' OR $1 IS NULL OR ds."divisionId"::text = $1) AND ($2::text = '' OR $2 IS NULL OR ds."structureTemplateId"::text = $2)
		ORDER BY ds."sortOrder" ASC, ds.id ASC
	`
	rows, err := h.db.Pool.Query(r.Context(), query, divID, tplID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "구분-장소 매핑 목록을 불러오는 중 오류가 발생했습니다."})
		return
	}
	defer rows.Close()
	var list []map[string]interface{}
	for rows.Next() {
		var id, divId, tplId, sortOrder int
		var dId, dCode, dName interface{}
		var stId, stName interface{}
		var stCat *string
		if err := rows.Scan(&id, &divId, &tplId, &sortOrder, &dId, &dCode, &dName, &stId, &stName, &stCat); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "구분-장소 매핑 목록을 불러오는 중 오류가 발생했습니다."})
			return
		}
		item := map[string]interface{}{"id": id, "divisionId": divId, "structureTemplateId": tplId, "sortOrder": sortOrder}
		if dId != nil {
			item["division"] = map[string]interface{}{"id": divId, "code": dCode, "name": dName}
		}
		if stId != nil {
			item["structureTemplate"] = map[string]interface{}{"id": tplId, "name": stName, "category": stCat}
		}
		list = append(list, item)
	}
	writeJSON(w, http.StatusOK, list)
}

// ScheduleDivisionStructuresCreate POST /api/schedule-division-structures
func (h *Handler) ScheduleDivisionStructuresCreate(w http.ResponseWriter, r *http.Request) {
	var body struct {
		DivisionID         int  `json:"divisionId"`
		StructureTemplateID int  `json:"structureTemplateId"`
		SortOrder          *int `json:"sortOrder"`
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
	err := h.db.Pool.QueryRow(r.Context(), `INSERT INTO schedule_division_structures ("divisionId", "structureTemplateId", "sortOrder", "createdAt", "updatedAt") VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id`, body.DivisionID, body.StructureTemplateID, sortOrder).Scan(&id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "구분-장소 매핑 추가 중 오류가 발생했습니다."})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]interface{}{"id": id, "divisionId": body.DivisionID, "structureTemplateId": body.StructureTemplateID, "sortOrder": sortOrder})
}

// ScheduleDivisionStructuresUpdate PUT /api/schedule-division-structures/:id
func (h *Handler) ScheduleDivisionStructuresUpdate(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 ID입니다."})
		return
	}
	var body struct {
		DivisionID         *int `json:"divisionId"`
		StructureTemplateID *int `json:"structureTemplateId"`
		SortOrder          *int `json:"sortOrder"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	var divId, tplId, sortOrder int
	if err := h.db.Pool.QueryRow(r.Context(), `SELECT "divisionId", "structureTemplateId", "sortOrder" FROM schedule_division_structures WHERE id = $1`, id).Scan(&divId, &tplId, &sortOrder); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "구분-장소 매핑을 찾을 수 없습니다."})
		return
	}
	if body.DivisionID != nil {
		divId = *body.DivisionID
	}
	if body.StructureTemplateID != nil {
		tplId = *body.StructureTemplateID
	}
	if body.SortOrder != nil {
		sortOrder = *body.SortOrder
	}
	_, err = h.db.Pool.Exec(r.Context(), `UPDATE schedule_division_structures SET "divisionId" = $1, "structureTemplateId" = $2, "sortOrder" = $3, "updatedAt" = NOW() WHERE id = $4`, divId, tplId, sortOrder, id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "구분-장소 매핑 수정 중 오류가 발생했습니다."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"id": id, "divisionId": divId, "structureTemplateId": tplId, "sortOrder": sortOrder})
}

// ScheduleDivisionStructuresDelete DELETE /api/schedule-division-structures/:id
func (h *Handler) ScheduleDivisionStructuresDelete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 ID입니다."})
		return
	}
	res, err := h.db.Pool.Exec(r.Context(), `DELETE FROM schedule_division_structures WHERE id = $1`, id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "구분-장소 매핑 삭제 중 오류가 발생했습니다."})
		return
	}
	if res.RowsAffected() == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "구분-장소 매핑을 찾을 수 없습니다."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "삭제되었습니다."})
}
