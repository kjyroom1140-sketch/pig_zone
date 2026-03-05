package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type openingSowInput struct {
	SowNo     string  `json:"sowNo"`
	Status    *string `json:"status"`
	Parity    *int    `json:"parity"`
	BirthDate *string `json:"birthDate"`
	Memo      *string `json:"memo"`
}

type openingGroupInput struct {
	GroupNo       string  `json:"groupNo"`
	HeadCount     int32   `json:"headCount"`
	Status        *string `json:"status"`
	CreatedReason *string `json:"createdReason"`
	Memo          *string `json:"memo"`
}

type openingSectionInput struct {
	SectionID string              `json:"sectionId"`
	Sows      []openingSowInput   `json:"sows"`
	Groups    []openingGroupInput `json:"groups"`
}

type openingPayload struct {
	Items []openingSectionInput `json:"items"`
}

type openingSectionSaveGroupInput struct {
	HeadCount     int32   `json:"headCount"`
	BirthDate     *string `json:"birthDate"`
	AgeDays       *int    `json:"ageDays"`
	Status        *string `json:"status"`
	CreatedReason *string `json:"createdReason"`
	Memo          *string `json:"memo"`
}

type openingSectionSaveBody struct {
	Kind            string                        `json:"kind"`
	EntryDate       string                        `json:"entryDate"`
	Sows            []openingSowInput             `json:"sows"`
	Group           *openingSectionSaveGroupInput `json:"group"`
	ReplaceExisting bool                          `json:"replaceExisting"`
}

func normalizeSowStatus(v *string) string {
	if v == nil {
		return "active"
	}
	s := strings.ToLower(strings.TrimSpace(*v))
	switch s {
	case "active", "inactive", "culled", "sold":
		return s
	default:
		return "active"
	}
}

func normalizeGroupStatus(v *string) string {
	if v == nil {
		return "active"
	}
	s := strings.ToLower(strings.TrimSpace(*v))
	switch s {
	case "active", "closed", "merged":
		return s
	default:
		return "active"
	}
}

func normalizeCreatedReason(v *string) string {
	if v == nil {
		return "manual"
	}
	s := strings.ToLower(strings.TrimSpace(*v))
	switch s {
	case "birth", "split", "manual", "merge":
		return s
	default:
		return "manual"
	}
}

func parseOpeningPayload(r *http.Request) (openingPayload, error) {
	var body openingPayload
	err := json.NewDecoder(r.Body).Decode(&body)
	if err != nil {
		return openingPayload{}, err
	}
	if body.Items == nil {
		body.Items = []openingSectionInput{}
	}
	return body, nil
}

func (h *Handler) validateOpeningPayloadTx(ctx context.Context, tx pgx.Tx, farmID uuid.UUID, body openingPayload) ([]string, int32, int, int) {
	var errors []string
	var totalHeadCount int32
	totalGroups := 0
	totalSows := 0

	seenSection := map[uuid.UUID]struct{}{}
	seenSowNo := map[string]struct{}{}
	seenGroupNo := map[string]struct{}{}

	for idx, item := range body.Items {
		sectionID, err := uuid.Parse(strings.TrimSpace(item.SectionID))
		if err != nil {
			errors = append(errors, "items["+itoa(idx)+"].sectionId 형식이 올바르지 않습니다.")
			continue
		}
		if _, exists := seenSection[sectionID]; exists {
			errors = append(errors, "items["+itoa(idx)+"].sectionId가 중복되었습니다.")
		}
		seenSection[sectionID] = struct{}{}

		ok, err := ensureSectionBelongsToFarmTx(ctx, tx, farmID, sectionID)
		if err != nil || !ok {
			errors = append(errors, "items["+itoa(idx)+"].sectionId가 farm에 속하지 않습니다.")
		}

		for sIdx, sow := range item.Sows {
			sowNo := strings.TrimSpace(sow.SowNo)
			if sowNo == "" {
				errors = append(errors, "items["+itoa(idx)+"].sows["+itoa(sIdx)+"].sowNo는 필수입니다.")
				continue
			}
			key := strings.ToLower(sowNo)
			if _, exists := seenSowNo[key]; exists {
				errors = append(errors, "sowNo 중복: "+sowNo)
			}
			seenSowNo[key] = struct{}{}
			totalHeadCount += 1
			totalSows++
		}

		for gIdx, group := range item.Groups {
			groupNo := strings.TrimSpace(group.GroupNo)
			if group.HeadCount <= 0 {
				errors = append(errors, "items["+itoa(idx)+"].groups["+itoa(gIdx)+"].headCount는 1 이상이어야 합니다.")
				continue
			}
			if groupNo != "" {
				key := strings.ToLower(groupNo)
				if _, exists := seenGroupNo[key]; exists {
					errors = append(errors, "groupNo 중복: "+groupNo)
				}
				seenGroupNo[key] = struct{}{}
			}
			totalHeadCount += group.HeadCount
			totalGroups++
		}
	}
	return errors, totalHeadCount, totalSows, totalGroups
}

func generateOpeningGroupNo(farmID uuid.UUID, sectionID uuid.UUID, seq int) string {
	ts := time.Now().UTC().Format("20060102150405")
	farmPart := strings.ToUpper(strings.ReplaceAll(farmID.String(), "-", ""))
	sectionPart := strings.ToUpper(strings.ReplaceAll(sectionID.String(), "-", ""))
	if len(farmPart) > 6 {
		farmPart = farmPart[:6]
	}
	if len(sectionPart) > 6 {
		sectionPart = sectionPart[:6]
	}
	return "OP-" + farmPart + "-" + sectionPart + "-" + ts + "-" + strconv.Itoa(seq)
}

const openingAutoWorkContent = "재고두수등록(초기값)"
const openingAutoWorkContentLegacy = "[AUTO] opening 초기값 저장"

var errOpeningSectionHasNonOpeningData = errors.New("opening section has non-opening ledger data")

type openingSectionDeleteSummary struct {
	LedgerRowsDeleted            int64
	MovementLineRowsDeleted      int64
	MovementEventRowsDeleted     int64
	GroupRowsDeleted             int64
	ScheduleExecutionRowsDeleted int64
	SowRowsDetached              int64
}

func collectOpeningEventIDsTx(ctx context.Context, tx pgx.Tx, farmID uuid.UUID, sectionID uuid.UUID) ([]uuid.UUID, error) {
	rows, err := tx.Query(ctx, `
		SELECT DISTINCT event_id::text
		FROM section_inventory_ledger
		WHERE farm_id = $1
		  AND section_id = $2
		  AND ref_type = 'opening'
		  AND event_id IS NOT NULL
	`, farmID, sectionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	ids := make([]uuid.UUID, 0)
	for rows.Next() {
		var idStr string
		if err := rows.Scan(&idStr); err != nil {
			return nil, err
		}
		id, err := uuid.Parse(strings.TrimSpace(idStr))
		if err != nil {
			continue
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return ids, nil
}

func collectOpeningGroupIDsTx(ctx context.Context, tx pgx.Tx, farmID uuid.UUID, sectionID uuid.UUID) ([]uuid.UUID, error) {
	rows, err := tx.Query(ctx, `
		SELECT DISTINCT pig_group_id::text
		FROM section_inventory_ledger
		WHERE farm_id = $1
		  AND section_id = $2
		  AND ref_type = 'opening'
		  AND pig_group_id IS NOT NULL
	`, farmID, sectionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	ids := make([]uuid.UUID, 0)
	for rows.Next() {
		var idStr string
		if err := rows.Scan(&idStr); err != nil {
			return nil, err
		}
		id, err := uuid.Parse(strings.TrimSpace(idStr))
		if err != nil {
			continue
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return ids, nil
}

func recomputeSectionBalanceTx(ctx context.Context, tx pgx.Tx, farmID uuid.UUID, sectionID uuid.UUID) error {
	if !hasTableTx(ctx, tx, "section_inventory_balance") {
		return nil
	}
	var nextCount int32 = 0
	if err := tx.QueryRow(ctx, `
		SELECT COALESCE(SUM(
			CASE
				WHEN direction = 'IN' THEN head_count
				WHEN direction = 'OUT' THEN -head_count
				ELSE 0
			END
		), 0)::int
		FROM section_inventory_ledger
		WHERE farm_id = $1
		  AND section_id = $2
	`, farmID, sectionID).Scan(&nextCount); err != nil {
		return err
	}
	if nextCount < 0 {
		nextCount = 0
	}
	_, err := tx.Exec(ctx, `
		INSERT INTO section_inventory_balance (farm_id, section_id, head_count, updated_at)
		VALUES ($1, $2, $3, NOW())
		ON CONFLICT (farm_id, section_id)
		DO UPDATE SET
			head_count = EXCLUDED.head_count,
			updated_at = NOW()
	`, farmID, sectionID, nextCount)
	return err
}

func deleteOpeningSectionDataTx(ctx context.Context, tx pgx.Tx, farmID uuid.UUID, sectionID uuid.UUID) (openingSectionDeleteSummary, error) {
	summary := openingSectionDeleteSummary{}

	var hasNonOpening bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM section_inventory_ledger
			WHERE farm_id = $1
			  AND section_id = $2
			  AND ref_type <> 'opening'
		)
	`, farmID, sectionID).Scan(&hasNonOpening); err != nil {
		return summary, err
	}
	if hasNonOpening {
		return summary, errOpeningSectionHasNonOpeningData
	}

	eventIDs, err := collectOpeningEventIDsTx(ctx, tx, farmID, sectionID)
	if err != nil {
		return summary, err
	}
	groupIDs, err := collectOpeningGroupIDsTx(ctx, tx, farmID, sectionID)
	if err != nil {
		return summary, err
	}

	if hasTableTx(ctx, tx, "schedule_executions") {
		tag, err := tx.Exec(ctx, `
			DELETE FROM schedule_executions
			WHERE farm_id = $1
			  AND section_id = $2
			  AND result_ref_type = 'opening_section'
		`, farmID, sectionID)
		if err != nil {
			return summary, err
		}
		summary.ScheduleExecutionRowsDeleted = tag.RowsAffected()
	}

	tagLedger, err := tx.Exec(ctx, `
		DELETE FROM section_inventory_ledger
		WHERE farm_id = $1
		  AND section_id = $2
		  AND ref_type = 'opening'
	`, farmID, sectionID)
	if err != nil {
		return summary, err
	}
	summary.LedgerRowsDeleted = tagLedger.RowsAffected()

	if len(eventIDs) > 0 {
		tagLines, err := tx.Exec(ctx, `
			DELETE FROM pig_movement_lines
			WHERE farm_id = $1
			  AND event_id = ANY($2::uuid[])
		`, farmID, eventIDs)
		if err != nil {
			return summary, err
		}
		summary.MovementLineRowsDeleted = tagLines.RowsAffected()

		tagEvents, err := tx.Exec(ctx, `
			DELETE FROM pig_movement_events
			WHERE farm_id = $1
			  AND id = ANY($2::uuid[])
		`, farmID, eventIDs)
		if err != nil {
			return summary, err
		}
		summary.MovementEventRowsDeleted = tagEvents.RowsAffected()
	}

	if len(groupIDs) > 0 {
		tagGroups, err := tx.Exec(ctx, `
			DELETE FROM pig_groups
			WHERE farm_id = $1
			  AND id = ANY($2::uuid[])
		`, farmID, groupIDs)
		if err != nil {
			return summary, err
		}
		summary.GroupRowsDeleted = tagGroups.RowsAffected()
	}

	tagSows, err := tx.Exec(ctx, `
		UPDATE sows
		SET current_section_id = NULL,
		    updated_at = NOW()
		WHERE farm_id = $1
		  AND current_section_id = $2
	`, farmID, sectionID)
	if err != nil {
		return summary, err
	}
	summary.SowRowsDetached = tagSows.RowsAffected()

	if hasFarmSectionsBirthDateColumn(ctx, tx) {
		if _, err := tx.Exec(ctx, `
			UPDATE farm_sections
			SET "entryDate" = NULL,
			    "birthDate" = NULL,
			    "updatedAt" = NOW()
			WHERE id = $1
		`, sectionID); err != nil {
			return summary, err
		}
	} else {
		if _, err := tx.Exec(ctx, `
			UPDATE farm_sections
			SET "entryDate" = NULL,
			    "updatedAt" = NOW()
			WHERE id = $1
		`, sectionID); err != nil {
			return summary, err
		}
	}

	if err := recomputeSectionBalanceTx(ctx, tx, farmID, sectionID); err != nil {
		return summary, err
	}

	var hasAnyOpening bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM section_inventory_ledger
			WHERE farm_id = $1
			  AND ref_type = 'opening'
		)
	`, farmID).Scan(&hasAnyOpening); err != nil {
		return summary, err
	}
	if !hasAnyOpening {
		if _, err := tx.Exec(ctx, `
			UPDATE farms
			SET farm_initialized_at = NULL,
			    "updatedAt" = NOW()
			WHERE id = $1
		`, farmID); err != nil {
			return summary, err
		}
	}

	return summary, nil
}

func normalizeOpeningKind(v string) string {
	switch strings.TrimSpace(v) {
	case "breedingGestation", "farrowing", "other":
		return strings.TrimSpace(v)
	default:
		return ""
	}
}

func hasPigGroupsBirthDateColumn(ctx context.Context, tx pgx.Tx) bool {
	var exists bool
	err := tx.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM information_schema.columns
			WHERE table_name = 'pig_groups'
			  AND column_name = 'birth_date'
		)
	`).Scan(&exists)
	return err == nil && exists
}

func hasFarmSectionsBirthDateColumn(ctx context.Context, tx pgx.Tx) bool {
	var exists bool
	err := tx.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM information_schema.columns
			WHERE table_name = 'farm_sections'
			  AND column_name = 'birthDate'
		)
	`).Scan(&exists)
	return err == nil && exists
}

func hasTableTx(ctx context.Context, tx pgx.Tx, tableName string) bool {
	var exists bool
	err := tx.QueryRow(ctx, `
		SELECT to_regclass($1) IS NOT NULL
	`, "public."+tableName).Scan(&exists)
	return err == nil && exists
}

func parseOpeningGroupBirthDate(entryDate time.Time, birthDateRaw *string, ageDays *int) (*time.Time, error) {
	if birthDateRaw != nil && strings.TrimSpace(*birthDateRaw) != "" {
		d, err := parseYMD(strings.TrimSpace(*birthDateRaw))
		if err != nil {
			return nil, err
		}
		return &d, nil
	}
	if ageDays != nil {
		if *ageDays < 0 {
			return nil, sql.ErrNoRows
		}
		d := entryDate.AddDate(0, 0, -*ageDays)
		return &d, nil
	}
	return nil, nil
}

func isMoveWorkContent(v string) bool {
	s := strings.ToLower(strings.TrimSpace(v))
	if s == "" {
		return false
	}
	return strings.Contains(s, "이동") || strings.Contains(s, "move")
}

func inferExecutionTypeFromWorkContent(v string) string {
	s := strings.ToLower(strings.TrimSpace(v))
	if s == "" {
		return "inspection"
	}
	if strings.Contains(s, "이동") || strings.Contains(s, "move") {
		return "move"
	}
	if strings.Contains(s, "분만") || strings.Contains(s, "출산") || strings.Contains(s, "birth") {
		return "birth"
	}
	return "inspection"
}

func intFromCriteriaContentValue(v interface{}) (int, bool) {
	switch n := v.(type) {
	case int:
		return n, true
	case int32:
		return int(n), true
	case int64:
		return int(n), true
	case float64:
		return int(n), true
	case json.Number:
		iv, err := n.Int64()
		if err != nil {
			return 0, false
		}
		return int(iv), true
	case string:
		iv, err := strconv.Atoi(strings.TrimSpace(n))
		if err != nil {
			return 0, false
		}
		return iv, true
	default:
		return 0, false
	}
}

func stringFromCriteriaContentValue(v interface{}) (string, bool) {
	s, ok := v.(string)
	if !ok {
		return "", false
	}
	out := strings.TrimSpace(s)
	if out == "" {
		return "", false
	}
	return out, true
}

func parseCriteriaScheduledDate(criteriaContentText *string, birthDate time.Time) (time.Time, bool) {
	if criteriaContentText == nil {
		return time.Time{}, false
	}
	raw := strings.TrimSpace(*criteriaContentText)
	if raw == "" || strings.EqualFold(raw, "null") {
		return time.Time{}, false
	}

	var payload interface{}
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		return time.Time{}, false
	}

	getFromMap := func(m map[string]interface{}) (time.Time, bool) {
		t, _ := m["type"].(string)
		kind := strings.ToLower(strings.TrimSpace(t))
		if kind != "" && kind != "range" && kind != "weekend" {
			return time.Time{}, false
		}
		if d, ok := intFromCriteriaContentValue(m["start_day"]); ok {
			return birthDate.AddDate(0, 0, d), true
		}
		if d, ok := intFromCriteriaContentValue(m["startDay"]); ok {
			return birthDate.AddDate(0, 0, d), true
		}
		if d, ok := intFromCriteriaContentValue(m["end_day"]); ok {
			return birthDate.AddDate(0, 0, d), true
		}
		if d, ok := intFromCriteriaContentValue(m["endDay"]); ok {
			return birthDate.AddDate(0, 0, d), true
		}
		if d, ok := intFromCriteriaContentValue(m["day"]); ok {
			return birthDate.AddDate(0, 0, d), true
		}
		if s, ok := stringFromCriteriaContentValue(m["start_date"]); ok {
			if parsed, err := parseYMD(s); err == nil {
				return parsed, true
			}
		}
		if s, ok := stringFromCriteriaContentValue(m["startDate"]); ok {
			if parsed, err := parseYMD(s); err == nil {
				return parsed, true
			}
		}
		if s, ok := stringFromCriteriaContentValue(m["end_date"]); ok {
			if parsed, err := parseYMD(s); err == nil {
				return parsed, true
			}
		}
		if s, ok := stringFromCriteriaContentValue(m["endDate"]); ok {
			if parsed, err := parseYMD(s); err == nil {
				return parsed, true
			}
		}
		return time.Time{}, false
	}

	if m, ok := payload.(map[string]interface{}); ok {
		return getFromMap(m)
	}
	if arr, ok := payload.([]interface{}); ok {
		for _, item := range arr {
			if m, ok := item.(map[string]interface{}); ok {
				if d, ok := getFromMap(m); ok {
					return d, true
				}
			}
		}
	}
	return time.Time{}, false
}

type openingAutoPlannedExecution struct {
	WorkPlanID     int
	ScheduledDate  time.Time
	ExecutionType  string
	WorkContentRaw string
}

func collectOpeningAutoPlannedExecutionsTx(ctx context.Context, tx pgx.Tx, farmID uuid.UUID, sectionID uuid.UUID, birthDate time.Time) ([]openingAutoPlannedExecution, error) {
	var structureTemplateID sql.NullInt64
	if err := tx.QueryRow(ctx, `
		SELECT b."structureTemplateId"
		FROM farm_sections s
		JOIN farm_rooms r ON r.id = s."roomId"
		JOIN farm_barns b ON b.id = r."barnId"
		JOIN farm_buildings bd ON bd.id = b."buildingId"
		WHERE s.id = $1
		  AND bd."farmId" = $2
		LIMIT 1
	`, sectionID, farmID).Scan(&structureTemplateID); err != nil {
		return nil, err
	}
	if !structureTemplateID.Valid {
		return []openingAutoPlannedExecution{}, nil
	}

	rows, err := tx.Query(ctx, `
		SELECT id, work_content, criteria_content::text
		FROM schedule_work_plans
		WHERE COALESCE(is_deleted, false) = false
		  AND structure_template_id = $2
		  AND ("farmId" IS NULL OR "farmId" = $1)
		ORDER BY COALESCE(sort_order, 999999) ASC, id ASC
	`, farmID, int(structureTemplateID.Int64))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	plans := make([]openingAutoPlannedExecution, 0)
	for rows.Next() {
		var workPlanID int
		var workContent sql.NullString
		var criteriaContentText *string
		if err := rows.Scan(&workPlanID, &workContent, &criteriaContentText); err != nil {
			return nil, err
		}
		if !workContent.Valid {
			continue
		}
		content := strings.TrimSpace(workContent.String)
		if content == "" || strings.EqualFold(content, openingAutoWorkContent) || strings.EqualFold(content, openingAutoWorkContentLegacy) {
			continue
		}
		scheduledDate, ok := parseCriteriaScheduledDate(criteriaContentText, birthDate)
		if !ok {
			continue
		}
		plans = append(plans, openingAutoPlannedExecution{
			WorkPlanID:     workPlanID,
			ScheduledDate:  scheduledDate,
			ExecutionType:  inferExecutionTypeFromWorkContent(content),
			WorkContentRaw: content,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return plans, nil
}

func createOpeningAutoPendingExecutionsTx(
	ctx context.Context,
	tx pgx.Tx,
	farmID uuid.UUID,
	sectionID uuid.UUID,
	groupID *uuid.UUID,
	groupNo string,
	birthDate time.Time,
) (int, error) {
	plans, err := collectOpeningAutoPlannedExecutionsTx(ctx, tx, farmID, sectionID, birthDate)
	if err != nil {
		return 0, err
	}
	created := 0
	for _, plan := range plans {
		groupKey := "section:" + sectionID.String()
		if groupID != nil {
			groupKey = groupID.String()
		}
		idempotencyKey := fmt.Sprintf("opening-auto-plan-%s-%d-%s", groupKey, plan.WorkPlanID, plan.ScheduledDate.Format("20060102"))
		tag, err := tx.Exec(ctx, `
			INSERT INTO schedule_executions (
				id, farm_id, work_plan_id, section_id, execution_type, scheduled_date, status, idempotency_key, created_at, updated_at
			)
			VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, NOW(), NOW())
			ON CONFLICT DO NOTHING
		`, uuid.New(), farmID, plan.WorkPlanID, sectionID, plan.ExecutionType, plan.ScheduledDate, idempotencyKey)
		if err != nil {
			return created, err
		}
		if tag.RowsAffected() > 0 {
			created++
		}
	}
	return created, nil
}

func itoa(v int) string {
	return strconv.Itoa(v)
}

// FarmBootstrapOpeningValidate POST /api/farms/:farmId/bootstrap/opening/validate
func (h *Handler) FarmBootstrapOpeningValidate(w http.ResponseWriter, r *http.Request) {
	farmID, _, ok := h.parseFarmIDAndAuth(w, r)
	if !ok {
		return
	}
	if !h.hasFarmsInitializedAtColumn(r.Context()) {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "farm_initialized_at 컬럼이 없습니다. 마이그레이션을 먼저 적용하세요.",
		})
		return
	}

	body, err := parseOpeningPayload(r)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}

	tx, err := h.db.Pool.Begin(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "transaction begin failed"})
		return
	}
	defer tx.Rollback(r.Context())

	errors, totalHeadCount, totalSows, totalGroups := h.validateOpeningPayloadTx(r.Context(), tx, farmID, body)
	valid := len(errors) == 0

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"farmId":         farmID.String(),
		"valid":          valid,
		"errors":         errors,
		"sections":       len(body.Items),
		"totalSows":      totalSows,
		"totalGroups":    totalGroups,
		"totalHeadCount": totalHeadCount,
	})
}

// FarmBootstrapOpeningCommit POST /api/farms/:farmId/bootstrap/opening/commit
func (h *Handler) FarmBootstrapOpeningCommit(w http.ResponseWriter, r *http.Request) {
	farmID, _, ok := h.parseFarmIDAndAuth(w, r)
	if !ok {
		return
	}
	if !h.hasFarmsInitializedAtColumn(r.Context()) {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "farm_initialized_at 컬럼이 없습니다. 마이그레이션을 먼저 적용하세요.",
		})
		return
	}

	body, err := parseOpeningPayload(r)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}

	tx, err := h.db.Pool.Begin(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "transaction begin failed"})
		return
	}
	defer tx.Rollback(r.Context())

	var initializedAt sql.NullTime
	err = tx.QueryRow(r.Context(), `
		SELECT farm_initialized_at
		FROM farms
		WHERE id = $1
		FOR UPDATE
	`, farmID).Scan(&initializedAt)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "farm not found"})
		return
	}
	if initializedAt.Valid {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "이미 초기값 확정이 완료된 농장입니다."})
		return
	}

	errors, totalHeadCount, totalSows, totalGroups := h.validateOpeningPayloadTx(r.Context(), tx, farmID, body)
	if len(errors) > 0 {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{
			"error":  "opening payload validation failed",
			"errors": errors,
		})
		return
	}

	now := time.Now().UTC()
	autoSeq := 1
	for _, item := range body.Items {
		sectionID, _ := uuid.Parse(strings.TrimSpace(item.SectionID))
		var sectionDelta int32 = 0

		for _, sow := range item.Sows {
			sowNo := strings.TrimSpace(sow.SowNo)
			if sowNo == "" {
				continue
			}
			var birthDate *time.Time
			if sow.BirthDate != nil && strings.TrimSpace(*sow.BirthDate) != "" {
				if d, err := parseYMD(strings.TrimSpace(*sow.BirthDate)); err == nil {
					birthDate = &d
				}
			}

			_, err = tx.Exec(r.Context(), `
				INSERT INTO sows (id, farm_id, sow_no, current_section_id, status, parity, birth_date, memo, created_at, updated_at, is_deleted)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), false)
				ON CONFLICT (farm_id, sow_no)
				DO UPDATE SET
					current_section_id = EXCLUDED.current_section_id,
					status = EXCLUDED.status,
					parity = EXCLUDED.parity,
					birth_date = EXCLUDED.birth_date,
					memo = EXCLUDED.memo,
					is_deleted = false,
					updated_at = NOW()
			`, uuid.New(), farmID, sowNo, sectionID, normalizeSowStatus(sow.Status), sow.Parity, birthDate, sow.Memo)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "sows upsert failed: " + err.Error()})
				return
			}
			sectionDelta += 1
		}

		for _, group := range item.Groups {
			groupNo := strings.TrimSpace(group.GroupNo)
			if group.HeadCount <= 0 {
				continue
			}
			if groupNo == "" {
				groupNo = generateOpeningGroupNo(farmID, sectionID, autoSeq)
				autoSeq++
			}
			groupID := uuid.New()
			_, err = tx.Exec(r.Context(), `
				INSERT INTO pig_groups (
					id, farm_id, group_no, root_group_id, current_section_id, head_count,
					status, created_reason, parent_group_id, memo, created_at, updated_at, is_deleted
				)
				VALUES ($1, $2, $3, $1, $4, $5, $6, $7, NULL, $8, NOW(), NOW(), false)
			`, groupID, farmID, groupNo, sectionID, group.HeadCount, normalizeGroupStatus(group.Status), normalizeCreatedReason(group.CreatedReason), group.Memo)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "pig_group insert failed: " + err.Error()})
				return
			}

			_, err = tx.Exec(r.Context(), `
				INSERT INTO section_inventory_ledger (
					id, farm_id, section_id, pig_group_id, direction, head_count,
					event_id, ref_type, ref_id, occurred_at, created_at
				)
				VALUES ($1, $2, $3, $4, 'IN', $5, NULL, 'opening', $6, $7, $7)
			`, uuid.New(), farmID, sectionID, groupID, group.HeadCount, groupID, now)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "opening ledger insert failed: " + err.Error()})
				return
			}
			sectionDelta += group.HeadCount
		}

		if sectionDelta > 0 {
			if err := upsertSectionBalanceTx(r.Context(), tx, farmID, sectionID, sectionDelta); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "section balance upsert failed: " + err.Error()})
				return
			}
		}
	}

	_, err = tx.Exec(r.Context(), `
		UPDATE farms
		SET farm_initialized_at = NOW(),
		    "updatedAt" = NOW()
		WHERE id = $1
	`, farmID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "farm initialize update failed: " + err.Error()})
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "transaction commit failed: " + err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"farmId":         farmID.String(),
		"initialized":    true,
		"initializedAt":  now.Format(time.RFC3339),
		"sections":       len(body.Items),
		"totalSows":      totalSows,
		"totalGroups":    totalGroups,
		"totalHeadCount": totalHeadCount,
	})
}

// FarmBootstrapOpeningSectionSave POST /api/farms/:farmId/bootstrap/opening/sections/:sectionId/save
func (h *Handler) FarmBootstrapOpeningSectionSave(w http.ResponseWriter, r *http.Request) {
	farmID, claims, ok := h.parseFarmIDAndAuth(w, r)
	if !ok {
		return
	}
	if !h.hasFarmsInitializedAtColumn(r.Context()) {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "farm_initialized_at 컬럼이 없습니다. 마이그레이션을 먼저 적용하세요.",
		})
		return
	}
	sectionID, err := uuid.Parse(strings.TrimSpace(chi.URLParam(r, "sectionId")))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "sectionId 형식이 올바르지 않습니다."})
		return
	}
	var body openingSectionSaveBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	kind := normalizeOpeningKind(body.Kind)
	if kind == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "kind는 breedingGestation, farrowing, other 중 하나여야 합니다."})
		return
	}
	entryDate, err := parseYMD(strings.TrimSpace(body.EntryDate))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "entryDate 형식이 올바르지 않습니다. (YYYY-MM-DD)"})
		return
	}

	tx, err := h.db.Pool.Begin(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "transaction begin failed"})
		return
	}
	defer tx.Rollback(r.Context())

	okBelongs, err := ensureSectionBelongsToFarmTx(r.Context(), tx, farmID, sectionID)
	if err != nil || !okBelongs {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "sectionId가 farm에 속하지 않습니다."})
		return
	}

	var initializedAt sql.NullTime
	if err := tx.QueryRow(r.Context(), `SELECT farm_initialized_at FROM farms WHERE id = $1 FOR UPDATE`, farmID).Scan(&initializedAt); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "farm not found"})
		return
	}
	_ = initializedAt

	var hasSaved bool
	if err := tx.QueryRow(r.Context(), `
		SELECT EXISTS (
			SELECT 1
			FROM section_inventory_ledger
			WHERE farm_id = $1
			  AND section_id = $2
			  AND ref_type = 'opening'
		)
	`, farmID, sectionID).Scan(&hasSaved); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "existing opening check failed"})
		return
	}
	if hasSaved {
		if !body.ReplaceExisting {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "해당 칸/스톨은 이미 초기값 저장이 완료되었습니다. 수정 저장을 사용하세요."})
			return
		}
		if _, err := deleteOpeningSectionDataTx(r.Context(), tx, farmID, sectionID); err != nil {
			if err == errOpeningSectionHasNonOpeningData {
				writeJSON(w, http.StatusConflict, map[string]string{"error": "opening 외 이력이 존재하여 초기값 수정 저장이 불가합니다. 해당 칸 이력을 정리한 뒤 다시 시도하세요."})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "기존 초기값 정리 실패: " + err.Error()})
			return
		}
	}

	sowRequired := kind == "breedingGestation" || kind == "farrowing"
	groupRequired := kind == "farrowing" || kind == "other"
	sowNos := make([]string, 0, len(body.Sows))
	seenSows := map[string]struct{}{}
	for _, s := range body.Sows {
		no := strings.TrimSpace(s.SowNo)
		if no == "" {
			continue
		}
		k := strings.ToLower(no)
		if _, exists := seenSows[k]; exists {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "모돈번호가 중복되었습니다: " + no})
			return
		}
		seenSows[k] = struct{}{}
		sowNos = append(sowNos, no)
	}
	if sowRequired && len(sowNos) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "모돈번호는 필수입니다."})
		return
	}

	var headCount int32 = 0
	var groupBirthDate *time.Time
	if groupRequired {
		if body.Group == nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "돈군 정보(두수/출생일 또는 일령)는 필수입니다."})
			return
		}
		if body.Group.HeadCount <= 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "두수는 1 이상이어야 합니다."})
			return
		}
		headCount = body.Group.HeadCount
		if body.Group.BirthDate == nil && body.Group.AgeDays == nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "출생일 또는 일령 중 하나는 필수입니다."})
			return
		}
		if body.Group.AgeDays != nil && *body.Group.AgeDays < 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "일령은 0 이상이어야 합니다."})
			return
		}
		groupBirthDate, err = parseOpeningGroupBirthDate(entryDate, body.Group.BirthDate, body.Group.AgeDays)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "출생일/일령 형식이 올바르지 않습니다."})
			return
		}
	}

	var sectionDelta int32 = 0
	for _, sow := range body.Sows {
		sowNo := strings.TrimSpace(sow.SowNo)
		if sowNo == "" {
			continue
		}
		var birthDate *time.Time
		if sow.BirthDate != nil && strings.TrimSpace(*sow.BirthDate) != "" {
			if d, err := parseYMD(strings.TrimSpace(*sow.BirthDate)); err == nil {
				birthDate = &d
			}
		}
		if _, err := tx.Exec(r.Context(), `
			INSERT INTO sows (id, farm_id, sow_no, current_section_id, status, parity, birth_date, memo, created_at, updated_at, is_deleted)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), false)
			ON CONFLICT (farm_id, sow_no)
			DO UPDATE SET
				current_section_id = EXCLUDED.current_section_id,
				status = EXCLUDED.status,
				parity = EXCLUDED.parity,
				birth_date = EXCLUDED.birth_date,
				memo = EXCLUDED.memo,
				is_deleted = false,
				updated_at = NOW()
		`, uuid.New(), farmID, sowNo, sectionID, normalizeSowStatus(sow.Status), sow.Parity, birthDate, sow.Memo); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "sows upsert failed: " + err.Error()})
			return
		}
		sectionDelta += 1
	}

	var movementEventID *uuid.UUID
	var groupID *uuid.UUID
	var groupNo string
	if groupRequired {
		evID := uuid.New()
		groupNo = generateOpeningGroupNo(farmID, sectionID, 1)
		gid := uuid.New()
		groupID = &gid
		movementEventID = &evID

		if hasPigGroupsBirthDateColumn(r.Context(), tx) {
			if _, err := tx.Exec(r.Context(), `
				INSERT INTO pig_groups (
					id, farm_id, group_no, root_group_id, current_section_id, head_count,
					status, created_reason, parent_group_id, birth_date, memo, created_at, updated_at, is_deleted
				)
				VALUES ($1, $2, $3, $1, $4, $5, $6, $7, NULL, $8, $9, NOW(), NOW(), false)
			`, gid, farmID, groupNo, sectionID, headCount, normalizeGroupStatus(body.Group.Status), normalizeCreatedReason(body.Group.CreatedReason), groupBirthDate, body.Group.Memo); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "pig_group insert failed: " + err.Error()})
				return
			}
		} else {
			if _, err := tx.Exec(r.Context(), `
				INSERT INTO pig_groups (
					id, farm_id, group_no, root_group_id, current_section_id, head_count,
					status, created_reason, parent_group_id, memo, created_at, updated_at, is_deleted
				)
				VALUES ($1, $2, $3, $1, $4, $5, $6, $7, NULL, $8, NOW(), NOW(), false)
			`, gid, farmID, groupNo, sectionID, headCount, normalizeGroupStatus(body.Group.Status), normalizeCreatedReason(body.Group.CreatedReason), body.Group.Memo); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "pig_group insert failed: " + err.Error()})
				return
			}
		}

		var movedBy interface{} = nil
		if actorID, err := uuid.Parse(claims.UserID); err == nil {
			movedBy = actorID
		}
		if _, err := tx.Exec(r.Context(), `
			INSERT INTO pig_movement_events (id, farm_id, event_type, scheduled_work_plan_id, moved_at, moved_by, memo, idempotency_key, created_at)
			VALUES ($1, $2, 'entry', NULL, $3, $4, $5, $6, NOW())
		`, evID, farmID, entryDate, movedBy, body.Group.Memo, "opening-entry-"+sectionID.String()); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "entry movement event insert failed: " + err.Error()})
			return
		}
		if _, err := tx.Exec(r.Context(), `
			INSERT INTO pig_movement_lines (id, farm_id, event_id, source_group_id, target_group_id, from_section_id, to_section_id, head_count, line_type, created_at)
			VALUES ($1, $2, $3, NULL, $4, NULL, $5, $6, 'entry', NOW())
		`, uuid.New(), farmID, evID, gid, sectionID, headCount); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "entry movement line insert failed: " + err.Error()})
			return
		}

		if _, err := tx.Exec(r.Context(), `
			INSERT INTO section_inventory_ledger (
				id, farm_id, section_id, pig_group_id, direction, head_count,
				event_id, ref_type, ref_id, occurred_at, created_at
			)
			VALUES ($1, $2, $3, $4, 'IN', $5, $6, 'opening', $7, $8, NOW())
		`, uuid.New(), farmID, sectionID, gid, headCount, evID, gid, entryDate); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "opening ledger insert failed: " + err.Error()})
			return
		}
		sectionDelta += headCount
	}

	if len(sowNos) > 0 {
		var eventID interface{} = nil
		if movementEventID != nil {
			eventID = *movementEventID
		}
		if _, err := tx.Exec(r.Context(), `
			INSERT INTO section_inventory_ledger (
				id, farm_id, section_id, pig_group_id, direction, head_count,
				event_id, ref_type, ref_id, occurred_at, created_at
			)
			VALUES ($1, $2, $3, NULL, 'IN', $4, $5, 'opening', NULL, $6, NOW())
		`, uuid.New(), farmID, sectionID, len(sowNos), eventID, entryDate); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "opening sow ledger insert failed: " + err.Error()})
			return
		}
	}

	if sectionDelta > 0 {
		if err := upsertSectionBalanceTx(r.Context(), tx, farmID, sectionID, sectionDelta); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "section balance upsert failed: " + err.Error()})
			return
		}
	}

	if hasFarmSectionsBirthDateColumn(r.Context(), tx) {
		if _, err := tx.Exec(r.Context(), `
			UPDATE farm_sections
			SET "entryDate" = $1,
			    "birthDate" = COALESCE($2, "birthDate"),
			    "updatedAt" = NOW()
			WHERE id = $3
		`, entryDate, groupBirthDate, sectionID); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "section date update failed: " + err.Error()})
			return
		}
	} else {
		if _, err := tx.Exec(r.Context(), `
			UPDATE farm_sections
			SET "entryDate" = $1,
			    "updatedAt" = NOW()
			WHERE id = $2
		`, entryDate, sectionID); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "section date update failed: " + err.Error()})
			return
		}
	}

	var scheduleExecutionID *uuid.UUID
	autoPendingMoveCount := 0
	if hasTableTx(r.Context(), tx, "schedule_executions") && hasTableTx(r.Context(), tx, "schedule_work_plans") {
		actorID, err := uuid.Parse(claims.UserID)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "사용자 식별자가 올바르지 않습니다."})
			return
		}
		openingWorkPlanID, err := ensureOpeningAutoWorkPlanTx(r.Context(), tx, farmID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "opening용 work plan 준비에 실패했습니다: " + err.Error()})
			return
		}
		id := uuid.New()
		scheduleExecutionID = &id
		if _, err := tx.Exec(r.Context(), `
			INSERT INTO schedule_executions (
				id, farm_id, work_plan_id, section_id, execution_type, scheduled_date, status,
				completed_at, completed_by, result_ref_type, result_ref_id, idempotency_key, created_at, updated_at
			)
			VALUES ($1, $2, $3, $4, 'inspection', $5, 'completed', NOW(), $6, 'opening_section', $7, $8, NOW(), NOW())
		`, id, farmID, openingWorkPlanID, sectionID, entryDate, actorID, sectionID, "opening-section-save-"+sectionID.String()); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "schedule execution completed 반영 실패: " + err.Error()})
			return
		}
		if groupBirthDate != nil {
			autoPendingMoveCount, err = createOpeningAutoPendingExecutionsTx(r.Context(), tx, farmID, sectionID, groupID, groupNo, *groupBirthDate)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "opening 기준 후속 예정 생성 실패: " + err.Error()})
				return
			}
		}
	}

	if _, err := tx.Exec(r.Context(), `
		UPDATE farms
		SET farm_initialized_at = COALESCE(farm_initialized_at, NOW()),
		    "updatedAt" = NOW()
		WHERE id = $1
	`, farmID); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "farm initialize update failed: " + err.Error()})
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "transaction commit failed: " + err.Error()})
		return
	}

	resp := map[string]interface{}{
		"saved":       true,
		"farmId":      farmID.String(),
		"sectionId":   sectionID.String(),
		"kind":        kind,
		"entryDate":   entryDate.Format("2006-01-02"),
		"sowCount":    len(sowNos),
		"headCount":   sectionDelta - int32(len(sowNos)),
		"initialized": true,
	}
	if scheduleExecutionID != nil {
		resp["scheduleExecutionId"] = scheduleExecutionID.String()
	}
	if autoPendingMoveCount > 0 {
		resp["autoPendingMoveCount"] = autoPendingMoveCount
	}
	if groupID != nil {
		resp["groupId"] = groupID.String()
		resp["groupNo"] = groupNo
	}
	if groupBirthDate != nil {
		resp["birthDate"] = groupBirthDate.Format("2006-01-02")
	}
	writeJSON(w, http.StatusOK, resp)
}

// FarmBootstrapOpeningSectionDelete DELETE /api/farms/:farmId/bootstrap/opening/sections/:sectionId
func (h *Handler) FarmBootstrapOpeningSectionDelete(w http.ResponseWriter, r *http.Request) {
	farmID, _, ok := h.parseFarmIDAndAuth(w, r)
	if !ok {
		return
	}
	sectionID, err := uuid.Parse(strings.TrimSpace(chi.URLParam(r, "sectionId")))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "sectionId 형식이 올바르지 않습니다."})
		return
	}

	tx, err := h.db.Pool.Begin(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "transaction begin failed"})
		return
	}
	defer tx.Rollback(r.Context())

	okBelongs, err := ensureSectionBelongsToFarmTx(r.Context(), tx, farmID, sectionID)
	if err != nil || !okBelongs {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "sectionId가 farm에 속하지 않습니다."})
		return
	}

	summary, err := deleteOpeningSectionDataTx(r.Context(), tx, farmID, sectionID)
	if err != nil {
		if err == errOpeningSectionHasNonOpeningData {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "opening 외 이력이 존재하여 초기값 삭제가 불가합니다. 해당 칸 이력을 정리한 뒤 다시 시도하세요."})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "초기값 삭제 실패: " + err.Error()})
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "transaction commit failed: " + err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"deleted":                      true,
		"farmId":                       farmID.String(),
		"sectionId":                    sectionID.String(),
		"ledgerRowsDeleted":            summary.LedgerRowsDeleted,
		"movementLineRowsDeleted":      summary.MovementLineRowsDeleted,
		"movementEventRowsDeleted":     summary.MovementEventRowsDeleted,
		"groupRowsDeleted":             summary.GroupRowsDeleted,
		"scheduleExecutionRowsDeleted": summary.ScheduleExecutionRowsDeleted,
		"sowRowsDetached":              summary.SowRowsDetached,
	})
}

func ensureOpeningAutoWorkPlanTx(ctx context.Context, tx pgx.Tx, farmID uuid.UUID) (int, error) {
	var workPlanID int
	err := tx.QueryRow(ctx, `
		SELECT id
		FROM schedule_work_plans
		WHERE "farmId" = $1
		  AND COALESCE(is_deleted, false) = false
		  AND work_content IN ($2, $3)
		ORDER BY id ASC
		LIMIT 1
	`, farmID, openingAutoWorkContent, openingAutoWorkContentLegacy).Scan(&workPlanID)
	if err == nil {
		_, _ = tx.Exec(ctx, `
			UPDATE schedule_work_plans
			SET work_content = $1,
			    "updatedAt" = NOW()
			WHERE id = $2
			  AND work_content <> $1
		`, openingAutoWorkContent, workPlanID)
		return workPlanID, nil
	}
	if err != pgx.ErrNoRows {
		return 0, err
	}

	var nextOrder int
	if err := tx.QueryRow(ctx, `
		SELECT COALESCE(MIN(sort_order), 0) - 1
		FROM schedule_work_plans
		WHERE ("farmId" = $1 OR "farmId" IS NULL)
		  AND COALESCE(is_deleted, false) = false
	`, farmID).Scan(&nextOrder); err != nil {
		return 0, err
	}

	err = tx.QueryRow(ctx, `
		INSERT INTO schedule_work_plans (
			"farmId", structure_template_id, sortation_id, jobtype_id, criteria_id,
			criteria_content, work_content, sort_order, is_deleted, "createdAt", "updatedAt"
		)
		VALUES ($1, NULL, NULL, NULL, NULL, NULL, $2, $3, false, NOW(), NOW())
		RETURNING id
	`, farmID, openingAutoWorkContent, nextOrder).Scan(&workPlanID)
	if err != nil {
		return 0, err
	}
	return workPlanID, nil
}
