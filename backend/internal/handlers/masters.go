package handlers

import (
	"net/http"
)

// FeedTypeItem for GET /api/feedTypes.
type FeedTypeItem struct {
	ID          int     `json:"id"`
	Name        string  `json:"name"`
	Manufacturer *string `json:"manufacturer"`
	TargetStage *string `json:"targetStage"`
	Description *string `json:"description"`
	Nutrients   *string `json:"nutrients"`
}

// FeedTypesList handles GET /api/feedTypes.
func (h *Handler) FeedTypesList(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT id, name, manufacturer, "targetStage", description, nutrients FROM feed_types ORDER BY "targetStage", name
	`)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "사료 데이터를 불러오는 중 오류가 발생했습니다."})
		return
	}
	defer rows.Close()
	var list []FeedTypeItem
	for rows.Next() {
		var f FeedTypeItem
		if err := rows.Scan(&f.ID, &f.Name, &f.Manufacturer, &f.TargetStage, &f.Description, &f.Nutrients); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "사료 데이터를 불러오는 중 오류가 발생했습니다."})
			return
		}
		list = append(list, f)
	}
	writeJSON(w, http.StatusOK, list)
}

// VaccineTypeItem for GET /api/vaccineTypes.
type VaccineTypeItem struct {
	ID            int     `json:"id"`
	Name          string  `json:"name"`
	TargetDisease string  `json:"targetDisease"`
	Manufacturer  *string `json:"manufacturer"`
	Method        *string `json:"method"`
}

// VaccineTypesList handles GET /api/vaccineTypes.
func (h *Handler) VaccineTypesList(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT id, name, "targetDisease", manufacturer, method FROM vaccine_types ORDER BY name
	`)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "백신 데이터를 불러오는 중 오류가 발생했습니다."})
		return
	}
	defer rows.Close()
	var list []VaccineTypeItem
	for rows.Next() {
		var v VaccineTypeItem
		if err := rows.Scan(&v.ID, &v.Name, &v.TargetDisease, &v.Manufacturer, &v.Method); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "백신 데이터를 불러오는 중 오류가 발생했습니다."})
			return
		}
		list = append(list, v)
	}
	writeJSON(w, http.StatusOK, list)
}

// DiseaseCodeItem for GET /api/diseaseCodes.
type DiseaseCodeItem struct {
	ID          int     `json:"id"`
	Code        string  `json:"code"`
	Name        string  `json:"name"`
	EnglishName *string `json:"englishName"`
}

// DiseaseCodesList handles GET /api/diseaseCodes.
func (h *Handler) DiseaseCodesList(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT id, code, name, "englishName" FROM disease_codes ORDER BY code
	`)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "질병 코드를 불러오는 중 오류가 발생했습니다."})
		return
	}
	defer rows.Close()
	var list []DiseaseCodeItem
	for rows.Next() {
		var d DiseaseCodeItem
		if err := rows.Scan(&d.ID, &d.Code, &d.Name, &d.EnglishName); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "질병 코드를 불러오는 중 오류가 발생했습니다."})
			return
		}
		list = append(list, d)
	}
	writeJSON(w, http.StatusOK, list)
}

// RoleItem for GET /api/roles.
type RoleItem struct {
	ID   int    `json:"id"`
	Code string `json:"code"`
	Name string `json:"name"`
}

// RolesList handles GET /api/roles.
func (h *Handler) RolesList(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Pool.Query(r.Context(), `SELECT id, code, name FROM roles ORDER BY id`)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "권한 목록을 불러오는 중 오류가 발생했습니다."})
		return
	}
	defer rows.Close()
	var list []RoleItem
	for rows.Next() {
		var item RoleItem
		if err := rows.Scan(&item.ID, &item.Code, &item.Name); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "권한 목록을 불러오는 중 오류가 발생했습니다."})
			return
		}
		list = append(list, item)
	}
	writeJSON(w, http.StatusOK, list)
}
