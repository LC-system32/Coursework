<p align="center">
  <a href="#">
    <img src="favicon.svg" alt="Data Import Bridge" width="180">
<h1 align="center">Data Import Bridge</h1>
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-beta-blue" alt="Status">
  <img src="https://img.shields.io/badge/version-v2.0.1-green" alt="Version">
  <img src="https://img.shields.io/github/license/sourcerer-io/hall-of-fame.svg?colorB=ff0000" alt="License">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/Vue.js-42B883?logo=vuedotjs&logoColor=white" alt="Vue.js">
  <img src="https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/npm-CB3837?logo=npm&logoColor=white" alt="npm">
  <img src="https://img.shields.io/badge/Chrome-MV3-4285F4?logo=googlechrome&logoColor=white" alt="Chrome MV3">
  <img src="https://img.shields.io/badge/Firefox-MV3-FF7139?logo=firefoxbrowser&logoColor=white" alt="Firefox MV3">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/vue-3.5.31-42b883" alt="Vue version">
  <img src="https://img.shields.io/badge/node-25.8.2-339933" alt="Node version">
  <img src="https://img.shields.io/badge/npm-11.11.1-CB3837" alt="npm version">
  <img src="https://img.shields.io/badge/Chrome-%3E%2088%2B-4285F4?logo=googlechrome&logoColor=white" alt="Chrome > 88+">
  <img src="https://img.shields.io/badge/Firefox-%3E109.0a1-FF7139?logo=firefoxbrowser&logoColor=white" alt="Firefox > 109.0a1">
</p>

## Introduction

**Data Import Bridge** is a browser extension that helps transfer data from one website to another faster and with fewer manual actions.

It allows you to:
- collect data from a source page
- match source fields with target fields
- automatically fill the target form
- support file transfer during the import process

**Simple workflow:**  
`Open source page → Open target page → Start import → Plugin Work → Done`

---

## Installation for Google Chrome

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked**
4. Select the extension folder

After installation, pin the extension to the toolbar for quick access.

If you update the extension files later, reload the extension on the extensions page and refresh the browser tabs where it is used.

---

## Installation for Mozilla Firefox

### Option 1 — Installation from `.zip` file

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select the `manifest.json` file

After installation, the extension will be available for used in the Firefox.

`Note: Temporary add-ons in Firefox are can removed after the browser is closed, so they need to be loaded again the next time you start Firefox.`

### Option 2 — Installation from `.xpi` file

1. Open Firefox
2. Drag and drop the `.xpi` file into the browser window  
   **or** open the `.xpi` file directly in Firefox
3. Confirm the installation when Firefox shows the prompt

After installation, the extension will be added to Firefox and can be used like a regular installed add-on.

---

## Rules for the Development New Features

**Keep structure stable:**  
- `background/` — orchestration, tabs, import flow  
- `content/` — DOM, reading, writing, file flow  
- `popup/common/` — shared popup helpers  
- `popup/main/` — main popup workflow  
- `popup/settings/` — settings workflow  

**Do not break:**  
- source → target import  
- saved mappings  
- JSON config compatibility  
- picker behavior  
- overwrite protection  
- file transfer flow  

**Before merge:**  
`Check config → Check popup → Check content → Check background → Test full import`

---

## Functional which been released

**Implemented:**  
- popup-based control  
- source and target site configuration  
- interactive field picker  
- field mapping  
- JSON import/export  
- automatic source data collection  
- automatic target page preparation  
- automatic target field filling  
- file transfer support  
- overwrite confirmation  
- timeout-based overwrite cancel  
- status and debug messages  
- import validation  
- hotkey support  
