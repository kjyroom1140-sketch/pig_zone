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
	Kind      string                        `json:"kind"`
	EntryDate string                        `json:"entryDate"`
	Sows      []openingSowInput             `json:"sows"`
	Group     *openingSectionSaveGroupInput `json:"group"`
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
	if initializedAt.Valid {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "이미 운영이 시작된 농장입니다. 초기값 저장이 제한됩니다."})
		return
	}

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
		writeJSON(w, http.StatusConflict, map[string]string{"error": "해당 칸/스톨은 이미 초기값 저장이 완료되었습니다."})
		return
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
		"saved":      true,
		"farmId":     farmID.String(),
		"sectionId":  sectionID.String(),
		"kind":       kind,
		"entryDate":  entryDate.Format("2006-01-02"),
		"sowCount":   len(sowNos),
		"headCount":  sectionDelta - int32(len(sowNos)),
		"initialized": true,
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
