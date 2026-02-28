package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"pig-farm-api/internal/config"

	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const claimsKey contextKey = "claims"

// Claims type must match handlers.Claims for parsing.
type Claims struct {
	UserID     string `json:"userId"`
	Username   string `json:"username"`
	FullName   string `json:"fullName"`
	SystemRole string `json:"systemRole"`
	jwt.RegisteredClaims
}

// GetClaims returns claims from context, or nil.
func GetClaims(ctx context.Context) *Claims {
	c, _ := ctx.Value(claimsKey).(*Claims)
	return c
}

func withClaims(ctx context.Context, c *Claims) context.Context {
	return context.WithValue(ctx, claimsKey, c)
}

// Auth extracts JWT from Cookie "token" or Authorization header, validates it, and sets claims in context.
func Auth(cfg *config.Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tokenStr := ""
			if c, _ := r.Cookie("token"); c != nil {
				tokenStr = c.Value
			}
			if tokenStr == "" {
				if s := r.Header.Get("Authorization"); strings.HasPrefix(s, "Bearer ") {
					tokenStr = strings.TrimPrefix(s, "Bearer ")
				}
			}
			if tokenStr == "" {
				if isAPI(r) {
					writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "로그인이 필요합니다."})
					return
				}
				http.Redirect(w, r, "/login.html", http.StatusFound)
				return
			}
			var claims Claims
			token, err := jwt.ParseWithClaims(tokenStr, &claims, func(t *jwt.Token) (interface{}, error) {
				return []byte(cfg.JWTSecret), nil
			})
			if err != nil || !token.Valid {
				if isAPI(r) {
					writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "로그인이 필요합니다."})
					return
				}
				http.Redirect(w, r, "/login.html", http.StatusFound)
				return
			}
			ctx := withClaims(r.Context(), &claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireSuperAdmin returns 403 if context user is not system_admin or super_admin.
func RequireSuperAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c := GetClaims(r.Context())
		if c == nil {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "로그인이 필요합니다."})
			return
		}
		if c.SystemRole != "system_admin" && c.SystemRole != "super_admin" {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "관리자 권한이 필요합니다."})
			return
		}
		next.ServeHTTP(w, r)
	})
}

func isAPI(r *http.Request) bool { return strings.HasPrefix(r.URL.Path, "/api/") }

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
