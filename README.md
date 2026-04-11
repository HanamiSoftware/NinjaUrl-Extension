# NinjaURL&trade; Chrome Extension

Minimal Chrome extension to generate NinjaLinks (smart short URLs) instantly from your browser.

## Demo

![Demo](./assets/demo/demo.gif)

## What it does

NinjaURL lets you shorten the current tab URL in one click and copy it immediately.

It’s built to stay out of the way and integrate directly into your browsing workflow.

## Features

- Shorten current tab URL instantly
- One-click copy
- Works with authenticated and anonymous users
- Side panel interface
- Ready for future analytics and link management

## Architecture

- Extension: Chrome Extension (Manifest V3)
- Auth: NinjaConnect (AuthGear Hosted UI MVP AuthGear Self Hosted Final Product)
- API: https://api.ninjaurl.io (not yet available)
- Auth: https://auth.ninjaconnect.io (not yet available)

## Installation

### Chrome Web Store
Coming soon.

### Manual install

```bash
git clone https://github.com/YOUR_USERNAME/ninjaurl-chrome-extension.git
```
## Installation steps:
- Open Chrome
- Go to chrome://extensions/
- Enable Developer Mode
- Click "Load unpacked"
- Select the project folder

## How it works
- Reads the active tab URL user Click "Shorten and Copy"
- Sends it to the NinjaURL API
- Receives a short link
- Shows it in the side panel
- Allows instant copy

## Roadmap
- Link history
- QR code generation
- Analytics dashboard
- Retry / offline queue
- Better anonymous UX
- future implemntation (Suggestion AI) Ninja re:Mind&trade; integration for link management and analytics insights