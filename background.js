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
* Get the values from Storage
* @param {string} item -Storage item
* @returns
*/
function getStorage(item) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(item, (res) => {
            resolve(res[item]);
        });
    });
}

/**
 * Message passing to the content script
 * @param {object} msg message to pass
 */
async function sendMessage(msg = {}) {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, msg);
}

/**
 * Listen for Web Navigation and trigger the saving of the file. 
 */
chrome.webNavigation.onBeforeNavigate.addListener(async function(e){
    const running = await getStorage('running')
    if (running && running=== e.tabId) {
        sendMessage({ type: 'updated' })
    }
})