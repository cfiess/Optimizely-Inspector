# Optimizely Inspector Chrome Extension

A Chrome extension to view and switch Optimizely experiment variations on any page.

## Features

- See which Optimizely experiments are running on the current page
- View which variation you're currently bucketed into
- Force any variation by clicking a button (reloads page with force parameter)
- See experiment metrics from the Optimizely REST API
- Saves your API token for full experiment details

## Installation

### From Source (Developer Mode)

1. **Generate Icons** (optional but recommended):
   - Open `icons/icon.svg` in a browser or image editor
   - Export as PNG in three sizes:
     - `icon16.png` (16x16 pixels)
     - `icon48.png` (48x48 pixels)
     - `icon128.png` (128x128 pixels)
   - Or use an online SVG to PNG converter

2. **Load the Extension**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select this `extension` folder

3. **Pin the Extension** (optional):
   - Click the puzzle piece icon in Chrome toolbar
   - Pin "Optimizely Inspector" for easy access

## Usage

1. Navigate to any page with Optimizely Web installed
2. Click the Optimizely Inspector icon in the toolbar
3. The popup will show:
   - Project info and your visitor ID
   - All running experiments
   - Your current variation (highlighted)
   - Click any variation button to force it

## API Token

For full experiment details including metrics:

1. Log into your Optimizely account
2. Go to **Settings** → **API Access**
3. Generate a Personal Access Token
4. Paste it into the extension's API Token field
5. Click Save

The token is stored locally in your browser and is only used to fetch experiment data from the Optimizely REST API.

## How Forcing Variations Works

When you click a variation button, the extension:
1. Adds `?optimizely_x{experimentId}={variationId}` to the current URL
2. Reloads the page with this parameter
3. Optimizely's snippet detects this parameter and forces the specified variation

This is the same mechanism used by Optimizely's QA tools.

## Permissions

- **activeTab**: Access the current tab to detect Optimizely
- **scripting**: Inject script to read `window.optimizely` state
- **storage**: Save your API token locally
- **host_permissions**: Required to run on any website

## Troubleshooting

**"No Optimizely detected"**
- The page may not have Optimizely installed
- Optimizely may not have finished loading (wait and refresh)
- Check the browser console for Optimizely errors

**Variations not showing**
- Make sure you have the API token configured for full details
- The experiment may not be running on this page's URL
