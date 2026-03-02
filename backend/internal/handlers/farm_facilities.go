package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"pig-farm-api/internal/middleware"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func (h *Handler) parseFarmIDAndCheckFacility(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "?棺??짆??嶺뚮ㅎ?닻???ш끽維???筌뤾퍓???"})
		return uuid.Nil, false
	}
	farmIDStr := chi.URLParam(r, "farmId")
	farmID, err := uuid.Parse(farmIDStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "farmId??좊읈? ??ш끽維???筌뤾퍓???"})
		return uuid.Nil, false
	}
	if !h.canManageFarmStructure(r.Context(), claims, farmID) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "???怨쀪텑 ??筌?留?????굿?域밸Ŧ肉ワ쭕???援????????⑤８?????덊렡."})
		return uuid.Nil, false
	}
	return farmID, true
}

func (h *Handler) buildingBelongsToFarm(ctx context.Context, buildingID, farmID uuid.UUID) bool {
	var id uuid.UUID
	err := h.db.Pool.QueryRow(ctx, `SELECT id FROM farm_buildings WHERE id = $1 AND "farmId" = $2`, buildingID, farmID).Scan(&id)
	return err == nil
}

func (h *Handler) barnBelongsToFarm(ctx context.Context, barnID, farmID uuid.UUID) bool {
	var id uuid.UUID
	err := h.db.Pool.QueryRow(ctx, `
		SELECT b.id FROM farm_barns b
		JOIN farm_buildings bg ON bg.id = b."buildingId"
		WHERE b.id = $1 AND bg."farmId" = $2
	`, barnID, farmID).Scan(&id)
	return err == nil
}

func (h *Handler) roomBelongsToFarm(ctx context.Context, roomID, farmID uuid.UUID) bool {
	var id uuid.UUID
	err := h.db.Pool.QueryRow(ctx, `
		SELECT r.id FROM farm_rooms r
		JOIN farm_barns b ON b.id = r."barnId"
		JOIN farm_buildings bg ON bg.id = b."buildingId"
		WHERE r.id = $1 AND bg."farmId" = $2
	`, roomID, farmID).Scan(&id)
	return err == nil
}

func (h *Handler) hasFarmRoomHousingModeColumn(ctx context.Context) bool {
	var exists bool
	err := h.db.Pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM information_schema.columns
			WHERE table_name = 'farm_rooms'
			  AND column_name = 'housingMode'
		)
	`).Scan(&exists)
	if err != nil {
		return false
	}
	return exists
}

func isBreedingOrGestationFacilityName(name string) bool {
	v := strings.TrimSpace(name)
	if v == "" {
		return false
	}
	return strings.Contains(v, "교배사") || strings.Contains(v, "임신사")
}

func (h *Handler) roomAllowsHousingModeSelection(ctx context.Context, roomID uuid.UUID) bool {
	var barnName sql.NullString
	var templateName sql.NullString
	err := h.db.Pool.QueryRow(ctx, `
		SELECT
			b.name,
			st.name
		FROM farm_rooms r
		JOIN farm_barns b ON b.id = r."barnId"
		LEFT JOIN structure_templates st
			ON b."barnType" ~ '^[0-9]+$'
			AND st.id = b."barnType"::int
		WHERE r.id = $1
	`, roomID).Scan(&barnName, &templateName)
	if err != nil {
		return false
	}

	if templateName.Valid && isBreedingOrGestationFacilityName(templateName.String) {
		return true
	}
	if barnName.Valid && isBreedingOrGestationFacilityName(barnName.String) {
		return true
	}
	return false
}

// FarmFacilitiesTree GET /api/farm-facilities/:farmId/tree
// Returns buildings with nested barns -> rooms -> sections (flat nesting, no floor grouping).
func (h *Handler) FarmFacilitiesTree(w http.ResponseWriter, r *http.Request) {
	farmID, ok := h.parseFarmIDAndCheckFacility(w, r)
	if !ok {
		return
	}
	roomHasHousingMode := h.hasFarmRoomHousingModeColumn(r.Context())
	buildings, err := h.db.Pool.Query(r.Context(), `
		SELECT id, name, code, "orderIndex", description, "totalFloors"
		FROM farm_buildings WHERE "farmId" = $1 AND "isActive" = true ORDER BY "orderIndex" ASC, "createdAt" ASC
	`, farmID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "??筌?留??嶺뚮ㅎ遊뉔걡????됰씭??????몄툗 濚?????곸씔??좊읈? ?袁⑸즵獒뺣뎾????怨?????덊렡."})
		return
	}
	defer buildings.Close()
	var tree []map[string]interface{}
	for buildings.Next() {
		var buildID uuid.UUID
		var name string
		var code, desc *string
		var orderIdx, totalFloors *int
		if err := buildings.Scan(&buildID, &name, &code, &orderIdx, &desc, &totalFloors); err != nil {
			continue
		}
		building := map[string]interface{}{
			"id": buildID.String(), "name": name, "code": code, "orderIndex": orderIdx,
			"description": desc, "totalFloors": totalFloors, "barns": []map[string]interface{}{},
		}
		barns, _ := h.db.Pool.Query(r.Context(), `
			SELECT id, name, "barnType", "floorNumber", "orderIndex", description
			FROM farm_barns WHERE "buildingId" = $1 AND "isActive" = true ORDER BY "floorNumber" ASC, "orderIndex" ASC
		`, buildID)
		for barns.Next() {
			var barnID uuid.UUID
			var barnName, barnType, barnDesc *string
			var floorNum, barnOrder *int
			if err := barns.Scan(&barnID, &barnName, &barnType, &floorNum, &barnOrder, &barnDesc); err != nil {
				continue
			}
			barnMap := map[string]interface{}{
				"id": barnID.String(), "name": barnName, "barnType": barnType, "floorNumber": floorNum,
				"orderIndex": barnOrder, "description": barnDesc, "rooms": []map[string]interface{}{},
			}
			if barnType != nil && *barnType != "" {
				if tid, err := strconv.Atoi(*barnType); err == nil {
					barnMap["structureTemplateId"] = tid
				}
			}
			roomQuery := `
				SELECT id, name, "roomNumber", "sectionCount", area, "totalCapacity", "orderIndex"
				FROM farm_rooms WHERE "barnId" = $1 AND "isActive" = true ORDER BY "orderIndex" ASC, "roomNumber" ASC
			`
			if roomHasHousingMode {
				roomQuery = `
					SELECT id, name, "roomNumber", "housingMode", "sectionCount", area, "totalCapacity", "orderIndex"
					FROM farm_rooms WHERE "barnId" = $1 AND "isActive" = true ORDER BY "orderIndex" ASC, "roomNumber" ASC
				`
			}
			rooms, err := h.db.Pool.Query(r.Context(), roomQuery, barnID)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to load rooms"})
				return
			}
			for rooms.Next() {
				var roomID uuid.UUID
				var roomName *string
				var housingMode *string
				var roomNum, sectionCount *int
				var area, totalCap interface{}
				var roomOrder *int
				if roomHasHousingMode {
					if err := rooms.Scan(&roomID, &roomName, &roomNum, &housingMode, &sectionCount, &area, &totalCap, &roomOrder); err != nil {
						continue
					}
				} else {
					if err := rooms.Scan(&roomID, &roomName, &roomNum, &sectionCount, &area, &totalCap, &roomOrder); err != nil {
						continue
					}
				}
				var normalizedHousingMode interface{} = nil
				if housingMode != nil && *housingMode != "" {
					m := strings.ToLower(strings.TrimSpace(*housingMode))
					if m == "stall" || m == "group" {
						normalizedHousingMode = m
					}
				}
				roomMap := map[string]interface{}{
					"id": roomID.String(), "name": roomName, "roomNumber": roomNum, "housingMode": normalizedHousingMode, "sectionCount": sectionCount,
					"area": area, "totalCapacity": totalCap, "orderIndex": roomOrder, "sections": []map[string]interface{}{},
				}
				sectionRows, err := h.db.Pool.Query(r.Context(), `
					SELECT id, name, "sectionNumber", "currentPigCount", "averageWeight", "entryDate", "breedType", area, capacity, "orderIndex"
					FROM farm_sections WHERE "roomId" = $1 AND "isActive" = true ORDER BY "sectionNumber" ASC
				`, roomID)
				if err != nil {
					rooms.Close()
					writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to load sections"})
					return
				}
				for sectionRows.Next() {
					var sID uuid.UUID
					var sName *string
					var sNum, pigCount *int
					var avgW, entryD, breedT, areaS, cap interface{}
					var oIdx *int
					_ = sectionRows.Scan(&sID, &sName, &sNum, &pigCount, &avgW, &entryD, &breedT, &areaS, &cap, &oIdx)
					secList := roomMap["sections"].([]map[string]interface{})
					secList = append(secList, map[string]interface{}{
						"id": sID.String(), "name": sName, "sectionNumber": sNum, "currentPigCount": pigCount,
						"averageWeight": avgW, "entryDate": entryD, "breedType": breedT,
						"area": areaS, "capacity": cap, "orderIndex": oIdx,
					})
					roomMap["sections"] = secList
				}
				sectionRows.Close()
				roomList := barnMap["rooms"].([]map[string]interface{})
				barnMap["rooms"] = append(roomList, roomMap)
			}
			rooms.Close()
			barnList := building["barns"].([]map[string]interface{})
			building["barns"] = append(barnList, barnMap)
		}
		barns.Close()
		tree = append(tree, building)
	}
	writeJSON(w, http.StatusOK, tree)
}

// FarmBuildingsCreate POST /api/farm-facilities/:farmId/buildings
func (h *Handler) FarmBuildingsCreate(w http.ResponseWriter, r *http.Request) {
	farmID, ok := h.parseFarmIDAndCheckFacility(w, r)
	if !ok {
		return
	}
	var body struct {
		Name        string `json:"name"`
		TotalFloors *int   `json:"totalFloors"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "??嚥?援?????Β?????嶺뚮Ĳ?뉛쭛????낇돲??"})
		return
	}
	name := body.Name
	if name == "" {
		name = "Building"
	}
	totalFloors := 1
	if body.TotalFloors != nil && *body.TotalFloors > 0 {
		totalFloors = *body.TotalFloors
	}
	id := uuid.New()
	_, err := h.db.Pool.Exec(r.Context(), `
		INSERT INTO farm_buildings (id, "farmId", name, "totalFloors", "isActive", "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, true, NOW(), NOW())
	`, id, farmID, name, totalFloors)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "癲꾧퀗??癲???⑤베堉? 濚?????곸씔??좊읈? ?袁⑸즵獒뺣뎾????怨?????덊렡."})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]interface{}{"id": id.String(), "name": name, "totalFloors": totalFloors})
}

// FarmBuildingUpdate PUT /api/farm-facilities/:farmId/buildings/:buildingId
func (h *Handler) FarmBuildingUpdate(w http.ResponseWriter, r *http.Request) {
	farmID, ok := h.parseFarmIDAndCheckFacility(w, r)
	if !ok {
		return
	}
	buildingIDStr := chi.URLParam(r, "buildingId")
	buildingID, err := uuid.Parse(buildingIDStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "buildingId??좊읈? ??ш끽維???筌뤾퍓???"})
		return
	}
	if !h.buildingBelongsToFarm(r.Context(), buildingID, farmID) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "癲꾧퀗??癲??癲ル슓??젆???????⑤８?????덊렡."})
		return
	}
	var body struct {
		Name        *string `json:"name"`
		TotalFloors *int    `json:"totalFloors"`
		Description *string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "??嚥?援?????Β?????嶺뚮Ĳ?뉛쭛????낇돲??"})
		return
	}
	if body.Name != nil {
		_, _ = h.db.Pool.Exec(r.Context(), `UPDATE farm_buildings SET name = $1, "updatedAt" = NOW() WHERE id = $2`, *body.Name, buildingID)
	}
	if body.TotalFloors != nil {
		_, _ = h.db.Pool.Exec(r.Context(), `UPDATE farm_buildings SET "totalFloors" = $1, "updatedAt" = NOW() WHERE id = $2`, *body.TotalFloors, buildingID)
	}
	if body.Description != nil {
		_, _ = h.db.Pool.Exec(r.Context(), `UPDATE farm_buildings SET description = $1, "updatedAt" = NOW() WHERE id = $2`, *body.Description, buildingID)
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "???쒓낯???筌???????"})
}

// FarmBuildingDelete DELETE /api/farm-facilities/:farmId/buildings/:buildingId
func (h *Handler) FarmBuildingDelete(w http.ResponseWriter, r *http.Request) {
	farmID, ok := h.parseFarmIDAndCheckFacility(w, r)
	if !ok {
		return
	}
	buildingIDStr := chi.URLParam(r, "buildingId")
	buildingID, err := uuid.Parse(buildingIDStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "buildingId??좊읈? ??ш끽維???筌뤾퍓???"})
		return
	}
	if !h.buildingBelongsToFarm(r.Context(), buildingID, farmID) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "癲꾧퀗??癲??癲ル슓??젆???????⑤８?????덊렡."})
		return
	}
	_, err = h.db.Pool.Exec(r.Context(), `UPDATE farm_buildings SET "isActive" = false, "updatedAt" = NOW() WHERE id = $1`, buildingID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "????濚?????곸씔??좊읈? ?袁⑸즵獒뺣뎾????怨?????덊렡."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "?????筌???????"})
}

// FarmBarnsCreate POST /api/farm-facilities/:farmId/buildings/:buildingId/barns
// body: structureTemplateId (int), category ("production"|"support"), floorNumber (default 1), name, roomCount (optional, create 1..roomCount rooms)
func (h *Handler) FarmBarnsCreate(w http.ResponseWriter, r *http.Request) {
	farmID, ok := h.parseFarmIDAndCheckFacility(w, r)
	if !ok {
		return
	}
	buildingIDStr := chi.URLParam(r, "buildingId")
	buildingID, err := uuid.Parse(buildingIDStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "buildingId is required"})
		return
	}
	if !h.buildingBelongsToFarm(r.Context(), buildingID, farmID) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "building not found"})
		return
	}
	var body struct {
		StructureTemplateID *int   `json:"structureTemplateId"`
		Category            string `json:"category"`
		FloorNumber         *int   `json:"floorNumber"`
		Name                string `json:"name"`
		RoomCount           int    `json:"roomCount"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	floorNum := 1
	if body.FloorNumber != nil {
		floorNum = *body.FloorNumber
	}
	barnType := ""
	if body.StructureTemplateID != nil && *body.StructureTemplateID > 0 {
		barnType = strconv.Itoa(*body.StructureTemplateID)
	}
	barnName := body.Name
	if barnName == "" {
		barnName = "Barn"
	}
	barnID := uuid.New()
	tx, err := h.db.Pool.Begin(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "transaction begin failed"})
		return
	}
	defer tx.Rollback(r.Context())

	_, err = tx.Exec(r.Context(), `
		INSERT INTO farm_barns (id, "buildingId", "farmId", name, "barnType", "floorNumber", "isActive", "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, NULLIF($5,''), $6, true, NOW(), NOW())
	`, barnID, buildingID, farmID, barnName, barnType, floorNum)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "barn create failed"})
		return
	}
	roomIds := []string{}
	if body.RoomCount > 0 && body.RoomCount <= 200 {
		for i := 1; i <= body.RoomCount; i++ {
			roomID := uuid.New()
			roomName := "Room " + strconv.Itoa(i)
			_, err = tx.Exec(r.Context(), `
				INSERT INTO farm_rooms (id, "barnId", "buildingId", "farmId", name, "roomNumber", "orderIndex", "isActive", "createdAt", "updatedAt")
				VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
			`, roomID, barnID, buildingID, farmID, roomName, i, i)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "room create failed: " + err.Error()})
				return
			}
			// 방 생성 시 기본 1칸 자동 생성
			sectionID := uuid.New()
			_, err = tx.Exec(r.Context(), `
				INSERT INTO farm_sections (id, "roomId", "barnId", "buildingId", "farmId", name, "sectionNumber", "orderIndex", "isActive", "createdAt", "updatedAt")
				VALUES ($1, $2, $3, $4, $5, $6, 1, 1, true, NOW(), NOW())
			`, sectionID, roomID, barnID, buildingID, farmID, "Section 1")
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "section create failed: " + err.Error()})
				return
			}
			roomIds = append(roomIds, roomID.String())
		}
	}
	if err = tx.Commit(r.Context()); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "transaction commit failed: " + err.Error()})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"id": barnID.String(), "name": barnName, "barnType": barnType, "floorNumber": floorNum,
		"roomIds": roomIds,
	})
}

// FarmBarnUpdate PUT /api/farm-facilities/:farmId/barns/:barnId
func (h *Handler) FarmBarnUpdate(w http.ResponseWriter, r *http.Request) {
	farmID, ok := h.parseFarmIDAndCheckFacility(w, r)
	if !ok {
		return
	}
	barnIDStr := chi.URLParam(r, "barnId")
	barnID, err := uuid.Parse(barnIDStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "barnId??좊읈? ??ш끽維???筌뤾퍓???"})
		return
	}
	if !h.barnBelongsToFarm(r.Context(), barnID, farmID) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "???????癲ル슓??젆???????⑤８?????덊렡."})
		return
	}
	var body struct {
		Name        *string `json:"name"`
		Description *string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "??嚥?援?????Β?????嶺뚮Ĳ?뉛쭛????낇돲??"})
		return
	}
	if body.Name != nil {
		_, _ = h.db.Pool.Exec(r.Context(), `UPDATE farm_barns SET name = $1, "updatedAt" = NOW() WHERE id = $2`, *body.Name, barnID)
	}
	if body.Description != nil {
		_, _ = h.db.Pool.Exec(r.Context(), `UPDATE farm_barns SET description = $1, "updatedAt" = NOW() WHERE id = $2`, *body.Description, barnID)
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "???쒓낯???筌???????"})
}

// FarmBarnDelete DELETE /api/farm-facilities/:farmId/barns/:barnId
func (h *Handler) FarmBarnDelete(w http.ResponseWriter, r *http.Request) {
	farmID, ok := h.parseFarmIDAndCheckFacility(w, r)
	if !ok {
		return
	}
	barnIDStr := chi.URLParam(r, "barnId")
	barnID, err := uuid.Parse(barnIDStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "barnId??좊읈? ??ш끽維???筌뤾퍓???"})
		return
	}
	if !h.barnBelongsToFarm(r.Context(), barnID, farmID) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "???????癲ル슓??젆???????⑤８?????덊렡."})
		return
	}
	_, err = h.db.Pool.Exec(r.Context(), `UPDATE farm_barns SET "isActive" = false, "updatedAt" = NOW() WHERE id = $1`, barnID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "????濚?????곸씔??좊읈? ?袁⑸즵獒뺣뎾????怨?????덊렡."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "?????筌???????"})
}

// FarmRoomsBulkCreate POST /api/farm-facilities/:farmId/barns/:barnId/rooms/bulk
// body: { count: number } -> set total room count to 1..count
func (h *Handler) FarmRoomsBulkCreate(w http.ResponseWriter, r *http.Request) {
	farmID, ok := h.parseFarmIDAndCheckFacility(w, r)
	if !ok {
		return
	}
	barnIDStr := chi.URLParam(r, "barnId")
	barnID, err := uuid.Parse(barnIDStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "barnId is required"})
		return
	}
	if !h.barnBelongsToFarm(r.Context(), barnID, farmID) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "barn not found"})
		return
	}
	var buildingID uuid.UUID
	if err := h.db.Pool.QueryRow(r.Context(), `SELECT "buildingId" FROM farm_barns WHERE id = $1`, barnID).Scan(&buildingID); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "barn not found"})
		return
	}
	var body struct {
		Count int `json:"count"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	count := body.Count
	if count <= 0 || count > 200 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "count must be between 1 and 200"})
		return
	}

	type roomState struct {
		ID       uuid.UUID
		Number   int
		IsActive bool
	}
	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT id, "roomNumber", COALESCE("isActive", false)
		FROM farm_rooms
		WHERE "barnId" = $1
		ORDER BY "roomNumber" ASC NULLS LAST, "createdAt" ASC
	`, barnID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to load rooms: " + err.Error()})
		return
	}
	defer rows.Close()

	allRooms := make([]roomState, 0)
	byNumber := make(map[int][]roomState)
	for rows.Next() {
		var id uuid.UUID
		var roomNumber sql.NullInt32
		var isActive bool
		if err := rows.Scan(&id, &roomNumber, &isActive); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to scan rooms: " + err.Error()})
			return
		}
		number := 0
		if roomNumber.Valid {
			number = int(roomNumber.Int32)
		}
		item := roomState{ID: id, Number: number, IsActive: isActive}
		allRooms = append(allRooms, item)
		if number > 0 {
			byNumber[number] = append(byNumber[number], item)
		}
	}

	tx, err := h.db.Pool.Begin(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "transaction begin failed: " + err.Error()})
		return
	}
	defer tx.Rollback(r.Context())

	ensureAtLeastOneSection := func(roomID uuid.UUID) error {
		var activeCount int
		if err := tx.QueryRow(r.Context(), `
			SELECT COUNT(1)
			FROM farm_sections
			WHERE "roomId" = $1
			  AND "isActive" = true
		`, roomID).Scan(&activeCount); err != nil {
			return err
		}
		if activeCount > 0 {
			return nil
		}

		rows, err := tx.Query(r.Context(), `
			SELECT id
			FROM farm_sections
			WHERE "roomId" = $1
			ORDER BY "sectionNumber" ASC NULLS LAST, "createdAt" ASC
			LIMIT 1
		`, roomID)
		if err != nil {
			return err
		}
		var existingID uuid.UUID
		hasExisting := false
		if rows.Next() {
			if err := rows.Scan(&existingID); err != nil {
				rows.Close()
				return err
			}
			hasExisting = true
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			return err
		}
		rows.Close()

		if hasExisting {
			_, err = tx.Exec(r.Context(), `
				UPDATE farm_sections
				SET name = $1,
					"sectionNumber" = 1,
					"orderIndex" = 1,
					"isActive" = true,
					"updatedAt" = NOW()
				WHERE id = $2
			`, "Section 1", existingID)
			return err
		}

		sectionID := uuid.New()
		_, err = tx.Exec(r.Context(), `
			INSERT INTO farm_sections (id, "roomId", "barnId", "buildingId", "farmId", name, "sectionNumber", "orderIndex", "isActive", "createdAt", "updatedAt")
			VALUES ($1, $2, $3, $4, $5, $6, 1, 1, true, NOW(), NOW())
		`, sectionID, roomID, barnID, buildingID, farmID, "Section 1")
		return err
	}

	pickOne := func(number int) (roomState, bool) {
		candidates := byNumber[number]
		if len(candidates) == 0 {
			return roomState{}, false
		}
		for idx, c := range candidates {
			if c.IsActive {
				byNumber[number] = append(candidates[:idx], candidates[idx+1:]...)
				return c, true
			}
		}
		chosen := candidates[0]
		byNumber[number] = candidates[1:]
		return chosen, true
	}

	kept := make(map[uuid.UUID]struct{}, count)
	roomIds := make([]string, 0, count)
	for i := 1; i <= count; i++ {
		if chosen, ok := pickOne(i); ok {
			if _, err = tx.Exec(r.Context(), `
				UPDATE farm_rooms
				SET "roomNumber" = $1, "orderIndex" = $2, "isActive" = true, "updatedAt" = NOW()
				WHERE id = $3
			`, i, i, chosen.ID); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "room update failed: " + err.Error()})
				return
			}
			if err := ensureAtLeastOneSection(chosen.ID); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "section ensure failed: " + err.Error()})
				return
			}
			kept[chosen.ID] = struct{}{}
			roomIds = append(roomIds, chosen.ID.String())
			continue
		}

		roomID := uuid.New()
		roomName := "Room " + strconv.Itoa(i)
		if _, err = tx.Exec(r.Context(), `
			INSERT INTO farm_rooms (id, "barnId", "buildingId", "farmId", name, "roomNumber", "orderIndex", "isActive", "createdAt", "updatedAt")
			VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
		`, roomID, barnID, buildingID, farmID, roomName, i, i); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "room create failed: " + err.Error()})
			return
		}
		if err := ensureAtLeastOneSection(roomID); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "section create failed: " + err.Error()})
			return
		}
		kept[roomID] = struct{}{}
		roomIds = append(roomIds, roomID.String())
	}

	for _, room := range allRooms {
		if _, ok := kept[room.ID]; ok {
			continue
		}
		if _, err = tx.Exec(r.Context(), `
			UPDATE farm_sections
			SET "isActive" = false, "updatedAt" = NOW()
			WHERE "roomId" = $1 AND "isActive" = true
		`, room.ID); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "section cleanup failed: " + err.Error()})
			return
		}
		if _, err = tx.Exec(r.Context(), `
			UPDATE farm_rooms
			SET "isActive" = false, "updatedAt" = NOW()
			WHERE id = $1 AND "isActive" = true
		`, room.ID); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "room cleanup failed: " + err.Error()})
			return
		}
	}

	if err = tx.Commit(r.Context()); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "transaction commit failed: " + err.Error()})
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{"roomIds": roomIds, "count": count})
}

// FarmRoomUpdate PUT /api/farm-facilities/:farmId/rooms/:roomId
func (h *Handler) FarmRoomUpdate(w http.ResponseWriter, r *http.Request) {
	farmID, ok := h.parseFarmIDAndCheckFacility(w, r)
	if !ok {
		return
	}
	roomIDStr := chi.URLParam(r, "roomId")
	roomID, err := uuid.Parse(roomIDStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "roomId??좊읈? ??ш끽維???筌뤾퍓???"})
		return
	}
	if !h.roomBelongsToFarm(r.Context(), roomID, farmID) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "?袁⑸젻泳??癲ル슓??젆???????⑤８?????덊렡."})
		return
	}
	var body struct {
		Name        *string `json:"name"`
		HousingMode *string `json:"housingMode"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "??嚥?援?????Β?????嶺뚮Ĳ?뉛쭛????낇돲??"})
		return
	}
	if body.Name != nil {
		if _, err := h.db.Pool.Exec(r.Context(), `UPDATE farm_rooms SET name = $1, "updatedAt" = NOW() WHERE id = $2`, *body.Name, roomID); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "room name update failed"})
			return
		}
	}
	if body.HousingMode != nil {
		if !h.hasFarmRoomHousingModeColumn(r.Context()) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "housingMode 컬럼이 없습니다. 마이그레이션을 먼저 적용하세요."})
			return
		}
		mode := strings.ToLower(strings.TrimSpace(*body.HousingMode))
		if mode != "stall" && mode != "group" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "housingMode는 stall 또는 group 이어야 합니다."})
			return
		}
		if mode == "stall" && !h.roomAllowsHousingModeSelection(r.Context(), roomID) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "운영방식은 교배사/임신사에서만 stall 선택이 가능합니다."})
			return
		}
		if _, err := h.db.Pool.Exec(r.Context(), `UPDATE farm_rooms SET "housingMode" = $1, "updatedAt" = NOW() WHERE id = $2`, mode, roomID); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "housingMode update failed"})
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "???쒓낯???筌???????"})
}

// FarmRoomDelete DELETE /api/farm-facilities/:farmId/rooms/:roomId
func (h *Handler) FarmRoomDelete(w http.ResponseWriter, r *http.Request) {
	farmID, ok := h.parseFarmIDAndCheckFacility(w, r)
	if !ok {
		return
	}
	roomIDStr := chi.URLParam(r, "roomId")
	roomID, err := uuid.Parse(roomIDStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "roomId??좊읈? ??ш끽維???筌뤾퍓???"})
		return
	}
	if !h.roomBelongsToFarm(r.Context(), roomID, farmID) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "?袁⑸젻泳??癲ル슓??젆???????⑤８?????덊렡."})
		return
	}
	_, err = h.db.Pool.Exec(r.Context(), `UPDATE farm_rooms SET "isActive" = false, "updatedAt" = NOW() WHERE id = $1`, roomID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "????濚?????곸씔??좊읈? ?袁⑸즵獒뺣뎾????怨?????덊렡."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "?????筌???????"})
}

// FarmSectionsBulkCreate POST /api/farm-facilities/:farmId/rooms/:roomId/sections/bulk
// body: { count: number } -> set total section count to 1..count
func (h *Handler) FarmSectionsBulkCreate(w http.ResponseWriter, r *http.Request) {
	farmID, ok := h.parseFarmIDAndCheckFacility(w, r)
	if !ok {
		return
	}
	roomIDStr := chi.URLParam(r, "roomId")
	roomID, err := uuid.Parse(roomIDStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "roomId is required"})
		return
	}
	if !h.roomBelongsToFarm(r.Context(), roomID, farmID) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "room not found"})
		return
	}
	var barnID, buildingID uuid.UUID
	if err := h.db.Pool.QueryRow(r.Context(), `SELECT "barnId", "buildingId" FROM farm_rooms WHERE id = $1`, roomID).Scan(&barnID, &buildingID); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "room not found"})
		return
	}
	var body struct {
		Count int `json:"count"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	count := body.Count
	if count <= 0 || count > 500 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "count must be between 1 and 500"})
		return
	}

	type sectionState struct {
		ID       uuid.UUID
		Number   int
		IsActive bool
	}
	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT id, "sectionNumber", COALESCE("isActive", false)
		FROM farm_sections
		WHERE "roomId" = $1
		ORDER BY "sectionNumber" ASC NULLS LAST, "createdAt" ASC
	`, roomID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to load sections: " + err.Error()})
		return
	}
	defer rows.Close()

	allSections := make([]sectionState, 0)
	byNumber := make(map[int][]sectionState)
	for rows.Next() {
		var id uuid.UUID
		var sectionNumber sql.NullInt32
		var isActive bool
		if err := rows.Scan(&id, &sectionNumber, &isActive); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to scan sections: " + err.Error()})
			return
		}
		number := 0
		if sectionNumber.Valid {
			number = int(sectionNumber.Int32)
		}
		item := sectionState{ID: id, Number: number, IsActive: isActive}
		allSections = append(allSections, item)
		if number > 0 {
			byNumber[number] = append(byNumber[number], item)
		}
	}

	tx, err := h.db.Pool.Begin(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "transaction begin failed: " + err.Error()})
		return
	}
	defer tx.Rollback(r.Context())

	pickOne := func(number int) (sectionState, bool) {
		candidates := byNumber[number]
		if len(candidates) == 0 {
			return sectionState{}, false
		}
		for idx, c := range candidates {
			if c.IsActive {
				byNumber[number] = append(candidates[:idx], candidates[idx+1:]...)
				return c, true
			}
		}
		chosen := candidates[0]
		byNumber[number] = candidates[1:]
		return chosen, true
	}

	kept := make(map[uuid.UUID]struct{}, count)
	sectionIds := make([]string, 0, count)
	for i := 1; i <= count; i++ {
		if chosen, ok := pickOne(i); ok {
			if _, err = tx.Exec(r.Context(), `
				UPDATE farm_sections
				SET "sectionNumber" = $1, "orderIndex" = $2, "isActive" = true, "updatedAt" = NOW()
				WHERE id = $3
			`, i, i, chosen.ID); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "section update failed: " + err.Error()})
				return
			}
			kept[chosen.ID] = struct{}{}
			sectionIds = append(sectionIds, chosen.ID.String())
			continue
		}

		sectionID := uuid.New()
		// Keep ASCII default label to avoid locale/encoding mojibake.
		sectionName := "Section " + strconv.Itoa(i)
		if _, err = tx.Exec(r.Context(), `
			INSERT INTO farm_sections (id, "roomId", "barnId", "buildingId", "farmId", name, "sectionNumber", "orderIndex", "isActive", "createdAt", "updatedAt")
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW(), NOW())
		`, sectionID, roomID, barnID, buildingID, farmID, sectionName, i, i); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "section create failed: " + err.Error()})
			return
		}
		kept[sectionID] = struct{}{}
		sectionIds = append(sectionIds, sectionID.String())
	}

	for _, sec := range allSections {
		if _, ok := kept[sec.ID]; ok {
			continue
		}
		if _, err = tx.Exec(r.Context(), `
			UPDATE farm_sections
			SET "isActive" = false, "updatedAt" = NOW()
			WHERE id = $1 AND "isActive" = true
		`, sec.ID); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "section cleanup failed: " + err.Error()})
			return
		}
	}

	if err = tx.Commit(r.Context()); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "transaction commit failed: " + err.Error()})
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{"sectionIds": sectionIds, "count": count})
}
