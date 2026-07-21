export {}

// Listen for extension icon click on non-X pages
chrome.action.onClicked.addListener((tab) => {
  if (
    tab.url &&
    !tab.url.includes('x.com') &&
    !tab.url.includes('twitter.com')
  ) {
    chrome.action.setPopup({ popup: 'popup.html' })
  }
})

// Set badge to indicate extension is active on X pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    tab.url &&
    (tab.url.includes('x.com') || tab.url.includes('twitter.com'))
  ) {
    chrome.action.setBadgeText({ text: 'ON', tabId })
    chrome.action.setBadgeBackgroundColor({ color: '#1d9bf0', tabId })
  } else {
    chrome.action.setBadgeText({ text: '', tabId })
  }
})
