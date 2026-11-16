// 纯本地逻辑：状态判定、趋势分类、部位→mesh 映射。仅档案事实解读，非诊断。
export type Metric = { value: number; unit?: string | null; ref_this_year?: string | null; pos_in_range_pct?: number | null; upper_pct?: number | null; page?: number; note?: string }
export type Finding = { text: string; level?: string | null; page?: number; report_advice_quote?: string }
export type YearEntry = { report_id: string; status?: 'tested' | 'not_tested'; metrics: Record<string, Metric>; findings: Finding[] }
export type Part = { label: string; by_year: Record<string, YearEntry> }
export type Point = { year: number; value: number; unit?: string | null; ref?: string | null; lo: number | null; hi: number | null; pos_pct: number | null; report_id: string; page?: number; flag?: string }
export type Data = {
  years: number[]
  all_years: number[]
  missing_years: number[]
  coverage?: Record<string, Record<string, boolean>>
  parts: Record<string, Part>
  series: Record<string, Point[]>
  flags: { metric: string; year: number; note: string }[]
  followups: { year: number; report_id: string; title: string; interval: string | null; page?: number; completed_record: string }[]
}

// 部位 → 模型 mesh（第一个为主 mesh，承载标注卡）
export const PART_MESH: Record<string, string[]> = {
  eye: ['eye_l', 'eye_r'], oral: ['tongue', 'salivary_glands'], throat: ['pharynx', 'larynx'],
  heart: ['heart', 'coronary_arteries'], liver: ['liver'], gallbladder: ['gallbladder'],
  kidney: ['kidney_l', 'kidney_r'], anorectal: ['colon'], thyroid: [],
  blood: ['aorta', 'arteries_abdomen', 'arteries_thorax', 'vena_cava_inferior', 'vena_cava_superior'],
  body: [], // 全身：无对应单一 mesh → 侧栏
}
export const MESH_PART: Record<string, string> = Object.fromEntries(Object.entries(PART_MESH).flatMap(([p, ks]) => ks.map(k => [k, p])))

export const METRIC_LABEL: Record<string, string> = {
  WEIGHT: '体重', BMI: 'BMI', SBP: '收缩压', DBP: '舒张压', GLU_FASTING: '空腹血糖', TC: '总胆固醇', TG: '甘油三酯', 'LDL-C': 'LDL-C', 'HDL-C': 'HDL-C',
  ALT: 'ALT', AST: 'AST', GGT: 'GGT', TBIL: '总胆红素', UA: '尿酸', CREA: '肌酐', UREA: '尿素', HR: '心率', PULSE: '脉搏', HGB: '血红蛋白', WBC: '白细胞', PLT: '血小板',
  HEIGHT: '身高', BODY_FAT_PCT: '体脂率', BMI_recalc_from_wt_ht: 'BMI(按身高体重复算)', AST_ALT_ratio: 'AST/ALT', MUSCLE_MASS: '肌肉量', BASAL_METABOLISM: '基础代谢', HEALTH_INDEX: '健康指数', VA_CORR_L: '矫正视力左', VA_CORR_R: '矫正视力右',
}
export const TREND_METRICS = ['WEIGHT', 'BMI', 'SBP', 'DBP', 'GLU_FASTING', 'TC', 'TG', 'LDL-C', 'HDL-C', 'ALT', 'AST', 'UA', 'CREA']

export type Status = 'none' | 'not_tested' | 'ok' | 'edge' | 'abn'
export const STATUS_COLOR: Record<Status, string> = {
  none: '#9aa0a6',
  not_tested: '#adb5bd',
  ok: '#2f9e44',
  edge: '#e0a100',
  abn: '#d6336c',
}
export const STATUS_BG: Record<Status, string> = {
  none: '#9aa0a6',
  not_tested: 'repeating-linear-gradient(135deg, #868e96 0, #868e96 3px, #dee2e6 3px, #dee2e6 6px)',
  ok: '#2f9e44',
  edge: '#e0a100',
  abn: '#d6336c',
}
export const STATUS_LABEL: Record<Status, string> = {
  none: '无记录',
  not_tested: '当年未查',
  ok: '正常',
  edge: '接近边缘/轻度',
  abn: '偏离/阳性',
}

export function parseRef(r?: string | null): [number | null, number | null] {
  if (!r) return [null, null]
  const s = r.replace(/\s/g, '').replace('>=', '≥').replace('<=', '≤')
  let m = s.match(/^(\d+(?:\.\d+)?)(?:--|-|~|～|—|<)(\d+(?:\.\d+)?)$/); if (m) return [+m[1], +m[2]]
  m = s.match(/^[<≤](\d+(?:\.\d+)?)$/); if (m) return [null, +m[1]]
  m = s.match(/^[>≥](\d+(?:\.\d+)?)$/); if (m) return [+m[1], null]
  return [null, null]
}
export function metricStatus(m: Metric): Status {
  const [lo, hi] = parseRef(m.ref_this_year)
  if (lo == null && hi == null) return 'none'
  if ((hi != null && m.value > hi) || (lo != null && m.value < lo)) return 'abn'
  if (lo != null && hi != null) { const p = (m.value - lo) / (hi - lo) * 100; return p >= 90 || p <= 10 ? 'edge' : 'ok' }
  if (hi != null) return m.value / hi >= 0.9 ? 'edge' : 'ok'
  return 'ok'
}
const rank: Record<Status, number> = { none: -2, not_tested: -1, ok: 0, edge: 1, abn: 2 }
export function findingStatus(f: Finding): Status { const n = +(f.level ?? 'L0').replace('L', ''); return n >= 3 ? 'abn' : n >= 1 ? 'edge' : 'ok' }

/** 某部位某年状态；区分该年无报告 (none)、有报告但未查该部位 (not_tested)、已查未见异常 (ok)、边缘 (edge)、偏离 (abn) */
export function partStatus(d: Data, part: string, year: number): Status {
  if (!d.years.includes(year)) return 'none'
  const sy = String(year)
  const e = d.parts[part]?.by_year[sy]
  const cov = d.coverage?.[part]?.[sy]
  if (e?.status === 'not_tested' || cov === false) return 'not_tested'
  if (!e) return 'ok'
  let s: Status = 'ok'
  for (const m of Object.values(e.metrics)) { const t = metricStatus(m); if (rank[t] > rank[s]) s = t }
  for (const f of e.findings) { const t = findingStatus(f); if (rank[t] > rank[s]) s = t }
  return s
}

export type Trend = 'better' | 'stable' | 'worse' | 'new' | 'gone' | 'na'
export const TREND_COLOR: Record<Trend, string> = { better: '#1c7ed6', stable: '#868e96', worse: '#c92a2a', new: '#e8590c', gone: '#2f9e44', na: '#ced4da' }
export const TREND_LABEL: Record<Trend, string> = { better: '改善', stable: '稳定', worse: '恶化', new: '新出现', gone: '已消失', na: '无可比/未查' }

export function partTrend(d: Data, part: string, from: number, to: number): { t: Trend; steady: boolean } {
  const a = partStatus(d, part, from), b = partStatus(d, part, to)
  if (a === 'none' || b === 'none' || a === 'not_tested' || b === 'not_tested') return { t: 'na', steady: false }
  const ys = d.years
    .filter(y => y >= from && y <= to)
    .map(y => partStatus(d, part, y))
    .filter(s => s !== 'none' && s !== 'not_tested')
    .map(s => rank[s])
  const mono = (dir: 1 | -1) => ys.every((v, i) => i === 0 || (v - ys[i - 1]) * dir >= 0)
  const ra = rank[a], rb = rank[b]
  if (ra === 0 && rb > 0) return { t: 'new', steady: mono(1) }
  if (ra > 0 && rb === 0) return { t: 'gone', steady: mono(-1) }
  if (rb > ra) return { t: 'worse', steady: mono(1) }
  if (rb < ra) return { t: 'better', steady: mono(-1) }
  return { t: 'stable', steady: true }
}
