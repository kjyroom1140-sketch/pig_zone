package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"

	"pig-farm-api/internal/config"
	"pig-farm-api/internal/db"
	"pig-farm-api/internal/handlers"
	"pig-farm-api/internal/middleware"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env (current dir or project root when run from backend/)
	_ = godotenv.Load(".env")
	if dir, err := os.Getwd(); err == nil {
		if root := filepath.Join(dir, ".."); root != "" {
			_ = godotenv.Load(filepath.Join(root, ".env"))
		}
	}
	cfg := config.Load()

	ctx := context.Background()
	database, err := db.New(ctx, cfg)
	if err != nil {
		log.Fatalf("DB connection: %v", err)
	}
	defer database.Close()

	h := handlers.New(database)
	r := chi.NewRouter()

	r.Use(chimw.Logger)
	r.Use(chimw.RealIP)
	r.Use(chimw.Recoverer)
	r.Use(cors(cfg.CORSOrigins))

	r.Route("/api", func(r chi.Router) {
		r.Route("/auth", func(r chi.Router) {
			r.Post("/login", func(w http.ResponseWriter, r *http.Request) {
				h.Login(cfg, w, r)
			})
			r.Post("/logout", handlers.Logout)
			// r.Get("/me", ...) with Auth middleware
		})
		// Protected routes
		r.Group(func(r chi.Router) {
			r.Use(middleware.Auth(cfg))
			r.Get("/auth/me", h.Me)
			// Admin routes (require super admin)
			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireSuperAdmin)
				r.Get("/admin/stats", h.AdminStats)
				r.Get("/admin/users", h.AdminUsers)
				r.Post("/admin/users", h.AdminUsersCreate)
				r.Get("/admin/user-farms/{userId}", h.AdminUserFarms)
				r.Put("/admin/users/{userId}", h.AdminUsersUpdate)
				r.Patch("/admin/users/{userId}/toggle-active", h.AdminUsersToggleActive)
				r.Delete("/admin/users/{userId}", h.AdminUsersDelete)
				r.Get("/admin/farms", h.AdminFarms)
				r.Route("/admin/schedule-work-plans", func(r chi.Router) {
					r.Get("/", h.ScheduleWorkPlansList)
					r.Post("/", h.ScheduleWorkPlansCreate)
					r.Post("/reorder", h.ScheduleWorkPlansReorder)
					r.Put("/{id}", h.ScheduleWorkPlansUpdate)
					r.Delete("/{id}", h.ScheduleWorkPlansDelete)
				})
				r.Get("/admin/settings/connection", h.AdminSettingsConnection)
				r.Put("/admin/settings/connection", h.AdminSettingsConnectionPut)
			})
			r.Get("/breeds", h.BreedsList)
			r.Get("/farms", h.FarmsList)
			r.Post("/farms", h.FarmsCreate)
			r.Get("/farms/{farmId}", h.FarmGetOne)
			r.Route("/farms/{farmId}", func(r chi.Router) {
				r.Put("/", h.FarmUpdate)
				r.Get("/staff", h.FarmStaffList)
				r.Post("/staff", h.FarmStaffCreate)
				r.Post("/staff/link", h.FarmStaffLink)
				r.Put("/staff/{userFarmId}", h.FarmStaffUpdate)
				r.Delete("/staff/{userFarmId}", h.FarmStaffDelete)
				r.Get("/schedule-task-types", h.FarmScheduleTaskTypesList)
				r.Get("/schedule-basis-types", h.FarmScheduleBasisTypesList)
				r.Get("/schedule-items", h.FarmScheduleItemsList)
				r.Get("/schedule-work-plans", h.FarmScheduleWorkPlansList)
			})
			r.Route("/structureTemplates", func(r chi.Router) {
				r.Post("/reorder", h.StructureTemplatesReorder)
				r.Get("/", h.StructureTemplatesList)
				r.Post("/", h.StructureTemplatesCreate)
				r.Put("/{id}", h.StructureTemplatesUpdate)
				r.Delete("/{id}", h.StructureTemplatesDelete)
			})
			r.Route("/farm-structure/{farmId}", func(r chi.Router) {
				r.Get("/production", h.FarmStructureProductionList)
				r.Post("/production", h.FarmStructureProductionSave)
			})
			r.Route("/farm-facilities/{farmId}", func(r chi.Router) {
				r.Get("/tree", h.FarmFacilitiesTree)
				r.Post("/buildings", h.FarmBuildingsCreate)
				r.Put("/buildings/{buildingId}", h.FarmBuildingUpdate)
				r.Delete("/buildings/{buildingId}", h.FarmBuildingDelete)
				r.Post("/buildings/{buildingId}/barns", h.FarmBarnsCreate)
				r.Put("/barns/{barnId}", h.FarmBarnUpdate)
				r.Delete("/barns/{barnId}", h.FarmBarnDelete)
				r.Post("/barns/{barnId}/rooms/bulk", h.FarmRoomsBulkCreate)
				r.Put("/rooms/{roomId}", h.FarmRoomUpdate)
				r.Delete("/rooms/{roomId}", h.FarmRoomDelete)
				r.Post("/rooms/{roomId}/sections/bulk", h.FarmSectionsBulkCreate)
			})
			r.Route("/schedule-sortations", func(r chi.Router) {
				r.Get("/", h.ScheduleSortationsList)
				r.Post("/", h.ScheduleSortationsCreate)
				r.Put("/{id}", h.ScheduleSortationsUpdate)
				r.Delete("/{id}", h.ScheduleSortationsDelete)
			})
			r.Route("/schedule-sortation-definitions", func(r chi.Router) {
				r.Get("/", h.ScheduleSortationDefinitionsList)
				r.Post("/", h.ScheduleSortationDefinitionsCreate)
				r.Put("/{id}", h.ScheduleSortationDefinitionsUpdate)
				r.Delete("/{id}", h.ScheduleSortationDefinitionsDelete)
			})
			r.Route("/schedule-criterias", func(r chi.Router) {
				r.Get("/", h.ScheduleCriteriasList)
				r.Post("/", h.ScheduleCriteriasCreate)
				r.Put("/{id}", h.ScheduleCriteriasUpdate)
				r.Delete("/{id}", h.ScheduleCriteriasDelete)
			})
			r.Route("/schedule-criteria-definitions", func(r chi.Router) {
				r.Get("/", h.ScheduleCriteriaDefinitionsList)
				r.Post("/", h.ScheduleCriteriaDefinitionsCreate)
				r.Put("/{id}", h.ScheduleCriteriaDefinitionsUpdate)
				r.Delete("/{id}", h.ScheduleCriteriaDefinitionsDelete)
			})
			r.Route("/schedule-jobtypes", func(r chi.Router) {
				r.Get("/", h.ScheduleJobtypesList)
				r.Post("/", h.ScheduleJobtypesCreate)
				r.Put("/{id}", h.ScheduleJobtypesUpdate)
				r.Delete("/{id}", h.ScheduleJobtypesDelete)
			})
			r.Route("/schedule-jobtype-definitions", func(r chi.Router) {
				r.Get("/", h.ScheduleJobtypeDefinitionsList)
				r.Post("/", h.ScheduleJobtypeDefinitionsCreate)
				r.Put("/{id}", h.ScheduleJobtypeDefinitionsUpdate)
				r.Delete("/{id}", h.ScheduleJobtypeDefinitionsDelete)
			})
		})
	})

	port := cfg.Port
	if port == "" {
		port = "8080"
	}
	srv := &http.Server{Addr: ":" + port, Handler: r}

	go func() {
		log.Printf("Go API listening on http://localhost:%s (CORS: %s)", port, cfg.CORSOrigins)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("ListenAndServe: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down...")
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("Shutdown: %v", err)
	}
}

func cors(origins string) func(http.Handler) http.Handler {
	allowed := make(map[string]bool)
	for _, o := range splitTrim(origins, ",") {
		if o != "" {
			allowed[o] = true
		}
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin != "" && allowed[origin] {
				w.Header().Set("Access-Control-Allow-Origin", origin)
			} else if len(allowed) > 0 {
				// 요청에 Origin이 없거나 허용 목록에 없으면 첫 번째 허용 오리진 사용 (동일 오리진 요청 등)
				for o := range allowed {
					w.Header().Set("Access-Control-Allow-Origin", o)
					break
				}
			}
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func splitTrim(s, sep string) []string {
	var out []string
	for _, p := range strings.Split(s, sep) {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	return out
}
