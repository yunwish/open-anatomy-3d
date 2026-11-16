import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'open-anatomy-3d-react/styles.css'
import './demo.css'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// 注册离线缓存 Service Worker（仅 https 或 localhost/127.0.0.1 可用；局域网 http 或失败时静默忽略）
if (
  'serviceWorker' in navigator &&
  (location.protocol === 'https:' ||
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    location.hostname === '[::1]')
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // 局域网 http 或不支持环境下静默忽略
    })
  })
}
