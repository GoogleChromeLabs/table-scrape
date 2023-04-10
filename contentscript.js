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
  if (request.type == 'loadData') {
    getData()
  }
  if (request.type == 'stopExport') {
    stopExport()
  }
  if (request.type == 'updated') {
    stopExport()
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
      disabled = checkDisabled(nextpage)
      const tag = mutation.target.tagName
      if (TAGS.includes(tag)) {
        const rowdata = getTableData('td');
        data.push(...rowdata)
        if (disabled) {
          if (!data || data.length == 0) return
          sendForExport(data, filename)
          reset()
          observer.disconnect()
        }
        nextpage.click()
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
  nextpage.click()
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
 * Find the Next button node
 * @param {string} text Button text to search for
 * @returns
 */
async function findRoleButtonByText(text) {
  const roleButtons = [...document.querySelectorAll('[role="button"]')]
  const buttons = [...document.querySelectorAll('button')]
  const allButtons = [...roleButtons, buttons]
  return allButtons.find(elem => (elem.innerText && elem.innerText.toLowerCase().includes(text)) || (elem.getAttribute('aria-label') && elem.getAttribute('aria-label').toLowerCase().includes(text)))
}