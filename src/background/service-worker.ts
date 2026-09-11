// Service Worker - 消息路由和快捷键处理
chrome.runtime.onInstalled.addListener(() => {
  console.log('PasteGuard installed')
})

// 打开Side Panel
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    await chrome.sidePanel.open({ tabId: tab.id })
  }
})

// 监听来自content script或popup的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPEN_SIDE_PANEL') {
    // 从消息中获取 tabId（来自Popup）或从sender获取（来自content script）
    const tabId = message.tabId || sender.tab?.id
    if (tabId) {
      chrome.sidePanel.open({ tabId }).then(() => {
        sendResponse({ success: true })
      }).catch((error) => {
        console.error('Failed to open side panel:', error)
        sendResponse({ success: false, error: error.message })
      })
    } else {
      sendResponse({ success: false, error: 'No tab ID available' })
    }
    return true // 保持消息通道开放以异步发送响应
  }
})
