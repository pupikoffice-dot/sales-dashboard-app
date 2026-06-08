import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const dataPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data_loader.js')
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

for (const tag of ['orders-pupik', 'orders-mt', 'openorders', 'openorders-mt']) {
  console.log(tag, stats(tag))
}
