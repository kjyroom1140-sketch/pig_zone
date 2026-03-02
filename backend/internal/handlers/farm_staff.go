package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"pig-farm-api/internal/middleware"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// FarmStaffList GET /api/farms/:farmId/staff
func (h *Handler) FarmStaffList(w http.ResponseWriter, r *http.Request) {
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
	if !h.canManageFarmStaff(r.Context(), claims, farmID) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "해당 농장의 직원을 관리할 권한이 없습니다."})
		return
	}
	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT uf.id, uf."userId", u.username, u."fullName", u.email, u.phone, u."systemRole", uf.role, uf.department, uf.position,
		       uf."employmentType", uf."hireDate", uf."resignDate", uf."isActive"
		FROM user_farms uf
		JOIN users u ON u.id = uf."userId"
		WHERE uf."farmId" = $1 AND uf."isActive" = true AND u."systemRole" NOT IN ('super_admin', 'system_admin')
		ORDER BY uf."createdAt" ASC
	`, farmID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "직원 목록을 불러오는 중 오류가 발생했습니다."})
		return
	}
	defer rows.Close()
	type staffRow struct {
		UserFarmID    string  `json:"userFarmId"`
		UserID        string  `json:"userId"`
		Username      *string `json:"username"`
		FullName      *string `json:"fullName"`
		Email         *string `json:"email"`
		Phone         *string `json:"phone"`
		Role          string  `json:"role"`
		Department    *string `json:"department"`
		Position      *string `json:"position"`
		EmploymentType *string `json:"employmentType"`
		HireDate      *string `json:"hireDate"`
		ResignDate    *string `json:"resignDate"`
		IsActive      bool   `json:"isActive"`
	}
	var list []staffRow
	for rows.Next() {
		var ufID, uID uuid.UUID
		var username, fullName, email, phone interface{}
		var systemRole string
		var role string
		var dept, pos, empType, hireDate, resignDate interface{}
		var isActive bool
		if err := rows.Scan(&ufID, &uID, &username, &fullName, &email, &phone, &systemRole, &role, &dept, &pos, &empType, &hireDate, &resignDate, &isActive); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "직원 목록을 불러오는 중 오류가 발생했습니다."})
			return
		}
		s := staffRow{UserFarmID: ufID.String(), UserID: uID.String(), Role: role, IsActive: isActive}
		if v, ok := username.(string); ok {
			s.Username = &v
		}
		if v, ok := fullName.(string); ok {
			s.FullName = &v
		}
		if v, ok := email.(string); ok {
			s.Email = &v
		}
		if v, ok := phone.(string); ok {
			s.Phone = &v
		}
		if v, ok := dept.(string); ok {
			s.Department = &v
		}
		if v, ok := pos.(string); ok {
			s.Position = &v
		}
		if v, ok := empType.(string); ok {
			s.EmploymentType = &v
		}
		if v, ok := hireDate.(string); ok {
			s.HireDate = &v
		}
		if v, ok := resignDate.(string); ok {
			s.ResignDate = &v
		}
		list = append(list, s)
	}
	writeJSON(w, http.StatusOK, list)
}

// FarmStaffCreate POST /api/farms/:farmId/staff (new user + user_farm)
func (h *Handler) FarmStaffCreate(w http.ResponseWriter, r *http.Request) {
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
	if !h.canManageFarmStaff(r.Context(), claims, farmID) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "해당 농장의 직원을 관리할 권한이 없습니다."})
		return
	}
	var body struct {
		Account struct {
			Username  string  `json:"username"`
			Password  string  `json:"password"`
			FullName  string  `json:"fullName"`
			Phone     *string `json:"phone"`
			Email     *string `json:"email"`
		} `json:"account"`
		Staff struct {
			Role           *string `json:"role"`
			Department     *string `json:"department"`
			Position       *string `json:"position"`
			EmploymentType *string `json:"employmentType"`
			HireDate       *string `json:"hireDate"`
		} `json:"staff"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	if body.Account.Username == "" || body.Account.Password == "" || body.Account.FullName == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "계정 정보(아이디, 비밀번호, 이름)는 필수입니다."})
		return
	}
	var exists int
	if err := h.db.Pool.QueryRow(r.Context(), `SELECT 1 FROM users WHERE username = $1`, body.Account.Username).Scan(&exists); err == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "이미 사용 중인 아이디입니다."})
		return
	}
	userID := uuid.New()
	_, err = h.db.Pool.Exec(r.Context(), `
		INSERT INTO users (id, username, password, "fullName", phone, email, "systemRole", "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, $5, $6, 'user', NOW(), NOW())
	`, userID, body.Account.Username, body.Account.Password, body.Account.FullName, body.Account.Phone, body.Account.Email)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "직원 등록 중 오류가 발생했습니다."})
		return
	}
	role := "staff"
	if body.Staff.Role != nil {
		role = *body.Staff.Role
	}
	if role == "farm_admin" {
		exists, checkErr := h.hasActiveFarmAdmin(r.Context(), farmID, nil)
		if checkErr != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "직원 등록 중 오류가 발생했습니다."})
			return
		}
		if exists {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "농장관리자는 농장당 1명만 등록할 수 있습니다."})
			return
		}
	}
	empType := "full_time"
	if body.Staff.EmploymentType != nil {
		empType = *body.Staff.EmploymentType
	}
	userFarmID := uuid.New()
	_, err = h.db.Pool.Exec(r.Context(), `
		INSERT INTO user_farms (id, "userId", "farmId", role, department, position, "employmentType", "hireDate", "assignedBy", "assignedAt", "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW(), NOW())
	`, userFarmID, userID, farmID, role, body.Staff.Department, body.Staff.Position, empType, body.Staff.HireDate, claims.UserID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "직원 등록 중 오류가 발생했습니다."})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]interface{}{"user": map[string]interface{}{"id": userID.String(), "username": body.Account.Username, "fullName": body.Account.FullName}, "userFarm": map[string]interface{}{"id": userFarmID.String()}})
}

// FarmStaffUpdate PUT /api/farms/:farmId/staff/:userFarmId
func (h *Handler) FarmStaffUpdate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "로그인이 필요합니다."})
		return
	}
	farmIDStr := chi.URLParam(r, "farmId")
	userFarmIDStr := chi.URLParam(r, "userFarmId")
	farmID, _ := uuid.Parse(farmIDStr)
	userFarmID, err := uuid.Parse(userFarmIDStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	if !h.canManageFarmStaff(r.Context(), claims, farmID) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "해당 농장의 직원을 관리할 권한이 없습니다."})
		return
	}
	var body struct {
		User  *struct {
			FullName *string `json:"fullName"`
			Phone   *string `json:"phone"`
			Email   *string `json:"email"`
		} `json:"user"`
		Staff *struct {
			Role           *string `json:"role"`
			Department     *string `json:"department"`
			Position       *string `json:"position"`
			EmploymentType *string `json:"employmentType"`
			HireDate       *string `json:"hireDate"`
			ResignDate     *string `json:"resignDate"`
		} `json:"staff"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	var userId uuid.UUID
	var currentRole string
	if err := h.db.Pool.QueryRow(r.Context(), `SELECT "userId", role FROM user_farms WHERE id = $1 AND "farmId" = $2 AND "isActive" = true`, userFarmID, farmID).Scan(&userId, &currentRole); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "해당 농장의 직원 정보를 찾을 수 없습니다."})
		return
	}
	if body.Staff != nil {
		if body.Staff.Role != nil && *body.Staff.Role == "farm_admin" && currentRole != "farm_admin" {
			exists, checkErr := h.hasActiveFarmAdmin(r.Context(), farmID, &userFarmID)
			if checkErr != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "수정 중 오류가 발생했습니다."})
				return
			}
			if exists {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "농장관리자는 농장당 1명만 등록할 수 있습니다."})
				return
			}
		}
		_, _ = h.db.Pool.Exec(r.Context(), `UPDATE user_farms SET role = COALESCE($1, role), department = $2, position = $3, "employmentType" = COALESCE($4, "employmentType"), "hireDate" = $5, "resignDate" = $6, "updatedAt" = NOW() WHERE id = $7`,
			body.Staff.Role, body.Staff.Department, body.Staff.Position, body.Staff.EmploymentType, body.Staff.HireDate, body.Staff.ResignDate, userFarmID)
	}
	if body.User != nil {
		_, _ = h.db.Pool.Exec(r.Context(), `UPDATE users SET "fullName" = COALESCE($1, "fullName"), phone = $2, email = $3, "updatedAt" = NOW() WHERE id = $4`,
			body.User.FullName, body.User.Phone, body.User.Email, userId)
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "수정되었습니다."})
}

// FarmStaffDelete DELETE /api/farms/:farmId/staff/:userFarmId (soft: isActive=false)
func (h *Handler) FarmStaffDelete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "로그인이 필요합니다."})
		return
	}
	farmIDStr := chi.URLParam(r, "farmId")
	userFarmIDStr := chi.URLParam(r, "userFarmId")
	farmID, _ := uuid.Parse(farmIDStr)
	userFarmID, err := uuid.Parse(userFarmIDStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	if !h.canManageFarmStaff(r.Context(), claims, farmID) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "해당 농장의 직원을 관리할 권한이 없습니다."})
		return
	}
	res, err := h.db.Pool.Exec(r.Context(), `UPDATE user_farms SET "isActive" = false, "resignDate" = COALESCE("resignDate", CURRENT_DATE::text), "updatedAt" = NOW() WHERE id = $1 AND "farmId" = $2`, userFarmID, farmID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "직원 삭제 처리 중 오류가 발생했습니다."})
		return
	}
	if res.RowsAffected() == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "해당 농장의 직원 정보를 찾을 수 없습니다."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "message": "퇴사 처리되었습니다."})
}

// FarmStaffLink POST /api/farms/:farmId/staff/link (existing user to farm)
func (h *Handler) FarmStaffLink(w http.ResponseWriter, r *http.Request) {
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
	if !h.canManageFarmStaff(r.Context(), claims, farmID) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "해당 농장의 직원을 관리할 권한이 없습니다."})
		return
	}
	var body struct {
		UserID         string  `json:"userId"`
		Role           *string `json:"role"`
		Department     *string `json:"department"`
		Position       *string `json:"position"`
		EmploymentType *string `json:"employmentType"`
		HireDate       *string `json:"hireDate"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	if body.UserID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "userId는 필수입니다."})
		return
	}
	userID, err := uuid.Parse(body.UserID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "userId가 올바르지 않습니다."})
		return
	}
	var exists int
	if err := h.db.Pool.QueryRow(r.Context(), `SELECT 1 FROM users WHERE id = $1`, userID).Scan(&exists); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "해당 사용자를 찾을 수 없습니다."})
		return
	}
	if err := h.db.Pool.QueryRow(r.Context(), `SELECT 1 FROM user_farms WHERE "userId" = $1 AND "farmId" = $2`, userID, farmID).Scan(&exists); err == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "이미 이 농장에 등록된 직원입니다."})
		return
	}
	role := "staff"
	if body.Role != nil {
		role = *body.Role
	}
	if role == "farm_admin" {
		exists, checkErr := h.hasActiveFarmAdmin(r.Context(), farmID, nil)
		if checkErr != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "기존 직원을 이 농장에 추가하는 중 오류가 발생했습니다."})
			return
		}
		if exists {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "농장관리자는 농장당 1명만 등록할 수 있습니다."})
			return
		}
	}
	empType := "full_time"
	if body.EmploymentType != nil {
		empType = *body.EmploymentType
	}
	userFarmID := uuid.New()
	_, err = h.db.Pool.Exec(r.Context(), `
		INSERT INTO user_farms (id, "userId", "farmId", role, department, position, "employmentType", "hireDate", "assignedBy", "assignedAt", "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW(), NOW())
	`, userFarmID, userID, farmID, role, body.Department, body.Position, empType, body.HireDate, claims.UserID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "기존 직원을 이 농장에 추가하는 중 오류가 발생했습니다."})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]interface{}{"userFarm": map[string]interface{}{"id": userFarmID.String()}})
}

// canManageFarmStaff: super_admin/system_admin or farm_admin of this farm
func (h *Handler) canManageFarmStaff(ctx context.Context, claims *middleware.Claims, farmID uuid.UUID) bool {
	if claims.SystemRole == "super_admin" || claims.SystemRole == "system_admin" {
		return true
	}
	var role string
	err := h.db.Pool.QueryRow(ctx, `SELECT role FROM user_farms WHERE "userId" = $1 AND "farmId" = $2 AND "isActive" = true`, claims.UserID, farmID).Scan(&role)
	return err == nil && role == "farm_admin"
}

func (h *Handler) hasActiveFarmAdmin(ctx context.Context, farmID uuid.UUID, excludeUserFarmID *uuid.UUID) (bool, error) {
	var exists bool
	var exclude interface{}
	if excludeUserFarmID != nil {
		exclude = *excludeUserFarmID
	}
	err := h.db.Pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM user_farms
			WHERE "farmId" = $1
			  AND "isActive" = true
			  AND role = 'farm_admin'
			  AND ($2::uuid IS NULL OR id <> $2)
		)
	`, farmID, exclude).Scan(&exists)
	if err != nil {
		return false, err
	}
	return exists, nil
}
