package api

import (
	"encoding/json"
	"log"
	"net/http"
	"powerctrl/database"
	"powerctrl/services"
	"strings"
)

type PowerRequest struct {
	IsOn bool `json:"isOn"`
}

func HandleGetDevices(w http.ResponseWriter, r *http.Request) {
	devices, err := database.GetAllDevices()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(devices)
}

func HandleToggleDevice(w http.ResponseWriter, r *http.Request) {
	// Parse ID from URL ex: /api/devices/{id}/power
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 5 {
		http.Error(w, "Invalid URL", http.StatusBadRequest)
		return
	}
	id := parts[3]

	var req PowerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Fetch device details to get IP and MAC
	device, err := database.GetDeviceByID(id)
	if err != nil {
		http.Error(w, "Device not found", http.StatusNotFound)
		return
	}

	// Execute hardware power control
	if device.Type == "pc" {
		if req.IsOn {
			log.Printf("Sending WOL to PC %s (MAC: %s)", device.Name, device.MAC)
			if err := services.WakeOnLAN(device.MAC); err != nil {
				log.Printf("WOL Error for %s: %v", device.Name, err)
			}
		} else {
			log.Printf("Sending Remote Shutdown to PC %s (IP: %s)", device.Name, device.IP)
			if err := services.ShutdownPC(device.IP); err != nil {
				log.Printf("Shutdown Error for %s: %v", device.Name, err)
			}
		}
	} else if device.Type == "projector" {
		cmd := "%1POWR 0"
		if req.IsOn {
			cmd = "%1POWR 1"
			log.Printf("Sending PJLink Power ON to Projector %s (IP: %s)", device.Name, device.IP)
		} else {
			log.Printf("Sending PJLink Power OFF to Projector %s (IP: %s)", device.Name, device.IP)
		}
		// Using empty default password for MVP.
		if err := services.SendPJLinkCommand(device.IP, cmd, ""); err != nil {
			log.Printf("PJLink Error for %s: %v", device.Name, err)
		}
	}

	if err := database.ToggleDevicePower(id, req.IsOn); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func HandleToggleGroup(w http.ResponseWriter, r *http.Request) {
	var req struct {
		GroupType  string `json:"groupType"`
		GroupValue string `json:"groupValue"`
		IsOn       bool   `json:"isOn"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	devices, err := database.GetAllDevices()
	if err == nil {
		for _, d := range devices {
			match := false
			if req.GroupType == "room" && d.Room == req.GroupValue {
				match = true
			} else if req.GroupType == "type" && d.Type == req.GroupValue {
				match = true
			}

			if match {
				if d.Type == "pc" {
					if req.IsOn {
						log.Printf("[Group] Sending WOL to PC %s", d.Name)
						services.WakeOnLAN(d.MAC)
					} else {
						log.Printf("[Group] Sending Shutdown to PC %s", d.Name)
						services.ShutdownPC(d.IP)
					}
				} else if d.Type == "projector" {
					cmd := "%1POWR 0"
					if req.IsOn {
						cmd = "%1POWR 1"
						log.Printf("[Group] Sending PJLink Power ON to Projector %s", d.Name)
					} else {
						log.Printf("[Group] Sending PJLink Power OFF to Projector %s", d.Name)
					}
					// Using empty default password for MVP.
					services.SendPJLinkCommand(d.IP, cmd, "")
				}
			}
		}
	}

	if err := database.ToggleGroupPower(req.GroupType, req.GroupValue, req.IsOn); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func HandleToggleAll(w http.ResponseWriter, r *http.Request) {
	var req PowerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	devices, err := database.GetAllDevices()
	if err == nil {
		for _, d := range devices {
			if d.Type == "pc" {
				if req.IsOn {
					log.Printf("[All] Sending WOL to PC %s", d.Name)
					services.WakeOnLAN(d.MAC)
				} else {
					log.Printf("[All] Sending Shutdown to PC %s", d.Name)
					services.ShutdownPC(d.IP)
				}
			} else if d.Type == "projector" {
				cmd := "%1POWR 0"
				if req.IsOn {
					cmd = "%1POWR 1"
					log.Printf("[All] Sending PJLink Power ON to Projector %s", d.Name)
				} else {
					log.Printf("[All] Sending PJLink Power OFF to Projector %s", d.Name)
				}
				// Using empty default password for MVP.
				services.SendPJLinkCommand(d.IP, cmd, "")
			}
		}
	}

	if err := database.ToggleAllPower(req.IsOn); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func HandleAddDevice(w http.ResponseWriter, r *http.Request) {
	var d database.Device
	if err := json.NewDecoder(r.Body).Decode(&d); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := database.AddDevice(d); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
}

func HandleUpdateDevice(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		http.Error(w, "Invalid URL", http.StatusBadRequest)
		return
	}
	id := parts[3]

	var d database.Device
	if err := json.NewDecoder(r.Body).Decode(&d); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	d.ID = id // ensure ID matches URL
	if err := database.UpdateDevice(d); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func HandleDeleteDevice(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		http.Error(w, "Invalid URL", http.StatusBadRequest)
		return
	}
	id := parts[3]

	if err := database.DeleteDevice(id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func HandleDeleteAllDevices(w http.ResponseWriter, r *http.Request) {
	deviceType := r.URL.Query().Get("type")
	if deviceType == "" {
		http.Error(w, "Type required", http.StatusBadRequest)
		return
	}

	if err := database.DeleteDevicesByType(deviceType); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func HandleFindMac(w http.ResponseWriter, r *http.Request) {
	ip := r.URL.Query().Get("ip")
	if ip == "" {
		http.Error(w, "IP required", http.StatusBadRequest)
		return
	}

	mac, err := services.FindMacByIP(ip)
	if err != nil || mac == "" {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"success": false, "mac": ""}`))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "mac": mac})
}

func HandleScanDevices(w http.ResponseWriter, r *http.Request) {
	devices, err := database.GetAllDevices()
	if err == nil {
		for _, d := range devices {
			isReachable := services.CheckDeviceStatus(d.IP, d.Type)
			if d.IsOn != isReachable {
				// State changed, update DB immediately
				database.ToggleDevicePower(d.ID, isReachable)
			}
		}
	}
	w.WriteHeader(http.StatusOK)
}

// --- Schedule Handlers ---

func HandleGetSchedules(w http.ResponseWriter, r *http.Request) {
	schedules, err := database.GetAllSchedules()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(schedules)
}

func HandleUpdateSchedule(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		http.Error(w, "Invalid URL", http.StatusBadRequest)
		return
	}
	room := parts[3]

	var s database.Schedule
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	s.Room = room

	if err := database.UpdateSchedule(s); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func HandleDeleteSchedule(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		http.Error(w, "Invalid URL", http.StatusBadRequest)
		return
	}
	room := parts[3]

	if err := database.DeleteSchedule(room); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func HandleGetSettings(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"schedulerEnabled": services.GlobalSettings.SchedulerEnabled,
		"preferredPort":    services.GlobalSettings.PreferredPort,
		"activePort":       services.ActivePort,
		"broadcastIp":      services.GlobalSettings.BroadcastIP,
	})
}

func HandleUpdateSettings(w http.ResponseWriter, r *http.Request) {
	var req struct {
		SchedulerEnabled bool   `json:"schedulerEnabled"`
		PreferredPort    int    `json:"preferredPort"`
		BroadcastIP      string `json:"broadcastIp"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	needsRestart := false
	if services.GlobalSettings.PreferredPort != req.PreferredPort {
		needsRestart = true
	}

	services.GlobalSettings.SchedulerEnabled = req.SchedulerEnabled
	services.IsSchedulerEnabled = req.SchedulerEnabled // maintain compat
	services.GlobalSettings.PreferredPort = req.PreferredPort
	services.GlobalSettings.BroadcastIP = req.BroadcastIP
	services.SaveSettings()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"needsRestart": needsRestart,
	})
}

func RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/devices", HandleGetDevices)
	mux.HandleFunc("POST /api/devices", HandleAddDevice)
	mux.HandleFunc("PUT /api/devices/{id}", HandleUpdateDevice)
	mux.HandleFunc("DELETE /api/devices/{id}", HandleDeleteDevice)
	mux.HandleFunc("DELETE /api/devices", HandleDeleteAllDevices)

	mux.HandleFunc("POST /api/devices/scan", HandleScanDevices)
	mux.HandleFunc("GET /api/arp", HandleFindMac)

	mux.HandleFunc("GET /api/schedules", HandleGetSchedules)
	mux.HandleFunc("PUT /api/schedules/{room}", HandleUpdateSchedule)
	mux.HandleFunc("DELETE /api/schedules/{room}", HandleDeleteSchedule)

	mux.HandleFunc("POST /api/devices/{id}/power", HandleToggleDevice)
	mux.HandleFunc("POST /api/group/power", HandleToggleGroup)
	mux.HandleFunc("POST /api/all/power", HandleToggleAll)

	mux.HandleFunc("GET /api/settings", HandleGetSettings)
	mux.HandleFunc("POST /api/settings", HandleUpdateSettings)
}
