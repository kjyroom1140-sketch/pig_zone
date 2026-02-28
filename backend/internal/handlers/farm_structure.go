package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"

	"pig-farm-api/internal/middleware"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// FarmStructureProductionList GET /api/farm-structure/:farmId/production
func (h *Handler) FarmStructureProductionList(w http.ResponseWriter, r *http.Request) {
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
	if !h.canManageFarmStructure(r.Context(), claims, farmID) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "농장 구조를 관리할 권한이 없습니다."})
		return
	}
	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT id::text, "templateId", name, weight, "optimalDensity", description
		FROM farm_structure WHERE "farmId" = $1 AND LOWER(category::text) = 'production'
		ORDER BY id ASC
	`, farmID)
	if err != nil {
		log.Printf("[farm_structure] GET production list error: %v", err)
		writeJSON(w, http.StatusOK, []struct {
			ID             string   `json:"id"`
			TemplateID     int      `json:"templateId"`
			Name           string   `json:"name"`
			Weight         *string  `json:"weight"`
			OptimalDensity *float64 `json:"optimalDensity"`
			Description    *string  `json:"description"`
		}{})
		return
	}
	defer rows.Close()
	type item struct {
		ID             string   `json:"id"`
		TemplateID     int      `json:"templateId"`
		Name           string   `json:"name"`
		Weight         *string  `json:"weight"`
		OptimalDensity *float64 `json:"optimalDensity"`
		Description    *string  `json:"description"`
	}
	var list []item
	for rows.Next() {
		var id string
		var t item
		if err := rows.Scan(&id, &t.TemplateID, &t.Name, &t.Weight, &t.OptimalDensity, &t.Description); err != nil {
			log.Printf("[farm_structure] GET production scan error: %v", err)
			writeJSON(w, http.StatusOK, []item{})
			return
		}
		t.ID = id
		list = append(list, t)
	}
	writeJSON(w, http.StatusOK, list)
}

// FarmStructureProductionSave POST /api/farm-structure/:farmId/production (body: { templateIds: number[] })
func (h *Handler) FarmStructureProductionSave(w http.ResponseWriter, r *http.Request) {
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
	if !h.canManageFarmStructure(r.Context(), claims, farmID) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "농장 구조를 관리할 권한이 없습니다."})
		return
	}
	var body struct {
		TemplateIDs []int `json:"templateIds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 데이터 형식입니다."})
		return
	}
	if body.TemplateIDs == nil {
		body.TemplateIDs = []int{}
	}
	tx, err := h.db.Pool.Begin(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "농장 구조 저장 중 오류가 발생했습니다."})
		return
	}
	defer tx.Rollback(r.Context())
	_, err = tx.Exec(r.Context(), `DELETE FROM farm_structure WHERE "farmId" = $1 AND LOWER(category::text) = 'production'`, farmID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "농장 구조 저장 중 오류가 발생했습니다."})
		return
	}
	if len(body.TemplateIDs) > 0 {
		rows, err := tx.Query(r.Context(), `
			SELECT id, name, category, weight, "optimalDensity", description FROM structure_templates WHERE id = ANY($1::int[]) AND LOWER(category::text) = 'production'
		`, body.TemplateIDs)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "농장 구조 저장 중 오류가 발생했습니다."})
			return
		}
		var templates []struct {
			ID             int
			Name           string
			Category       string
			Weight         *string
			OptimalDensity *float64
			Description    *string
		}
		for rows.Next() {
			var t struct {
				ID             int
				Name           string
				Category       string
				Weight         *string
				OptimalDensity *float64
				Description    *string
			}
			if err := rows.Scan(&t.ID, &t.Name, &t.Category, &t.Weight, &t.OptimalDensity, &t.Description); err != nil {
				rows.Close()
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "농장 구조 저장 중 오류가 발생했습니다."})
				return
			}
			templates = append(templates, t)
		}
		rows.Close()
		for _, t := range templates {
			_, err = tx.Exec(r.Context(), `
				INSERT INTO farm_structure ("farmId", "templateId", category, name, weight, "optimalDensity", description, "createdAt", "updatedAt")
				VALUES ($1, $2, 'production', $3, $4, $5, $6, NOW(), NOW())
			`, farmID, t.ID, t.Name, t.Weight, t.OptimalDensity, t.Description)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "농장 구조 저장 중 오류가 발생했습니다."})
				return
			}
		}
	}
	if err := tx.Commit(r.Context()); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "농장 구조 저장 중 오류가 발생했습니다."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "농장 구조가 성공적으로 저장되었습니다."})
}

func (h *Handler) canManageFarmStructure(ctx context.Context, claims *middleware.Claims, farmID uuid.UUID) bool {
	if claims.SystemRole == "super_admin" || claims.SystemRole == "system_admin" {
		return true
	}
	var role string
	err := h.db.Pool.QueryRow(ctx, `SELECT role FROM user_farms WHERE "userId" = $1 AND "farmId" = $2 AND "isActive" = true`, claims.UserID, farmID).Scan(&role)
	return err == nil && (role == "farm_admin" || role == "manager")
}
