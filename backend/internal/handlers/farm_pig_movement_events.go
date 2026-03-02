package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"pig-farm-api/internal/middleware"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type pigMovementLineItem struct {
	ID            string  `json:"id"`
	EventID       string  `json:"eventId"`
	FarmID        string  `json:"farmId"`
	SourceGroupID *string `json:"sourceGroupId,omitempty"`
	TargetGroupID *string `json:"targetGroupId,omitempty"`
	FromSectionID *string `json:"fromSectionId,omitempty"`
	ToSectionID   *string `json:"toSectionId,omitempty"`
	HeadCount     int32   `json:"headCount"`
	LineType      string  `json:"lineType"`
	CreatedAt     string  `json:"createdAt"`
}

type pigMovementEventItem struct {
	ID                  string                `json:"id"`
	FarmID              string                `json:"farmId"`
	EventType           string                `json:"eventType"`
	ScheduledWorkPlanID *int32                `json:"scheduledWorkPlanId,omitempty"`
	MovedAt             string                `json:"movedAt"`
	MovedBy             *string               `json:"movedBy,omitempty"`
	Memo                *string               `json:"memo,omitempty"`
	IdempotencyKey      *string               `json:"idempotencyKey,omitempty"`
	CreatedAt           string                `json:"createdAt"`
	Lines               []pigMovementLineItem `json:"lines,omitempty"`
}

// FarmPigMovementEventsList GET /api/farms/:farmId/pig-movement-events
func (h *Handler) FarmPigMovementEventsList(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "로그인이 필요합니다."})
		return
	}
	farmID, ok := parseFarmIDParam(w, r)
	if !ok {
		return
	}
	if !h.canAccessFarmPigGroups(r.Context(), claims, farmID) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "해당 농장 데이터를 조회할 권한이 없습니다."})
		return
	}

	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT
			id::text, farm_id::text, event_type, scheduled_work_plan_id,
			moved_at, moved_by::text, memo, idempotency_key, created_at
		FROM pig_movement_events
		WHERE farm_id = $1
		ORDER BY moved_at DESC, created_at DESC
		LIMIT 300
	`, farmID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "이동 이벤트 목록을 불러오는 중 오류가 발생했습니다.", "detail": err.Error()})
		return
	}
	defer rows.Close()

	list := make([]pigMovementEventItem, 0)
	for rows.Next() {
		var (
			id, fid, eventType        string
			scheduledWorkPlanID       sql.NullInt32
			movedBy, memo, idempo     sql.NullString
			movedAt, createdAt        time.Time
		)
		if err := rows.Scan(&id, &fid, &eventType, &scheduledWorkPlanID, &movedAt, &movedBy, &memo, &idempo, &createdAt); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "이동 이벤트 목록을 불러오는 중 오류가 발생했습니다.", "detail": err.Error()})
			return
		}
		item := pigMovementEventItem{
			ID:        id,
			FarmID:    fid,
			EventType: eventType,
			MovedAt:   movedAt.Format(time.RFC3339),
			CreatedAt: createdAt.Format(time.RFC3339),
		}
		if scheduledWorkPlanID.Valid {
			v := scheduledWorkPlanID.Int32
			item.ScheduledWorkPlanID = &v
		}
		if movedBy.Valid {
			v := movedBy.String
			item.MovedBy = &v
		}
		if memo.Valid {
			v := memo.String
			item.Memo = &v
		}
		if idempo.Valid {
			v := idempo.String
			item.IdempotencyKey = &v
		}
		list = append(list, item)
	}
	writeJSON(w, http.StatusOK, list)
}

// FarmPigMovementEventsGet GET /api/farms/:farmId/pig-movement-events/:eventId
func (h *Handler) FarmPigMovementEventsGet(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "로그인이 필요합니다."})
		return
	}
	farmID, ok := parseFarmIDParam(w, r)
	if !ok {
		return
	}
	if !h.canAccessFarmPigGroups(r.Context(), claims, farmID) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "해당 농장 데이터를 조회할 권한이 없습니다."})
		return
	}
	eventID, err := uuid.Parse(chi.URLParam(r, "eventId"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 eventId입니다."})
		return
	}

	var (
		item                                   pigMovementEventItem
		scheduledWorkPlanID                    sql.NullInt32
		movedBy, memo, idempo                  sql.NullString
		movedAt, createdAt                     time.Time
	)
	err = h.db.Pool.QueryRow(r.Context(), `
		SELECT
			id::text, farm_id::text, event_type, scheduled_work_plan_id,
			moved_at, moved_by::text, memo, idempotency_key, created_at
		FROM pig_movement_events
		WHERE id = $1
		  AND farm_id = $2
	`, eventID, farmID).Scan(
		&item.ID, &item.FarmID, &item.EventType, &scheduledWorkPlanID,
		&movedAt, &movedBy, &memo, &idempo, &createdAt,
	)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "이동 이벤트를 찾을 수 없습니다."})
		return
	}
	item.MovedAt = movedAt.Format(time.RFC3339)
	item.CreatedAt = createdAt.Format(time.RFC3339)
	if scheduledWorkPlanID.Valid {
		v := scheduledWorkPlanID.Int32
		item.ScheduledWorkPlanID = &v
	}
	if movedBy.Valid {
		v := movedBy.String
		item.MovedBy = &v
	}
	if memo.Valid {
		v := memo.String
		item.Memo = &v
	}
	if idempo.Valid {
		v := idempo.String
		item.IdempotencyKey = &v
	}

	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT
			id::text, event_id::text, farm_id::text,
			source_group_id::text, target_group_id::text,
			from_section_id::text, to_section_id::text,
			head_count, line_type, created_at
		FROM pig_movement_lines
		WHERE event_id = $1
		  AND farm_id = $2
		ORDER BY created_at ASC
	`, eventID, farmID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "이동 이벤트 상세를 불러오는 중 오류가 발생했습니다.", "detail": err.Error()})
		return
	}
	defer rows.Close()

	lines := make([]pigMovementLineItem, 0)
	for rows.Next() {
		var (
			line                                 pigMovementLineItem
			source, target, fromSection, toSection sql.NullString
			createdAtLine                        time.Time
		)
		if err := rows.Scan(
			&line.ID, &line.EventID, &line.FarmID,
			&source, &target, &fromSection, &toSection,
			&line.HeadCount, &line.LineType, &createdAtLine,
		); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "이동 이벤트 상세를 불러오는 중 오류가 발생했습니다.", "detail": err.Error()})
			return
		}
		line.CreatedAt = createdAtLine.Format(time.RFC3339)
		if source.Valid {
			v := source.String
			line.SourceGroupID = &v
		}
		if target.Valid {
			v := target.String
			line.TargetGroupID = &v
		}
		if fromSection.Valid {
			v := fromSection.String
			line.FromSectionID = &v
		}
		if toSection.Valid {
			v := toSection.String
			line.ToSectionID = &v
		}
		lines = append(lines, line)
	}
	item.Lines = lines
	writeJSON(w, http.StatusOK, item)
}

// FarmPigMovementEventsCreate POST /api/farms/:farmId/pig-movement-events
func (h *Handler) FarmPigMovementEventsCreate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "로그인이 필요합니다."})
		return
	}
	farmID, ok := parseFarmIDParam(w, r)
	if !ok {
		return
	}
	if !h.canManageFarmStructure(r.Context(), claims, farmID) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "해당 농장 데이터를 관리할 권한이 없습니다."})
		return
	}

	var body struct {
		EventType           string  `json:"eventType"`
		ScheduledWorkPlanID *int32  `json:"scheduledWorkPlanId"`
		MovedAt             *string `json:"movedAt"`
		Memo                *string `json:"memo"`
		IdempotencyKey      *string `json:"idempotencyKey"`
		Lines               []struct {
			SourceGroupID *string `json:"sourceGroupId"`
			TargetGroupID *string `json:"targetGroupId"`
			FromSectionID *string `json:"fromSectionId"`
			ToSectionID   *string `json:"toSectionId"`
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

	var movedAt time.Time
	if body.MovedAt != nil && strings.TrimSpace(*body.MovedAt) != "" {
		parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(*body.MovedAt))
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "movedAt은 RFC3339 형식이어야 합니다."})
			return
		}
		movedAt = parsed
	} else {
		movedAt = time.Now()
	}

	type parsedLine struct {
		SourceGroupID interface{}
		TargetGroupID interface{}
		FromSectionID interface{}
		ToSectionID   interface{}
		HeadCount     int32
		LineType      string
	}
	parsedLines := make([]parsedLine, 0, len(body.Lines))
	for i, line := range body.Lines {
		if line.HeadCount <= 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "line headCount는 1 이상이어야 합니다.", "lineIndex": intToString(i)})
			return
		}
		lineType := strings.TrimSpace(line.LineType)
		if !isValidMovementLineType(lineType) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "lineType 값이 올바르지 않습니다.", "lineIndex": intToString(i)})
			return
		}
		pl := parsedLine{HeadCount: line.HeadCount, LineType: lineType}
		var err error
		pl.SourceGroupID, err = parseOptionalUUID(line.SourceGroupID)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "sourceGroupId가 올바르지 않습니다.", "lineIndex": intToString(i)})
			return
		}
		pl.TargetGroupID, err = parseOptionalUUID(line.TargetGroupID)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "targetGroupId가 올바르지 않습니다.", "lineIndex": intToString(i)})
			return
		}
		pl.FromSectionID, err = parseOptionalUUID(line.FromSectionID)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "fromSectionId가 올바르지 않습니다.", "lineIndex": intToString(i)})
			return
		}
		pl.ToSectionID, err = parseOptionalUUID(line.ToSectionID)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "toSectionId가 올바르지 않습니다.", "lineIndex": intToString(i)})
			return
		}
		if pl.SourceGroupID == nil && pl.TargetGroupID == nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "sourceGroupId 또는 targetGroupId 중 하나는 필요합니다.", "lineIndex": intToString(i)})
			return
		}
		parsedLines = append(parsedLines, pl)
	}

	eventID := uuid.New()
	idempotencyKey := body.IdempotencyKey
	if idempotencyKey == nil || strings.TrimSpace(*idempotencyKey) == "" {
		if s := strings.TrimSpace(r.Header.Get("Idempotency-Key")); s != "" {
			idempotencyKey = &s
		}
	}

	tx, err := h.db.Pool.Begin(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "트랜잭션 시작 실패"})
		return
	}
	defer tx.Rollback(r.Context())

	_, err = tx.Exec(r.Context(), `
		INSERT INTO pig_movement_events
			(id, farm_id, event_type, scheduled_work_plan_id, moved_at, moved_by, memo, idempotency_key, created_at)
		VALUES
			($1, $2, $3, $4, $5, $6, $7, $8, NOW())
	`, eventID, farmID, body.EventType, body.ScheduledWorkPlanID, movedAt, claims.UserID, body.Memo, idempotencyKey)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "이동 이벤트 저장 중 오류가 발생했습니다.", "detail": err.Error()})
		return
	}

	for _, line := range parsedLines {
		_, err = tx.Exec(r.Context(), `
			INSERT INTO pig_movement_lines
				(id, farm_id, event_id, source_group_id, target_group_id, from_section_id, to_section_id, head_count, line_type, created_at)
			VALUES
				($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
		`, uuid.New(), farmID, eventID, line.SourceGroupID, line.TargetGroupID, line.FromSectionID, line.ToSectionID, line.HeadCount, line.LineType)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "이동 라인 저장 중 오류가 발생했습니다.", "detail": err.Error()})
			return
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "이동 이벤트 저장 중 오류가 발생했습니다."})
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"id":    eventID.String(),
		"lines": len(parsedLines),
	})
}

func parseOptionalUUID(v *string) (interface{}, error) {
	if v == nil {
		return nil, nil
	}
	s := strings.TrimSpace(*v)
	if s == "" {
		return nil, nil
	}
	parsed, err := uuid.Parse(s)
	if err != nil {
		return nil, err
	}
	return parsed, nil
}

func isValidMovementEventType(v string) bool {
	switch v {
	case "full", "partial", "split", "merge", "entry", "shipment":
		return true
	default:
		return false
	}
}

func isValidMovementLineType(v string) bool {
	switch v {
	case "move", "split_out", "split_in", "merge_in", "merge_out", "entry", "shipment":
		return true
	default:
		return false
	}
}

func intToString(v int) string {
	return strconv.Itoa(v)
}

