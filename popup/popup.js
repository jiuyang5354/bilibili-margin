// 映间 MARGIN 0.6 · 21st.dev UI Control Controller

const toggle = document.getElementById('toggle')
const toggleDesc = document.getElementById('toggle-desc')
const engineStatus = document.getElementById('engine-status')
const engineText = document.getElementById('engine-text')
const status = document.getElementById('status')
const segmentedGlider = document.getElementById('segmented-glider')
const scopeBtns = document.querySelectorAll('.segmented-btn')
const scopeIndicator = document.getElementById('scope-indicator')
const themeBtns = document.querySelectorAll('.theme-pill-btn')

let enabled = true
let currentScope = 'all' // 'all' | 'home' | 'watch'
let currentTheme = 'dark' // 'dark' | 'light' | 'auto'

// Storage Helper with safe fallback
const storage = {
  get: async (keys) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return chrome.storage.local.get(keys)
    }
    const res = {}
    for (const k of (Array.isArray(keys) ? keys : [keys])) {
      res[k] = localStorage.getItem(k) ? JSON.parse(localStorage.getItem(k)) : undefined
    }
    return res
  },
  set: async (items) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return chrome.storage.local.set(items)
    }
    for (const [k, v] of Object.entries(items)) {
      localStorage.setItem(k, JSON.stringify(v))
    }
  }
}

function updateToggleUI() {
  toggle.setAttribute('aria-checked', String(enabled))
  if (enabled) {
    engineStatus.classList.remove('disabled')
    engineText.textContent = '已生效'
    toggleDesc.textContent = '净化原生首页与播放页'
  } else {
    engineStatus.classList.add('disabled')
    engineText.textContent = '已停用'
    toggleDesc.textContent = '已恢复 B 站原生界面'
  }
}

function updateScopeUI(scope) {
  const indexMap = { all: 0, home: 1, watch: 2 }
  const labels = { all: '全部页面', home: '仅首页', watch: '仅播放页' }
  const idx = indexMap[scope] ?? 0
  segmentedGlider.style.transform = `translateX(${idx * 100}%)`
  scopeBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.scope === scope)
  })
  if (scopeIndicator) {
    scopeIndicator.textContent = labels[scope] || '全部页面'
  }
}

function updateThemeUI(theme) {
  themeBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.themeVal === theme)
  })
  document.documentElement.setAttribute('data-theme', theme)
}

// Initial Load
storage.get(['margin-enabled', 'margin-scope', 'margin-theme']).then(state => {
  enabled = state['margin-enabled'] !== false
  currentScope = state['margin-scope'] || 'all'
  currentTheme = state['margin-theme'] || 'dark'

  updateToggleUI()
  updateScopeUI(currentScope)
  updateThemeUI(currentTheme)
})

// Toggle Engine Switch
toggle.addEventListener('click', async () => {
  enabled = !enabled
  await storage.set({ 'margin-enabled': enabled })
  updateToggleUI()
  status.textContent = '设置已保存，刷新页面后生效'
})

// Segmented Scope Switch
scopeBtns.forEach(btn => {
  btn.addEventListener('click', async () => {
    const scope = btn.dataset.scope
    currentScope = scope
    updateScopeUI(scope)
    await storage.set({ 'margin-scope': scope })
    status.textContent = `已应用：${scopeIndicator.textContent}`
  })
})

// Theme Pills Switch
themeBtns.forEach(btn => {
  btn.addEventListener('click', async () => {
    const theme = btn.dataset.themeVal
    currentTheme = theme
    updateThemeUI(theme)
    await storage.set({ 'margin-theme': theme })
    status.textContent = `主题已切换为：${btn.textContent}`
  })
})
