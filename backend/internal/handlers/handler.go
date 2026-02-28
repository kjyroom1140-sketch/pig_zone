package handlers

import "pig-farm-api/internal/db"

// Handler holds shared dependencies for HTTP handlers.
type Handler struct {
	db *db.DB
}

// New returns a new Handler.
func New(database *db.DB) *Handler {
	return &Handler{db: database}
}
