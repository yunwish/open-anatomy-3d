import type { Point } from './logic'

// 多年折线 + 每点当年参考区间带；flag「不一致」的点空心且不连线；单位缺失的点仅用虚线外圈轻量标记，不重复显示 ⚠ 文字
export function LineChart({ pts, years, norm, w = 300, h = 120, color = '#e8590c' }: { pts: Point[]; years: number[]; norm: boolean; w?: number; h?: number; color?: string }) {
  const P = 26, R = 18, B = 18
  const val = (p: Point) => norm ? p.pos_pct : p.value
  const shown = pts.filter(p => val(p) != null)
  if (!shown.length) return <p className="hm-empty">{norm ? '无双侧参考区间，无法归一化' : '无数据'}</p>
  const vs: number[] = []
  shown.forEach(p => { vs.push(val(p)!); if (!norm) { if (p.lo != null) vs.push(p.lo); if (p.hi != null) vs.push(p.hi) } })
  if (norm) vs.push(0, 100)
  let mn = Math.min(...vs), mx = Math.max(...vs); const pad = (mx - mn) * 0.14 || 1; mn -= pad; mx += pad
  const x0 = years[0], x1 = years[years.length - 1]
  const X = (y: number) => P + (x1 === x0 ? 0.5 : (y - x0) / (x1 - x0)) * (w - P - R)
  const Y = (v: number) => h - B - (v - mn) / (mx - mn) * (h - B - 10)
  const hard = (p: Point) => !!p.flag && p.flag.includes('不一致')
  const missingUnit = (p: Point) => !!p.flag && !hard(p)
  const segs: string[] = []; let cur = ''
  shown.forEach(p => { if (hard(p)) { if (cur) segs.push(cur); cur = ''; return } cur += `${cur ? 'L' : 'M'}${X(p.year)},${Y(val(p)!)}` })
  if (cur) segs.push(cur)
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} width="100%">
      {years.map(y => <text key={y} x={X(y)} y={h - 4} className="ax" textAnchor="middle">{String(y).slice(2)}</text>)}
      {norm && [0, 100].map(v => <line key={v} x1={P} x2={w - R} y1={Y(v)} y2={Y(v)} className="refline" />)}
      {norm && <rect x={P} width={w - P - R} y={Y(100)} height={Y(0) - Y(100)} className="band" />}
      {!norm && shown.map(p => (p.lo != null || p.hi != null) && (
        <rect key={'b' + p.year} x={X(p.year) - 7} width={14} y={Y(p.hi ?? mx)} height={Y(p.lo ?? mn) - Y(p.hi ?? mx)} className="band" rx={3}>
          <title>{p.year} 当年参考区间 {p.ref}</title></rect>))}
      {segs.map((s, i) => <path key={i} d={s} fill="none" stroke={color} strokeWidth={2} />)}
      {shown.map(p => {
        const cx = X(p.year), cy = Y(val(p)!)
        const isHard = hard(p), isMissUnit = missingUnit(p)
        return (
          <g key={p.year}>
            {isMissUnit && (
              <circle cx={cx} cy={cy} r={5.6} fill="none" stroke={color} strokeWidth={1.2} strokeDasharray="2 1.6" />
            )}
            <circle
              cx={cx}
              cy={cy}
              r={isHard ? 4 : 3.2}
              fill={isHard ? 'var(--surface)' : color}
              stroke={color}
              strokeWidth={1.6}
              strokeDasharray={isMissUnit ? '1.8 1.2' : undefined}
            />
            <text x={cx} y={cy - 8} className="pv" textAnchor="middle">{norm ? `${val(p)}%` : p.value}</text>
            <title>{`${p.year} ${p.value}${p.unit ?? ''} 区间 ${p.ref ?? '无'}${p.pos_pct != null ? ` 区间位置 ${p.pos_pct}%` : ''} · ${p.report_id}${p.page ? ' p' + p.page : ''}${p.flag ? ' · ' + p.flag : ''}`}</title>
          </g>
        )
      })}
      <text x={2} y={10} className="ax">{norm ? '区间%' : (shown[0].unit ?? '')}</text>
    </svg>
  )
}
