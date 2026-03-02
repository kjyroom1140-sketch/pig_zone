package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"
	"time"

	"pig-farm-api/internal/middleware"

	"github.com/google/uuid"
)

type sectionInventoryLedgerItem struct {
	ID         string  `json:"id"`
	FarmID     string  `json:"farmId"`
	SectionID  string  `json:"sectionId"`
	PigGroupID *string `json:"pigGroupId,omitempty"`
	Direction  string  `json:"direction"`
	HeadCount  int32   `json:"headCount"`
	EventID    *string `json:"eventId,omitempty"`
	RefType    string  `json:"refType"`
	RefID      *string `json:"refId,omitempty"`
	OccurredAt string  `json:"occurredAt"`
	CreatedAt  string  `json:"createdAt"`
}

type sectionInventoryBalanceItem struct {
	FarmID    string `json:"farmId"`
	SectionID string `json:"sectionId"`
	HeadCount int32  `json:"headCount"`
	UpdatedAt string `json:"updatedAt"`
}

// FarmSectionInventoryLedgerList GET /api/farms/:farmId/section-inventory/ledger
func (h *Handler) FarmSectionInventoryLedgerList(w http.ResponseWriter, r *http.Request) {
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

	limit := 500
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 && n <= 2000 {
			limit = n
		}
	}

	var rows interface {
		Next() bool
		Scan(dest ...interface{}) error
		Close()
	}
	var dbRows interface {
		Next() bool
		Scan(dest ...interface{}) error
		Close()
	}
	sectionIDRaw := strings.TrimSpace(r.URL.Query().Get("sectionId"))
	if sectionIDRaw != "" {
		sectionID, err := uuid.Parse(sectionIDRaw)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "sectionId가 올바르지 않습니다."})
			return
		}
		qRows, err := h.db.Pool.Query(r.Context(), `
			SELECT
				id::text, farm_id::text, section_id::text, pig_group_id::text,
				direction, head_count, event_id::text, ref_type, ref_id::text,
				occurred_at, created_at
			FROM section_inventory_ledger
			WHERE farm_id = $1
			  AND section_id = $2
			ORDER BY occurred_at DESC, created_at DESC
			LIMIT $3
		`, farmID, sectionID, limit)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "재고 원장 조회 중 오류가 발생했습니다.", "detail": err.Error()})
			return
		}
		dbRows = qRows
	} else {
		qRows, err := h.db.Pool.Query(r.Context(), `
			SELECT
				id::text, farm_id::text, section_id::text, pig_group_id::text,
				direction, head_count, event_id::text, ref_type, ref_id::text,
				occurred_at, created_at
			FROM section_inventory_ledger
			WHERE farm_id = $1
			ORDER BY occurred_at DESC, created_at DESC
			LIMIT $2
		`, farmID, limit)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "재고 원장 조회 중 오류가 발생했습니다.", "detail": err.Error()})
			return
		}
		dbRows = qRows
	}
	rows = dbRows
	defer rows.Close()

	list := make([]sectionInventoryLedgerItem, 0)
	for rows.Next() {
		var (
			item                               sectionInventoryLedgerItem
			pigGroupID, eventID, refID         sql.NullString
			occurredAt, createdAt              time.Time
		)
		if err := rows.Scan(
			&item.ID, &item.FarmID, &item.SectionID, &pigGroupID,
			&item.Direction, &item.HeadCount, &eventID, &item.RefType, &refID,
			&occurredAt, &createdAt,
		); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "재고 원장 조회 중 오류가 발생했습니다.", "detail": err.Error()})
			return
		}
		item.OccurredAt = occurredAt.Format(time.RFC3339)
		item.CreatedAt = createdAt.Format(time.RFC3339)
		if pigGroupID.Valid {
			v := pigGroupID.String
			item.PigGroupID = &v
		}
		if eventID.Valid {
			v := eventID.String
			item.EventID = &v
		}
		if refID.Valid {
			v := refID.String
			item.RefID = &v
		}
		list = append(list, item)
	}

	writeJSON(w, http.StatusOK, list)
}

// FarmSectionInventoryBalances GET /api/farms/:farmId/section-inventory/balances
func (h *Handler) FarmSectionInventoryBalances(w http.ResponseWriter, r *http.Request) {
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
		SELECT farm_id::text, section_id::text, head_count, updated_at
		FROM section_inventory_balance
		WHERE farm_id = $1
		ORDER BY section_id ASC
	`, farmID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "현재고 조회 중 오류가 발생했습니다.", "detail": err.Error()})
		return
	}
	defer rows.Close()

	list := make([]sectionInventoryBalanceItem, 0)
	for rows.Next() {
		var (
			item sectionInventoryBalanceItem
			updatedAt time.Time
		)
		if err := rows.Scan(&item.FarmID, &item.SectionID, &item.HeadCount, &updatedAt); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "현재고 조회 중 오류가 발생했습니다.", "detail": err.Error()})
			return
		}
		item.UpdatedAt = updatedAt.Format(time.RFC3339)
		list = append(list, item)
	}
	writeJSON(w, http.StatusOK, list)
}

