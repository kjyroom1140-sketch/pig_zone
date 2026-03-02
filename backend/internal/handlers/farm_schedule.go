package handlers

import (
	"context"

	"pig-farm-api/internal/middleware"

	"github.com/google/uuid"
)

// canManageFarmSchedule: same as farm structure (farm_admin or manager).
func (h *Handler) canManageFarmSchedule(ctx context.Context, claims *middleware.Claims, farmID uuid.UUID) bool {
	return h.canManageFarmStructure(ctx, claims, farmID)
}
