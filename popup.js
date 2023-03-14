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
 * Send a message to the content script
 * @param {object} msg message to send
 */
async function sendAMessage(msg={}) {
    const [tab] = await chrome.tabs.query({active: true, lastFocusedWindow: true});
    const response = await chrome.tabs.sendMessage(tab.id, msg);
    // do something with response here, not outside the function
    console.log(response);
}

/**
 * On click handler to send the message to load the data
 */
document.querySelector('#send').addEventListener("click", function(e){
    sendAMessage({type:'loadData'})
    window.close()
});