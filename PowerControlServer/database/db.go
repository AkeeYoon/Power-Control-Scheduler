package database

import (
	"database/sql"
	"encoding/json"
	"log"
	"os"

	_ "modernc.org/sqlite"
)

type Device struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Type string `json:"type"`
	Room string `json:"room"`
	IP   string `json:"ip"`
	MAC  string `json:"mac"`
	IsOn bool   `json:"isOn"`
}

// DayConfig holds per-day schedule settings
type DayConfig struct {
	Enabled   bool   `json:"enabled"`
	StartTime string `json:"startTime"`
	EndTime   string `json:"endTime"`
}

// DaysMap is a map of weekday keys to DayConfig
type DaysMap map[string]DayConfig

type Schedule struct {
	Room           string `json:"room"`
	Name           string `json:"name"`
	IsActive       bool   `json:"isActive"`
	StartTime      string `json:"startTime"`
	EndTime        string `json:"endTime"`
	ProjectorDelay int    `json:"projectorDelay"`
	PcDelay        int    `json:"pcDelay"`
	DaysConfig     string `json:"daysConfig"` // JSON string of DaysMap
}

// DefaultDaysConfig returns a default weekday-enabled config with the given times
func DefaultDaysConfig(startTime, endTime string) string {
	days := DaysMap{
		"mon": {Enabled: true, StartTime: startTime, EndTime: endTime},
		"tue": {Enabled: true, StartTime: startTime, EndTime: endTime},
		"wed": {Enabled: true, StartTime: startTime, EndTime: endTime},
		"thu": {Enabled: true, StartTime: startTime, EndTime: endTime},
		"fri": {Enabled: true, StartTime: startTime, EndTime: endTime},
		"sat": {Enabled: false, StartTime: "", EndTime: ""},
		"sun": {Enabled: false, StartTime: "", EndTime: ""},
	}
	data, _ := json.Marshal(days)
	return string(data)
}

// ParseDaysConfig parses the JSON daysConfig string into a DaysMap
func ParseDaysConfig(configStr string) DaysMap {
	if configStr == "" {
		return nil
	}
	var days DaysMap
	if err := json.Unmarshal([]byte(configStr), &days); err != nil {
		return nil
	}
	return days
}

var DB *sql.DB

func InitDB() {
	// Ensure directory exists
	os.MkdirAll("./data", os.ModePerm)

	var err error
	DB, err = sql.Open("sqlite", "./data/powerctrl.db")
	if err != nil {
		log.Fatal("Failed to open database:", err)
	}

	createTables()
	// Migrations for older databases
	DB.Exec(`ALTER TABLE schedules ADD COLUMN name TEXT DEFAULT ''`)
	DB.Exec(`ALTER TABLE schedules ADD COLUMN days_config TEXT DEFAULT ''`)
	seedData()
}

func createTables() {
	query1 := `
	CREATE TABLE IF NOT EXISTS devices (
		id TEXT PRIMARY KEY,
		name TEXT,
		type TEXT,
		room TEXT,
		ip TEXT,
		mac TEXT,
		is_on BOOLEAN
	);`
	_, err := DB.Exec(query1)
	if err != nil {
		log.Fatal("Failed to create devices table:", err)
	}

	query2 := `
	CREATE TABLE IF NOT EXISTS schedules (
		room TEXT PRIMARY KEY,
		name TEXT DEFAULT '',
		is_active BOOLEAN,
		start_time TEXT,
		end_time TEXT,
		projector_delay INTEGER,
		pc_delay INTEGER
	);`
	_, err = DB.Exec(query2)
	if err != nil {
		log.Fatal("Failed to create schedules table:", err)
	}
}

func seedData() {
	// Optional: Patch older DB records where name is empty
	DB.Exec(`UPDATE schedules SET name='1 강의실' WHERE room='room1' AND name=''`)
	DB.Exec(`UPDATE schedules SET name='대회의실' WHERE room='room2' AND name=''`)

	// Check if already seeded
	var count int
	DB.QueryRow("SELECT COUNT(*) FROM devices").Scan(&count)
	if count > 0 {
		return // Data exists
	}

	devices := []Device{
		// Intro (인트로)
		{ID: "pc_intro_1", Name: "인트로 PC", Type: "pc", Room: "intro", IP: "192.168.1.101", MAC: "", IsOn: false},
		{ID: "pj_intro_1", Name: "인트로 프로젝터 1", Type: "projector", Room: "intro", IP: "192.168.1.201", MAC: "", IsOn: false},
		{ID: "pj_intro_2", Name: "인트로 프로젝터 2", Type: "projector", Room: "intro", IP: "192.168.1.202", MAC: "", IsOn: false},
		{ID: "pj_intro_3", Name: "인트로 프로젝터 3", Type: "projector", Room: "intro", IP: "192.168.1.203", MAC: "", IsOn: false},

		// Main (메인)
		{ID: "pc_main_1", Name: "메인 PC 1", Type: "pc", Room: "main", IP: "192.168.1.102", MAC: "", IsOn: false},
		{ID: "pc_main_2", Name: "메인 PC 2", Type: "pc", Room: "main", IP: "192.168.1.103", MAC: "", IsOn: false},
		{ID: "pj_main_1", Name: "메인 프로젝터 1", Type: "projector", Room: "main", IP: "192.168.1.204", MAC: "", IsOn: false},
		{ID: "pj_main_2", Name: "메인 프로젝터 2", Type: "projector", Room: "main", IP: "192.168.1.205", MAC: "", IsOn: false},
		{ID: "pj_main_3", Name: "메인 프로젝터 3", Type: "projector", Room: "main", IP: "192.168.1.206", MAC: "", IsOn: false},
		{ID: "pj_main_4", Name: "메인 프로젝터 4", Type: "projector", Room: "main", IP: "192.168.1.207", MAC: "", IsOn: false},

		// Epilogue (에필로그)
		{ID: "pc_epi_1", Name: "에필로그 PC", Type: "pc", Room: "epilogue", IP: "192.168.1.104", MAC: "", IsOn: false},
		{ID: "pj_epi_1", Name: "에필로그 프로젝터 1", Type: "projector", Room: "epilogue", IP: "192.168.1.208", MAC: "", IsOn: false},
		{ID: "pj_epi_2", Name: "에필로그 프로젝터 2", Type: "projector", Room: "epilogue", IP: "192.168.1.209", MAC: "", IsOn: false},
	}

	for _, d := range devices {
		_, err := DB.Exec(`INSERT INTO devices (id, name, type, room, ip, mac, is_on) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			d.ID, d.Name, d.Type, d.Room, d.IP, d.MAC, d.IsOn)
		if err != nil {
			log.Printf("Failed to seed device %s: %v\n", d.ID, err)
		}
	}

	// Seed Schedules
	defaultDays := DefaultDaysConfig("09:00", "18:00")
	schedules := []Schedule{
		{Room: "intro", Name: "인트로", IsActive: false, StartTime: "09:00", EndTime: "18:00", ProjectorDelay: 5, PcDelay: 5, DaysConfig: defaultDays},
		{Room: "main", Name: "메인", IsActive: false, StartTime: "09:00", EndTime: "18:00", ProjectorDelay: 5, PcDelay: 5, DaysConfig: defaultDays},
		{Room: "epilogue", Name: "에필로그", IsActive: false, StartTime: "09:00", EndTime: "18:00", ProjectorDelay: 5, PcDelay: 5, DaysConfig: defaultDays},
	}
	for _, s := range schedules {
		DB.Exec(`INSERT INTO schedules (room, name, is_active, start_time, end_time, projector_delay, pc_delay, days_config) 
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, s.Room, s.Name, s.IsActive, s.StartTime, s.EndTime, s.ProjectorDelay, s.PcDelay, s.DaysConfig)
	}
}

func GetAllDevices() ([]Device, error) {
	rows, err := DB.Query("SELECT id, name, type, room, ip, mac, is_on FROM devices")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var devices []Device
	for rows.Next() {
		var d Device
		err := rows.Scan(&d.ID, &d.Name, &d.Type, &d.Room, &d.IP, &d.MAC, &d.IsOn)
		if err != nil {
			return nil, err
		}
		devices = append(devices, d)
	}

	return devices, nil
}

func GetDeviceByID(id string) (Device, error) {
	var d Device
	err := DB.QueryRow("SELECT id, name, type, room, ip, mac, is_on FROM devices WHERE id = ?", id).
		Scan(&d.ID, &d.Name, &d.Type, &d.Room, &d.IP, &d.MAC, &d.IsOn)
	return d, err
}

func ToggleDevicePower(id string, isOn bool) error {
	_, err := DB.Exec("UPDATE devices SET is_on = ? WHERE id = ?", isOn, id)
	return err
}

func ToggleGroupPower(groupType string, groupValue string, isOn bool) error {
	query := "UPDATE devices SET is_on = ? WHERE room = ?"
	if groupType == "type" {
		query = "UPDATE devices SET is_on = ? WHERE type = ?"
	}
	_, err := DB.Exec(query, isOn, groupValue)
	return err
}

func ToggleAllPower(isOn bool) error {
	_, err := DB.Exec("UPDATE devices SET is_on = ?", isOn)
	return err
}

func AddDevice(d Device) error {
	_, err := DB.Exec(`INSERT INTO devices (id, name, type, room, ip, mac, is_on) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		d.ID, d.Name, d.Type, d.Room, d.IP, d.MAC, d.IsOn)
	return err
}

func UpdateDevice(d Device) error {
	_, err := DB.Exec(`UPDATE devices SET name=?, type=?, room=?, ip=?, mac=? WHERE id=?`,
		d.Name, d.Type, d.Room, d.IP, d.MAC, d.ID)
	return err
}

func DeleteDevice(id string) error {
	_, err := DB.Exec(`DELETE FROM devices WHERE id=?`, id)
	return err
}

func DeleteDevicesByType(deviceType string) error {
	_, err := DB.Exec(`DELETE FROM devices WHERE type=?`, deviceType)
	return err
}

// --- Schedule Operations ---

func GetAllSchedules() ([]Schedule, error) {
	rows, err := DB.Query("SELECT room, COALESCE(name, ''), is_active, start_time, end_time, projector_delay, pc_delay, COALESCE(days_config, '') FROM schedules")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var schedules []Schedule
	for rows.Next() {
		var s Schedule
		err := rows.Scan(&s.Room, &s.Name, &s.IsActive, &s.StartTime, &s.EndTime, &s.ProjectorDelay, &s.PcDelay, &s.DaysConfig)
		if err != nil {
			return nil, err
		}
		schedules = append(schedules, s)
	}
	return schedules, nil
}

func UpdateSchedule(s Schedule) error {
	_, err := DB.Exec(`INSERT INTO schedules (room, name, is_active, start_time, end_time, projector_delay, pc_delay, days_config) 
		VALUES (?, ?, ?, ?, ?, ?, ?, ?) 
		ON CONFLICT(room) DO UPDATE SET 
		name=excluded.name,
		is_active=excluded.is_active, 
		start_time=excluded.start_time, 
		end_time=excluded.end_time, 
		projector_delay=excluded.projector_delay, 
		pc_delay=excluded.pc_delay,
		days_config=excluded.days_config`,
		s.Room, s.Name, s.IsActive, s.StartTime, s.EndTime, s.ProjectorDelay, s.PcDelay, s.DaysConfig)
	return err
}

func DeleteSchedule(room string) error {
	_, err := DB.Exec(`DELETE FROM schedules WHERE room=?`, room)
	if err == nil {
		DB.Exec(`UPDATE devices SET room='' WHERE room=?`, room)
	}
	return err
}
