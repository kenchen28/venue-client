# Venue Client PWA

A Progressive Web App (PWA) version of the Venue Client, converted from the original Chrome app for managing display devices in venue environments.

## Features

- **PWA Capabilities**: Installable, offline-ready, fullscreen display
- **Display Management**: Fullscreen mode, orientation handling, wake lock
- **Settings Management**: Persistent settings via localStorage
- **API Integration**: Heartbeat and communication with venue services
- **Logging**: Comprehensive logging with localStorage persistence

## Key Differences from Chrome App

- **No Chrome APIs**: Replaced Chrome-specific APIs with web standards
- **Single Display**: PWAs can't manage multiple displays like Chrome apps
- **localStorage**: Settings and logs stored locally instead of Chrome storage
- **Modern Build**: Uses Vite instead of Gulp for faster development

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Open http://localhost:3000

## Build

```bash
npm run build
docker build -t venue-pwa .

docker run -d --name venue-server -p 8080:80 -v $(pwd)/dist:/usr/share/nginx/html nginx:alpine
```



## Usage

1. **Settings**: Double-click or press Ctrl+S to open settings panel
2. **Fullscreen**: Press F11 or wait 3 seconds for auto-fullscreen
3. **Configuration**: Set InVenue host URL in settings
4. **Installation**: Use browser's "Install App" option for PWA installation

## Settings

- **InVenue Host**: API endpoint for venue services
- **Check Interval**: Heartbeat interval in milliseconds

## Browser Support

- Chrome/Edge: Full PWA support
- Firefox: Basic PWA support
- Safari: Limited PWA support

## Deployment

Build the app and serve the `dist` folder from any web server with HTTPS enabled for full PWA functionality.