package handlers

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// User is the in-memory representation of a user (password excluded for JSON).
type User struct {
	ID         uuid.UUID `json:"id"`
	Username   string    `json:"username"`
	Email      *string   `json:"email"`
	FullName   string    `json:"fullName"`
	Phone      *string   `json:"phone"`
	SystemRole string    `json:"systemRole"`
	IsActive   bool      `json:"isActive"`
	LastLogin  *time.Time `json:"lastLogin,omitempty"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

// userRow is used for scanning from DB (Sequelize default: table users, camelCase -> lowercased in PG).
type userRow struct {
	ID         uuid.UUID
	Username   string
	Email      *string
	Password   string
	FullName   string
	Phone      *string
	SystemRole string
	IsActive   bool
	LastLogin  *time.Time
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

// Table "users" - Sequelize default camelCase; in PostgreSQL use quoted identifiers.
const userSelectCols = `id, username, email, password, "fullName", phone, "systemRole", "isActive", "lastLogin", "createdAt", "updatedAt"`

func userFromRow(r userRow) User {
	return User{
		ID:         r.ID,
		Username:   r.Username,
		Email:      r.Email,
		FullName:   r.FullName,
		Phone:      r.Phone,
		SystemRole: r.SystemRole,
		IsActive:   r.IsActive,
		LastLogin:  r.LastLogin,
		CreatedAt:  r.CreatedAt,
		UpdatedAt:  r.UpdatedAt,
	}
}

// UserByUsername loads a user by username for login. Returns (nil, nil) if not found.
func (h *Handler) UserByUsername(ctx context.Context, username string) (*userRow, error) {
	q := `SELECT ` + userSelectCols + ` FROM users WHERE username = $1`
	var r userRow
	err := h.db.Pool.QueryRow(ctx, q, username).Scan(
		&r.ID, &r.Username, &r.Email, &r.Password, &r.FullName, &r.Phone,
		&r.SystemRole, &r.IsActive, &r.LastLogin, &r.CreatedAt, &r.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

// UserByID loads a user by ID. Returns (nil, nil) if not found.
func (h *Handler) UserByID(ctx context.Context, id string) (*userRow, error) {
	uid, err := uuid.Parse(id)
	if err != nil {
		return nil, err
	}
	q := `SELECT ` + userSelectCols + ` FROM users WHERE id = $1`
	var r userRow
	err = h.db.Pool.QueryRow(ctx, q, uid).Scan(
		&r.ID, &r.Username, &r.Email, &r.Password, &r.FullName, &r.Phone,
		&r.SystemRole, &r.IsActive, &r.LastLogin, &r.CreatedAt, &r.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

// UpdateLastLogin sets lastLogin to now for the user (Sequelize camelCase).
func (h *Handler) UpdateLastLogin(ctx context.Context, userID uuid.UUID) error {
	now := time.Now()
	_, err := h.db.Pool.Exec(ctx, `UPDATE users SET "lastLogin" = $1, "updatedAt" = $1 WHERE id = $2`, now, now, userID)
	return err
}
