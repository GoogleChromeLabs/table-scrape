/* Copyright 2023 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*      http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License. */

/**
 * @fileoverview Localization function for popup.
 */

/**
 * Localize the page
 */
document.querySelectorAll('[data-locale]').forEach(elem => {
    elem.textContent = chrome.i18n.getMessage(elem.dataset.locale);
});

/**
 * Display an error banner inside the popup
 * @param {string} text Error message
 */
function showError(text) {
    const banner = document.querySelector('#error-banner')
    const errorText = document.querySelector('#error-text')
    errorText.textContent = text
    banner.style.display = 'flex'
}

/**
 * Hide the error banner inside the popup
 */
function hideError() {
    const banner = document.querySelector('#error-banner')
    banner.style.display = 'none'
}

/**
 * Ensures that the contentscript is active inside the targeted tab.
 * If not responding, it programmatically injects contentscript.js into the tab.
 * @param {number} tabId 
 * @returns {Promise<boolean>} True if active/successfully injected, false otherwise
 */
async function ensureContentScriptActive(tabId) {
    try {
        console.log(`[TableScrape] Pinging contentscript in tab ${tabId}...`);
        const response = await chrome.tabs.sendMessage(tabId, { type: 'ping' });
        if (response && response.type === 'pong') {
            console.log(`[TableScrape] Handshake successful. Contentscript is already active.`);
            return true;
        }
    } catch (err) {
        console.log(`[TableScrape] Handshake failed. Attempting programmatic injection of contentscript.js...`, err);
        
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tabId, allFrames: true },
                files: ['contentscript.js']
            });
            console.log(`[TableScrape] Programmatic injection successful.`);
            
            // Wait a tiny bit to let the script initialize
            await new Promise(resolve => setTimeout(resolve, 150));
            return true;
        } catch (injectError) {
            console.error(`[TableScrape] Programmatic injection failed:`, injectError);
            if (injectError.message.includes('Cannot access') || injectError.message.includes('not allowed') || injectError.message.includes('policy')) {
                showError("Chrome blocks extension scripts on this system or corporate administration page.");
            } else {
                showError("Could not connect to page. Try refreshing the webpage first.");
            }
            return false;
        }
    }
    return false;
}

/**
 * Send a message to the content script
 * @param {object} msg message to send
 * @returns {Promise<boolean>} True if successfully sent, false otherwise
 */
async function sendAMessage(msg = {}) {
    hideError();
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
            showError("Could not find an active tab.");
            return false;
        }

        // Check for blocked browser/extension pages
        if (tab.url && (
            tab.url.startsWith('chrome://') ||
            tab.url.startsWith('chrome-extension://') ||
            tab.url.startsWith('about:') ||
            tab.url.startsWith('https://chrome.google.com/webstore')
        )) {
            showError("Extensions are blocked on this system page. Try a normal webpage containing a table.");
            return false;
        }

        // Ensure the content script is active and responding (or inject it!)
        const isReady = await ensureContentScriptActive(tab.id);
        if (!isReady) {
            return false;
        }

        await chrome.tabs.sendMessage(tab.id, msg);
        return true;
    } catch (error) {
        console.error("[TableScrape] IPC Error:", error);
        showError("Could not connect to page. Please refresh the page or ensure the page has fully loaded.");
        return false;
    }
}

/**
 * On click handler to send the message to load the data
 */
document.querySelector('#send').addEventListener("click", async function (e) {
    const success = await sendAMessage({ type: 'loadData' })
    if (success) {
        const stop = document.querySelector('#stop')
        stop.style.display = 'block'
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.storage.local.set({ running: tab.id })
        window.close()
    }
});

/**
 * On click handler to send the message to stop and export the data
 */
document.querySelector('#stop').addEventListener('click', async function (e) {
    const success = await sendAMessage({ type: 'stopExport' })
    if (!success) {
        // If tab is unresponsive or closed, forcefully reset state
        chrome.storage.local.set({ running: false })
    }
    window.close()
})

/**
 * Check if the extension is running and show the stop button
 */
document.addEventListener("DOMContentLoaded", () => {
    chrome.storage.local.get('running', function (e) {
        if (e['running']) {
            const stop = document.querySelector('#stop')
            stop.style.display = 'block'
            const send = document.querySelector('#send')
            send.style.display = 'none'

            const statusDot = document.querySelector('#status-dot')
            statusDot.classList.add('active')
            const statusText = document.querySelector('#status-text')
            statusText.textContent = chrome.i18n.getMessage('statusScraping')
        }
    })
});
