<a id="english"></a>
# Power Control System (Server & Client)

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Go](https://img.shields.io/badge/Go-1.20+-00ADD8?style=flat&logo=go&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-07405E?style=flat&logo=sqlite&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)

A smart, network-based remote power management solution designed to monitor and control the power status of remote devices (Servers, PCs, Projectors, Monitors) via Wake-on-LAN and a dedicated Windows client.

🌐 **Language:** [English](#english) | [한국어](#korean)

---

### 📥 Direct Download (Release Version)
You can download the pre-compiled executable files and use them immediately without setting up a development environment:
- **[👉 Download PowerCtrl.zip (Latest Release)](https://github.com/AkeeYoon/Power-Control-Scheduler/releases/latest/download/PowerCtrl.zip)**
> 💡 **Tip:** If you haven't created a GitHub Release yet, you can build the binaries yourself using the instructions below.

---

## 📖 Introduction
Power Control System is a utility for AV engineers and network administrators to effortlessly schedule and manage the power state of equipment. It features a central Web Dashboard (Server) that sends Wake-on-LAN (Magic Packets) to wake devices up, and communicates with a lightweight Windows Client to securely shut down or reboot remote Windows systems.

## ✨ Features
- **Real-Time Monitoring**: Automatically checks the ON/OFF status of registered network devices via ICMP Ping tests.
- **Wake-on-LAN (WOL)**: Sends Magic Packets to remotely turn on PCs and servers.
- **Smart Scheduling**: Flexible operation scheduling with "Unified Mode" (same time for all days) and "Advanced Mode" (independent times per day).
- **Windows Client Control**: A lightweight background client tray app that receives shutdown/reboot commands from the server to safely power off target machines.
- **Responsive Dashboard UI**: Clean, modern web interface with intuitive scheduling toggles and device management.

## 🛠 Tech Stack
- **Backend / Client Engine**: Go (Golang)
- **Database**: SQLite (Local embedded database)
- **Frontend**: Vanilla HTML5, CSS3, JavaScript
- **Build Tools**: `go-winres` (for embedding Windows executable icons and resources)

## 🚀 Installation & Execution

### Prerequisites
- [Go (Golang)](https://golang.org/dl/) 1.20 or higher

### Installation
```bash
# Clone the repository
git clone https://github.com/AkeeYoon/Power-Control-Scheduler.git
cd Power-Control-Scheduler

# Install the go-winres package for Windows icons (Optional)
go install github.com/tc-hib/go-winres@latest
```

### Build Execution
```bash
# 1. Build the Server
cd PowerControlServer
go-winres make
go build -ldflags "-H=windowsgui -w -s" -o ..\PowerControl.exe .

# 2. Build the Client
cd ../PowerControlClient
go-winres make
go build -ldflags "-H=windowsgui -w -s" -o ..\PowerControlClient.exe .
```

### 📱 Mobile Dashboard Connection
You can access the control dashboard from your mobile phone or tablet by opening a web browser and navigating to the server's local IP address:
- **Default Connection Format:** `http://<SERVER_IP>:<PORT>`
- **Example Address:** `http://192.168.1.XXX:8080` (where `192.168.1.XXX` is your server machine's IP, and `8080` is the configured port)

## 📄 License
This project is licensed under the [MIT License](LICENSE).

---

<a id="korean"></a>
# Power Control System (서버 & 클라이언트)

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Go](https://img.shields.io/badge/Go-1.20+-00ADD8?style=flat&logo=go&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-07405E?style=flat&logo=sqlite&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)

네트워크상에 있는 원격 장비(서버, PC, 프로젝터, 모니터 등)의 전원을 스마트하게 모니터링하고 제어하기 위해 개발된 Go(Golang) 기반의 전원 관리 솔루션입니다.

🌐 **언어:** [English](#english) | [한국어](#korean)

---

### 📥 릴리즈 버전 즉시 다운로드 (Release Version)
복잡한 개발 환경 구성 없이, 컴파일이 완료된 실행 파일 압축본을 다운로드하여 즉시 사용할 수 있습니다:
- **[👉 PowerCtrl.zip 다운로드 (최신 릴리즈)](https://github.com/AkeeYoon/Power-Control-Scheduler/releases/latest/download/PowerCtrl.zip)**
> 💡 **팁:** 아직 GitHub Release를 등록하지 않으셨다면, 하단의 빌드 설명서를 참고하여 소스코드에서 직접 빌드할 수 있습니다.

---

## 📖 소개
Power Control System은 AV 엔지니어 및 시스템 관리자가 네트워크 장비의 전원 상태를 손쉽게 제어하고 예약할 수 있도록 돕는 유틸리티입니다. Wake-on-LAN(WOL) 매직 패킷을 전송하여 장비를 켜는 **웹 기반 대시보드 서버**와, 서버로부터 종료/재부팅 명령을 수신하여 시스템을 안전하게 끄는 **가벼운 윈도우 클라이언트** 프로그램으로 구성되어 있습니다.

## ✨ 주요 기능 (Features)
- **실시간 상태 모니터링**: 네트워크 핑(Ping) 테스트를 통해 장비들의 실시간 켜짐/꺼짐(ON/OFF) 상태를 파악합니다.
- **Wake-on-LAN (WOL)**: MAC 주소를 기반으로 매직 패킷을 전송하여 원격으로 PC 및 서버의 전원을 켭니다.
- **스마트 스케줄링**: "기본 모드(요일 통합)"와 "고급 모드(요일별 개별 설정)"의 토글 전환을 지원하여 유연한 구동 시간 예약이 가능합니다.
- **윈도우 클라이언트 제어**: 백그라운드 트레이에서 가볍게 동작하며, 서버의 명령을 받아 윈도우 시스템을 안전하게 끄거나 재부팅합니다.
- **직관적인 대시보드 UI**: 반응형 웹 기술이 적용된 모던하고 깔끔한 기기 관리 인터페이스를 제공합니다.

## 🛠 기술 스택 (Tech Stack)
- **Backend / Client**: Go (Golang)
- **Database**: SQLite (로컬 데이터베이스)
- **Frontend**: Vanilla HTML5, CSS3, JavaScript
- **Build Tools**: `go-winres` (윈도우 실행 파일 아이콘 및 리소스 패키징)

## 🚀 설치 및 실행 방법

### 요구 사항 (Prerequisites)
- [Go (Golang)](https://golang.org/dl/) 1.20 이상

### 설치 명령어
```bash
# 저장소 클론
git clone https://github.com/AkeeYoon/Power-Control-Scheduler.git
cd Power-Control-Scheduler

# 윈도우 아이콘 리소스 빌드를 위한 go-winres 패키지 설치 (선택)
go install github.com/tc-hib/go-winres@latest
```

### 실행 및 빌드 명령어
```bash
# 1. 서버 빌드
cd PowerControlServer
go-winres make
go build -ldflags "-H=windowsgui -w -s" -o ..\PowerControl.exe .

# 2. 클라이언트 빌드
cd ../PowerControlClient
go-winres make
go build -ldflags "-H=windowsgui -w -s" -o ..\PowerControlClient.exe .
```

### 📱 모바일(폰) 대시보드 접속 방법
모바일 기기(스마트폰, 태블릿)의 웹 브라우저를 통해 전원 제어 대시보드에 접속하여 간편하게 제어할 수 있습니다.
- **접속 주소 형식:** `http://<서버_IP>:<포트>`
- **접속 주소 예시:** `http://192.168.1.XXX:8080` (여기서 `192.168.1.XXX`는 서버 프로그램이 구동 중인 PC의 IP 주소이며, `8080`은 설정된 서버 포트입니다.)

## 📄 라이선스
이 프로젝트는 [MIT 라이선스](LICENSE)를 따릅니다.
