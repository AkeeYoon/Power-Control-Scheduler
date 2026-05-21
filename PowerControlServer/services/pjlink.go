package services

import (
	"crypto/md5"
	"errors"
	"fmt"
	"io"
	"net"
	"strings"
	"time"
)

// SendPJLinkCommand sends a PJLink protocol command to the specified projector IP.
// Common commands:
// Power On:  "%1POWR 1"
// Power Off: "%1POWR 0"
func SendPJLinkCommand(ip, command, password string) error {
	address := net.JoinHostPort(ip, "4352") // Default PJLink port
	conn, err := net.DialTimeout("tcp", address, 3*time.Second)
	if err != nil {
		return fmt.Errorf("failed to connect to projector: %v", err)
	}
	defer conn.Close()

	conn.SetDeadline(time.Now().Add(5 * time.Second))

	// Read initial authentication request from projector
	buffer := make([]byte, 1024)
	n, err := conn.Read(buffer)
	if err != nil {
		return fmt.Errorf("failed to read greeting: %v", err)
	}

	greeting := string(buffer[:n])
	greeting = strings.TrimSpace(greeting)

	// PJLink Class 1/2 Greeting Format: "PJLINK 0" (no auth) or "PJLINK 1 <token>" (auth)
	if !strings.HasPrefix(greeting, "PJLINK") {
		return errors.New("invalid PJLink greeting")
	}

	var authPrefix string
	// Check if authentication is required
	if strings.HasPrefix(greeting, "PJLINK 1") {
		parts := strings.Split(greeting, " ")
		if len(parts) >= 3 && password != "" {
			token := parts[2]
			// Hash = MD5(token + password)
			hash := md5.New()
			io.WriteString(hash, token)
			io.WriteString(hash, password)
			authPrefix = fmt.Sprintf("%x", hash.Sum(nil))
		} else if password == "" {
			return errors.New("password required for this projector but not provided")
		}
	}

	// Prepare final command
	// Format: [AuthToken]%1COMMAND\r
	fullCommand := fmt.Sprintf("%s%s\r", authPrefix, command)

	// Send command
	_, err = conn.Write([]byte(fullCommand))
	if err != nil {
		return fmt.Errorf("failed to send command: %v", err)
	}

	// Read response
	n, err = conn.Read(buffer)
	if err != nil {
		return fmt.Errorf("failed to read response: %v", err)
	}
	response := string(buffer[:n])
	response = strings.TrimSpace(response)

	// Handle response
	// Format: %1POWR=OK or %1POWR=ERR1 etc.
	if strings.Contains(response, "=ERR") {
		return fmt.Errorf("projector returned error: %s", response)
	}

	return nil
}

// QueryPJLinkPower queries the true power state of the projector.
func QueryPJLinkPower(ip, password string) (bool, error) {
	address := net.JoinHostPort(ip, "4352")
	conn, err := net.DialTimeout("tcp", address, 2*time.Second)
	if err != nil {
		return false, err
	}
	defer conn.Close()

	conn.SetDeadline(time.Now().Add(3 * time.Second))

	buffer := make([]byte, 1024)
	n, err := conn.Read(buffer)
	if err != nil {
		return false, err
	}
	greeting := strings.TrimSpace(string(buffer[:n]))
	if !strings.HasPrefix(greeting, "PJLINK") {
		return false, errors.New("invalid PJLink greeting")
	}

	var authPrefix string
	// Check if authentication is required
	if strings.HasPrefix(greeting, "PJLINK 1") {
		parts := strings.Split(greeting, " ")
		if len(parts) >= 3 && password != "" {
			token := parts[2]
			hash := md5.New()
			io.WriteString(hash, token)
			io.WriteString(hash, password)
			authPrefix = fmt.Sprintf("%x", hash.Sum(nil))
		}
	}

	fullCommand := fmt.Sprintf("%s%%1POWR ?\r", authPrefix)
	_, err = conn.Write([]byte(fullCommand))
	if err != nil {
		return false, err
	}

	n, err = conn.Read(buffer)
	if err != nil {
		return false, err
	}
	response := strings.TrimSpace(string(buffer[:n]))

	// %1POWR=1 (ON) or %1POWR=3 (Warm up)
	if strings.Contains(response, "=1") || strings.Contains(response, "=3") {
		return true, nil
	}
	return false, nil
}
