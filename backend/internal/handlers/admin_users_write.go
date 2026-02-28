package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"pig-farm-api/internal/middleware"
)

// CreateUserRequest for POST /api/admin/users.
type CreateUserRequest struct {
	Username string  `json:"username"`
	Email    string  `json:"email"`
	Password string  `json:"password"`
	FullName string  `json:"fullName"`
	Phone    *string `json:"phone"`
}

// AdminUsersCreate handles POST /api/admin/users (super_admin 생성).
func (h *Handler) AdminUsersCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}
	var req CreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "필수 항목을 모두 입력해주세요."})
		return
	}
	if req.Username == "" || req.Email == "" || req.Password == "" || req.FullName == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "필수 항목을 모두 입력해주세요."})
		return
	}

	ctx := r.Context()
	var exists int
	err := h.db.Pool.QueryRow(ctx, `SELECT 1 FROM users WHERE username = $1 OR email = $2`, req.Username, req.Email).Scan(&exists)
	if err == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "이미 존재하는 사용자명 또는 이메일입니다."})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 10)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "사용자 추가 중 오류가 발생했습니다."})
		return
	}
	id := uuid.New()
	_, err = h.db.Pool.Exec(ctx, `
		INSERT INTO users (id, username, email, password, "fullName", phone, "systemRole", "isActive", "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, $5, $6, 'super_admin', true, NOW(), NOW())
	`, id, req.Username, req.Email, string(hash), req.FullName, req.Phone)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "사용자 추가 중 오류가 발생했습니다."})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"message": "농장 운영 관리자가 성공적으로 등록되었습니다.",
		"user":    map[string]interface{}{"id": id.String(), "username": req.Username, "fullName": req.FullName, "email": req.Email, "systemRole": "super_admin"},
	})
}

// AdminUsersToggleActive handles PATCH /api/admin/users/:userId/toggle-active.
func (h *Handler) AdminUsersToggleActive(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}
	userID := chi.URLParam(r, "userId")
	if userID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "userId가 필요합니다."})
		return
	}
	claims := middleware.GetClaims(r.Context())
	if claims != nil && claims.UserID == userID {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "자기 자신의 계정은 비활성화할 수 없습니다."})
		return
	}

	ctx := r.Context()
	var isActive bool
	err := h.db.Pool.QueryRow(ctx, `SELECT "isActive" FROM users WHERE id = $1`, userID).Scan(&isActive)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "사용자를 찾을 수 없습니다."})
		return
	}
	newActive := !isActive
	_, err = h.db.Pool.Exec(ctx, `UPDATE users SET "isActive" = $1, "updatedAt" = NOW() WHERE id = $2`, newActive, userID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "사용자 상태를 변경하는 중 오류가 발생했습니다."})
		return
	}
	msg := "비활성화"
	if newActive {
		msg = "활성화"
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"message": "사용자가 " + msg + "되었습니다."})
}

// AdminUsersUpdate handles PUT /api/admin/users/:userId.
func (h *Handler) AdminUsersUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}
	userID := chi.URLParam(r, "userId")
	var body struct {
		Email    *string `json:"email"`
		FullName *string `json:"fullName"`
		Phone    *string `json:"phone"`
		Password *string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "잘못된 요청입니다."})
		return
	}
	ctx := r.Context()
	if body.Password != nil && len(*body.Password) > 0 {
		if len(*body.Password) < 8 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "비밀번호는 최소 8자 이상이어야 합니다."})
			return
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(*body.Password), 10)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "사용자 정보를 수정하는 중 오류가 발생했습니다."})
			return
		}
		_, err = h.db.Pool.Exec(ctx, `UPDATE users SET password = $1, "updatedAt" = NOW() WHERE id = $2`, string(hash), userID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "사용자 정보를 수정하는 중 오류가 발생했습니다."})
			return
		}
	}
	// email, fullName, phone 업데이트 (동적 쿼리 대신 개별 필드)
	if body.Email != nil || body.FullName != nil || body.Phone != nil {
		_, err := h.db.Pool.Exec(ctx, `
			UPDATE users SET email = COALESCE($1, email), "fullName" = COALESCE($2, "fullName"), phone = COALESCE($3, phone), "updatedAt" = NOW() WHERE id = $4
		`, body.Email, body.FullName, body.Phone, userID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "사용자 정보를 수정하는 중 오류가 발생했습니다."})
			return
		}
	}
	row, _ := h.UserByID(ctx, userID)
	if row == nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{"message": "사용자 정보가 수정되었습니다."})
		return
	}
	user := userFromRow(*row)
	writeJSON(w, http.StatusOK, map[string]interface{}{"message": "사용자 정보가 수정되었습니다.", "user": user})
}

// AdminUsersDelete handles DELETE /api/admin/users/:userId.
func (h *Handler) AdminUsersDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}
	userID := chi.URLParam(r, "userId")
	claims := middleware.GetClaims(r.Context())
	if claims != nil && claims.UserID == userID {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "자기 자신의 계정은 삭제할 수 없습니다."})
		return
	}
	ctx := r.Context()
	_, err := h.db.Pool.Exec(ctx, `DELETE FROM user_farms WHERE "userId" = $1`, userID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "사용자를 삭제하는 중 오류가 발생했습니다."})
		return
	}
	tag2, err := h.db.Pool.Exec(ctx, `DELETE FROM users WHERE id = $1`, userID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "사용자를 삭제하는 중 오류가 발생했습니다."})
		return
	}
	if tag2.RowsAffected() == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "사용자를 찾을 수 없습니다."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "사용자가 삭제되었습니다."})
}
