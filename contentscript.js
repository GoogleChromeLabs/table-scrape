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

const TAGS = ['TBODY'];
let exporting = false;
let data = [];
let observer;

/**
 * Message passing listener
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('request', request)
  if (request.type == 'ping') {
    sendResponse({ type: 'pong' });
    return;
  }
  if (request.type == 'loadData') {
    getData();
  }
  if (request.type == 'stopExport') {
    stopExport();
  }
  if (request.type == 'updated') {
    stopExport();
  }
})

/**
 * Stop the data export
 */
function stopExport() {
  const filename = window.location.pathname.replace(/\//g, '_')
  sendForExport(data, filename)
  reset()
  if (observer) {
    observer.disconnect()
    observer = undefined
  }
}

/**
 * Retrieves the data on the first encountered table of the page.
 */
async function getData() {
  if (exporting) return
  exporting = true
  const filename = window.location.pathname.replace(/\//g, '_')
  let nextpage = await nextPageButton();
  let disabled = checkDisabled(nextpage)
  observer = new MutationObserver(mutations => {
    mutations.forEach(async (mutation) => {
      nextpage = await nextPageButton();
      if (!exporting) return;
      const tag = mutation.target.tagName
      if (TAGS.includes(tag)) {
        const rowdata = getTableData('td');
        data.push(...rowdata)
        disabled = checkDisabled(nextpage)
        if (disabled) {
          if (!data || data.length == 0) return
          sendForExport(data, filename)
          reset()
          observer.disconnect()
        }
        simulateClick(nextpage)
      }
    })
  });
  const table = document.querySelector('table')
  observer.observe(table, {
    subtree: true,
    childList: true
  });

  const headerData = getTableData('th')
  data.push(headerData[0])
  const firstPageData = getTableData('td');
  data.push(...firstPageData)

  if (disabled) {
    sendForExport(data, filename)
    observer.disconnect()
    return
  }
  if (!exporting) return
  simulateClick(nextpage)
}

/**
 * Reset the global variables
 */
function reset() {
  data = []
  exporting = false
  chrome.storage.local.set({ running: false })
}
/**
 * Check that the Node is disabled
 * @param {HTMLElement} node Button node
 * @returns
 */
function checkDisabled(node) {
  if (!node) return true
  let disabled = node.disabled
  if (!disabled) {
    disabled = node.ariaDisabled == 'true'
  }
  return disabled
}

/**
 * Get the next Page button using the translated value of next
 * @returns Button Node
 */
async function nextPageButton() {
  const text = chrome.i18n.getMessage("next")
  return await findRoleButtonByText(text)
}

/**
 * Sends the 2d array of the constructed table to be exported
 * @param {Array[]} data
 * @param {string} filename
 */
function sendForExport(data, filename) {
  const timestamp = new Date().toUTCString()
  const csvContent = ''
    + data.filter(row => row.length > 0).map(e => e.join(",")).join("\n");
  const encodedUri = encodeURI(csvContent);
  exportBlob({ name: `${filename}_${timestamp}.csv`, buffers: csvContent, mime: "application/octet-stream" })
}

/**
 * Export the blob as a file
 * @param {object} blob Blob info settings
 * @param {string} blob.name filename of the blob
 * @param {string} blob.buffers Blob content
 * @param {string} blob.mime Blob mimetype
 */
function exportBlob(blob = { name: 'export.csv', buffers: '', mime: "application/octet-stream" }) {
  const blobobject = new Blob([blob.buffers], { type: blob.mime });
  const blobUrl = URL.createObjectURL(blobobject);
  const a = document.createElement("a");
  a.download = blob.name || Math.random();
  a.href = blobUrl;
  a.click();
  URL.revokeObjectURL(blob);
}

/**
 * Gets the Table data and returns as a 2d array
 * @param {string} cellType Cell type as th or td to return the header or the cells
 * @returns
 */
function getTableData(cellType = 'td') {
  const tableData = [];
  const table = document.querySelector(`table`)
  const rows = table.querySelectorAll('tr')
  for (const row of rows) {
    const rowData = [];
    for (const [index, column] of row.querySelectorAll(cellType).entries()) {
      const text = '"' + column.innerText + '"'
      rowData.push(text)
    }
    tableData.push(rowData);
  }
  return tableData
}

/**
 * Checks if an element is likely to be the "Next" pagination button using text, aria-label,
 * icon font text, and SVG path matching as fallbacks.
 * @param {HTMLElement} elem 
 * @param {string} localizedText 
 * @returns {boolean}
 */
function isNextButton(elem, localizedText) {
  const innerText = (elem.innerText || '').toLowerCase().trim();
  const ariaLabel = (elem.getAttribute('aria-label') || '').toLowerCase().trim();
  const title = (elem.getAttribute('title') || '').toLowerCase().trim();
  const id = (elem.id || '').toLowerCase().trim();
  const className = (elem.className || '').toLowerCase().trim();

  // 1. Try localized text matching
  if (localizedText) {
    const text = localizedText.toLowerCase().trim();
    if (innerText.includes(text) || ariaLabel.includes(text) || title.includes(text)) {
      return true;
    }
  }

  // 2. English fallbacks
  if (innerText.includes('next') || ariaLabel.includes('next') || title.includes('next') || id.includes('next') || className.includes('next')) {
    return true;
  }
  
  // 3. Icon font fallbacks (common material design icons)
  const iconNames = ['chevron_right', 'navigate_next', 'arrow_forward', 'arrow_right'];
  for (const iconName of iconNames) {
    if (innerText.includes(iconName)) {
      return true;
    }
  }

  // 4. SVG path fallbacks for right chevrons / arrows
  const paths = elem.querySelectorAll('path');
  for (const path of paths) {
    const d = path.getAttribute('d') || '';
    if (
      d.includes('13.17 12') || 
      d.includes('7.41 13.17') || 
      d.includes('8.59 16.59') || 
      d.includes('10 6l6 6-6 6') ||
      d.includes('M10 6L8.59 7.41')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Find the Next button node using text matching & fallback icons.
 * @param {string} text Button text to search for
 * @returns {HTMLElement|undefined}
 */
async function findRoleButtonByText(text) {
  const roleButtons = [...document.querySelectorAll('[role="button"]')]
  const buttons = [...document.querySelectorAll('button')]
  const allButtons = [...roleButtons, ...buttons]
  
  console.log(`[TableScrape] Searching for next page button (matching term: "${text}"). Found ${allButtons.length} buttons total on page.`);

  const matched = allButtons.find(elem => isNextButton(elem, text));

  if (matched) {
    console.log(`[TableScrape] Successfully matched Next button:`, matched);
  } else {
    console.warn(`[TableScrape] Could not match a Next page button.`);
    console.log(`[TableScrape] Listing all available buttons to help diagnose:`);
    allButtons.forEach((elem, idx) => {
      const ariaLabel = elem.getAttribute('aria-label') || '';
      const svgPathCount = elem.querySelectorAll('path').length;
      console.log(`  #${idx}: tag=${elem.tagName}, class="${elem.className}", text="${(elem.innerText || '').trim().substring(0, 30)}", aria-label="${ariaLabel}", paths=${svgPathCount}`);
    });
  }

  return matched;
}

/**
 * Simulates a complete hardware pointer click sequence (pointerdown -> mousedown -> pointerup -> mouseup -> click)
 * to trigger stubborn event dispatchers (like Wiz/Jsaction) that standard element.click() fails to activate.
 * @param {HTMLElement} elem 
 */
function simulateClick(elem) {
  if (!elem) return;
  const eventOptions = { bubbles: true, cancelable: true, view: window };
  elem.dispatchEvent(new PointerEvent('pointerdown', { ...eventOptions, pointerType: 'mouse' }));
  elem.dispatchEvent(new MouseEvent('mousedown', eventOptions));
  elem.dispatchEvent(new PointerEvent('pointerup', { ...eventOptions, pointerType: 'mouse' }));
  elem.dispatchEvent(new MouseEvent('mouseup', eventOptions));
  elem.dispatchEvent(new MouseEvent('click', eventOptions));
  if (typeof elem.click === 'function') {
    elem.click();
  }
}
