package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"pig-farm-api/internal/middleware"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type pigGroupItem struct {
	ID               string  `json:"id"`
	FarmID           string  `json:"farmId"`
	GroupNo          string  `json:"groupNo"`
	RootGroupID      *string `json:"rootGroupId,omitempty"`
	CurrentSectionID *string `json:"currentSectionId,omitempty"`
	HeadCount        int32   `json:"headCount"`
	Status           string  `json:"status"`
	CreatedReason    string  `json:"createdReason"`
	ParentGroupID    *string `json:"parentGroupId,omitempty"`
	Memo             *string `json:"memo,omitempty"`
	CreatedAt        string  `json:"createdAt"`
	UpdatedAt        string  `json:"updatedAt"`
}

// FarmPigGroupsList GET /api/farms/:farmId/pig-groups
func (h *Handler) FarmPigGroupsList(w http.ResponseWriter, r *http.Request) {
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
			id::text,
			farm_id::text,
			group_no,
			root_group_id::text,
			current_section_id::text,
			head_count,
			status,
			created_reason,
			parent_group_id::text,
			memo,
			created_at,
			updated_at
		FROM pig_groups
		WHERE farm_id = $1
		  AND COALESCE(is_deleted, false) = false
		ORDER BY created_at DESC
	`, farmID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "돈군 목록을 불러오는 중 오류가 발생했습니다.", "detail": err.Error()})
		return
	}
	defer rows.Close()

	list := make([]pigGroupItem, 0)
	for rows.Next() {
		var (
			id, fid, groupNo, status, createdReason string
			rootID, sectionID, parentID, memo       sql.NullString
			headCount                               int32
			createdAt, updatedAt                    time.Time
		)
		if err := rows.Scan(&id, &fid, &groupNo, &rootID, &sectionID, &headCount, &status, &createdReason, &parentID, &memo, &createdAt, &updatedAt); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "돈군 목록을 불러오는 중 오류가 발생했습니다.", "detail": err.Error()})
			return
		}
		item := pigGroupItem{
			ID:            id,
			FarmID:        fid,
			GroupNo:       groupNo,
			HeadCount:     headCount,
			Status:        status,
			CreatedReason: createdReason,
			CreatedAt:     createdAt.Format(time.RFC3339),
			UpdatedAt:     updatedAt.Format(time.RFC3339),
		}
		if rootID.Valid {
			v := rootID.String
			item.RootGroupID = &v
		}
		if sectionID.Valid {
			v := sectionID.String
			item.CurrentSectionID = &v
		}
		if parentID.Valid {
			v := parentID.String
			item.ParentGroupID = &v
		}
		if memo.Valid {
			v := memo.String
			item.Memo = &v
		}
		list = append(list, item)
	}
	writeJSON(w, http.StatusOK, list)
}

// FarmPigGroupsCreate POST /api/farms/:farmId/pig-groups
func (h *Handler) FarmPigGroupsCreate(w http.ResponseWriter, r *http.Request) {
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
		GroupNo          *string `json:"groupNo"`
		CurrentSectionID *string `json:"currentSectionId"`
		HeadCount        *int32  `json:"headCount"`
		Status           *string `json:"status"`
		CreatedReason    *string `json:"createdReason"`
		ParentGroupID    *string `json:"parentGroupId"`
		Memo             *string `json:"memo"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}

	groupID := uuid.New()
	groupNo := defaultGroupNo(body.GroupNo)
	headCount := int32(0)
	if body.HeadCount != nil {
		headCount = *body.HeadCount
	}
	if headCount < 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "headCount는 0 이상이어야 합니다."})
		return
	}
	status := "active"
	if body.Status != nil && strings.TrimSpace(*body.Status) != "" {
		status = strings.TrimSpace(*body.Status)
	}
	if !isValidPigGroupStatus(status) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "status 값이 올바르지 않습니다."})
		return
	}
	createdReason := "manual"
	if body.CreatedReason != nil && strings.TrimSpace(*body.CreatedReason) != "" {
		createdReason = strings.TrimSpace(*body.CreatedReason)
	}
	if !isValidCreatedReason(createdReason) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "createdReason 값이 올바르지 않습니다."})
		return
	}

	var currentSectionID interface{}
	if body.CurrentSectionID != nil && strings.TrimSpace(*body.CurrentSectionID) != "" {
		parsed, err := uuid.Parse(strings.TrimSpace(*body.CurrentSectionID))
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "currentSectionId가 올바르지 않습니다."})
			return
		}
		currentSectionID = parsed
	}

	var parentGroupID interface{}
	if body.ParentGroupID != nil && strings.TrimSpace(*body.ParentGroupID) != "" {
		parsed, err := uuid.Parse(strings.TrimSpace(*body.ParentGroupID))
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "parentGroupId가 올바르지 않습니다."})
			return
		}
		parentGroupID = parsed
	}

	var memo interface{}
	if body.Memo != nil {
		memo = *body.Memo
	}

	_, err := h.db.Pool.Exec(r.Context(), `
		INSERT INTO pig_groups (
			id, farm_id, group_no, root_group_id, current_section_id, head_count,
			status, created_reason, parent_group_id, memo, created_at, updated_at, is_deleted
		)
		VALUES ($1, $2, $3, $1, $4, $5, $6, $7, $8, $9, NOW(), NOW(), false)
	`, groupID, farmID, groupNo, currentSectionID, headCount, status, createdReason, parentGroupID, memo)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "돈군 생성 중 오류가 발생했습니다.", "detail": err.Error()})
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"id":            groupID.String(),
		"groupNo":       groupNo,
		"headCount":     headCount,
		"status":        status,
		"createdReason": createdReason,
	})
}

// FarmPigGroupsUpdate PUT /api/farms/:farmId/pig-groups/:groupId
func (h *Handler) FarmPigGroupsUpdate(w http.ResponseWriter, r *http.Request) {
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

	groupIDStr := chi.URLParam(r, "groupId")
	groupID, err := uuid.Parse(groupIDStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 groupId입니다."})
		return
	}

	var body struct {
		GroupNo          *string `json:"groupNo"`
		CurrentSectionID *string `json:"currentSectionId"`
		HeadCount        *int32  `json:"headCount"`
		Status           *string `json:"status"`
		CreatedReason    *string `json:"createdReason"`
		ParentGroupID    *string `json:"parentGroupId"`
		Memo             *string `json:"memo"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}

	if body.HeadCount != nil && *body.HeadCount < 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "headCount는 0 이상이어야 합니다."})
		return
	}
	if body.Status != nil {
		*body.Status = strings.TrimSpace(*body.Status)
		if *body.Status != "" && !isValidPigGroupStatus(*body.Status) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "status 값이 올바르지 않습니다."})
			return
		}
	}
	if body.CreatedReason != nil {
		*body.CreatedReason = strings.TrimSpace(*body.CreatedReason)
		if *body.CreatedReason != "" && !isValidCreatedReason(*body.CreatedReason) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "createdReason 값이 올바르지 않습니다."})
			return
		}
	}

	var currentSectionID interface{}
	if body.CurrentSectionID != nil && strings.TrimSpace(*body.CurrentSectionID) != "" {
		parsed, err := uuid.Parse(strings.TrimSpace(*body.CurrentSectionID))
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "currentSectionId가 올바르지 않습니다."})
			return
		}
		currentSectionID = parsed
	}
	var parentGroupID interface{}
	if body.ParentGroupID != nil && strings.TrimSpace(*body.ParentGroupID) != "" {
		parsed, err := uuid.Parse(strings.TrimSpace(*body.ParentGroupID))
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "parentGroupId가 올바르지 않습니다."})
			return
		}
		parentGroupID = parsed
	}

	res, err := h.db.Pool.Exec(r.Context(), `
		UPDATE pig_groups
		SET
			group_no = COALESCE($1, group_no),
			current_section_id = COALESCE($2, current_section_id),
			head_count = COALESCE($3, head_count),
			status = COALESCE($4, status),
			created_reason = COALESCE($5, created_reason),
			parent_group_id = COALESCE($6, parent_group_id),
			memo = COALESCE($7, memo),
			updated_at = NOW()
		WHERE id = $8
		  AND farm_id = $9
		  AND COALESCE(is_deleted, false) = false
	`,
		body.GroupNo,
		currentSectionID,
		body.HeadCount,
		body.Status,
		body.CreatedReason,
		parentGroupID,
		body.Memo,
		groupID,
		farmID,
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "돈군 수정 중 오류가 발생했습니다.", "detail": err.Error()})
		return
	}
	if res.RowsAffected() == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "해당 돈군을 찾을 수 없습니다."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"id": groupID.String()})
}

// FarmPigGroupsDelete DELETE /api/farms/:farmId/pig-groups/:groupId (soft delete)
func (h *Handler) FarmPigGroupsDelete(w http.ResponseWriter, r *http.Request) {
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

	groupIDStr := chi.URLParam(r, "groupId")
	groupID, err := uuid.Parse(groupIDStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 groupId입니다."})
		return
	}

	res, err := h.db.Pool.Exec(r.Context(), `
		UPDATE pig_groups
		SET is_deleted = true, updated_at = NOW()
		WHERE id = $1
		  AND farm_id = $2
		  AND COALESCE(is_deleted, false) = false
	`, groupID, farmID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "돈군 삭제 중 오류가 발생했습니다.", "detail": err.Error()})
		return
	}
	if res.RowsAffected() == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "해당 돈군을 찾을 수 없습니다."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true})
}

func parseFarmIDParam(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	farmIDStr := chi.URLParam(r, "farmId")
	farmID, err := uuid.Parse(farmIDStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "farmId가 올바르지 않습니다."})
		return uuid.Nil, false
	}
	return farmID, true
}

func (h *Handler) canAccessFarmPigGroups(ctx context.Context, claims *middleware.Claims, farmID uuid.UUID) bool {
	if claims.SystemRole == "super_admin" || claims.SystemRole == "system_admin" {
		return true
	}
	var exists bool
	err := h.db.Pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM user_farms
			WHERE "userId" = $1
			  AND "farmId" = $2
			  AND "isActive" = true
		)
	`, claims.UserID, farmID).Scan(&exists)
	return err == nil && exists
}

func isValidPigGroupStatus(v string) bool {
	switch v {
	case "active", "closed", "merged":
		return true
	default:
		return false
	}
}

func isValidCreatedReason(v string) bool {
	switch v {
	case "birth", "split", "manual", "merge":
		return true
	default:
		return false
	}
}

func defaultGroupNo(v *string) string {
	if v != nil {
		s := strings.TrimSpace(*v)
		if s != "" {
			return s
		}
	}
	ts := time.Now().Format("20060102-150405")
	return "PG-" + ts + "-" + uuid.NewString()[:8]
}

