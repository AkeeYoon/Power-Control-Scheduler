package services

import (
	"log"
	"time"

	"powerctrl/database"
)

var IsSchedulerEnabled bool = true

func StartScheduler() {
	go func() {
		var lastCheckedMinute string
		ticker := time.NewTicker(1 * time.Second)
		defer ticker.Stop()

		// Map Go weekday to our day keys
		weekdayMap := map[time.Weekday]string{
			time.Monday:    "mon",
			time.Tuesday:   "tue",
			time.Wednesday: "wed",
			time.Thursday:  "thu",
			time.Friday:    "fri",
			time.Saturday:  "sat",
			time.Sunday:    "sun",
		}

		for range ticker.C {
			now := time.Now()
			currentTime := now.Format("15:04") // HH:mm format

			// Run check only once per minute
			if currentTime != lastCheckedMinute {
				lastCheckedMinute = currentTime

				if !IsSchedulerEnabled {
					continue
				}

				todayKey := weekdayMap[now.Weekday()]

				schedules, err := database.GetAllSchedules()
				if err == nil {
					for _, schedule := range schedules {
						if !schedule.IsActive {
							continue
						}

						// Determine today's start/end time from DaysConfig
						startTime := schedule.StartTime
						endTime := schedule.EndTime
						todayEnabled := true

						days := database.ParseDaysConfig(schedule.DaysConfig)
						if days != nil {
							dayConf, exists := days[todayKey]
							if !exists || !dayConf.Enabled {
								todayEnabled = false
							} else {
								startTime = dayConf.StartTime
								endTime = dayConf.EndTime
							}
						}

						if !todayEnabled {
							continue
						}

						if currentTime == startTime {
							// Trigger Turn ON Sequence
							log.Printf("Scheduler triggered ON sequence for room: %s (day: %s)", schedule.Room, todayKey)
							go ExecutePowerOnSequence(schedule)
						} else if currentTime == endTime {
							// Trigger Turn OFF Sequence
							log.Printf("Scheduler triggered OFF sequence for room: %s (day: %s)", schedule.Room, todayKey)
							go ExecutePowerOffSequence(schedule)
						}
					}
				}
			}
		}
	}()
}

func ExecutePowerOnSequence(schedule database.Schedule) {
	devices, err := database.GetAllDevices()
	if err != nil {
		return
	}

	// Step 1: Turn ON Projectors
	for _, d := range devices {
		if d.Room == schedule.Room && d.Type == "projector" {
			log.Printf("[Scheduler] Powering ON Projector: %s", d.Name)
			SendPJLinkCommand(d.IP, "%1POWR 1", "")
			database.ToggleDevicePower(d.ID, true)
		}
	}

	// Wait for projector delay
	if schedule.ProjectorDelay > 0 {
		log.Printf("[Scheduler] %s: Waiting %d minutes for projectors...", schedule.Room, schedule.ProjectorDelay)
		time.Sleep(time.Duration(schedule.ProjectorDelay) * time.Minute)
	}

	// Step 2: Turn ON PCs (WOL)
	for _, d := range devices {
		if d.Room == schedule.Room && d.Type == "pc" {
			log.Printf("[Scheduler] Powering ON PC: %s", d.Name)
			WakeOnLAN(d.MAC)
			database.ToggleDevicePower(d.ID, true)
		}
	}
}

func ExecutePowerOffSequence(schedule database.Schedule) {
	devices, err := database.GetAllDevices()
	if err != nil {
		return
	}

	// Step 1: Turn OFF PCs
	for _, d := range devices {
		if d.Room == schedule.Room && d.Type == "pc" {
			log.Printf("[Scheduler] Powering OFF PC: %s", d.Name)
			ShutdownPC(d.IP)
			database.ToggleDevicePower(d.ID, false)
		}
	}

	// Wait for PC delay
	if schedule.PcDelay > 0 {
		log.Printf("[Scheduler] %s: Waiting %d minutes for PCs to shutdown...", schedule.Room, schedule.PcDelay)
		time.Sleep(time.Duration(schedule.PcDelay) * time.Minute)
	}

	// Step 2: Turn OFF Projectors
	for _, d := range devices {
		if d.Room == schedule.Room && d.Type == "projector" {
			log.Printf("[Scheduler] Powering OFF Projector: %s", d.Name)
			SendPJLinkCommand(d.IP, "%1POWR 0", "")
			database.ToggleDevicePower(d.ID, false)
		}
	}
}
