// 构建后生成离线预缓存清单（含 index.html、manifest、图标及 assets 下全部构建产物如 .glb/.js/.css）
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(__dirname, '../demo/dist')

function walk(dir, base = dir) {
  const results = []
  if (!fs.existsSync(dir)) return results
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walk(full, base))
    } else if (entry.isFile()) {
      const rel = path.relative(base, full).split(path.sep).join('/')
      if (rel !== 'sw.js' && rel !== 'sw-assets.json' && !rel.endsWith('.map')) {
        results.push('./' + rel)
      }
    }
  }
  return results
}

const files = ['./', ...walk(distDir).sort()]
const uniqueFiles = [...new Set(files)]

fs.writeFileSync(
  path.join(distDir, 'sw-assets.json'),
  JSON.stringify(uniqueFiles, null, 2) + '\n',
  'utf8'
)

const swPath = path.join(distDir, 'sw.js')
if (fs.existsSync(swPath)) {
  const swSrc = fs.readFileSync(swPath, 'utf8')
  const updated = swSrc.replace(
    /\/\* __PRECACHE_MANIFEST__ \*\/ \[[\s\S]*?\]/,
    `/* __PRECACHE_MANIFEST__ */ ${JSON.stringify(uniqueFiles, null, 2)}`
  )
  fs.writeFileSync(swPath, updated, 'utf8')
}

console.log(`[gen-sw-manifest] Generated precache list with ${uniqueFiles.length} entries (including .glb).`)
