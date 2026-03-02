package handlers

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"pig-farm-api/internal/middleware"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type shipmentEventItem struct {
	ID             string  `json:"id"`
	FarmID         string  `json:"farmId"`
	ShippedAt      string  `json:"shippedAt"`
	ShippedBy      *string `json:"shippedBy,omitempty"`
	Memo           *string `json:"memo,omitempty"`
	IdempotencyKey *string `json:"idempotencyKey,omitempty"`
	CreatedAt      string  `json:"createdAt"`
}

// FarmShipmentsList GET /api/farms/:farmId/shipments
func (h *Handler) FarmShipmentsList(w http.ResponseWriter, r *http.Request) {
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
		SELECT id::text, farm_id::text, shipped_at, shipped_by::text, memo, idempotency_key, created_at
		FROM shipment_events
		WHERE farm_id = $1
		ORDER BY shipped_at DESC, created_at DESC
		LIMIT 300
	`, farmID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "출하 이벤트 목록을 불러오는 중 오류가 발생했습니다.", "detail": err.Error()})
		return
	}
	defer rows.Close()

	list := make([]shipmentEventItem, 0)
	for rows.Next() {
		var (
			item                             shipmentEventItem
			shippedBy, memo, idempotencyKey *string
			shippedAt, createdAt             time.Time
		)
		if err := rows.Scan(&item.ID, &item.FarmID, &shippedAt, &shippedBy, &memo, &idempotencyKey, &createdAt); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "출하 이벤트 목록을 불러오는 중 오류가 발생했습니다.", "detail": err.Error()})
			return
		}
		item.ShippedAt = shippedAt.Format(time.RFC3339)
		item.CreatedAt = createdAt.Format(time.RFC3339)
		item.ShippedBy = shippedBy
		item.Memo = memo
		item.IdempotencyKey = idempotencyKey
		list = append(list, item)
	}
	writeJSON(w, http.StatusOK, list)
}

// FarmShipmentsCreate POST /api/farms/:farmId/shipments
func (h *Handler) FarmShipmentsCreate(w http.ResponseWriter, r *http.Request) {
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
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "해당 농장 데이터를 관리할 권한이 없습니다."})
		return
	}

	var body struct {
		ShippedAt      *string `json:"shippedAt"`
		Memo           *string `json:"memo"`
		IdempotencyKey *string `json:"idempotencyKey"`
		Lines          []struct {
			SourceGroupID string `json:"sourceGroupId"`
			SectionID     string `json:"sectionId"`
			HeadCount     int32  `json:"headCount"`
		} `json:"lines"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	if len(body.Lines) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "lines는 최소 1개 이상이어야 합니다."})
		return
	}

	shippedAt := time.Now()
	if body.ShippedAt != nil && strings.TrimSpace(*body.ShippedAt) != "" {
		parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(*body.ShippedAt))
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "shippedAt은 RFC3339 형식이어야 합니다."})
			return
		}
		shippedAt = parsed
	}
	if body.IdempotencyKey == nil || strings.TrimSpace(*body.IdempotencyKey) == "" {
		if k := strings.TrimSpace(r.Header.Get("Idempotency-Key")); k != "" {
			body.IdempotencyKey = &k
		}
	}

	type parsedLine struct {
		SourceGroupID uuid.UUID
		SectionID     uuid.UUID
		HeadCount     int32
	}
	parsedLines := make([]parsedLine, 0, len(body.Lines))
	groupOutTotal := map[uuid.UUID]int32{}
	for i, line := range body.Lines {
		sourceGroupID, err := uuid.Parse(strings.TrimSpace(line.SourceGroupID))
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "sourceGroupId가 올바르지 않습니다.", "lineIndex": intToString(i)})
			return
		}
		sectionID, err := uuid.Parse(strings.TrimSpace(line.SectionID))
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "sectionId가 올바르지 않습니다.", "lineIndex": intToString(i)})
			return
		}
		if line.HeadCount <= 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "headCount는 1 이상이어야 합니다.", "lineIndex": intToString(i)})
			return
		}
		parsedLines = append(parsedLines, parsedLine{
			SourceGroupID: sourceGroupID,
			SectionID:     sectionID,
			HeadCount:     line.HeadCount,
		})
		groupOutTotal[sourceGroupID] += line.HeadCount
	}

	tx, err := h.db.Pool.Begin(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "트랜잭션 시작 실패"})
		return
	}
	defer tx.Rollback(r.Context())

	// 동일 요청 중복 방지 + 재고 음수 방지
	for groupID, outQty := range groupOutTotal {
		var current int32
		if err := tx.QueryRow(r.Context(), `
			SELECT head_count
			FROM pig_groups
			WHERE id = $1
			  AND farm_id = $2
			  AND COALESCE(is_deleted, false) = false
			FOR UPDATE
		`, groupID, farmID).Scan(&current); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "출하 대상 돈군을 찾을 수 없습니다.", "groupId": groupID.String()})
			return
		}
		if current < outQty {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "출하 두수가 현재 돈군 두수를 초과합니다.", "groupId": groupID.String()})
			return
		}
	}

	shipmentID := uuid.New()
	_, err = tx.Exec(r.Context(), `
		INSERT INTO shipment_events (id, farm_id, shipped_at, shipped_by, memo, idempotency_key, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW())
	`, shipmentID, farmID, shippedAt, claims.UserID, body.Memo, body.IdempotencyKey)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "출하 이벤트 저장 중 오류가 발생했습니다.", "detail": err.Error()})
		return
	}

	for _, line := range parsedLines {
		lineID := uuid.New()
		_, err = tx.Exec(r.Context(), `
			INSERT INTO shipment_lines (id, event_id, farm_id, source_group_id, section_id, head_count, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, NOW())
		`, lineID, shipmentID, farmID, line.SourceGroupID, line.SectionID, line.HeadCount)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "출하 라인 저장 중 오류가 발생했습니다.", "detail": err.Error()})
			return
		}

		_, err = tx.Exec(r.Context(), `
			INSERT INTO section_inventory_ledger (id, farm_id, section_id, pig_group_id, direction, head_count, event_id, ref_type, ref_id, occurred_at, created_at)
			VALUES ($1, $2, $3, $4, 'OUT', $5, NULL, 'shipment', $6, $7, NOW())
		`, uuid.New(), farmID, line.SectionID, line.SourceGroupID, line.HeadCount, lineID, shippedAt)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "재고 원장 반영 중 오류가 발생했습니다.", "detail": err.Error()})
			return
		}
	}

	for groupID, outQty := range groupOutTotal {
		_, err = tx.Exec(r.Context(), `
			UPDATE pig_groups
			SET
				head_count = GREATEST(0, head_count - $1),
				status = CASE WHEN head_count - $1 <= 0 THEN 'closed' ELSE status END,
				updated_at = NOW()
			WHERE id = $2
			  AND farm_id = $3
			  AND COALESCE(is_deleted, false) = false
		`, outQty, groupID, farmID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "돈군 상태 반영 중 오류가 발생했습니다.", "detail": err.Error()})
			return
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "출하 처리 중 오류가 발생했습니다."})
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"id":    shipmentID.String(),
		"lines": len(parsedLines),
	})
}

// FarmShipmentGet GET /api/farms/:farmId/shipments/:shipmentId
func (h *Handler) FarmShipmentGet(w http.ResponseWriter, r *http.Request) {
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
	shipmentID, err := uuid.Parse(chi.URLParam(r, "shipmentId"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 shipmentId입니다."})
		return
	}

	type lineItem struct {
		ID            string `json:"id"`
		SourceGroupID string `json:"sourceGroupId"`
		SectionID     string `json:"sectionId"`
		HeadCount     int32  `json:"headCount"`
		CreatedAt     string `json:"createdAt"`
	}
	resp := map[string]interface{}{}
	var shippedAt, createdAt time.Time
	var id, fid string
	var shippedBy, memo, idempo *string
	if err := h.db.Pool.QueryRow(r.Context(), `
		SELECT id::text, farm_id::text, shipped_at, shipped_by::text, memo, idempotency_key, created_at
		FROM shipment_events
		WHERE id = $1
		  AND farm_id = $2
	`, shipmentID, farmID).Scan(&id, &fid, &shippedAt, &shippedBy, &memo, &idempo, &createdAt); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "출하 이벤트를 찾을 수 없습니다."})
		return
	}
	resp["event"] = map[string]interface{}{
		"id":             id,
		"farmId":         fid,
		"shippedAt":      shippedAt.Format(time.RFC3339),
		"shippedBy":      shippedBy,
		"memo":           memo,
		"idempotencyKey": idempo,
		"createdAt":      createdAt.Format(time.RFC3339),
	}

	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT id::text, source_group_id::text, section_id::text, head_count, created_at
		FROM shipment_lines
		WHERE event_id = $1
		  AND farm_id = $2
		ORDER BY created_at ASC
	`, shipmentID, farmID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "출하 라인 조회 중 오류가 발생했습니다.", "detail": err.Error()})
		return
	}
	defer rows.Close()
	lines := make([]lineItem, 0)
	for rows.Next() {
		var li lineItem
		var t time.Time
		if err := rows.Scan(&li.ID, &li.SourceGroupID, &li.SectionID, &li.HeadCount, &t); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "출하 라인 조회 중 오류가 발생했습니다.", "detail": err.Error()})
			return
		}
		li.CreatedAt = t.Format(time.RFC3339)
		lines = append(lines, li)
	}
	resp["lines"] = lines
	writeJSON(w, http.StatusOK, resp)
}

// FarmShipmentTrace GET /api/farms/:farmId/shipments/:shipmentId/trace
func (h *Handler) FarmShipmentTrace(w http.ResponseWriter, r *http.Request) {
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
	shipmentID, err := uuid.Parse(chi.URLParam(r, "shipmentId"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 shipmentId입니다."})
		return
	}

	var exists bool
	if err := h.db.Pool.QueryRow(r.Context(), `
		SELECT EXISTS(
			SELECT 1 FROM shipment_events
			WHERE id = $1 AND farm_id = $2
		)
	`, shipmentID, farmID).Scan(&exists); err != nil || !exists {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "출하 이벤트를 찾을 수 없습니다."})
		return
	}

	type lineageRow struct {
		StartGroupID    string `json:"startGroupId"`
		AncestorGroupID string `json:"ancestorGroupId"`
		Depth           int32  `json:"depth"`
	}
	lineageRows := make([]lineageRow, 0)
	lRows, err := h.db.Pool.Query(r.Context(), `
		WITH RECURSIVE
		shipped_groups AS (
			SELECT DISTINCT sl.source_group_id AS group_id
			FROM shipment_lines sl
			JOIN shipment_events se ON se.id = sl.event_id
			WHERE se.farm_id = $1
			  AND se.id = $2
		),
		lineage AS (
			SELECT
				sg.group_id AS start_group_id,
				sg.group_id AS current_group_id,
				0 AS depth
			FROM shipped_groups sg
			UNION ALL
			SELECT
				l.start_group_id,
				e.parent_group_id AS current_group_id,
				l.depth + 1 AS depth
			FROM lineage l
			JOIN pig_group_lineage_edges e
				ON e.child_group_id = l.current_group_id
			   AND e.farm_id = $1
			WHERE l.depth < 30
		)
		SELECT DISTINCT
			start_group_id::text,
			current_group_id::text,
			depth
		FROM lineage
		ORDER BY start_group_id, depth
	`, farmID, shipmentID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "계보 추적 조회 중 오류가 발생했습니다.", "detail": err.Error()})
		return
	}
	defer lRows.Close()
	for lRows.Next() {
		var row lineageRow
		if err := lRows.Scan(&row.StartGroupID, &row.AncestorGroupID, &row.Depth); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "계보 추적 조회 중 오류가 발생했습니다.", "detail": err.Error()})
			return
		}
		lineageRows = append(lineageRows, row)
	}

	type originRow struct {
		StartGroupID string  `json:"startGroupId"`
		OriginSowID  *string `json:"originSowId,omitempty"`
		FarrowingAt  string  `json:"farrowingAt"`
	}
	originRows := make([]originRow, 0)
	oRows, err := h.db.Pool.Query(r.Context(), `
		WITH RECURSIVE
		shipped_groups AS (
			SELECT DISTINCT sl.source_group_id AS group_id
			FROM shipment_lines sl
			JOIN shipment_events se ON se.id = sl.event_id
			WHERE se.farm_id = $1
			  AND se.id = $2
		),
		lineage AS (
			SELECT sg.group_id AS start_group_id, sg.group_id AS current_group_id, 0 AS depth
			FROM shipped_groups sg
			UNION ALL
			SELECT l.start_group_id, e.parent_group_id, l.depth + 1
			FROM lineage l
			JOIN pig_group_lineage_edges e
			  ON e.child_group_id = l.current_group_id
			 AND e.farm_id = $1
			WHERE l.depth < 30
		),
		origin_candidates AS (
			SELECT
				l.start_group_id::text AS start_group_id,
				fe.origin_sow_id::text AS origin_sow_id,
				fe.occurred_at AS occurred_at,
				ROW_NUMBER() OVER (
					PARTITION BY l.start_group_id
					ORDER BY fe.occurred_at ASC
				) AS rn
			FROM lineage l
			JOIN farrowing_events fe
			  ON fe.created_group_id = l.current_group_id
			 AND fe.farm_id = $1
		)
		SELECT start_group_id, origin_sow_id, occurred_at
		FROM origin_candidates
		WHERE rn = 1
		ORDER BY start_group_id
	`, farmID, shipmentID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "모돈 기원 조회 중 오류가 발생했습니다.", "detail": err.Error()})
		return
	}
	defer oRows.Close()
	for oRows.Next() {
		var (
			row originRow
			originSowID *string
			farrowingAt time.Time
		)
		if err := oRows.Scan(&row.StartGroupID, &originSowID, &farrowingAt); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "모돈 기원 조회 중 오류가 발생했습니다.", "detail": err.Error()})
			return
		}
		row.OriginSowID = originSowID
		row.FarrowingAt = farrowingAt.Format(time.RFC3339)
		originRows = append(originRows, row)
	}

	type pathRow struct {
		StartGroupID string `json:"startGroupId"`
		MovedAt      string `json:"movedAt"`
		FromSectionID *string `json:"fromSectionId,omitempty"`
		ToSectionID   *string `json:"toSectionId,omitempty"`
		HeadCount    int32  `json:"headCount"`
		LineType     string `json:"lineType"`
	}
	pathRows := make([]pathRow, 0)
	pRows, err := h.db.Pool.Query(r.Context(), `
		WITH RECURSIVE
		shipped_groups AS (
			SELECT DISTINCT sl.source_group_id AS group_id
			FROM shipment_lines sl
			JOIN shipment_events se ON se.id = sl.event_id
			WHERE se.farm_id = $1
			  AND se.id = $2
		),
		lineage AS (
			SELECT sg.group_id AS start_group_id, sg.group_id AS current_group_id, 0 AS depth
			FROM shipped_groups sg
			UNION ALL
			SELECT l.start_group_id, e.parent_group_id, l.depth + 1
			FROM lineage l
			JOIN pig_group_lineage_edges e
			  ON e.child_group_id = l.current_group_id
			 AND e.farm_id = $1
			WHERE l.depth < 30
		),
		lineage_groups AS (
			SELECT DISTINCT start_group_id, current_group_id AS group_id
			FROM lineage
		)
		SELECT
			lg.start_group_id::text,
			me.moved_at,
			ml.from_section_id::text,
			ml.to_section_id::text,
			ml.head_count,
			ml.line_type
		FROM lineage_groups lg
		JOIN pig_movement_lines ml
		  ON ml.farm_id = $1
		 AND (ml.source_group_id = lg.group_id OR ml.target_group_id = lg.group_id)
		JOIN pig_movement_events me
		  ON me.id = ml.event_id
		 AND me.farm_id = $1
		ORDER BY lg.start_group_id, me.moved_at, ml.created_at
	`, farmID, shipmentID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "이동 경로 조회 중 오류가 발생했습니다.", "detail": err.Error()})
		return
	}
	defer pRows.Close()
	for pRows.Next() {
		var (
			row pathRow
			fromSectionID, toSectionID *string
			movedAt time.Time
		)
		if err := pRows.Scan(&row.StartGroupID, &movedAt, &fromSectionID, &toSectionID, &row.HeadCount, &row.LineType); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "이동 경로 조회 중 오류가 발생했습니다.", "detail": err.Error()})
			return
		}
		row.MovedAt = movedAt.Format(time.RFC3339)
		row.FromSectionID = fromSectionID
		row.ToSectionID = toSectionID
		pathRows = append(pathRows, row)
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"shipmentId": shipmentID.String(),
		"lineage":    lineageRows,
		"origins":    originRows,
		"movementPath": pathRows,
	})
}

