package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type farmScheduleExecutionItem struct {
	ID             string  `json:"id"`
	FarmID         string  `json:"farmId"`
	WorkPlanID     int     `json:"workPlanId"`
	SectionID      *string `json:"sectionId,omitempty"`
	ExecutionType  string  `json:"executionType"`
	ScheduledDate  string  `json:"scheduledDate"`
	Status         string  `json:"status"`
	CompletedAt    *string `json:"completedAt,omitempty"`
	CompletedBy    *string `json:"completedBy,omitempty"`
	ResultRefType  *string `json:"resultRefType,omitempty"`
	ResultRefID    *string `json:"resultRefId,omitempty"`
	IdempotencyKey *string `json:"idempotencyKey,omitempty"`
	Memo           *string `json:"memo,omitempty"`
	CreatedAt      string  `json:"createdAt"`
	UpdatedAt      string  `json:"updatedAt"`
	WorkContent    *string `json:"workContent,omitempty"`
	SortationName  *string `json:"sortationName,omitempty"`
	JobtypeName    *string `json:"jobtypeName,omitempty"`
	CriteriaName   *string `json:"criteriaName,omitempty"`
}

// FarmScheduleExecutionsList GET /api/farms/:farmId/schedule-executions
func (h *Handler) FarmScheduleExecutionsList(w http.ResponseWriter, r *http.Request) {
	farmID, _, ok := h.parseFarmIDAndAuth(w, r)
	if !ok {
		return
	}

	q := `
		SELECT
			se.id::text,
			se.farm_id::text,
			se.work_plan_id,
			se.section_id::text,
			se.execution_type,
			se.scheduled_date,
			se.status,
			se.completed_at,
			se.completed_by::text,
			se.result_ref_type,
			se.result_ref_id::text,
			se.idempotency_key,
			se.memo,
			se.created_at,
			se.updated_at,
			swp.work_content,
			sd.name AS sortation_name,
			jd.name AS jobtype_name,
			cd.name AS criteria_name
		FROM schedule_executions se
		LEFT JOIN schedule_work_plans swp ON swp.id = se.work_plan_id
		LEFT JOIN schedule_sortation_definitions sd ON sd.id = swp.sortation_id
		LEFT JOIN schedule_jobtype_definitions jd ON jd.id = swp.jobtype_id
		LEFT JOIN schedule_criteria_definitions cd ON cd.id = swp.criteria_id
		WHERE se.farm_id = $1
	`
	args := []interface{}{farmID}
	argNum := 2

	if startDate := strings.TrimSpace(r.URL.Query().Get("startDate")); startDate != "" {
		d, err := parseYMD(startDate)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "startDate는 YYYY-MM-DD 형식이어야 합니다."})
			return
		}
		q += ` AND se.scheduled_date >= $` + strconv.Itoa(argNum)
		args = append(args, d)
		argNum++
	}
	if endDate := strings.TrimSpace(r.URL.Query().Get("endDate")); endDate != "" {
		d, err := parseYMD(endDate)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "endDate는 YYYY-MM-DD 형식이어야 합니다."})
			return
		}
		q += ` AND se.scheduled_date <= $` + strconv.Itoa(argNum)
		args = append(args, d)
		argNum++
	}
	if status := strings.TrimSpace(r.URL.Query().Get("status")); status != "" {
		if !isValidScheduleExecutionStatus(status) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "status 값이 올바르지 않습니다."})
			return
		}
		q += ` AND se.status = $` + strconv.Itoa(argNum)
		args = append(args, status)
		argNum++
	}
	if executionType := strings.TrimSpace(r.URL.Query().Get("executionType")); executionType != "" {
		if !isValidScheduleExecutionType(executionType) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "executionType 값이 올바르지 않습니다."})
			return
		}
		q += ` AND se.execution_type = $` + strconv.Itoa(argNum)
		args = append(args, executionType)
		argNum++
	}
	if sectionIDStr := strings.TrimSpace(r.URL.Query().Get("sectionId")); sectionIDStr != "" {
		sectionID, err := uuid.Parse(sectionIDStr)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "sectionId가 올바르지 않습니다."})
			return
		}
		q += ` AND se.section_id = $` + strconv.Itoa(argNum)
		args = append(args, sectionID)
		argNum++
	}

	limit := 500
	if limitStr := strings.TrimSpace(r.URL.Query().Get("limit")); limitStr != "" {
		v, err := strconv.Atoi(limitStr)
		if err != nil || v < 1 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "limit 값이 올바르지 않습니다."})
			return
		}
		if v > 2000 {
			v = 2000
		}
		limit = v
	}

	q += ` ORDER BY se.scheduled_date ASC, se.created_at ASC LIMIT $` + strconv.Itoa(argNum)
	args = append(args, limit)

	rows, err := h.db.Pool.Query(r.Context(), q, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "일정 실행 목록을 불러오는 중 오류가 발생했습니다.", "detail": err.Error()})
		return
	}
	defer rows.Close()

	list := make([]farmScheduleExecutionItem, 0)
	for rows.Next() {
		var (
			item                                  farmScheduleExecutionItem
			sectionID, completedBy, resultRefType sql.NullString
			resultRefID, idempotencyKey, memo     sql.NullString
			workContent, sortationName            sql.NullString
			jobtypeName, criteriaName             sql.NullString
			completedAt                           sql.NullTime
			scheduledDate                         time.Time
			createdAt, updatedAt                  time.Time
		)
		if err := rows.Scan(
			&item.ID,
			&item.FarmID,
			&item.WorkPlanID,
			&sectionID,
			&item.ExecutionType,
			&scheduledDate,
			&item.Status,
			&completedAt,
			&completedBy,
			&resultRefType,
			&resultRefID,
			&idempotencyKey,
			&memo,
			&createdAt,
			&updatedAt,
			&workContent,
			&sortationName,
			&jobtypeName,
			&criteriaName,
		); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "일정 실행 목록을 불러오는 중 오류가 발생했습니다.", "detail": err.Error()})
			return
		}
		item.ScheduledDate = scheduledDate.Format("2006-01-02")
		item.CreatedAt = createdAt.Format(time.RFC3339)
		item.UpdatedAt = updatedAt.Format(time.RFC3339)
		if sectionID.Valid {
			v := sectionID.String
			item.SectionID = &v
		}
		if completedAt.Valid {
			v := completedAt.Time.Format(time.RFC3339)
			item.CompletedAt = &v
		}
		if completedBy.Valid {
			v := completedBy.String
			item.CompletedBy = &v
		}
		if resultRefType.Valid {
			v := resultRefType.String
			item.ResultRefType = &v
		}
		if resultRefID.Valid {
			v := resultRefID.String
			item.ResultRefID = &v
		}
		if idempotencyKey.Valid {
			v := idempotencyKey.String
			item.IdempotencyKey = &v
		}
		if memo.Valid {
			v := memo.String
			item.Memo = &v
		}
		if workContent.Valid {
			v := workContent.String
			item.WorkContent = &v
		}
		if sortationName.Valid {
			v := sortationName.String
			item.SortationName = &v
		}
		if jobtypeName.Valid {
			v := jobtypeName.String
			item.JobtypeName = &v
		}
		if criteriaName.Valid {
			v := criteriaName.String
			item.CriteriaName = &v
		}
		list = append(list, item)
	}

	writeJSON(w, http.StatusOK, list)
}

// FarmScheduleExecutionsCreate POST /api/farms/:farmId/schedule-executions
func (h *Handler) FarmScheduleExecutionsCreate(w http.ResponseWriter, r *http.Request) {
	farmID, claims, ok := h.parseFarmIDAndAuth(w, r)
	if !ok {
		return
	}

	var body struct {
		WorkPlanID         *int    `json:"workPlanId"`
		WorkPlanIDSnake    *int    `json:"work_plan_id"`
		SectionID          *string `json:"sectionId"`
		SectionIDSnake     *string `json:"section_id"`
		ExecutionType      *string `json:"executionType"`
		ExecutionTypeSnake *string `json:"execution_type"`
		ScheduledDate      *string `json:"scheduledDate"`
		ScheduledDateSnake *string `json:"scheduled_date"`
		IdempotencyKey     *string `json:"idempotencyKey"`
		IdempotencyKeyAlt  *string `json:"idempotency_key"`
		Memo               *string `json:"memo"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}

	workPlanID := firstInt(body.WorkPlanID, body.WorkPlanIDSnake)
	if workPlanID == nil || *workPlanID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "workPlanId가 필요합니다."})
		return
	}

	executionType := strings.TrimSpace(firstString(body.ExecutionType, body.ExecutionTypeSnake))
	if !isValidScheduleExecutionType(executionType) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "executionType 값이 올바르지 않습니다."})
		return
	}

	scheduledDateStr := strings.TrimSpace(firstString(body.ScheduledDate, body.ScheduledDateSnake))
	if scheduledDateStr == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "scheduledDate가 필요합니다."})
		return
	}
	scheduledDate, err := parseYMD(scheduledDateStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "scheduledDate는 YYYY-MM-DD 형식이어야 합니다."})
		return
	}

	var sectionIDValue interface{}
	sectionIDStr := strings.TrimSpace(firstString(body.SectionID, body.SectionIDSnake))
	if sectionIDStr != "" {
		sectionID, err := uuid.Parse(sectionIDStr)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "sectionId가 올바르지 않습니다."})
			return
		}
		var sectionExists bool
		err = h.db.Pool.QueryRow(r.Context(), `
			SELECT EXISTS (
				SELECT 1
				FROM farm_sections s
				JOIN farm_rooms r ON r.id = s."roomId"
				JOIN farm_barns b ON b.id = r."barnId"
				JOIN farm_buildings bd ON bd.id = b."buildingId"
				WHERE s.id = $1
				  AND bd."farmId" = $2
			)
		`, sectionID, farmID).Scan(&sectionExists)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "sectionId 검증 중 오류가 발생했습니다.", "detail": err.Error()})
			return
		}
		if !sectionExists {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "해당 농장에 속한 sectionId가 아닙니다."})
			return
		}
		sectionIDValue = sectionID
	}

	var planExists bool
	err = h.db.Pool.QueryRow(r.Context(), `
		SELECT EXISTS (
			SELECT 1
			FROM schedule_work_plans swp
			WHERE swp.id = $1
			  AND COALESCE(swp.is_deleted, false) = false
			  AND (swp."farmId" IS NULL OR swp."farmId" = $2)
		)
	`, *workPlanID, farmID).Scan(&planExists)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "workPlan 검증 중 오류가 발생했습니다.", "detail": err.Error()})
		return
	}
	if !planExists {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "workPlanId가 유효하지 않습니다."})
		return
	}

	var idempotencyKey interface{}
	idempotencyKeyStr := strings.TrimSpace(firstString(body.IdempotencyKey, body.IdempotencyKeyAlt))
	if idempotencyKeyStr != "" {
		idempotencyKey = idempotencyKeyStr
	}

	var memo interface{}
	if body.Memo != nil {
		memo = *body.Memo
	}

	executionID := uuid.New()
	var createdAt, updatedAt time.Time
	err = h.db.Pool.QueryRow(r.Context(), `
		INSERT INTO schedule_executions (
			id, farm_id, work_plan_id, section_id, execution_type, scheduled_date, status,
			idempotency_key, memo, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, NOW(), NOW())
		RETURNING created_at, updated_at
	`, executionID, farmID, *workPlanID, sectionIDValue, executionType, scheduledDate, idempotencyKey, memo).Scan(&createdAt, &updatedAt)
	if err != nil {
		if strings.Contains(err.Error(), "uq_schedule_executions_idempotency") || strings.Contains(err.Error(), "duplicate key value") {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "중복 요청입니다. idempotencyKey를 확인해 주세요."})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "일정 실행건 생성 중 오류가 발생했습니다.", "detail": err.Error()})
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"id":             executionID.String(),
		"farmId":         farmID.String(),
		"workPlanId":     *workPlanID,
		"sectionId":      nullableStringOrNil(sectionIDStr),
		"executionType":  executionType,
		"scheduledDate":  scheduledDate.Format("2006-01-02"),
		"status":         "pending",
		"idempotencyKey": nullableStringOrNil(idempotencyKeyStr),
		"memo":           body.Memo,
		"createdAt":      createdAt.Format(time.RFC3339),
		"updatedAt":      updatedAt.Format(time.RFC3339),
		"createdBy":      claims.UserID,
	})
}

func isValidScheduleExecutionStatus(v string) bool {
	switch v {
	case "pending", "completed", "skipped", "cancelled":
		return true
	default:
		return false
	}
}

func isValidScheduleExecutionType(v string) bool {
	switch v {
	case "birth", "move", "inspection":
		return true
	default:
		return false
	}
}

func parseYMD(v string) (time.Time, error) {
	return time.Parse("2006-01-02", v)
}

func firstInt(values ...*int) *int {
	for _, v := range values {
		if v != nil {
			return v
		}
	}
	return nil
}

func firstString(values ...*string) string {
	for _, v := range values {
		if v != nil {
			return *v
		}
	}
	return ""
}

func nullableStringOrNil(v string) interface{} {
	if strings.TrimSpace(v) == "" {
		return nil
	}
	return v
}

// FarmScheduleExecutionCompleteBirth POST /api/farms/:farmId/schedule-executions/:executionId/complete-birth
func (h *Handler) FarmScheduleExecutionCompleteBirth(w http.ResponseWriter, r *http.Request) {
	farmID, claims, ok := h.parseFarmIDAndAuth(w, r)
	if !ok {
		return
	}
	executionID, err := uuid.Parse(strings.TrimSpace(chi.URLParam(r, "executionId")))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "executionId가 올바르지 않습니다."})
		return
	}

	var body struct {
		BornCount      int32   `json:"bornCount"`
		SectionID      *string `json:"sectionId"`
		SectionIDSnake *string `json:"section_id"`
		GroupNo        *string `json:"groupNo"`
		OriginSowID    *string `json:"originSowId"`
		Memo           *string `json:"memo"`
		IdempotencyKey *string `json:"idempotencyKey"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	if body.BornCount <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bornCount는 1 이상이어야 합니다."})
		return
	}

	idempotencyKey := strings.TrimSpace(firstString(body.IdempotencyKey))
	if idempotencyKey == "" {
		idempotencyKey = strings.TrimSpace(r.Header.Get("Idempotency-Key"))
	}
	if idempotencyKey == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "idempotencyKey가 필요합니다."})
		return
	}

	tx, err := h.db.Pool.Begin(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "트랜잭션 시작 실패"})
		return
	}
	defer tx.Rollback(r.Context())

	type lockedExecution struct {
		WorkPlanID     int
		SectionID      sql.NullString
		ExecutionType  string
		Status         string
		IdempotencyKey sql.NullString
		ResultRefType  sql.NullString
		ResultRefID    sql.NullString
	}
	var exec lockedExecution
	err = tx.QueryRow(r.Context(), `
		SELECT work_plan_id, section_id::text, execution_type, status, idempotency_key, result_ref_type, result_ref_id::text
		FROM schedule_executions
		WHERE id = $1
		  AND farm_id = $2
		FOR UPDATE
	`, executionID, farmID).Scan(
		&exec.WorkPlanID, &exec.SectionID, &exec.ExecutionType, &exec.Status, &exec.IdempotencyKey, &exec.ResultRefType, &exec.ResultRefID,
	)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "일정 실행건을 찾을 수 없습니다."})
		return
	}

	if exec.ExecutionType != "birth" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "birth 실행건이 아닙니다."})
		return
	}
	if exec.Status == "completed" {
		if exec.IdempotencyKey.Valid && exec.IdempotencyKey.String == idempotencyKey {
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"id":            executionID.String(),
				"status":        "completed",
				"resultRefType": nullableStringOrNil(exec.ResultRefType.String),
				"resultRefId":   nullableStringOrNil(exec.ResultRefID.String),
				"message":       "이미 완료된 요청입니다.",
			})
			return
		}
		writeJSON(w, http.StatusConflict, map[string]string{"error": "이미 완료된 실행건입니다."})
		return
	}
	if exec.Status != "pending" {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "pending 상태에서만 완료 처리할 수 있습니다."})
		return
	}
	if exec.IdempotencyKey.Valid && exec.IdempotencyKey.String != idempotencyKey {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "idempotencyKey가 기존 실행건과 일치하지 않습니다."})
		return
	}

	sectionIDRaw := strings.TrimSpace(firstString(body.SectionID, body.SectionIDSnake))
	if sectionIDRaw == "" && exec.SectionID.Valid {
		sectionIDRaw = exec.SectionID.String
	}
	sectionID, err := uuid.Parse(strings.TrimSpace(sectionIDRaw))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "sectionId가 필요하며 UUID 형식이어야 합니다."})
		return
	}
	ok, err = ensureSectionBelongsToFarmTx(r.Context(), tx, farmID, sectionID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "sectionId 검증 중 오류가 발생했습니다.", "detail": err.Error()})
		return
	}
	if !ok {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "해당 농장에 속한 sectionId가 아닙니다."})
		return
	}

	createdBy, err := uuid.Parse(claims.UserID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "사용자 식별자가 올바르지 않습니다."})
		return
	}

	var originSowID interface{}
	if body.OriginSowID != nil && strings.TrimSpace(*body.OriginSowID) != "" {
		sowID, err := uuid.Parse(strings.TrimSpace(*body.OriginSowID))
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "originSowId가 올바르지 않습니다."})
			return
		}
		originSowID = sowID
	}

	groupID := uuid.New()
	groupNo := defaultGroupNo(body.GroupNo)
	farrowingID := uuid.New()
	now := time.Now()

	_, err = tx.Exec(r.Context(), `
		INSERT INTO pig_groups (
			id, farm_id, group_no, root_group_id, current_section_id, head_count,
			status, created_reason, parent_group_id, memo, created_at, updated_at, is_deleted
		)
		VALUES ($1, $2, $3, $1, $4, $5, 'active', 'birth', NULL, $6, NOW(), NOW(), false)
	`, groupID, farmID, groupNo, sectionID, body.BornCount, body.Memo)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "분만 돈군 생성 중 오류가 발생했습니다.", "detail": err.Error()})
		return
	}

	_, err = tx.Exec(r.Context(), `
		INSERT INTO farrowing_events (
			id, farm_id, section_id, created_group_id, origin_sow_id, born_count,
			occurred_at, created_by, memo, idempotency_key, created_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
	`, farrowingID, farmID, sectionID, groupID, originSowID, body.BornCount, now, createdBy, body.Memo, idempotencyKey)
	if err != nil {
		if strings.Contains(err.Error(), "uq_farrowing_events_idempotency") || strings.Contains(err.Error(), "duplicate key value") {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "중복 요청입니다. idempotencyKey를 확인해 주세요."})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "분만 이벤트 저장 중 오류가 발생했습니다.", "detail": err.Error()})
		return
	}

	_, err = tx.Exec(r.Context(), `
		INSERT INTO section_inventory_ledger (
			id, farm_id, section_id, pig_group_id, direction, head_count, event_id, ref_type, ref_id, occurred_at, created_at
		)
		VALUES ($1, $2, $3, $4, 'IN', $5, NULL, 'birth', $6, $7, NOW())
	`, uuid.New(), farmID, sectionID, groupID, body.BornCount, farrowingID, now)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "재고 원장 반영 중 오류가 발생했습니다.", "detail": err.Error()})
		return
	}

	if err := upsertSectionBalanceTx(r.Context(), tx, farmID, sectionID, body.BornCount); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "현재고 반영 중 오류가 발생했습니다.", "detail": err.Error()})
		return
	}

	_, err = tx.Exec(r.Context(), `
		UPDATE schedule_executions
		SET
			status = 'completed',
			completed_at = NOW(),
			completed_by = $1,
			result_ref_type = 'farrowing_event',
			result_ref_id = $2,
			idempotency_key = COALESCE(idempotency_key, $3),
			memo = COALESCE($4, memo),
			updated_at = NOW()
		WHERE id = $5
		  AND farm_id = $6
	`, createdBy, farrowingID, idempotencyKey, body.Memo, executionID, farmID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "실행 완료 상태 반영 중 오류가 발생했습니다.", "detail": err.Error()})
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "분만 완료 처리 중 오류가 발생했습니다."})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id":            executionID.String(),
		"status":        "completed",
		"resultRefType": "farrowing_event",
		"resultRefId":   farrowingID.String(),
		"groupId":       groupID.String(),
		"groupNo":       groupNo,
	})
}

// FarmScheduleExecutionCompleteMove POST /api/farms/:farmId/schedule-executions/:executionId/complete-move
func (h *Handler) FarmScheduleExecutionCompleteMove(w http.ResponseWriter, r *http.Request) {
	farmID, claims, ok := h.parseFarmIDAndAuth(w, r)
	if !ok {
		return
	}
	executionID, err := uuid.Parse(strings.TrimSpace(chi.URLParam(r, "executionId")))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "executionId가 올바르지 않습니다."})
		return
	}

	var body struct {
		EventType      string  `json:"eventType"`
		Memo           *string `json:"memo"`
		IdempotencyKey *string `json:"idempotencyKey"`
		Lines          []struct {
			SourceGroupID string  `json:"sourceGroupId"`
			TargetGroupID *string `json:"targetGroupId"`
			FromSectionID *string `json:"fromSectionId"`
			ToSectionID   string  `json:"toSectionId"`
			HeadCount     int32   `json:"headCount"`
			LineType      string  `json:"lineType"`
		} `json:"lines"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	body.EventType = strings.TrimSpace(body.EventType)
	if !isValidMovementEventType(body.EventType) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "eventType 값이 올바르지 않습니다."})
		return
	}
	if len(body.Lines) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "lines는 최소 1개 이상이어야 합니다."})
		return
	}

	idempotencyKey := strings.TrimSpace(firstString(body.IdempotencyKey))
	if idempotencyKey == "" {
		idempotencyKey = strings.TrimSpace(r.Header.Get("Idempotency-Key"))
	}
	if idempotencyKey == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "idempotencyKey가 필요합니다."})
		return
	}

	actorID, err := uuid.Parse(claims.UserID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "사용자 식별자가 올바르지 않습니다."})
		return
	}

	type parsedLine struct {
		SourceGroupID uuid.UUID
		TargetGroupID *uuid.UUID
		FromSectionID *uuid.UUID
		ToSectionID   uuid.UUID
		HeadCount     int32
		LineType      string
	}
	parsedLines := make([]parsedLine, 0, len(body.Lines))
	groupOutTotal := map[uuid.UUID]int32{}
	for i, line := range body.Lines {
		sourceGroupID, err := uuid.Parse(strings.TrimSpace(line.SourceGroupID))
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "sourceGroupId가 올바르지 않습니다.", "lineIndex": intToString(i)})
			return
		}
		toSectionID, err := uuid.Parse(strings.TrimSpace(line.ToSectionID))
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "toSectionId가 올바르지 않습니다.", "lineIndex": intToString(i)})
			return
		}
		if line.HeadCount <= 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "headCount는 1 이상이어야 합니다.", "lineIndex": intToString(i)})
			return
		}
		lineType := strings.TrimSpace(line.LineType)
		if lineType == "" {
			lineType = "move"
		}
		if !isValidMovementLineType(lineType) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "lineType 값이 올바르지 않습니다.", "lineIndex": intToString(i)})
			return
		}

		var targetGroupID *uuid.UUID
		if line.TargetGroupID != nil && strings.TrimSpace(*line.TargetGroupID) != "" {
			tid, err := uuid.Parse(strings.TrimSpace(*line.TargetGroupID))
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "targetGroupId가 올바르지 않습니다.", "lineIndex": intToString(i)})
				return
			}
			targetGroupID = &tid
		}

		var fromSectionID *uuid.UUID
		if line.FromSectionID != nil && strings.TrimSpace(*line.FromSectionID) != "" {
			fid, err := uuid.Parse(strings.TrimSpace(*line.FromSectionID))
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "fromSectionId가 올바르지 않습니다.", "lineIndex": intToString(i)})
				return
			}
			fromSectionID = &fid
		}

		parsedLines = append(parsedLines, parsedLine{
			SourceGroupID: sourceGroupID,
			TargetGroupID: targetGroupID,
			FromSectionID: fromSectionID,
			ToSectionID:   toSectionID,
			HeadCount:     line.HeadCount,
			LineType:      lineType,
		})
		groupOutTotal[sourceGroupID] += line.HeadCount
	}

	tx, err := h.db.Pool.Begin(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "트랜잭션 시작 실패"})
		return
	}
	defer tx.Rollback(r.Context())

	type lockedExecution struct {
		WorkPlanID     int
		ExecutionType  string
		Status         string
		IdempotencyKey sql.NullString
		ResultRefType  sql.NullString
		ResultRefID    sql.NullString
	}
	var exec lockedExecution
	err = tx.QueryRow(r.Context(), `
		SELECT work_plan_id, execution_type, status, idempotency_key, result_ref_type, result_ref_id::text
		FROM schedule_executions
		WHERE id = $1
		  AND farm_id = $2
		FOR UPDATE
	`, executionID, farmID).Scan(&exec.WorkPlanID, &exec.ExecutionType, &exec.Status, &exec.IdempotencyKey, &exec.ResultRefType, &exec.ResultRefID)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "일정 실행건을 찾을 수 없습니다."})
		return
	}
	if exec.ExecutionType != "move" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "move 실행건이 아닙니다."})
		return
	}
	if exec.Status == "completed" {
		if exec.IdempotencyKey.Valid && exec.IdempotencyKey.String == idempotencyKey {
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"id":            executionID.String(),
				"status":        "completed",
				"resultRefType": nullableStringOrNil(exec.ResultRefType.String),
				"resultRefId":   nullableStringOrNil(exec.ResultRefID.String),
				"message":       "이미 완료된 요청입니다.",
			})
			return
		}
		writeJSON(w, http.StatusConflict, map[string]string{"error": "이미 완료된 실행건입니다."})
		return
	}
	if exec.Status != "pending" {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "pending 상태에서만 완료 처리할 수 있습니다."})
		return
	}
	if exec.IdempotencyKey.Valid && exec.IdempotencyKey.String != idempotencyKey {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "idempotencyKey가 기존 실행건과 일치하지 않습니다."})
		return
	}

	checkedSections := map[uuid.UUID]bool{}
	for _, line := range parsedLines {
		if _, exists := checkedSections[line.ToSectionID]; !exists {
			sectionOK, err := ensureSectionBelongsToFarmTx(r.Context(), tx, farmID, line.ToSectionID)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "toSectionId 검증 중 오류가 발생했습니다.", "detail": err.Error()})
				return
			}
			if !sectionOK {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "해당 농장에 속하지 않은 toSectionId가 포함되어 있습니다."})
				return
			}
			checkedSections[line.ToSectionID] = true
		}
		if line.FromSectionID != nil {
			if _, exists := checkedSections[*line.FromSectionID]; !exists {
				sectionOK, err := ensureSectionBelongsToFarmTx(r.Context(), tx, farmID, *line.FromSectionID)
				if err != nil {
					writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "fromSectionId 검증 중 오류가 발생했습니다.", "detail": err.Error()})
					return
				}
				if !sectionOK {
					writeJSON(w, http.StatusBadRequest, map[string]string{"error": "해당 농장에 속하지 않은 fromSectionId가 포함되어 있습니다."})
					return
				}
				checkedSections[*line.FromSectionID] = true
			}
		}
	}

	for sourceGroupID, outQty := range groupOutTotal {
		var current int32
		err := tx.QueryRow(r.Context(), `
			SELECT head_count
			FROM pig_groups
			WHERE id = $1
			  AND farm_id = $2
			  AND COALESCE(is_deleted, false) = false
			FOR UPDATE
		`, sourceGroupID, farmID).Scan(&current)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "sourceGroupId를 찾을 수 없습니다.", "groupId": sourceGroupID.String()})
			return
		}
		if current < outQty {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "이동 두수가 현재 돈군 두수를 초과합니다.", "groupId": sourceGroupID.String()})
			return
		}
	}

	eventID := uuid.New()
	movedAt := time.Now()
	_, err = tx.Exec(r.Context(), `
		INSERT INTO pig_movement_events (id, farm_id, event_type, scheduled_work_plan_id, moved_at, moved_by, memo, idempotency_key, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
	`, eventID, farmID, body.EventType, exec.WorkPlanID, movedAt, actorID, body.Memo, idempotencyKey)
	if err != nil {
		if strings.Contains(err.Error(), "uq_pig_movement_events_idempotency") || strings.Contains(err.Error(), "duplicate key value") {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "중복 요청입니다. idempotencyKey를 확인해 주세요."})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "이동 이벤트 저장 중 오류가 발생했습니다.", "detail": err.Error()})
		return
	}

	for _, line := range parsedLines {
		var sourceRootID uuid.UUID
		var sourceSectionID sql.NullString
		err := tx.QueryRow(r.Context(), `
			SELECT COALESCE(root_group_id, id), current_section_id::text
			FROM pig_groups
			WHERE id = $1
			  AND farm_id = $2
		`, line.SourceGroupID, farmID).Scan(&sourceRootID, &sourceSectionID)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "sourceGroup 정보를 조회할 수 없습니다.", "groupId": line.SourceGroupID.String()})
			return
		}

		fromSectionID := sourceSectionID
		if line.FromSectionID != nil {
			fromSectionID = sql.NullString{String: line.FromSectionID.String(), Valid: true}
		}
		if !fromSectionID.Valid {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "fromSectionId를 확정할 수 없습니다. sourceGroup의 현재 위치가 필요합니다."})
			return
		}
		fromSectionUUID, err := uuid.Parse(fromSectionID.String)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "sourceGroup의 현재 section 정보가 올바르지 않습니다."})
			return
		}

		targetGroupID := line.TargetGroupID
		if targetGroupID != nil {
			tag, err := tx.Exec(r.Context(), `
				UPDATE pig_groups
				SET head_count = head_count + $1,
					current_section_id = $2,
					status = 'active',
					updated_at = NOW()
				WHERE id = $3
				  AND farm_id = $4
				  AND COALESCE(is_deleted, false) = false
			`, line.HeadCount, line.ToSectionID, *targetGroupID, farmID)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "targetGroup 반영 중 오류가 발생했습니다.", "detail": err.Error()})
				return
			}
			if tag.RowsAffected() == 0 {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "targetGroupId를 찾을 수 없습니다."})
				return
			}
		} else {
			newTargetID := uuid.New()
			reason := "split"
			if strings.Contains(line.LineType, "merge") || body.EventType == "merge" {
				reason = "merge"
			}
			_, err = tx.Exec(r.Context(), `
				INSERT INTO pig_groups (
					id, farm_id, group_no, root_group_id, current_section_id, head_count,
					status, created_reason, parent_group_id, memo, created_at, updated_at, is_deleted
				)
				VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8, $9, NOW(), NOW(), false)
			`, newTargetID, farmID, defaultGroupNo(nil), sourceRootID, line.ToSectionID, line.HeadCount, reason, line.SourceGroupID, body.Memo)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "target 돈군 생성 중 오류가 발생했습니다.", "detail": err.Error()})
				return
			}
			targetGroupID = &newTargetID
		}

		sourceClosedStatus := "closed"
		if body.EventType == "merge" || strings.Contains(line.LineType, "merge") {
			sourceClosedStatus = "merged"
		}
		_, err = tx.Exec(r.Context(), `
			UPDATE pig_groups
			SET
				head_count = GREATEST(0, head_count - $1),
				status = CASE WHEN head_count - $1 <= 0 THEN $2 ELSE status END,
				updated_at = NOW()
			WHERE id = $3
			  AND farm_id = $4
			  AND COALESCE(is_deleted, false) = false
		`, line.HeadCount, sourceClosedStatus, line.SourceGroupID, farmID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "sourceGroup 반영 중 오류가 발생했습니다.", "detail": err.Error()})
			return
		}

		_, err = tx.Exec(r.Context(), `
			INSERT INTO pig_movement_lines (
				id, farm_id, event_id, source_group_id, target_group_id,
				from_section_id, to_section_id, head_count, line_type, created_at
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
		`, uuid.New(), farmID, eventID, line.SourceGroupID, *targetGroupID, fromSectionUUID, line.ToSectionID, line.HeadCount, line.LineType)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "이동 라인 저장 중 오류가 발생했습니다.", "detail": err.Error()})
			return
		}

		_, err = tx.Exec(r.Context(), `
			INSERT INTO section_inventory_ledger (
				id, farm_id, section_id, pig_group_id, direction, head_count, event_id, ref_type, ref_id, occurred_at, created_at
			)
			VALUES ($1, $2, $3, $4, 'OUT', $5, $6, 'movement', $6, $7, NOW())
		`, uuid.New(), farmID, fromSectionUUID, line.SourceGroupID, line.HeadCount, eventID, movedAt)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "출발 칸 원장 반영 중 오류가 발생했습니다.", "detail": err.Error()})
			return
		}
		if err := upsertSectionBalanceTx(r.Context(), tx, farmID, fromSectionUUID, -line.HeadCount); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "출발 칸 현재고 반영 중 오류가 발생했습니다.", "detail": err.Error()})
			return
		}

		_, err = tx.Exec(r.Context(), `
			INSERT INTO section_inventory_ledger (
				id, farm_id, section_id, pig_group_id, direction, head_count, event_id, ref_type, ref_id, occurred_at, created_at
			)
			VALUES ($1, $2, $3, $4, 'IN', $5, $6, 'movement', $6, $7, NOW())
		`, uuid.New(), farmID, line.ToSectionID, *targetGroupID, line.HeadCount, eventID, movedAt)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "도착 칸 원장 반영 중 오류가 발생했습니다.", "detail": err.Error()})
			return
		}
		if err := upsertSectionBalanceTx(r.Context(), tx, farmID, line.ToSectionID, line.HeadCount); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "도착 칸 현재고 반영 중 오류가 발생했습니다.", "detail": err.Error()})
			return
		}
	}

	_, err = tx.Exec(r.Context(), `
		UPDATE schedule_executions
		SET
			status = 'completed',
			completed_at = NOW(),
			completed_by = $1,
			result_ref_type = 'movement_event',
			result_ref_id = $2,
			idempotency_key = COALESCE(idempotency_key, $3),
			memo = COALESCE($4, memo),
			updated_at = NOW()
		WHERE id = $5
		  AND farm_id = $6
	`, actorID, eventID, idempotencyKey, body.Memo, executionID, farmID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "실행 완료 상태 반영 중 오류가 발생했습니다.", "detail": err.Error()})
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "이동 완료 처리 중 오류가 발생했습니다."})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id":            executionID.String(),
		"status":        "completed",
		"resultRefType": "movement_event",
		"resultRefId":   eventID.String(),
		"lines":         len(parsedLines),
	})
}

// FarmScheduleExecutionsDirectCompleteBirth POST /api/farms/:farmId/schedule-executions/direct-complete-birth
// 정책(MVP-046): 내부 pending 생성 + 동일 트랜잭션 완료 처리
func (h *Handler) FarmScheduleExecutionsDirectCompleteBirth(w http.ResponseWriter, r *http.Request) {
	farmID, claims, ok := h.parseFarmIDAndAuth(w, r)
	if !ok {
		return
	}

	var body struct {
		WorkPlanID         *int    `json:"workPlanId"`
		WorkPlanIDSnake    *int    `json:"work_plan_id"`
		SectionID          *string `json:"sectionId"`
		SectionIDSnake     *string `json:"section_id"`
		ScheduledDate      *string `json:"scheduledDate"`
		ScheduledDateSnake *string `json:"scheduled_date"`
		BornCount          int32   `json:"bornCount"`
		GroupNo            *string `json:"groupNo"`
		OriginSowID        *string `json:"originSowId"`
		Memo               *string `json:"memo"`
		IdempotencyKey     *string `json:"idempotencyKey"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}

	workPlanID := firstInt(body.WorkPlanID, body.WorkPlanIDSnake)
	if workPlanID == nil || *workPlanID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "workPlanId가 필요합니다."})
		return
	}
	sectionIDStr := strings.TrimSpace(firstString(body.SectionID, body.SectionIDSnake))
	sectionID, err := uuid.Parse(sectionIDStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "sectionId가 필요하며 UUID 형식이어야 합니다."})
		return
	}
	scheduledDateStr := strings.TrimSpace(firstString(body.ScheduledDate, body.ScheduledDateSnake))
	if scheduledDateStr == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "scheduledDate가 필요합니다."})
		return
	}
	scheduledDate, err := parseYMD(scheduledDateStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "scheduledDate는 YYYY-MM-DD 형식이어야 합니다."})
		return
	}
	if body.BornCount <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bornCount는 1 이상이어야 합니다."})
		return
	}
	idempotencyKey := strings.TrimSpace(firstString(body.IdempotencyKey))
	if idempotencyKey == "" {
		idempotencyKey = strings.TrimSpace(r.Header.Get("Idempotency-Key"))
	}
	if idempotencyKey == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "idempotencyKey가 필요합니다."})
		return
	}

	createdBy, err := uuid.Parse(claims.UserID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "사용자 식별자가 올바르지 않습니다."})
		return
	}

	tx, err := h.db.Pool.Begin(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "트랜잭션 시작 실패"})
		return
	}
	defer tx.Rollback(r.Context())

	var planExists bool
	err = tx.QueryRow(r.Context(), `
		SELECT EXISTS (
			SELECT 1
			FROM schedule_work_plans swp
			WHERE swp.id = $1
			  AND COALESCE(swp.is_deleted, false) = false
			  AND (swp."farmId" IS NULL OR swp."farmId" = $2)
		)
	`, *workPlanID, farmID).Scan(&planExists)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "workPlan 검증 중 오류가 발생했습니다.", "detail": err.Error()})
		return
	}
	if !planExists {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "workPlanId가 유효하지 않습니다."})
		return
	}
	ok, err = ensureSectionBelongsToFarmTx(r.Context(), tx, farmID, sectionID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "sectionId 검증 중 오류가 발생했습니다.", "detail": err.Error()})
		return
	}
	if !ok {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "해당 농장에 속한 sectionId가 아닙니다."})
		return
	}

	executionID := uuid.New()
	_, err = tx.Exec(r.Context(), `
		INSERT INTO schedule_executions (
			id, farm_id, work_plan_id, section_id, execution_type, scheduled_date, status,
			idempotency_key, memo, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, 'birth', $5, 'pending', $6, $7, NOW(), NOW())
	`, executionID, farmID, *workPlanID, sectionID, scheduledDate, idempotencyKey, body.Memo)
	if err != nil {
		if strings.Contains(err.Error(), "uq_schedule_executions_idempotency") || strings.Contains(err.Error(), "duplicate key value") {
			existingID, existingType, existingStatus, existingRefType, existingRefID, lookupErr := h.lookupScheduleExecutionByIdempotency(r.Context(), farmID, idempotencyKey)
			if lookupErr != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "중복 실행건 확인 중 오류가 발생했습니다.", "detail": lookupErr.Error()})
				return
			}
			if existingID != "" && existingType == "birth" && existingStatus == "completed" {
				writeJSON(w, http.StatusOK, map[string]interface{}{
					"id":            existingID,
					"status":        "completed",
					"resultRefType": nullableStringOrNil(existingRefType.String),
					"resultRefId":   nullableStringOrNil(existingRefID.String),
					"message":       "이미 완료된 요청입니다.",
				})
				return
			}
			writeJSON(w, http.StatusConflict, map[string]string{"error": "중복 요청입니다. idempotencyKey를 확인해 주세요."})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "직접 완료용 실행건 생성 중 오류가 발생했습니다.", "detail": err.Error()})
		return
	}

	var originSowID interface{}
	if body.OriginSowID != nil && strings.TrimSpace(*body.OriginSowID) != "" {
		sowID, err := uuid.Parse(strings.TrimSpace(*body.OriginSowID))
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "originSowId가 올바르지 않습니다."})
			return
		}
		originSowID = sowID
	}

	groupID := uuid.New()
	groupNo := defaultGroupNo(body.GroupNo)
	farrowingID := uuid.New()
	now := time.Now()

	_, err = tx.Exec(r.Context(), `
		INSERT INTO pig_groups (
			id, farm_id, group_no, root_group_id, current_section_id, head_count,
			status, created_reason, parent_group_id, memo, created_at, updated_at, is_deleted
		)
		VALUES ($1, $2, $3, $1, $4, $5, 'active', 'birth', NULL, $6, NOW(), NOW(), false)
	`, groupID, farmID, groupNo, sectionID, body.BornCount, body.Memo)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "분만 돈군 생성 중 오류가 발생했습니다.", "detail": err.Error()})
		return
	}

	_, err = tx.Exec(r.Context(), `
		INSERT INTO farrowing_events (
			id, farm_id, section_id, created_group_id, origin_sow_id, born_count,
			occurred_at, created_by, memo, idempotency_key, created_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
	`, farrowingID, farmID, sectionID, groupID, originSowID, body.BornCount, now, createdBy, body.Memo, idempotencyKey)
	if err != nil {
		if strings.Contains(err.Error(), "uq_farrowing_events_idempotency") || strings.Contains(err.Error(), "duplicate key value") {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "중복 요청입니다. idempotencyKey를 확인해 주세요."})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "분만 이벤트 저장 중 오류가 발생했습니다.", "detail": err.Error()})
		return
	}

	_, err = tx.Exec(r.Context(), `
		INSERT INTO section_inventory_ledger (
			id, farm_id, section_id, pig_group_id, direction, head_count, event_id, ref_type, ref_id, occurred_at, created_at
		)
		VALUES ($1, $2, $3, $4, 'IN', $5, NULL, 'birth', $6, $7, NOW())
	`, uuid.New(), farmID, sectionID, groupID, body.BornCount, farrowingID, now)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "재고 원장 반영 중 오류가 발생했습니다.", "detail": err.Error()})
		return
	}
	if err := upsertSectionBalanceTx(r.Context(), tx, farmID, sectionID, body.BornCount); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "현재고 반영 중 오류가 발생했습니다.", "detail": err.Error()})
		return
	}

	_, err = tx.Exec(r.Context(), `
		UPDATE schedule_executions
		SET
			status = 'completed',
			completed_at = NOW(),
			completed_by = $1,
			result_ref_type = 'farrowing_event',
			result_ref_id = $2,
			memo = COALESCE($3, memo),
			updated_at = NOW()
		WHERE id = $4
		  AND farm_id = $5
	`, createdBy, farrowingID, body.Memo, executionID, farmID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "실행 완료 상태 반영 중 오류가 발생했습니다.", "detail": err.Error()})
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "분만 완료 처리 중 오류가 발생했습니다."})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id":            executionID.String(),
		"status":        "completed",
		"resultRefType": "farrowing_event",
		"resultRefId":   farrowingID.String(),
		"groupId":       groupID.String(),
		"groupNo":       groupNo,
	})
}

// FarmScheduleExecutionsDirectCompleteMove POST /api/farms/:farmId/schedule-executions/direct-complete-move
// 정책(MVP-046): 내부 pending 생성 + 동일 트랜잭션 완료 처리
func (h *Handler) FarmScheduleExecutionsDirectCompleteMove(w http.ResponseWriter, r *http.Request) {
	farmID, claims, ok := h.parseFarmIDAndAuth(w, r)
	if !ok {
		return
	}

	var body struct {
		WorkPlanID         *int    `json:"workPlanId"`
		WorkPlanIDSnake    *int    `json:"work_plan_id"`
		ScheduledDate      *string `json:"scheduledDate"`
		ScheduledDateSnake *string `json:"scheduled_date"`
		EventType          string  `json:"eventType"`
		Memo               *string `json:"memo"`
		IdempotencyKey     *string `json:"idempotencyKey"`
		Lines              []struct {
			SourceGroupID string  `json:"sourceGroupId"`
			TargetGroupID *string `json:"targetGroupId"`
			FromSectionID *string `json:"fromSectionId"`
			ToSectionID   string  `json:"toSectionId"`
			HeadCount     int32   `json:"headCount"`
			LineType      string  `json:"lineType"`
		} `json:"lines"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}

	workPlanID := firstInt(body.WorkPlanID, body.WorkPlanIDSnake)
	if workPlanID == nil || *workPlanID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "workPlanId가 필요합니다."})
		return
	}
	scheduledDateStr := strings.TrimSpace(firstString(body.ScheduledDate, body.ScheduledDateSnake))
	if scheduledDateStr == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "scheduledDate가 필요합니다."})
		return
	}
	scheduledDate, err := parseYMD(scheduledDateStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "scheduledDate는 YYYY-MM-DD 형식이어야 합니다."})
		return
	}
	body.EventType = strings.TrimSpace(body.EventType)
	if !isValidMovementEventType(body.EventType) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "eventType 값이 올바르지 않습니다."})
		return
	}
	if len(body.Lines) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "lines는 최소 1개 이상이어야 합니다."})
		return
	}
	idempotencyKey := strings.TrimSpace(firstString(body.IdempotencyKey))
	if idempotencyKey == "" {
		idempotencyKey = strings.TrimSpace(r.Header.Get("Idempotency-Key"))
	}
	if idempotencyKey == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "idempotencyKey가 필요합니다."})
		return
	}

	actorID, err := uuid.Parse(claims.UserID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "사용자 식별자가 올바르지 않습니다."})
		return
	}

	type parsedLine struct {
		SourceGroupID uuid.UUID
		TargetGroupID *uuid.UUID
		FromSectionID *uuid.UUID
		ToSectionID   uuid.UUID
		HeadCount     int32
		LineType      string
	}
	parsedLines := make([]parsedLine, 0, len(body.Lines))
	groupOutTotal := map[uuid.UUID]int32{}
	for i, line := range body.Lines {
		sourceGroupID, err := uuid.Parse(strings.TrimSpace(line.SourceGroupID))
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "sourceGroupId가 올바르지 않습니다.", "lineIndex": intToString(i)})
			return
		}
		toSectionID, err := uuid.Parse(strings.TrimSpace(line.ToSectionID))
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "toSectionId가 올바르지 않습니다.", "lineIndex": intToString(i)})
			return
		}
		if line.HeadCount <= 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "headCount는 1 이상이어야 합니다.", "lineIndex": intToString(i)})
			return
		}
		lineType := strings.TrimSpace(line.LineType)
		if lineType == "" {
			lineType = "move"
		}
		if !isValidMovementLineType(lineType) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "lineType 값이 올바르지 않습니다.", "lineIndex": intToString(i)})
			return
		}

		var targetGroupID *uuid.UUID
		if line.TargetGroupID != nil && strings.TrimSpace(*line.TargetGroupID) != "" {
			tid, err := uuid.Parse(strings.TrimSpace(*line.TargetGroupID))
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "targetGroupId가 올바르지 않습니다.", "lineIndex": intToString(i)})
				return
			}
			targetGroupID = &tid
		}
		var fromSectionID *uuid.UUID
		if line.FromSectionID != nil && strings.TrimSpace(*line.FromSectionID) != "" {
			fid, err := uuid.Parse(strings.TrimSpace(*line.FromSectionID))
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "fromSectionId가 올바르지 않습니다.", "lineIndex": intToString(i)})
				return
			}
			fromSectionID = &fid
		}

		parsedLines = append(parsedLines, parsedLine{
			SourceGroupID: sourceGroupID,
			TargetGroupID: targetGroupID,
			FromSectionID: fromSectionID,
			ToSectionID:   toSectionID,
			HeadCount:     line.HeadCount,
			LineType:      lineType,
		})
		groupOutTotal[sourceGroupID] += line.HeadCount
	}

	tx, err := h.db.Pool.Begin(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "트랜잭션 시작 실패"})
		return
	}
	defer tx.Rollback(r.Context())

	var planExists bool
	err = tx.QueryRow(r.Context(), `
		SELECT EXISTS (
			SELECT 1
			FROM schedule_work_plans swp
			WHERE swp.id = $1
			  AND COALESCE(swp.is_deleted, false) = false
			  AND (swp."farmId" IS NULL OR swp."farmId" = $2)
		)
	`, *workPlanID, farmID).Scan(&planExists)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "workPlan 검증 중 오류가 발생했습니다.", "detail": err.Error()})
		return
	}
	if !planExists {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "workPlanId가 유효하지 않습니다."})
		return
	}

	var executionSectionID interface{}
	if len(parsedLines) > 0 {
		executionSectionID = parsedLines[0].ToSectionID
	}
	executionID := uuid.New()
	_, err = tx.Exec(r.Context(), `
		INSERT INTO schedule_executions (
			id, farm_id, work_plan_id, section_id, execution_type, scheduled_date, status,
			idempotency_key, memo, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, 'move', $5, 'pending', $6, $7, NOW(), NOW())
	`, executionID, farmID, *workPlanID, executionSectionID, scheduledDate, idempotencyKey, body.Memo)
	if err != nil {
		if strings.Contains(err.Error(), "uq_schedule_executions_idempotency") || strings.Contains(err.Error(), "duplicate key value") {
			existingID, existingType, existingStatus, existingRefType, existingRefID, lookupErr := h.lookupScheduleExecutionByIdempotency(r.Context(), farmID, idempotencyKey)
			if lookupErr != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "중복 실행건 확인 중 오류가 발생했습니다.", "detail": lookupErr.Error()})
				return
			}
			if existingID != "" && existingType == "move" && existingStatus == "completed" {
				writeJSON(w, http.StatusOK, map[string]interface{}{
					"id":            existingID,
					"status":        "completed",
					"resultRefType": nullableStringOrNil(existingRefType.String),
					"resultRefId":   nullableStringOrNil(existingRefID.String),
					"message":       "이미 완료된 요청입니다.",
				})
				return
			}
			writeJSON(w, http.StatusConflict, map[string]string{"error": "중복 요청입니다. idempotencyKey를 확인해 주세요."})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "직접 완료용 실행건 생성 중 오류가 발생했습니다.", "detail": err.Error()})
		return
	}

	checkedSections := map[uuid.UUID]bool{}
	for _, line := range parsedLines {
		if _, exists := checkedSections[line.ToSectionID]; !exists {
			sectionOK, err := ensureSectionBelongsToFarmTx(r.Context(), tx, farmID, line.ToSectionID)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "toSectionId 검증 중 오류가 발생했습니다.", "detail": err.Error()})
				return
			}
			if !sectionOK {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "해당 농장에 속하지 않은 toSectionId가 포함되어 있습니다."})
				return
			}
			checkedSections[line.ToSectionID] = true
		}
		if line.FromSectionID != nil {
			if _, exists := checkedSections[*line.FromSectionID]; !exists {
				sectionOK, err := ensureSectionBelongsToFarmTx(r.Context(), tx, farmID, *line.FromSectionID)
				if err != nil {
					writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "fromSectionId 검증 중 오류가 발생했습니다.", "detail": err.Error()})
					return
				}
				if !sectionOK {
					writeJSON(w, http.StatusBadRequest, map[string]string{"error": "해당 농장에 속하지 않은 fromSectionId가 포함되어 있습니다."})
					return
				}
				checkedSections[*line.FromSectionID] = true
			}
		}
	}

	for sourceGroupID, outQty := range groupOutTotal {
		var current int32
		err := tx.QueryRow(r.Context(), `
			SELECT head_count
			FROM pig_groups
			WHERE id = $1
			  AND farm_id = $2
			  AND COALESCE(is_deleted, false) = false
			FOR UPDATE
		`, sourceGroupID, farmID).Scan(&current)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "sourceGroupId를 찾을 수 없습니다.", "groupId": sourceGroupID.String()})
			return
		}
		if current < outQty {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "이동 두수가 현재 돈군 두수를 초과합니다.", "groupId": sourceGroupID.String()})
			return
		}
	}

	eventID := uuid.New()
	movedAt := time.Now()
	_, err = tx.Exec(r.Context(), `
		INSERT INTO pig_movement_events (id, farm_id, event_type, scheduled_work_plan_id, moved_at, moved_by, memo, idempotency_key, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
	`, eventID, farmID, body.EventType, *workPlanID, movedAt, actorID, body.Memo, idempotencyKey)
	if err != nil {
		if strings.Contains(err.Error(), "uq_pig_movement_events_idempotency") || strings.Contains(err.Error(), "duplicate key value") {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "중복 요청입니다. idempotencyKey를 확인해 주세요."})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "이동 이벤트 저장 중 오류가 발생했습니다.", "detail": err.Error()})
		return
	}

	for _, line := range parsedLines {
		var sourceRootID uuid.UUID
		var sourceSectionID sql.NullString
		err := tx.QueryRow(r.Context(), `
			SELECT COALESCE(root_group_id, id), current_section_id::text
			FROM pig_groups
			WHERE id = $1
			  AND farm_id = $2
		`, line.SourceGroupID, farmID).Scan(&sourceRootID, &sourceSectionID)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "sourceGroup 정보를 조회할 수 없습니다.", "groupId": line.SourceGroupID.String()})
			return
		}

		fromSectionID := sourceSectionID
		if line.FromSectionID != nil {
			fromSectionID = sql.NullString{String: line.FromSectionID.String(), Valid: true}
		}
		if !fromSectionID.Valid {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "fromSectionId를 확정할 수 없습니다. sourceGroup의 현재 위치가 필요합니다."})
			return
		}
		fromSectionUUID, err := uuid.Parse(fromSectionID.String)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "sourceGroup의 현재 section 정보가 올바르지 않습니다."})
			return
		}

		targetGroupID := line.TargetGroupID
		if targetGroupID != nil {
			tag, err := tx.Exec(r.Context(), `
				UPDATE pig_groups
				SET head_count = head_count + $1,
					current_section_id = $2,
					status = 'active',
					updated_at = NOW()
				WHERE id = $3
				  AND farm_id = $4
				  AND COALESCE(is_deleted, false) = false
			`, line.HeadCount, line.ToSectionID, *targetGroupID, farmID)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "targetGroup 반영 중 오류가 발생했습니다.", "detail": err.Error()})
				return
			}
			if tag.RowsAffected() == 0 {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "targetGroupId를 찾을 수 없습니다."})
				return
			}
		} else {
			newTargetID := uuid.New()
			reason := "split"
			if strings.Contains(line.LineType, "merge") || body.EventType == "merge" {
				reason = "merge"
			}
			_, err = tx.Exec(r.Context(), `
				INSERT INTO pig_groups (
					id, farm_id, group_no, root_group_id, current_section_id, head_count,
					status, created_reason, parent_group_id, memo, created_at, updated_at, is_deleted
				)
				VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8, $9, NOW(), NOW(), false)
			`, newTargetID, farmID, defaultGroupNo(nil), sourceRootID, line.ToSectionID, line.HeadCount, reason, line.SourceGroupID, body.Memo)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "target 돈군 생성 중 오류가 발생했습니다.", "detail": err.Error()})
				return
			}
			targetGroupID = &newTargetID
		}

		sourceClosedStatus := "closed"
		if body.EventType == "merge" || strings.Contains(line.LineType, "merge") {
			sourceClosedStatus = "merged"
		}
		_, err = tx.Exec(r.Context(), `
			UPDATE pig_groups
			SET
				head_count = GREATEST(0, head_count - $1),
				status = CASE WHEN head_count - $1 <= 0 THEN $2 ELSE status END,
				updated_at = NOW()
			WHERE id = $3
			  AND farm_id = $4
			  AND COALESCE(is_deleted, false) = false
		`, line.HeadCount, sourceClosedStatus, line.SourceGroupID, farmID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "sourceGroup 반영 중 오류가 발생했습니다.", "detail": err.Error()})
			return
		}

		_, err = tx.Exec(r.Context(), `
			INSERT INTO pig_movement_lines (
				id, farm_id, event_id, source_group_id, target_group_id,
				from_section_id, to_section_id, head_count, line_type, created_at
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
		`, uuid.New(), farmID, eventID, line.SourceGroupID, *targetGroupID, fromSectionUUID, line.ToSectionID, line.HeadCount, line.LineType)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "이동 라인 저장 중 오류가 발생했습니다.", "detail": err.Error()})
			return
		}

		_, err = tx.Exec(r.Context(), `
			INSERT INTO section_inventory_ledger (
				id, farm_id, section_id, pig_group_id, direction, head_count, event_id, ref_type, ref_id, occurred_at, created_at
			)
			VALUES ($1, $2, $3, $4, 'OUT', $5, $6, 'movement', $6, $7, NOW())
		`, uuid.New(), farmID, fromSectionUUID, line.SourceGroupID, line.HeadCount, eventID, movedAt)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "출발 칸 원장 반영 중 오류가 발생했습니다.", "detail": err.Error()})
			return
		}
		if err := upsertSectionBalanceTx(r.Context(), tx, farmID, fromSectionUUID, -line.HeadCount); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "출발 칸 현재고 반영 중 오류가 발생했습니다.", "detail": err.Error()})
			return
		}

		_, err = tx.Exec(r.Context(), `
			INSERT INTO section_inventory_ledger (
				id, farm_id, section_id, pig_group_id, direction, head_count, event_id, ref_type, ref_id, occurred_at, created_at
			)
			VALUES ($1, $2, $3, $4, 'IN', $5, $6, 'movement', $6, $7, NOW())
		`, uuid.New(), farmID, line.ToSectionID, *targetGroupID, line.HeadCount, eventID, movedAt)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "도착 칸 원장 반영 중 오류가 발생했습니다.", "detail": err.Error()})
			return
		}
		if err := upsertSectionBalanceTx(r.Context(), tx, farmID, line.ToSectionID, line.HeadCount); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "도착 칸 현재고 반영 중 오류가 발생했습니다.", "detail": err.Error()})
			return
		}
	}

	_, err = tx.Exec(r.Context(), `
		UPDATE schedule_executions
		SET
			status = 'completed',
			completed_at = NOW(),
			completed_by = $1,
			result_ref_type = 'movement_event',
			result_ref_id = $2,
			memo = COALESCE($3, memo),
			updated_at = NOW()
		WHERE id = $4
		  AND farm_id = $5
	`, actorID, eventID, body.Memo, executionID, farmID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "실행 완료 상태 반영 중 오류가 발생했습니다.", "detail": err.Error()})
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "이동 완료 처리 중 오류가 발생했습니다."})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id":            executionID.String(),
		"status":        "completed",
		"resultRefType": "movement_event",
		"resultRefId":   eventID.String(),
		"lines":         len(parsedLines),
	})
}

func (h *Handler) lookupScheduleExecutionByIdempotency(
	ctx context.Context,
	farmID uuid.UUID,
	idempotencyKey string,
) (id string, executionType string, status string, resultRefType sql.NullString, resultRefID sql.NullString, err error) {
	err = h.db.Pool.QueryRow(ctx, `
		SELECT id::text, execution_type, status, result_ref_type, result_ref_id::text
		FROM schedule_executions
		WHERE farm_id = $1
		  AND idempotency_key = $2
		ORDER BY created_at DESC
		LIMIT 1
	`, farmID, idempotencyKey).Scan(&id, &executionType, &status, &resultRefType, &resultRefID)
	if err == pgx.ErrNoRows {
		return "", "", "", sql.NullString{}, sql.NullString{}, nil
	}
	return id, executionType, status, resultRefType, resultRefID, err
}

func ensureSectionBelongsToFarmTx(ctx context.Context, tx pgx.Tx, farmID uuid.UUID, sectionID uuid.UUID) (bool, error) {
	var exists bool
	err := tx.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM farm_sections s
			JOIN farm_rooms r ON r.id = s."roomId"
			JOIN farm_barns b ON b.id = r."barnId"
			JOIN farm_buildings bd ON bd.id = b."buildingId"
			WHERE s.id = $1
			  AND bd."farmId" = $2
		)
	`, sectionID, farmID).Scan(&exists)
	return exists, err
}

func upsertSectionBalanceTx(ctx context.Context, tx pgx.Tx, farmID uuid.UUID, sectionID uuid.UUID, delta int32) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO section_inventory_balance (farm_id, section_id, head_count, updated_at)
		VALUES ($1, $2, $3, NOW())
		ON CONFLICT (farm_id, section_id)
		DO UPDATE SET
			head_count = GREATEST(0, section_inventory_balance.head_count + EXCLUDED.head_count),
			updated_at = NOW()
	`, farmID, sectionID, delta)
	return err
}
