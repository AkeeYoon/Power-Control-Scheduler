package services

import (
	"log"
	"os"
	"path/filepath"

	"golang.org/x/sys/windows/registry"
)

const appName = "PowerControlSystem"

func RegisterAutoStart() {
	// Get full path to the executable
	exePath, err := os.Executable()
	if err != nil {
		log.Println("AutoStart Error: Could not get executable path:", err)
		return
	}
	absPath, err := filepath.Abs(exePath)
	if err != nil {
		log.Println("AutoStart Error: Could not get absolute path:", err)
		return
	}

	key, _, err := registry.CreateKey(registry.CURRENT_USER, `Software\Microsoft\Windows\CurrentVersion\Run`, registry.SET_VALUE)
	if err != nil {
		log.Println("AutoStart Error: Could not open/create registry key:", err)
		return
	}
	defer key.Close()

	err = key.SetStringValue(appName, `"`+absPath+`"`)
	if err != nil {
		log.Println("AutoStart Error: Could not set registry value:", err)
		return
	}

	log.Println("AutoStart successfully registered to Windows startup.")
}
