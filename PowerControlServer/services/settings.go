package services

import (
	"encoding/json"
	"io/ioutil"
	"log"
	"os"
	"os/exec"
	"path/filepath"
)

type AppSettings struct {
	PreferredPort    int    `json:"preferredPort"`
	BroadcastIP      string `json:"broadcastIp"`
	SchedulerEnabled bool   `json:"schedulerEnabled"`
}

var (
	GlobalSettings AppSettings
	ActivePort     int
)

func LoadSettings() {
	GlobalSettings = AppSettings{
		PreferredPort:    8080,
		BroadcastIP:      "192.168.1.255",
		SchedulerEnabled: true,
	}

	path := filepath.Join("data", "settings.json")
	if _, err := os.Stat(path); os.IsNotExist(err) {
		SaveSettings() // Create default settings file
		return
	}

	data, err := ioutil.ReadFile(path)
	if err == nil {
		json.Unmarshal(data, &GlobalSettings)
	} else {
		log.Println("Error reading settings file:", err)
	}

	// Update older scheduler flag reference
	IsSchedulerEnabled = GlobalSettings.SchedulerEnabled
}

func SaveSettings() error {
	os.MkdirAll("data", os.ModePerm)
	path := filepath.Join("data", "settings.json")

	// Sync legacy flag from GlobalSettings (not the other way around)
	IsSchedulerEnabled = GlobalSettings.SchedulerEnabled

	data, err := json.MarshalIndent(GlobalSettings, "", "  ")
	if err != nil {
		return err
	}
	return ioutil.WriteFile(path, data, 0644)
}

func RestartApp() {
	exe, err := os.Executable()
	if err != nil {
		log.Println("Failed to get executable path for restart:", err)
		return
	}
	
	// Create a command that waits 2 seconds (using ping) and then starts the app.
	// This ensures the current process and its WebView2 child processes are completely dead
	// so that the EBWebView cache and database file locks are fully released.
	cmd := exec.Command("cmd", "/C", "ping 127.0.0.1 -n 2 > nul & start \"\" \""+exe+"\"")
	
	err = cmd.Start()
	if err != nil {
		log.Println("Failed to restart app:", err)
		return
	}
	
	os.Exit(0)
}
