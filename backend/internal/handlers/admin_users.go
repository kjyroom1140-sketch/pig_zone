package handlers

import (
	"net/http"
	"time"

	"github.com/google/uuid"
)

// AdminUsersResponse for GET /api/admin/users.
type AdminUsersResponse struct {
	Users []UserListItem `json:"users"`
}

// UserListItem is user without password, for list.
type UserListItem struct {
	ID         uuid.UUID  `json:"id"`
	Username   string     `json:"username"`
	Email      *string    `json:"email"`
	FullName   string     `json:"fullName"`
	Phone      *string    `json:"phone"`
	SystemRole string     `json:"systemRole"`
	IsActive   bool       `json:"isActive"`
	LastLogin  *time.Time `json:"lastLogin,omitempty"`
	CreatedAt  time.Time  `json:"createdAt"`
	UpdatedAt  time.Time  `json:"updatedAt"`
}

// AdminUsers handles GET /api/admin/users (order by createdAt DESC).
// system_admin 권한 회원은 목록에 포함하지 않음.
func (h *Handler) AdminUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT id, username, email, "fullName", phone, "systemRole", "isActive", "lastLogin", "createdAt", "updatedAt"
		FROM users
		WHERE "systemRole" != 'system_admin'
		ORDER BY "createdAt" DESC
	`)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "사용자 목록을 가져오는 중 오류가 발생했습니다."})
		return
	}
	defer rows.Close()

	var list []UserListItem
	for rows.Next() {
		var u UserListItem
		err := rows.Scan(&u.ID, &u.Username, &u.Email, &u.FullName, &u.Phone, &u.SystemRole, &u.IsActive, &u.LastLogin, &u.CreatedAt, &u.UpdatedAt)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "사용자 목록을 가져오는 중 오류가 발생했습니다."})
			return
		}
		list = append(list, u)
	}
	writeJSON(w, http.StatusOK, AdminUsersResponse{Users: list})
}
