package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os/exec"
	"runtime"
	"syscall"
)

type Response struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

func main() {
	http.HandleFunc("/ping", handlePing)
	http.HandleFunc("/shutdown", handleShutdown)

	log.Println("PowerControl Client is running on port 9999...")
	if err := http.ListenAndServe(":9999", nil); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func handlePing(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(Response{Success: true, Message: "pong"})
}

func handleShutdown(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if runtime.GOOS != "windows" {
		w.WriteHeader(http.StatusNotImplemented)
		json.NewEncoder(w).Encode(Response{Success: false, Message: "Only Windows is supported for shutdown via this agent."})
		return
	}

	cmd := exec.Command("shutdown", "/s", "/f", "/t", "0")
	// Hide CMD window completely
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000} // CREATE_NO_WINDOW

	err := cmd.Run()
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(Response{Success: false, Message: "Failed to execute shutdown command: " + err.Error()})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(Response{Success: true, Message: "Shutdown initiated successfully"})
}
