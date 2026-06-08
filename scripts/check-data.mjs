import fs from 'fs'
import path from 'path'

const dataPath = process.argv[2]
if (!dataPath) {
  console.error('Usage: node check-data.mjs <path-to-data_loader.js>')
  process.exit(1)
}

const s = fs.readFileSync(dataPath, 'utf8')
const start = s.indexOf('"rows": [')
let end = s.indexOf('"wmsTotalRows"')
if (start < 0 || end < 0) {
  console.error('parse markers not found', start, end)
  process.exit(1)
}
end = s.lastIndexOf('],', end)
const rows = JSON.parse(s.slice(start + 7, end + 1))

const monthStart = '2026-06-01'
const todayStr = '2026-06-07'

function stats(tag) {
  const all = rows.filter(r => r.company === tag)
  const mtd = all.filter(r => r.date && r.date >= monthStart && r.date <= todayStr)
  const today = all.filter(r => r.date === todayStr)
  const clients = new Set(mtd.map(r => r.clientID).filter(Boolean)).size
  return {
    total: all.length,
    mtd: mtd.length,
    mtdClients: clients,
    today: today.length,
    mtdCash: mtd.reduce((a, r) => a + (r.cash || 0), 0),
  }
}

console.log('file:', dataPath)
console.log('generated:', (s.match(/Generated:\s*([^\n]+)/) || [])[1] || 'unknown')
for (const tag of ['orders-pupik', 'orders-mt', 'openorders', 'openorders-mt']) {
  console.log(tag, stats(tag))
}
