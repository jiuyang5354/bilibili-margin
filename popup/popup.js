const toggle = document.getElementById('toggle')
const status = document.getElementById('status')
let enabled = true
function render() {
  toggle.setAttribute('aria-pressed', String(enabled))
  toggle.textContent = enabled ? '界面重设计已开启 · 点击关闭' : '界面重设计已关闭 · 点击开启'
}
chrome.storage.local.get('margin-enabled').then(state => {
  enabled = state['margin-enabled'] !== false
  render()
})
toggle.addEventListener('click', async () => {
  enabled = !enabled
  await chrome.storage.local.set({ 'margin-enabled': enabled })
  render()
  status.textContent = '设置已保存，刷新页面后生效。'
})
