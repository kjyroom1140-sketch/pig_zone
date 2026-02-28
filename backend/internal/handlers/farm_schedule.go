package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"pig-farm-api/internal/middleware"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// canManageFarmSchedule: same as farm structure (farm_admin or manager).
func (h *Handler) canManageFarmSchedule(ctx context.Context, claims *middleware.Claims, farmID uuid.UUID) bool {
	return h.canManageFarmStructure(ctx, claims, farmID)
}

// FarmScheduleTaskTypesList GET /api/farms/:farmId/schedule-task-types
func (h *Handler) FarmScheduleTaskTypesList(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "로그인이 필요합니다."})
		return
	}
	farmIDStr := chi.URLParam(r, "farmId")
	farmID, err := uuid.Parse(farmIDStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "farmId가 필요합니다."})
		return
	}
	if !h.canManageFarmSchedule(r.Context(), claims, farmID) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "농장 일정을 관리할 권한이 없습니다."})
		return
	}
	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT id, "originalId", code, name, category, "sortOrder", "appliesToAllStructures"
		FROM farm_schedule_task_types WHERE "farmId" = $1 ORDER BY "sortOrder" ASC, id ASC
	`, farmID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "작업 유형 목록을 불러오는 중 오류가 발생했습니다."})
		return
	}
	defer rows.Close()
	var list []map[string]interface{}
	for rows.Next() {
		var id, sortOrder int
		var originalId *int
		var code, name, category *string
		var applies bool
		if err := rows.Scan(&id, &originalId, &code, &name, &category, &sortOrder, &applies); err != nil {
			continue
		}
		n := ""
		if name != nil {
			n = *name
		}
		list = append(list, map[string]interface{}{
			"id": id, "originalId": originalId, "code": code, "name": n, "category": category,
			"sortOrder": sortOrder, "appliesToAllStructures": applies,
		})
	}
	writeJSON(w, http.StatusOK, list)
}

// FarmScheduleBasisTypesList GET /api/farms/:farmId/schedule-basis-types
func (h *Handler) FarmScheduleBasisTypesList(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "로그인이 필요합니다."})
		return
	}
	farmIDStr := chi.URLParam(r, "farmId")
	farmID, err := uuid.Parse(farmIDStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "farmId가 필요합니다."})
		return
	}
	if !h.canManageFarmSchedule(r.Context(), claims, farmID) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "농장 일정을 관리할 권한이 없습니다."})
		return
	}
	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT id, "originalId", code, name, "targetType", description, "sortOrder"
		FROM farm_schedule_basis_types WHERE "farmId" = $1 ORDER BY "sortOrder" ASC, id ASC
	`, farmID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "기준 유형 목록을 불러오는 중 오류가 발생했습니다."})
		return
	}
	defer rows.Close()
	var list []map[string]interface{}
	for rows.Next() {
		var id, sortOrder int
		var originalId *int
		var code, name, targetType, desc *string
		if err := rows.Scan(&id, &originalId, &code, &name, &targetType, &desc, &sortOrder); err != nil {
			continue
		}
		n := ""
		if name != nil {
			n = *name
		}
		list = append(list, map[string]interface{}{
			"id": id, "originalId": originalId, "code": code, "name": n, "targetType": targetType,
			"description": desc, "sortOrder": sortOrder,
		})
	}
	writeJSON(w, http.StatusOK, list)
}

// FarmScheduleItemsList GET /api/farms/:farmId/schedule-items
func (h *Handler) FarmScheduleItemsList(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "로그인이 필요합니다."})
		return
	}
	farmIDStr := chi.URLParam(r, "farmId")
	farmID, err := uuid.Parse(farmIDStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "farmId가 필요합니다."})
		return
	}
	if !h.canManageFarmSchedule(r.Context(), claims, farmID) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "농장 일정을 관리할 권한이 없습니다."})
		return
	}
	targetType := r.URL.Query().Get("targetType")
	structureTemplateId := r.URL.Query().Get("structureTemplateId")
	taskTypeId := r.URL.Query().Get("taskTypeId")
	basisTypeId := r.URL.Query().Get("basisTypeId")
	query := `
		SELECT i.id, i."farmId", i."targetType", i."structureTemplateId", i."basisTypeId", i."ageLabel",
		       i."dayMin", i."dayMax", i."taskTypeId", i."sortOrder", i."isActive",
		       i."recurrenceType", i."recurrenceInterval", i."recurrenceWeekdays", i."recurrenceMonthDay",
		       st.id, st.name, st.category,
		       t.id, t.code, t.name, t.category,
		       b.id, b.code, b.name, b."targetType"
		FROM farm_schedule_items i
		LEFT JOIN structure_templates st ON st.id = i."structureTemplateId"
		LEFT JOIN farm_schedule_task_types t ON t.id = i."taskTypeId"
		LEFT JOIN farm_schedule_basis_types b ON b.id = i."basisTypeId"
		WHERE i."farmId" = $1
	`
	args := []interface{}{farmID}
	pos := 2
	if targetType != "" {
		query += ` AND i."targetType" = $` + strconv.Itoa(pos)
		args = append(args, targetType)
		pos++
	}
	if structureTemplateId != "" {
		query += ` AND i."structureTemplateId"::text = $` + strconv.Itoa(pos)
		args = append(args, structureTemplateId)
		pos++
	}
	if taskTypeId != "" {
		query += ` AND i."taskTypeId"::text = $` + strconv.Itoa(pos)
		args = append(args, taskTypeId)
		pos++
	}
	if basisTypeId != "" {
		query += ` AND i."basisTypeId"::text = $` + strconv.Itoa(pos)
		args = append(args, basisTypeId)
		pos++
	}
	query += ` ORDER BY i."sortOrder" ASC, i.id ASC`
	rows, err := h.db.Pool.Query(r.Context(), query, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "농장 일정 목록을 불러오는 중 오류가 발생했습니다."})
		return
	}
	defer rows.Close()
	var list []map[string]interface{}
	for rows.Next() {
		var id, taskTypeId, sortOrder int
		var farmId uuid.UUID
		var targetTypeVal string
		var structTplId, basisTypeIdVal *int
		var ageLabel *string
		var dayMin, dayMax *int
		var isActive bool
		var recurType, recurInterval, recurWeekdays *string
		var recurMonthDay *int
		var stId interface{}
		var stName, stCat *string
		var tId interface{}
		var tCode, tName, tCat *string
		var bId interface{}
		var bCode, bName *string
		var bTargetType *string
		if err := rows.Scan(&id, &farmId, &targetTypeVal, &structTplId, &basisTypeIdVal, &ageLabel, &dayMin, &dayMax, &taskTypeId, &sortOrder, &isActive,
			&recurType, &recurInterval, &recurWeekdays, &recurMonthDay,
			&stId, &stName, &stCat, &tId, &tCode, &tName, &tCat, &bId, &bCode, &bName, &bTargetType); err != nil {
			continue
		}
		item := map[string]interface{}{
			"id": id, "farmId": farmId.String(), "targetType": targetTypeVal, "structureTemplateId": structTplId,
			"basisTypeId": basisTypeIdVal, "ageLabel": ageLabel, "dayMin": dayMin, "dayMax": dayMax,
			"taskTypeId": taskTypeId, "sortOrder": sortOrder, "isActive": isActive,
			"recurrenceType": recurType, "recurrenceInterval": recurInterval, "recurrenceWeekdays": recurWeekdays, "recurrenceMonthDay": recurMonthDay,
		}
		if stName != nil {
			item["structureTemplate"] = map[string]interface{}{"id": stId, "name": *stName, "category": stCat}
		}
		if tName != nil {
			item["taskType"] = map[string]interface{}{"id": tId, "code": tCode, "name": *tName, "category": tCat}
		}
		if bName != nil {
			item["basisTypeRef"] = map[string]interface{}{"id": bId, "code": bCode, "name": *bName, "targetType": bTargetType}
		}
		list = append(list, item)
	}
	writeJSON(w, http.StatusOK, list)
}

// FarmScheduleWorkPlansList GET /api/farms/:farmId/schedule-work-plans?from=&to=
func (h *Handler) FarmScheduleWorkPlansList(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "로그인이 필요합니다."})
		return
	}
	farmIDStr := chi.URLParam(r, "farmId")
	farmID, err := uuid.Parse(farmIDStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "farmId가 필요합니다."})
		return
	}
	if !h.canManageFarmSchedule(r.Context(), claims, farmID) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "농장 일정을 관리할 권한이 없습니다."})
		return
	}
	from := r.URL.Query().Get("from")
	to := r.URL.Query().Get("to")
	query := `
		SELECT p.id, p."farmId", p."farmScheduleItemId", p."taskTypeCategory", p."roomId", p."sectionId",
		       p."plannedStartDate", p."plannedEndDate", p."entrySource", p."entryCount", p."completedDate",
		       i.id, t.id, t.code, t.name, t.category
		FROM farm_schedule_work_plans p
		LEFT JOIN farm_schedule_items i ON i.id = p."farmScheduleItemId"
		LEFT JOIN farm_schedule_task_types t ON t.id = i."taskTypeId"
		WHERE p."farmId" = $1
	`
	args := []interface{}{farmID}
	pos := 2
	if from != "" && to != "" {
		query += ` AND p."plannedStartDate" <= $` + strconv.Itoa(pos) + ` AND p."plannedEndDate" >= $` + strconv.Itoa(pos+1)
		args = append(args, to, from)
		pos += 2
	}
	query += ` ORDER BY p."plannedStartDate" ASC, p.id ASC`
	rows, err := h.db.Pool.Query(r.Context(), query, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "작업 계획 목록을 불러오는 중 오류가 발생했습니다."})
		return
	}
	defer rows.Close()
	var list []map[string]interface{}
	for rows.Next() {
		var id, farmScheduleItemId int
		var taskTypeCategory *string
		var roomId, sectionId *uuid.UUID
		var plannedStart, plannedEnd string
		var entrySource *string
		var entryCount *int
		var completedDate *string
		var itemId interface{}
		var tId interface{}
		var tCode, tName, tCat *string
		var fID uuid.UUID
		if err := rows.Scan(&id, &fID, &farmScheduleItemId, &taskTypeCategory, &roomId, &sectionId,
			&plannedStart, &plannedEnd, &entrySource, &entryCount, &completedDate,
			&itemId, &tId, &tCode, &tName, &tCat); err != nil {
			continue
		}
		plan := map[string]interface{}{
			"id": id, "farmId": fID.String(), "farmScheduleItemId": farmScheduleItemId,
			"taskTypeCategory": taskTypeCategory, "roomId": roomId, "sectionId": sectionId,
			"plannedStartDate": plannedStart, "plannedEndDate": plannedEnd,
			"entrySource": entrySource, "entryCount": entryCount, "completedDate": completedDate,
		}
		if tName != nil {
			plan["scheduleItem"] = map[string]interface{}{
				"id": itemId,
				"taskType": map[string]interface{}{"id": tId, "code": tCode, "name": *tName, "category": tCat},
			}
		}
		list = append(list, plan)
	}
	writeJSON(w, http.StatusOK, list)
}

// FarmScheduleWorkPlansCreate POST /api/farms/:farmId/schedule-work-plans
func (h *Handler) FarmScheduleWorkPlansCreate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "로그인이 필요합니다."})
		return
	}
	farmIDStr := chi.URLParam(r, "farmId")
	farmID, err := uuid.Parse(farmIDStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "farmId가 필요합니다."})
		return
	}
	if !h.canManageFarmSchedule(r.Context(), claims, farmID) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "농장 일정을 관리할 권한이 없습니다."})
		return
	}
	var body struct {
		FarmScheduleItemID *int    `json:"farmScheduleItemId"`
		PlannedStartDate   string  `json:"plannedStartDate"`
		PlannedEndDate     string  `json:"plannedEndDate"`
		RoomID             *string `json:"roomId"`
		SectionID          *string `json:"sectionId"`
		EntrySource        *string `json:"entrySource"`
		EntryCount         *int    `json:"entryCount"`
		CompletedDate     *string `json:"completedDate"`
		PlannedDate        *string `json:"plannedDate"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	plannedStart := body.PlannedStartDate
	if plannedStart == "" && body.PlannedDate != nil {
		plannedStart = *body.PlannedDate
	}
	if plannedStart == "" && body.CompletedDate != nil {
		plannedStart = *body.CompletedDate
	}
	if plannedStart == "" {
		plannedStart = time.Now().Format("2006-01-02")
	}
	plannedEnd := body.PlannedEndDate
	if plannedEnd == "" {
		plannedEnd = plannedStart
	}
	var itemID int
	if body.FarmScheduleItemID != nil {
		itemID = *body.FarmScheduleItemID
	} else {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "일정 항목(farmScheduleItemId)이 필요합니다."})
		return
	}
	var taskTypeCategory *string
	_ = h.db.Pool.QueryRow(r.Context(), `SELECT t.category FROM farm_schedule_items i JOIN farm_schedule_task_types t ON t.id = i."taskTypeId" WHERE i.id = $1 AND i."farmId" = $2`, itemID, farmID).Scan(&taskTypeCategory)
	var roomID, sectionID interface{}
	if body.RoomID != nil && *body.RoomID != "" {
		roomID, _ = uuid.Parse(*body.RoomID)
	}
	if body.SectionID != nil && *body.SectionID != "" {
		sectionID, _ = uuid.Parse(*body.SectionID)
	}
	var newID int
	err = h.db.Pool.QueryRow(r.Context(), `
		INSERT INTO farm_schedule_work_plans ("farmId", "farmScheduleItemId", "taskTypeCategory", "roomId", "sectionId", "plannedStartDate", "plannedEndDate", "entrySource", "entryCount", "completedDate", "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()) RETURNING id
	`, farmID, itemID, taskTypeCategory, roomID, sectionID, plannedStart, plannedEnd, body.EntrySource, body.EntryCount, body.CompletedDate).Scan(&newID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "작업 계획 추가 중 오류가 발생했습니다."})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]interface{}{"id": newID, "farmScheduleItemId": itemID, "plannedStartDate": plannedStart, "plannedEndDate": plannedEnd})
}
