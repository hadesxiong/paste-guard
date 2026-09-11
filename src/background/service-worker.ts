// Service Worker - 打开Side Panel
chrome.runtime.onInstalled.addListener(() => {
  console.log('PasteGuard installed')
})

// 点击扩展图标直接打开Side Panel
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    await chrome.sidePanel.open({ tabId: tab.id })
  }
})
