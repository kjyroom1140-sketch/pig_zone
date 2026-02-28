package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
)

// StructureTemplateItem for structure_templates.
type StructureTemplateItem struct {
	ID             int      `json:"id"`
	Name           string   `json:"name"`
	Category       string   `json:"category"`
	ThemeColor     *string  `json:"themeColor"`
	Weight         *string  `json:"weight"`
	OptimalDensity *float64 `json:"optimalDensity"`
	AgeLabel       *string  `json:"ageLabel"`
	Description    *string  `json:"description"`
	SortOrder      int      `json:"sortOrder"`
}

var hexColorPattern = regexp.MustCompile(`^#[0-9A-Fa-f]{6}$`)

func normalizeThemeColor(input *string) (*string, error) {
	if input == nil {
		return nil, nil
	}
	v := strings.TrimSpace(*input)
	if v == "" {
		return nil, nil
	}
	if !hexColorPattern.MatchString(v) {
		return nil, errors.New("invalid themeColor format")
	}
	upper := strings.ToUpper(v)
	return &upper, nil
}

func defaultThemeColorByCategory(category string) string {
	if strings.EqualFold(strings.TrimSpace(category), "support") {
		return "#94A3B8"
	}
	return "#38BDF8"
}

// StructureTemplatesList GET /api/structureTemplates
func (h *Handler) StructureTemplatesList(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT id, name, category, "themeColor", weight, "optimalDensity", "ageLabel", description, "sortOrder"
		FROM structure_templates ORDER BY category DESC, "sortOrder" ASC, id ASC
	`)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "템플릿 데이터를 불러오는 중 오류가 발생했습니다."})
		return
	}
	defer rows.Close()
	var list []StructureTemplateItem
	for rows.Next() {
		var t StructureTemplateItem
		if err := rows.Scan(&t.ID, &t.Name, &t.Category, &t.ThemeColor, &t.Weight, &t.OptimalDensity, &t.AgeLabel, &t.Description, &t.SortOrder); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "템플릿 데이터를 불러오는 중 오류가 발생했습니다."})
			return
		}
		list = append(list, t)
	}
	writeJSON(w, http.StatusOK, list)
}

// StructureTemplatesCreate POST /api/structureTemplates
// 구분(category)은 2가지로 고정. 클라이언트는 사육시설/일반시설 목록 중 어느 "추가" 버튼을 눌렀는지에 따라 production 또는 support를 보냄.
func (h *Handler) StructureTemplatesCreate(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name           string   `json:"name"`
		Category       string   `json:"category"`
		ThemeColor     *string  `json:"themeColor"`
		Weight         *string  `json:"weight"`
		OptimalDensity *float64 `json:"optimalDensity"`
		AgeLabel       *string  `json:"ageLabel"`
		Description    *string  `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	// 구분 2종만 허용. DB enum(enum_structure_templates_category)은 소문자: production, support
	body.Category = strings.TrimSpace(strings.ToLower(body.Category))
	if body.Category == "" {
		body.Category = "production"
	}
	if body.Category != "production" && body.Category != "support" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "category는 production 또는 support만 가능합니다."})
		return
	}
	themeColor, err := normalizeThemeColor(body.ThemeColor)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "themeColor는 #RRGGBB 형식이어야 합니다."})
		return
	}
	if themeColor == nil {
		v := defaultThemeColorByCategory(body.Category)
		themeColor = &v
	}
	var maxOrder *int
	_ = h.db.Pool.QueryRow(r.Context(), `SELECT MAX("sortOrder") FROM structure_templates WHERE category = $1`, body.Category).Scan(&maxOrder)
	sortOrder := 0
	if maxOrder != nil {
		sortOrder = *maxOrder + 1
	}
	var id int
	err = h.db.Pool.QueryRow(r.Context(), `
		INSERT INTO structure_templates (name, category, "themeColor", weight, "optimalDensity", "ageLabel", description, "sortOrder", "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING id
	`, body.Name, body.Category, themeColor, body.Weight, body.OptimalDensity, body.AgeLabel, body.Description, sortOrder).Scan(&id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "템플릿 추가 중 오류가 발생했습니다.", "detail": err.Error()})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"id": id, "name": body.Name, "category": body.Category, "themeColor": themeColor, "weight": body.Weight,
		"optimalDensity": body.OptimalDensity, "ageLabel": body.AgeLabel, "description": body.Description, "sortOrder": sortOrder,
	})
}

// StructureTemplatesUpdate PUT /api/structureTemplates/:id
func (h *Handler) StructureTemplatesUpdate(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 ID입니다."})
		return
	}
	var body struct {
		Name           *string  `json:"name"`
		Category       *string  `json:"category"`
		ThemeColor     *string  `json:"themeColor"`
		Weight         *string  `json:"weight"`
		OptimalDensity *float64 `json:"optimalDensity"`
		AgeLabel       *string  `json:"ageLabel"`
		Description    *string  `json:"description"`
		SortOrder      *int     `json:"sortOrder"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	var name, category string
	var themeColor, weight, ageLabel, desc *string
	var optDensity *float64
	var sortOrder int
	row := h.db.Pool.QueryRow(r.Context(), `SELECT name, category, "themeColor", weight, "optimalDensity", "ageLabel", description, "sortOrder" FROM structure_templates WHERE id = $1`, id)
	if err := row.Scan(&name, &category, &themeColor, &weight, &optDensity, &ageLabel, &desc, &sortOrder); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "템플릿을 찾을 수 없습니다."})
		return
	}
	if body.Name != nil {
		name = *body.Name
	}
	if body.Category != nil {
		category = *body.Category
	}
	if body.ThemeColor != nil {
		parsedThemeColor, parseErr := normalizeThemeColor(body.ThemeColor)
		if parseErr != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "themeColor는 #RRGGBB 형식이어야 합니다."})
			return
		}
		themeColor = parsedThemeColor
	}
	if body.Weight != nil {
		weight = body.Weight
	}
	if body.OptimalDensity != nil {
		optDensity = body.OptimalDensity
	}
	if body.AgeLabel != nil {
		ageLabel = body.AgeLabel
	}
	if body.Description != nil {
		desc = body.Description
	}
	if body.SortOrder != nil {
		sortOrder = *body.SortOrder
	}
	_, err = h.db.Pool.Exec(r.Context(), `
		UPDATE structure_templates SET name = $1, category = $2, "themeColor" = $3, weight = $4, "optimalDensity" = $5, "ageLabel" = $6, description = $7, "sortOrder" = $8, "updatedAt" = NOW() WHERE id = $9
	`, name, category, themeColor, weight, optDensity, ageLabel, desc, sortOrder, id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "템플릿 수정 중 오류가 발생했습니다."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"id": id, "name": name, "category": category, "themeColor": themeColor, "weight": weight, "optimalDensity": optDensity, "ageLabel": ageLabel, "description": desc, "sortOrder": sortOrder})
}

// StructureTemplatesDelete DELETE /api/structureTemplates/:id
func (h *Handler) StructureTemplatesDelete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 ID입니다."})
		return
	}
	var category string
	if err := h.db.Pool.QueryRow(r.Context(), `SELECT category FROM structure_templates WHERE id = $1`, id).Scan(&category); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "템플릿을 찾을 수 없습니다."})
		return
	}
	res, err := h.db.Pool.Exec(r.Context(), `DELETE FROM structure_templates WHERE id = $1`, id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "템플릿 삭제 중 오류가 발생했습니다."})
		return
	}
	if res.RowsAffected() == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "템플릿을 찾을 수 없습니다."})
		return
	}
	// 삭제 후 같은 카테고리 내 sortOrder를 0,1,2,... 로 재정렬
	rows, _ := h.db.Pool.Query(r.Context(), `SELECT id FROM structure_templates WHERE category = $1 ORDER BY "sortOrder" ASC, id ASC`, category)
	if rows != nil {
		defer rows.Close()
		var ids []int
		for rows.Next() {
			var rid int
			if err := rows.Scan(&rid); err != nil {
				break
			}
			ids = append(ids, rid)
		}
		for i, rid := range ids {
			_, _ = h.db.Pool.Exec(r.Context(), `UPDATE structure_templates SET "sortOrder" = $1, "updatedAt" = NOW() WHERE id = $2`, i, rid)
		}
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "템플릿이 삭제되었습니다."})
}

// StructureTemplatesReorder POST /api/structureTemplates/reorder
func (h *Handler) StructureTemplatesReorder(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ID        int    `json:"id"`
		Direction string `json:"direction"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	if body.Direction != "up" && body.Direction != "down" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "direction은 up 또는 down 이어야 합니다."})
		return
	}
	var category string
	var currentOrder int
	if err := h.db.Pool.QueryRow(r.Context(), `SELECT category, "sortOrder" FROM structure_templates WHERE id = $1`, body.ID).Scan(&category, &currentOrder); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "템플릿을 찾을 수 없습니다."})
		return
	}
	rows, err := h.db.Pool.Query(r.Context(), `SELECT id, "sortOrder" FROM structure_templates WHERE category = $1 ORDER BY "sortOrder" ASC, id ASC`, category)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "순서 변경 중 오류가 발생했습니다."})
		return
	}
	defer rows.Close()
	type sid struct{ id, order int }
	var siblings []sid
	for rows.Next() {
		var s sid
		if err := rows.Scan(&s.id, &s.order); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "순서 변경 중 오류가 발생했습니다."})
			return
		}
		siblings = append(siblings, s)
	}
	idx := -1
	for i, s := range siblings {
		if s.id == body.ID {
			idx = i
			break
		}
	}
	if idx < 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "같은 카테고리 내에서 항목을 찾을 수 없습니다."})
		return
	}
	swapIdx := idx - 1
	if body.Direction == "down" {
		swapIdx = idx + 1
	}
	if swapIdx < 0 || swapIdx >= len(siblings) {
		var t StructureTemplateItem
		_ = h.db.Pool.QueryRow(r.Context(), `SELECT id, name, category, "themeColor", weight, "optimalDensity", "ageLabel", description, "sortOrder" FROM structure_templates WHERE id = $1`, body.ID).
			Scan(&t.ID, &t.Name, &t.Category, &t.ThemeColor, &t.Weight, &t.OptimalDensity, &t.AgeLabel, &t.Description, &t.SortOrder)
		writeJSON(w, http.StatusOK, map[string]interface{}{"message": "이미 맨 위/맨 아래입니다.", "template": t})
		return
	}
	swapOrder := siblings[swapIdx].order
	_, _ = h.db.Pool.Exec(r.Context(), `UPDATE structure_templates SET "sortOrder" = $1, "updatedAt" = NOW() WHERE id = $2`, swapOrder, body.ID)
	_, _ = h.db.Pool.Exec(r.Context(), `UPDATE structure_templates SET "sortOrder" = $1, "updatedAt" = NOW() WHERE id = $2`, currentOrder, siblings[swapIdx].id)
	var t StructureTemplateItem
	_ = h.db.Pool.QueryRow(r.Context(), `SELECT id, name, category, "themeColor", weight, "optimalDensity", "ageLabel", description, "sortOrder" FROM structure_templates WHERE id = $1`, body.ID).
		Scan(&t.ID, &t.Name, &t.Category, &t.ThemeColor, &t.Weight, &t.OptimalDensity, &t.AgeLabel, &t.Description, &t.SortOrder)
	writeJSON(w, http.StatusOK, t)
}
