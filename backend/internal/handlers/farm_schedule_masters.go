package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"pig-farm-api/internal/middleware"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// ---- 농장별 "마스터(정의/목록)" CRUD: Admin schedule_masters_simple.go 를 farm scope로 복제 ----

func (h *Handler) parseFarmIDAndAuth(w http.ResponseWriter, r *http.Request) (uuid.UUID, *middleware.Claims, bool) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "로그인이 필요합니다."})
		return uuid.Nil, nil, false
	}
	farmIDStr := chi.URLParam(r, "farmId")
	farmID, err := uuid.Parse(farmIDStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "farmId가 필요합니다."})
		return uuid.Nil, nil, false
	}
	if !h.canManageFarmSchedule(r.Context(), claims, farmID) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "농장 일정을 관리할 권한이 없습니다."})
		return uuid.Nil, nil, false
	}
	return farmID, claims, true
}

// FarmScheduleSortationsList GET /api/farms/:farmId/schedule-sortations (?structure_template_id=)
func (h *Handler) FarmScheduleSortationsList(w http.ResponseWriter, r *http.Request) {
	farmID, _, ok := h.parseFarmIDAndAuth(w, r)
	if !ok {
		return
	}
	q := `
		SELECT ss.id, ss.structure_template_id, ss.sortations::text, COALESCE(ss.sort_order, 0),
		       sd.name AS sortation_name,
		       (NULLIF(ss.sortations::jsonb->0->>'sortation_definition_id', '')::int) AS sortation_definition_id,
		       ss."farmId"
		FROM schedule_sortations ss
		LEFT JOIN schedule_sortation_definitions sd
		  ON sd.id = (NULLIF(ss.sortations::jsonb->0->>'sortation_definition_id', '')::int)
		WHERE (ss."farmId" IS NULL OR ss."farmId" = $1) AND COALESCE(ss.is_deleted, false) = false
	`
	args := []interface{}{farmID}
	argNum := 2
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
		log.Printf("[farm_schedule_sortations] list failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "목록 조회 실패"})
		return
	}
	defer rows.Close()
	var list []map[string]interface{}
	idxByKey := map[string]int{}
	isFarmByKey := map[string]bool{}
	for rows.Next() {
		var id int
		var structID *int
		var sortations *string
		var sortOrder int
		var sortationName *string
		var sortationDefID *int
		var ownerFarmID *uuid.UUID
		if err := rows.Scan(&id, &structID, &sortations, &sortOrder, &sortationName, &sortationDefID, &ownerFarmID); err != nil {
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
		structKey := "nil"
		if structID != nil {
			structKey = strconv.Itoa(*structID)
		}
		defKey := "nil"
		if sortationDefID != nil {
			defKey = strconv.Itoa(*sortationDefID)
		}
		key := structKey + "|" + defKey
		isFarm := ownerFarmID != nil
		if idx, exists := idxByKey[key]; exists {
			// 같은 논리 항목이면 농장 데이터가 전역보다 우선
			if !isFarmByKey[key] && isFarm {
				list[idx] = item
				isFarmByKey[key] = true
			}
			continue
		}
		idxByKey[key] = len(list)
		isFarmByKey[key] = isFarm
		list = append(list, item)
	}
	writeJSON(w, http.StatusOK, list)
}

// FarmScheduleSortationsCreate POST /api/farms/:farmId/schedule-sortations
func (h *Handler) FarmScheduleSortationsCreate(w http.ResponseWriter, r *http.Request) {
	farmID, _, ok := h.parseFarmIDAndAuth(w, r)
	if !ok {
		return
	}
	var body struct {
		Name                  string      `json:"name"`
		StructureTemplateID   *int        `json:"structure_template_id"`
		SortationDefinitionID *int        `json:"sortation_definition_id"`
		Sortations            interface{} `json:"sortations"`
		SortOrder             *int        `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	if body.StructureTemplateID == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "시설(structure_template_id)이 필요합니다."})
		return
	}
	var sortationsPayload interface{} = body.Sortations
	if body.SortationDefinitionID != nil {
		sortationsPayload = []map[string]interface{}{{"sortation_definition_id": *body.SortationDefinitionID}}
	} else if body.Name != "" && body.Sortations == nil {
		sortationsPayload = []map[string]interface{}{{"name": body.Name}}
	}
	b, _ := json.Marshal(sortationsPayload)
	sortOrder := 0
	if body.SortOrder != nil {
		sortOrder = *body.SortOrder
	}
	var id int
	err := h.db.Pool.QueryRow(r.Context(), `
		INSERT INTO schedule_sortations ("farmId", structure_template_id, sortations, sort_order, is_deleted, "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, false, NOW(), NOW()) RETURNING id
	`, farmID, body.StructureTemplateID, b, sortOrder).Scan(&id)
	if err != nil {
		log.Printf("[farm_schedule_sortations] insert failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "생성 실패"})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]interface{}{"id": id})
}

// FarmScheduleSortationsUpdate PUT /api/farms/:farmId/schedule-sortations/:id
func (h *Handler) FarmScheduleSortationsUpdate(w http.ResponseWriter, r *http.Request) {
	farmID, _, ok := h.parseFarmIDAndAuth(w, r)
	if !ok {
		return
	}
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 ID입니다."})
		return
	}
	var body struct {
		StructureTemplateID *int        `json:"structure_template_id"`
		Sortations          interface{} `json:"sortations"`
		SortOrder           *int        `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	var structID *int
	var sortations *string
	var currentOrder *int
	if err := h.db.Pool.QueryRow(r.Context(), `SELECT structure_template_id, sortations::text, sort_order FROM schedule_sortations WHERE id = $1 AND "farmId" = $2 AND COALESCE(is_deleted, false) = false`, id, farmID).
		Scan(&structID, &sortations, &currentOrder); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "구분을 찾을 수 없습니다."})
		return
	}
	if body.StructureTemplateID != nil {
		structID = body.StructureTemplateID
	}
	var payload []byte
	if body.Sortations != nil {
		payload, _ = json.Marshal(body.Sortations)
	} else {
		payload = []byte("null")
		if sortations != nil {
			payload = []byte(*sortations)
		}
	}
	orderVal := 0
	if currentOrder != nil {
		orderVal = *currentOrder
	}
	if body.SortOrder != nil {
		orderVal = *body.SortOrder
	}
	_, err = h.db.Pool.Exec(r.Context(), `
		UPDATE schedule_sortations
		SET structure_template_id = $1, sortations = $2, sort_order = $3, "updatedAt" = NOW()
		WHERE id = $4 AND "farmId" = $5 AND COALESCE(is_deleted, false) = false
	`, structID, payload, orderVal, id, farmID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "수정 실패"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"id": id})
}

// FarmScheduleSortationsDelete DELETE /api/farms/:farmId/schedule-sortations/:id (하위 작업유형/기준 함께 삭제)
func (h *Handler) FarmScheduleSortationsDelete(w http.ResponseWriter, r *http.Request) {
	farmID, _, ok := h.parseFarmIDAndAuth(w, r)
	if !ok {
		return
	}
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 ID입니다."})
		return
	}
	ctx := r.Context()
	_, _ = h.db.Pool.Exec(ctx, `UPDATE schedule_criterias SET is_deleted = true, "updatedAt" = NOW() WHERE jobtype_id IN (SELECT id FROM schedule_jobtypes WHERE sortation_id = $1 AND "farmId" = $2) AND "farmId" = $2`, id, farmID)
	_, _ = h.db.Pool.Exec(ctx, `UPDATE schedule_jobtypes SET is_deleted = true, "updatedAt" = NOW() WHERE sortation_id = $1 AND "farmId" = $2`, id, farmID)
	res, err := h.db.Pool.Exec(ctx, `UPDATE schedule_sortations SET is_deleted = true, "updatedAt" = NOW() WHERE id = $1 AND "farmId" = $2 AND COALESCE(is_deleted, false) = false`, id, farmID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "구분 삭제 중 오류가 발생했습니다."})
		return
	}
	if res.RowsAffected() == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "해당 항목을 찾을 수 없습니다."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true})
}

// ---- Definitions (구분/작업유형/기준 정의) ----

func (h *Handler) FarmScheduleSortationDefinitionsList(w http.ResponseWriter, r *http.Request) {
	farmID, _, ok := h.parseFarmIDAndAuth(w, r)
	if !ok {
		return
	}
	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT id, name, COALESCE(sort_order, 0), "farmId"
		FROM schedule_sortation_definitions
		WHERE ("farmId" IS NULL OR "farmId" = $1) AND COALESCE(is_deleted, false) = false
		ORDER BY COALESCE(sort_order, 0) ASC, id ASC
	`, farmID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "목록 조회 실패"})
		return
	}
	defer rows.Close()
	var list []map[string]interface{}
	idxByName := map[string]int{}
	isFarmByName := map[string]bool{}
	for rows.Next() {
		var id, sortOrder int
		var name string
		var ownerFarmID *uuid.UUID
		if err := rows.Scan(&id, &name, &sortOrder, &ownerFarmID); err != nil {
			continue
		}
		item := map[string]interface{}{"id": id, "name": name, "sort_order": sortOrder}
		isFarm := ownerFarmID != nil
		if idx, exists := idxByName[name]; exists {
			if !isFarmByName[name] && isFarm {
				list[idx] = item
				isFarmByName[name] = true
			}
			continue
		}
		idxByName[name] = len(list)
		isFarmByName[name] = isFarm
		list = append(list, item)
	}
	writeJSON(w, http.StatusOK, list)
}

func (h *Handler) FarmScheduleSortationDefinitionsCreate(w http.ResponseWriter, r *http.Request) {
	farmID, _, ok := h.parseFarmIDAndAuth(w, r)
	if !ok {
		return
	}
	var body struct {
		Name      string `json:"name"`
		SortOrder *int   `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name이 필요합니다."})
		return
	}
	sortOrder := 0
	if body.SortOrder != nil {
		sortOrder = *body.SortOrder
	}
	var id int
	err := h.db.Pool.QueryRow(r.Context(), `
		INSERT INTO schedule_sortation_definitions ("farmId", name, sort_order, is_deleted, "createdAt", "updatedAt")
		VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id
	`, farmID, body.Name, sortOrder).Scan(&id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "생성 실패"})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]interface{}{"id": id})
}

func (h *Handler) FarmScheduleSortationDefinitionsUpdate(w http.ResponseWriter, r *http.Request) {
	farmID, _, ok := h.parseFarmIDAndAuth(w, r)
	if !ok {
		return
	}
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 ID입니다."})
		return
	}
	var body struct {
		Name      *string `json:"name"`
		SortOrder *int    `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	_, err = h.db.Pool.Exec(r.Context(), `
		UPDATE schedule_sortation_definitions
		SET name = COALESCE($1, name), sort_order = COALESCE($2, sort_order), "updatedAt" = NOW()
		WHERE id = $3 AND "farmId" = $4 AND COALESCE(is_deleted, false) = false
	`, body.Name, body.SortOrder, id, farmID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "수정 실패"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"id": id})
}

func (h *Handler) FarmScheduleSortationDefinitionsDelete(w http.ResponseWriter, r *http.Request) {
	farmID, _, ok := h.parseFarmIDAndAuth(w, r)
	if !ok {
		return
	}
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 ID입니다."})
		return
	}
	var owner *uuid.UUID
	_ = h.db.Pool.QueryRow(r.Context(), `SELECT "farmId" FROM schedule_sortation_definitions WHERE id = $1`, id).Scan(&owner)
	if owner == nil {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "전역 데이터는 농장에서 삭제할 수 없습니다."})
		return
	}
	res, err := h.db.Pool.Exec(r.Context(), `UPDATE schedule_sortation_definitions SET is_deleted = true, "updatedAt" = NOW() WHERE id = $1 AND "farmId" = $2 AND COALESCE(is_deleted, false) = false`, id, farmID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "삭제 실패"})
		return
	}
	if res.RowsAffected() == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "해당 항목을 찾을 수 없습니다."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true})
}

// ---- Jobtype definitions / list ----

func (h *Handler) FarmScheduleJobtypeDefinitionsList(w http.ResponseWriter, r *http.Request) {
	farmID, _, ok := h.parseFarmIDAndAuth(w, r)
	if !ok {
		return
	}
	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT id, name, COALESCE(sort_order, 0), "farmId"
		FROM schedule_jobtype_definitions
		WHERE ("farmId" IS NULL OR "farmId" = $1) AND COALESCE(is_deleted, false) = false
		ORDER BY COALESCE(sort_order, 0) ASC, id ASC
	`, farmID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "목록 조회 실패"})
		return
	}
	defer rows.Close()
	var list []map[string]interface{}
	idxByName := map[string]int{}
	isFarmByName := map[string]bool{}
	for rows.Next() {
		var id, sortOrder int
		var name string
		var ownerFarmID *uuid.UUID
		if err := rows.Scan(&id, &name, &sortOrder, &ownerFarmID); err != nil {
			continue
		}
		item := map[string]interface{}{"id": id, "name": name, "sort_order": sortOrder}
		isFarm := ownerFarmID != nil
		if idx, exists := idxByName[name]; exists {
			if !isFarmByName[name] && isFarm {
				list[idx] = item
				isFarmByName[name] = true
			}
			continue
		}
		idxByName[name] = len(list)
		isFarmByName[name] = isFarm
		list = append(list, item)
	}
	writeJSON(w, http.StatusOK, list)
}

func (h *Handler) FarmScheduleJobtypeDefinitionsCreate(w http.ResponseWriter, r *http.Request) {
	farmID, _, ok := h.parseFarmIDAndAuth(w, r)
	if !ok {
		return
	}
	var body struct {
		Name      string `json:"name"`
		SortOrder *int   `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name이 필요합니다."})
		return
	}
	sortOrder := 0
	if body.SortOrder != nil {
		sortOrder = *body.SortOrder
	}
	var id int
	err := h.db.Pool.QueryRow(r.Context(), `
		INSERT INTO schedule_jobtype_definitions ("farmId", name, sort_order, is_deleted, "createdAt", "updatedAt")
		VALUES ($1, $2, $3, false, NOW(), NOW()) RETURNING id
	`, farmID, body.Name, sortOrder).Scan(&id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "생성 실패"})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]interface{}{"id": id})
}

func (h *Handler) FarmScheduleJobtypeDefinitionsUpdate(w http.ResponseWriter, r *http.Request) {
	farmID, _, ok := h.parseFarmIDAndAuth(w, r)
	if !ok {
		return
	}
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 ID입니다."})
		return
	}
	var body struct {
		Name      *string `json:"name"`
		SortOrder *int    `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	_, err = h.db.Pool.Exec(r.Context(), `
		UPDATE schedule_jobtype_definitions
		SET name = COALESCE($1, name), sort_order = COALESCE($2, sort_order), "updatedAt" = NOW()
		WHERE id = $3 AND "farmId" = $4 AND COALESCE(is_deleted, false) = false
	`, body.Name, body.SortOrder, id, farmID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "수정 실패"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"id": id})
}

func (h *Handler) FarmScheduleJobtypeDefinitionsDelete(w http.ResponseWriter, r *http.Request) {
	farmID, _, ok := h.parseFarmIDAndAuth(w, r)
	if !ok {
		return
	}
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 ID입니다."})
		return
	}
	var owner2 *uuid.UUID
	_ = h.db.Pool.QueryRow(r.Context(), `SELECT "farmId" FROM schedule_jobtype_definitions WHERE id = $1`, id).Scan(&owner2)
	if owner2 == nil {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "전역 데이터는 농장에서 삭제할 수 없습니다."})
		return
	}
	res, err := h.db.Pool.Exec(r.Context(), `UPDATE schedule_jobtype_definitions SET is_deleted = true, "updatedAt" = NOW() WHERE id = $1 AND "farmId" = $2 AND COALESCE(is_deleted, false) = false`, id, farmID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "삭제 실패"})
		return
	}
	if res.RowsAffected() == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "해당 항목을 찾을 수 없습니다."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true})
}

// FarmScheduleJobtypesList GET /api/farms/:farmId/schedule-jobtypes
func (h *Handler) FarmScheduleJobtypesList(w http.ResponseWriter, r *http.Request) {
	farmID, _, ok := h.parseFarmIDAndAuth(w, r)
	if !ok {
		return
	}
	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT sj.id, sj.sortation_id, sj.jobtypes::text, COALESCE(sj.sort_order, 0),
		       jd.name AS jobtype_name,
		       (NULLIF(sj.jobtypes::jsonb->0->>'jobtype_definition_id', '')::int) AS jobtype_definition_id,
		       sj."farmId"
		FROM schedule_jobtypes sj
		LEFT JOIN schedule_jobtype_definitions jd
		  ON jd.id = (NULLIF(sj.jobtypes::jsonb->0->>'jobtype_definition_id', '')::int)
		WHERE (sj."farmId" IS NULL OR sj."farmId" = $1) AND COALESCE(sj.is_deleted, false) = false
		ORDER BY COALESCE(sj.sort_order, 0) ASC, sj.id ASC
	`, farmID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "목록 조회 실패"})
		return
	}
	defer rows.Close()
	var list []map[string]interface{}
	idxByKey := map[string]int{}
	isFarmByKey := map[string]bool{}
	for rows.Next() {
		var id int
		var sortationID *int
		var jobtypes *string
		var sortOrder int
		var jobtypeName *string
		var jobtypeDefID *int
		var ownerFarmID *uuid.UUID
		if err := rows.Scan(&id, &sortationID, &jobtypes, &sortOrder, &jobtypeName, &jobtypeDefID, &ownerFarmID); err != nil {
			continue
		}
		item := map[string]interface{}{"id": id, "sortation_id": sortationID, "jobtypes": ParseJSONBFromText(jobtypes), "sort_order": sortOrder}
		if jobtypeName != nil {
			item["jobtype_name"] = *jobtypeName
		}
		if jobtypeDefID != nil {
			item["jobtype_definition_id"] = *jobtypeDefID
		}
		sortKey := "nil"
		if sortationID != nil {
			sortKey = strconv.Itoa(*sortationID)
		}
		defKey := "nil"
		if jobtypeDefID != nil {
			defKey = strconv.Itoa(*jobtypeDefID)
		}
		key := sortKey + "|" + defKey
		isFarm := ownerFarmID != nil
		if idx, exists := idxByKey[key]; exists {
			if !isFarmByKey[key] && isFarm {
				list[idx] = item
				isFarmByKey[key] = true
			}
			continue
		}
		idxByKey[key] = len(list)
		isFarmByKey[key] = isFarm
		list = append(list, item)
	}
	writeJSON(w, http.StatusOK, list)
}

func (h *Handler) FarmScheduleJobtypesCreate(w http.ResponseWriter, r *http.Request) {
	farmID, _, ok := h.parseFarmIDAndAuth(w, r)
	if !ok {
		return
	}
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
	var payload interface{} = body.Jobtypes
	if body.JobtypeDefinitionID != nil {
		payload = []map[string]interface{}{{"jobtype_definition_id": *body.JobtypeDefinitionID}}
	} else if body.Name != "" && body.Jobtypes == nil {
		payload = []map[string]interface{}{{"name": body.Name}}
	}
	b, _ := json.Marshal(payload)
	sortOrder := 0
	if body.SortOrder != nil {
		sortOrder = *body.SortOrder
	}
	var id int
	err := h.db.Pool.QueryRow(r.Context(), `
		INSERT INTO schedule_jobtypes ("farmId", sortation_id, jobtypes, sort_order, is_deleted, "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, false, NOW(), NOW()) RETURNING id
	`, farmID, body.SortationID, b, sortOrder).Scan(&id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "생성 실패"})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]interface{}{"id": id})
}

func (h *Handler) FarmScheduleJobtypesUpdate(w http.ResponseWriter, r *http.Request) {
	farmID, _, ok := h.parseFarmIDAndAuth(w, r)
	if !ok {
		return
	}
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
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
	if err := h.db.Pool.QueryRow(r.Context(), `SELECT sortation_id, jobtypes::text, sort_order FROM schedule_jobtypes WHERE id = $1 AND "farmId" = $2 AND COALESCE(is_deleted, false) = false`, id, farmID).
		Scan(&sortationID, &jobtypes, &currentOrder); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "작업유형을 찾을 수 없습니다."})
		return
	}
	if body.SortationID != nil {
		sortationID = body.SortationID
	}
	var payload []byte
	if body.Jobtypes != nil {
		payload, _ = json.Marshal(body.Jobtypes)
	} else {
		payload = []byte("null")
		if jobtypes != nil {
			payload = []byte(*jobtypes)
		}
	}
	orderVal := 0
	if currentOrder != nil {
		orderVal = *currentOrder
	}
	if body.SortOrder != nil {
		orderVal = *body.SortOrder
	}
	_, err = h.db.Pool.Exec(r.Context(), `
		UPDATE schedule_jobtypes
		SET sortation_id = $1, jobtypes = $2, sort_order = $3, "updatedAt" = NOW()
		WHERE id = $4 AND "farmId" = $5 AND COALESCE(is_deleted, false) = false
	`, sortationID, payload, orderVal, id, farmID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "수정 실패"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"id": id})
}

// FarmScheduleJobtypesDelete DELETE /api/farms/:farmId/schedule-jobtypes/:id (하위 기준 함께 삭제)
func (h *Handler) FarmScheduleJobtypesDelete(w http.ResponseWriter, r *http.Request) {
	farmID, _, ok := h.parseFarmIDAndAuth(w, r)
	if !ok {
		return
	}
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 ID입니다."})
		return
	}
	ctx := r.Context()
	_, _ = h.db.Pool.Exec(ctx, `UPDATE schedule_criterias SET is_deleted = true, "updatedAt" = NOW() WHERE jobtype_id = $1 AND "farmId" = $2`, id, farmID)
	res, err := h.db.Pool.Exec(ctx, `UPDATE schedule_jobtypes SET is_deleted = true, "updatedAt" = NOW() WHERE id = $1 AND "farmId" = $2 AND COALESCE(is_deleted, false) = false`, id, farmID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "작업유형 삭제 중 오류가 발생했습니다."})
		return
	}
	if res.RowsAffected() == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "해당 항목을 찾을 수 없습니다."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true})
}

// ---- Criteria definitions / list ----

func (h *Handler) FarmScheduleCriteriaDefinitionsList(w http.ResponseWriter, r *http.Request) {
	farmID, _, ok := h.parseFarmIDAndAuth(w, r)
	if !ok {
		return
	}
	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT id, name, content_type, COALESCE(sort_order, 0), "farmId"
		FROM schedule_criteria_definitions
		WHERE ("farmId" IS NULL OR "farmId" = $1) AND COALESCE(is_deleted, false) = false
		ORDER BY COALESCE(sort_order, 0) ASC, id ASC
	`, farmID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "목록 조회 실패"})
		return
	}
	defer rows.Close()
	var list []map[string]interface{}
	idxByKey := map[string]int{}
	isFarmByKey := map[string]bool{}
	for rows.Next() {
		var id, sortOrder int
		var name, contentType string
		var ownerFarmID *uuid.UUID
		if err := rows.Scan(&id, &name, &contentType, &sortOrder, &ownerFarmID); err != nil {
			continue
		}
		item := map[string]interface{}{"id": id, "name": name, "content_type": contentType, "sort_order": sortOrder}
		key := name + "|" + contentType
		isFarm := ownerFarmID != nil
		if idx, exists := idxByKey[key]; exists {
			if !isFarmByKey[key] && isFarm {
				list[idx] = item
				isFarmByKey[key] = true
			}
			continue
		}
		idxByKey[key] = len(list)
		isFarmByKey[key] = isFarm
		list = append(list, item)
	}
	writeJSON(w, http.StatusOK, list)
}

func (h *Handler) FarmScheduleCriteriaDefinitionsCreate(w http.ResponseWriter, r *http.Request) {
	farmID, _, ok := h.parseFarmIDAndAuth(w, r)
	if !ok {
		return
	}
	var body struct {
		Name        string `json:"name"`
		ContentType string `json:"content_type"`
		SortOrder   *int   `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Name == "" || body.ContentType == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name, content_type이 필요합니다."})
		return
	}
	sortOrder := 0
	if body.SortOrder != nil {
		sortOrder = *body.SortOrder
	}
	var id int
	err := h.db.Pool.QueryRow(r.Context(), `
		INSERT INTO schedule_criteria_definitions ("farmId", name, content_type, sort_order, is_deleted, "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, false, NOW(), NOW()) RETURNING id
	`, farmID, body.Name, body.ContentType, sortOrder).Scan(&id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "생성 실패"})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]interface{}{"id": id})
}

func (h *Handler) FarmScheduleCriteriaDefinitionsUpdate(w http.ResponseWriter, r *http.Request) {
	farmID, _, ok := h.parseFarmIDAndAuth(w, r)
	if !ok {
		return
	}
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 ID입니다."})
		return
	}
	var body struct {
		Name        *string `json:"name"`
		ContentType *string `json:"content_type"`
		SortOrder   *int    `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	_, err = h.db.Pool.Exec(r.Context(), `
		UPDATE schedule_criteria_definitions
		SET name = COALESCE($1, name),
		    content_type = COALESCE($2, content_type),
		    sort_order = COALESCE($3, sort_order),
		    "updatedAt" = NOW()
		WHERE id = $4 AND "farmId" = $5 AND COALESCE(is_deleted, false) = false
	`, body.Name, body.ContentType, body.SortOrder, id, farmID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "수정 실패"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"id": id})
}

func (h *Handler) FarmScheduleCriteriaDefinitionsDelete(w http.ResponseWriter, r *http.Request) {
	farmID, _, ok := h.parseFarmIDAndAuth(w, r)
	if !ok {
		return
	}
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 ID입니다."})
		return
	}
	var owner3 *uuid.UUID
	_ = h.db.Pool.QueryRow(r.Context(), `SELECT "farmId" FROM schedule_criteria_definitions WHERE id = $1`, id).Scan(&owner3)
	if owner3 == nil {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "전역 데이터는 농장에서 삭제할 수 없습니다."})
		return
	}
	res, err := h.db.Pool.Exec(r.Context(), `UPDATE schedule_criteria_definitions SET is_deleted = true, "updatedAt" = NOW() WHERE id = $1 AND "farmId" = $2 AND COALESCE(is_deleted, false) = false`, id, farmID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "삭제 실패"})
		return
	}
	if res.RowsAffected() == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "해당 항목을 찾을 수 없습니다."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true})
}

// FarmScheduleCriteriasList GET /api/farms/:farmId/schedule-criterias
func (h *Handler) FarmScheduleCriteriasList(w http.ResponseWriter, r *http.Request) {
	farmID, _, ok := h.parseFarmIDAndAuth(w, r)
	if !ok {
		return
	}
	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT sc.id, sc.jobtype_id, sc.criterias::text, COALESCE(sc.sort_order, 0),
		       d.name AS criteria_name, d.content_type AS content_type,
		       (NULLIF(sc.criterias::jsonb->0->>'criteria_definition_id', '')::int) AS criteria_definition_id,
		       sc."farmId"
		FROM schedule_criterias sc
		LEFT JOIN schedule_criteria_definitions d
		  ON d.id = (NULLIF(sc.criterias::jsonb->0->>'criteria_definition_id', '')::int)
		WHERE (sc."farmId" IS NULL OR sc."farmId" = $1) AND COALESCE(sc.is_deleted, false) = false
		ORDER BY COALESCE(sc.sort_order, 0) ASC, sc.id ASC
	`, farmID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "목록 조회 실패"})
		return
	}
	defer rows.Close()
	var list []map[string]interface{}
	idxByKey := map[string]int{}
	isFarmByKey := map[string]bool{}
	for rows.Next() {
		var id int
		var jobtypeID *int
		var criterias *string
		var sortOrder int
		var criteriaName, contentType *string
		var criteriaDefID *int
		var ownerFarmID *uuid.UUID
		if err := rows.Scan(&id, &jobtypeID, &criterias, &sortOrder, &criteriaName, &contentType, &criteriaDefID, &ownerFarmID); err != nil {
			continue
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
		jobKey := "nil"
		if jobtypeID != nil {
			jobKey = strconv.Itoa(*jobtypeID)
		}
		defKey := "nil"
		if criteriaDefID != nil {
			defKey = strconv.Itoa(*criteriaDefID)
		}
		key := jobKey + "|" + defKey
		isFarm := ownerFarmID != nil
		if idx, exists := idxByKey[key]; exists {
			if !isFarmByKey[key] && isFarm {
				list[idx] = item
				isFarmByKey[key] = true
			}
			continue
		}
		idxByKey[key] = len(list)
		isFarmByKey[key] = isFarm
		list = append(list, item)
	}
	writeJSON(w, http.StatusOK, list)
}

func (h *Handler) FarmScheduleCriteriasCreate(w http.ResponseWriter, r *http.Request) {
	farmID, _, ok := h.parseFarmIDAndAuth(w, r)
	if !ok {
		return
	}
	var body struct {
		Name                string      `json:"name"`
		JobtypeID            *int        `json:"jobtype_id"`
		CriteriaDefinitionID *int        `json:"criteria_definition_id"`
		Criterias            interface{} `json:"criterias"`
		SortOrder            *int        `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	if body.JobtypeID == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "작업유형(jobtype_id)이 필요합니다."})
		return
	}
	var payload interface{} = body.Criterias
	if body.CriteriaDefinitionID != nil {
		payload = []map[string]interface{}{{"criteria_definition_id": *body.CriteriaDefinitionID}}
	} else if body.Name != "" && body.Criterias == nil {
		payload = []map[string]interface{}{{"name": body.Name}}
	}
	b, _ := json.Marshal(payload)
	sortOrder := 0
	if body.SortOrder != nil {
		sortOrder = *body.SortOrder
	}
	var id int
	err := h.db.Pool.QueryRow(r.Context(), `
		INSERT INTO schedule_criterias ("farmId", jobtype_id, criterias, sort_order, is_deleted, "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, false, NOW(), NOW()) RETURNING id
	`, farmID, body.JobtypeID, b, sortOrder).Scan(&id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "생성 실패"})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]interface{}{"id": id})
}

func (h *Handler) FarmScheduleCriteriasUpdate(w http.ResponseWriter, r *http.Request) {
	farmID, _, ok := h.parseFarmIDAndAuth(w, r)
	if !ok {
		return
	}
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 ID입니다."})
		return
	}
	var body struct {
		JobtypeID *int        `json:"jobtype_id"`
		Criterias interface{} `json:"criterias"`
		SortOrder *int        `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	var jobtypeID *int
	var criterias *string
	var currentOrder *int
	if err := h.db.Pool.QueryRow(r.Context(), `SELECT jobtype_id, criterias::text, sort_order FROM schedule_criterias WHERE id = $1 AND "farmId" = $2 AND COALESCE(is_deleted, false) = false`, id, farmID).
		Scan(&jobtypeID, &criterias, &currentOrder); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "기준을 찾을 수 없습니다."})
		return
	}
	if body.JobtypeID != nil {
		jobtypeID = body.JobtypeID
	}
	var payload []byte
	if body.Criterias != nil {
		payload, _ = json.Marshal(body.Criterias)
	} else {
		payload = []byte("null")
		if criterias != nil {
			payload = []byte(*criterias)
		}
	}
	orderVal := 0
	if currentOrder != nil {
		orderVal = *currentOrder
	}
	if body.SortOrder != nil {
		orderVal = *body.SortOrder
	}
	_, err = h.db.Pool.Exec(r.Context(), `
		UPDATE schedule_criterias
		SET jobtype_id = $1, criterias = $2, sort_order = $3, "updatedAt" = NOW()
		WHERE id = $4 AND "farmId" = $5 AND COALESCE(is_deleted, false) = false
	`, jobtypeID, payload, orderVal, id, farmID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "수정 실패"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"id": id})
}

func (h *Handler) FarmScheduleCriteriasDelete(w http.ResponseWriter, r *http.Request) {
	farmID, _, ok := h.parseFarmIDAndAuth(w, r)
	if !ok {
		return
	}
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 ID입니다."})
		return
	}
	res, err := h.db.Pool.Exec(r.Context(), `UPDATE schedule_criterias SET is_deleted = true, "updatedAt" = NOW() WHERE id = $1 AND "farmId" = $2 AND COALESCE(is_deleted, false) = false`, id, farmID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "기준 삭제 중 오류가 발생했습니다."})
		return
	}
	if res.RowsAffected() == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "해당 항목을 찾을 수 없습니다."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true})
}

