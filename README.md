# 🛰️ NetSpace — Local Network Visualizer

NetSpace is a self-hosted dashboard that discovers every device on your local network and displays them as an interactive 2D radial map, with the router at the center and connected devices arranged around it.

![NetSpace](https://img.shields.io/badge/NetSpace-v1.0-blue)

## Features

- **Live 2D Network Map** — Radial hub-and-spoke diagram with the router at center and devices on concentric rings
- **Automatic Device Discovery** — Ping sweep + ARP cache reading to find all LAN devices
- **Smart Device Classification** — Identifies iPhones, Macs, printers, game consoles, smart home devices, and more from hostname/vendor patterns
- **Offline MAC Vendor Lookup** — Uses the bundled IEEE OUI database, no internet required
- **mDNS/Bonjour Resolution** — Discovers friendly hostnames like "John's iPhone"
- **Animated Connections** — Traveling pulse along connection lines between router and devices
- **Device Management** — Click any device to view details, assign nicknames, and add notes (persisted across restarts)
- **Responsive Design** — Radial map on desktop, card list on mobile
- **Cross-Platform** — Runs on macOS, Linux, and Windows

## Quick Start

```bash
# 1. Install all dependencies (backend + frontend)
npm install && cd frontend && npm install && cd ..

# 2. Start both backend and frontend
npm run dev
source ~/.nvm/nvm.sh && npm run dev

# 3. Open in your browser
# From the host machine:   http://localhost:5173
# From another device:     http://<your-local-ip>:5173
```

The backend runs on port **3778** and the frontend dev server on port **5173** (with API proxy).

## Opening from another device

Any device on the same Wi-Fi/LAN can access NetSpace. Find your host machine's IP address (shown in the NetSpace header after the first scan) and navigate to:

```
http://<host-ip>:5173
```

## Configuration

Copy `.env.example` to `.env` to customize:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3778` | Backend API port |
| `FRONTEND_PORT` | `5173` | Vite dev server port |

Additional settings (refresh interval, capacity override, online vendor lookup) are configurable from the in-app **Settings** panel.

## Architecture

```
┌──────────────────┐    REST API     ┌─────────────────────┐
│  React Frontend  │ ◄──────────────► │   Node.js Backend   │
│  (Vite + React)  │    /api/*       │   (Express)         │
│                  │                 │                     │
│  • 2D radial map │                 │  • Ping sweep       │
│  • Device cards  │                 │  • ARP cache read   │
│  • Search/filter │                 │  • DNS/mDNS lookup  │
│  • Settings UI   │                 │  • OUI vendor match │
└──────────────────┘                 │  • Classification   │
                                     │  • JSON persistence │
                                     └─────────────────────┘
```

**Why not browser-based discovery?** Browsers cannot enumerate LAN devices — there is no browser API for ARP tables, raw sockets, or ping sweeps. This is a deliberate security restriction. All discovery runs server-side in Node.js, which has OS-level access.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/network` | Router IP, subnet, capacity, connected count |
| `GET` | `/api/devices` | All discovered devices |
| `POST` | `/api/scan` | Trigger immediate rescan |
| `PATCH` | `/api/devices/:id` | Update device nickname/notes |
| `GET` | `/api/settings` | Current settings |
| `PUT` | `/api/settings` | Update settings |

## Known Caveats & OS-Specific Notes

### Permissions
- **macOS**: Generally works without `sudo`. If you see incomplete results, try running with `sudo`.
- **Linux**: Full ARP visibility may require `sudo` or the `CAP_NET_RAW` capability on the Node binary.
- **Windows**: Run the terminal as **Administrator** for best results.

### MAC Address Randomization
Modern iOS and Android devices randomize their MAC address and hostname per network for privacy. This means:
- Device identification is **best-effort** — accurate when a device exposes its real hostname, generic ("Unknown device") otherwise.
- You can manually **rename any device** with a nickname; this override persists across rescans.

### Router Capacity
There is no network-discoverable value for a router's true wireless client limit — it's a hardware/firmware spec, not something broadcast. NetSpace shows:
- An **estimated capacity** computed from the subnet size (e.g., `/24` → up to 254 usable addresses)
- A user-configurable **manufacturer-rated capacity** override in Settings

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express, CORS |
| Discovery | `arp`, `ping`, `default-gateway`, `oui`, `multicast-dns` |
| Persistence | lowdb (JSON file) |
| Frontend | React 18, Vite, Tailwind CSS |
| Animation | Framer Motion |
| Icons | lucide-react |

## Project Structure

```
netspace/
├── package.json          # Root: concurrently runs backend + frontend
├── .env.example
├── README.md
├── backend/
│   ├── server.js         # Express entry point
│   ├── discovery/
│   │   ├── gateway.js    # Gateway/subnet detection
│   │   ├── scanner.js    # Ping sweep + ARP + enrichment
│   │   ├── classifier.js # Device type classification
│   │   └── oui-lookup.js # MAC vendor lookup
│   ├── routes/
│   │   ├── network.js
│   │   ├── devices.js
│   │   ├── scan.js
│   │   └── settings.js
│   └── store/
│       └── db.js         # lowdb persistence
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── App.jsx
        ├── main.jsx
        ├── index.css
        ├── hooks/
        │   └── useNetwork.js
        ├── utils/
        │   └── api.js
        └── components/
            ├── NetworkMap.jsx
            ├── RouterNode.jsx
            ├── DeviceNode.jsx
            ├── ConnectionLine.jsx
            ├── Header.jsx
            ├── DeviceDrawer.jsx
            ├── SettingsModal.jsx
            ├── LoadingState.jsx
            ├── ErrorState.jsx
            ├── MobileList.jsx
            └── Footer.jsx
```

## ⚠️ Security Notice

**This tool should only be run on networks you own or are authorized to administer.** Network scanning can be considered intrusive on networks you don't control.

## License

MIT
