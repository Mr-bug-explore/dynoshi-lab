# DYNOSHI ANDROID LAB

**Real Android Virtual Device, Physical ADB & Multi-Host Control Center**

---

## 1. Overview

**DYNOSHI ANDROID LAB** manages genuine Android OS instances via official Android SDK tools (`adb`, `emulator`, `avdmanager`, `sdkmanager`), physical USB/TCP-IP Android hardware, and distributed workstation host agents (`scripts/dynoshi_node_agent.ts`).

Every running device in DYNOSHI displays the actual Android framebuffer (`adb exec-out screencap -p`) and dispatches real ADB events (`input tap`, `input swipe`, `input keyevent`, `input text`, `pm`, `am`, `monkey`, `logcat`).

### Key Capabilities
- **Host SDK & Virtualization Diagnostics**: Probes `adb`, `emulator`, `avdmanager`, `sdkmanager`, `scrcpy`, `/dev/kvm` (Linux), and WHPX/AEHD (Windows) and reports any missing prerequisite explicitly.
- **Real Device & AVD Management**: Discovers USB/TCP-IP ADB devices (`adb devices -l`), connects wireless/remote ADB endpoints (`adb connect host:port`), lists real AVDs (`avdmanager list avd` / `emulator -list-avds`), and spawns independent emulator OS processes.
- **Live Framebuffer Screen & Controls**: Streams PNG framebuffers directly from the running Android OS, translates mouse clicks and drags to exact device pixel coordinates, and sends Back/Home/Recents/Power/Volume/Text/Shell commands.
- **Technical Verification & Google Play Audit**: Runs verifiable ADB checks (`adb devices -l`, `getprop`, `sys.boot_completed`, `pm list packages` for `com.android.vending` and `com.google.android.youtube`, `ping`, `dumpsys window displays`) with verbatim command output.
- **Real Package, File & Automation Workflows**: Inspects `pm list packages -f`, installs `.apk` via `adb install -r`, browses/pushes/pulls files via `adb ls` / `push` / `pull`, captures real PNG screenshots, and executes step-by-step ADB automation workflows.
- **Distributed Node Agents**: Connects to additional lab workstations running `npx tsx scripts/dynoshi_node_agent.ts` with live HTTP `/health` verification.

---

## 2. Requirements for Local Android Emulators

To boot local Android Emulators with Google Play Store (`com.android.vending`) and YouTube (`com.google.android.youtube`):
1. Install **Android Studio** or Android SDK Command-Line Tools with:
   - `platform-tools` (`adb`)
   - `emulator`
   - A Google Play system image (`system-images;android-34;google_apis_playstore;x86_64`)
2. Enable hardware virtualization:
   - **Windows**: Enable Windows Hypervisor Platform (WHPX) or Android Emulator Hypervisor Driver (AEHD) in BIOS/Windows Features.
   - **Linux**: Ensure `/dev/kvm` is present and R/W accessible (note: sandboxed containers without `/dev/kvm` cannot run hardware-accelerated QEMU locally, and DYNOSHI will report this blocker explicitly).
3. Or attach a physical Android phone with **USB Debugging** / **Wireless Debugging** enabled (`adb connect <ip>:<port>`).

---

## 3. Quick Start

```bash
npm install
npm test
npm run dev
```

On Windows desktop, double-click `launch_dynoshi.bat`.

To connect a remote workstation node:
```bash
npx tsx scripts/dynoshi_node_agent.ts
```
