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