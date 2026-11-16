import { useEffect, useMemo, useRef, useState } from 'react'
import { ATTRIBUTION } from 'open-anatomy-3d'
import { AnatomyViewer, type AnatomyPin } from 'open-anatomy-3d-react'
import maleUrl from 'open-anatomy-3d/models/anatomy-male.glb?url'
import femaleUrl from 'open-anatomy-3d/models/anatomy-female.glb?url'
import raw from './health/data.json'
import {
  type Data, PART_MESH, MESH_PART, METRIC_LABEL, TREND_METRICS,
  STATUS_COLOR, STATUS_LABEL, TREND_COLOR, TREND_LABEL,
  partStatus, partTrend, metricStatus, findingStatus, type Status, type Trend,
} from './health/logic'
import { LineChart } from './health/Chart'
import { Body2D } from './health/Body2D'
import { ZH_I18N, ZH_LABELS } from './health/zh'

const D = raw as unknown as Data
const MODEL_URLS = { male: maleUrl, female: femaleUrl }
const Q = new URLSearchParams(location.search)
const ALL = D.all_years, LAST = D.years[D.years.length - 1], FIRST = D.years[0]
const PARTS = Object.keys(D.parts)
const ORDER = ['eye', 'oral', 'throat', 'heart', 'liver', 'gallbladder', 'kidney', 'anorectal', 'blood', 'body']
  .filter(p => PARTS.includes(p))
  .concat(PARTS.filter(p => !['eye', 'oral', 'throat', 'heart', 'liver', 'gallbladder', 'kidney', 'anorectal', 'blood', 'body'].includes(p)))
const TREND_ORDER = Object.keys(TREND_LABEL) as Trend[]
const missing = new Set(D.missing_years)

type DrawerTab = 'detail' | 'trend' | 'matrix' | 'followup'

export function App() {
  const [year, setYear] = useState<number>(+(Q.get('year') ?? LAST))
  const [mode, setMode] = useState<'year' | 'trend'>(Q.get('mode') === 'trend' ? 'trend' : 'year')
  const [from, setFrom] = useState<number>(+(Q.get('from') ?? FIRST))
  const [to, setTo] = useState<number>(+(Q.get('to') ?? LAST))
  const rawSel = Q.get('sel')
  const initSel = rawSel
    ? (D.parts[rawSel] ? rawSel : PARTS.find(p => D.parts[p].label === rawSel) ?? rawSel)
    : null
  const [sel, setSel] = useState<string | null>(initSel)
  const [norm, setNorm] = useState(Q.get('norm') === '1')
  const [theme, setTheme] = useState<string>(Q.get('theme') ?? 'auto')
  const [lite, setLite] = useState<boolean>(Q.get('lite') === '1')

  const initTab = Q.get('tab')
  const [tab, setTab] = useState<DrawerTab>(
    initTab === 'detail' || initTab === 'trend' || initTab === 'matrix' || initTab === 'followup'
      ? initTab
      : initTab === 'heatmap'
        ? 'matrix'
        : initSel
          ? 'detail'
          : Q.get('mode') === 'trend' ? 'trend' : 'detail'
  )
  const [drawerOpen, setDrawerOpen] = useState<boolean>(
    Q.get('sheet') !== '0' && (
      Q.get('sheet') === '1' ||
      Q.get('sheet') === 'true' ||
      Q.get('drawer') === 'open' ||
      Q.get('drawer') === '1' ||
      !!initSel ||
      !!Q.get('tab')
    )
  )
  const dragStartY = useRef<number | null>(null)
  const stageDownPos = useRef<{ x: number; y: number } | null>(null)
  const stageRef = useRef<HTMLElement | null>(null)
  const yearsRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    const el = yearsRef.current?.querySelector<HTMLButtonElement>('button.on')
    el?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [year, mode])

  const selectPart = (p: string | null) => {
    setSel(p)
    if (p) {
      setTab('detail')
      setDrawerOpen(true)
    }
  }

  const colorOf = (p: string) =>
    mode === 'trend' ? TREND_COLOR[partTrend(D, p, from, to).t] : STATUS_COLOR[partStatus(D, p, year)]
  const statusTextOf = (p: string) =>
    mode === 'trend' ? TREND_LABEL[partTrend(D, p, from, to).t] : STATUS_LABEL[partStatus(D, p, year)]
  const isPartNotTested = (p: string) =>
    mode === 'year' && partStatus(D, p, year) === 'not_tested'

  const keyColors = useMemo(
    () => Object.fromEntries(PARTS.flatMap(p => (PART_MESH[p] ?? []).map(k => [k, colorOf(p)]))),
    [mode, year, from, to]
  )
  const active = (p: string) =>
    mode === 'trend'
      ? (partTrend(D, p, from, to).t !== 'na' && partTrend(D, p, from, to).t !== 'stable') ||
        !['ok', 'none', 'not_tested'].includes(partStatus(D, p, to))
      : partStatus(D, p, year) === 'edge' || partStatus(D, p, year) === 'abn'

  const pins: AnatomyPin[] = useMemo(() => PARTS.filter(p => (PART_MESH[p] ?? []).length && (active(p) || p === sel)).map(p => {
    const k = PART_MESH[p][0]
    if (mode === 'trend') {
      const t = partTrend(D, p, from, to)
      return {
        key: k,
        title: D.parts[p].label,
        color: TREND_COLOR[t.t],
        items: [`${from}→${to}：${TREND_LABEL[t.t]}${t.steady && t.t !== 'stable' && t.t !== 'na' ? '（持续）' : ''}`],
      }
    }
    const e = D.parts[p].by_year[String(year)]
    const s = partStatus(D, p, year)
    return {
      key: k,
      title: D.parts[p].label,
      color: STATUS_COLOR[s],
      items: [`${year}：${STATUS_LABEL[s]}`, ...(e?.findings.slice(0, 1).map(f => f.text.slice(0, 22)) ?? [])],
    }
  }), [mode, year, from, to, sel])

  const highlighted = useMemo(
    () => PARTS.filter(p => active(p) || p === sel).flatMap(p => (PART_MESH[p] ?? []).slice(1)),
    [mode, year, from, to, sel]
  )

  // 为 3D 模型上的彩色圆点绑定对应部位标识，支持手机端直接点圆点打开底部抽屉卡片
  useEffect(() => {
    const circles = stageRef.current?.querySelectorAll<SVGCircleElement>('.oa3d-callout-svg circle')
    circles?.forEach((c, idx) => {
      const pin = pins[idx]
      if (!pin) return
      const part = MESH_PART[pin.key] ?? ''
      c.dataset.key = pin.key
      c.dataset.part = part
      if (part && D.parts[part]) {
        c.setAttribute('aria-label', `${D.parts[part].label}：点击查看档案`)
      }
    })
  }, [pins, lite])

  // 手机端首屏摘要卡统计（单年模式：偏离/边缘/未查；趋势模式：改善/稳定/恶化/新出现/已消失/无可比/未查）
  const summaryStats = useMemo(() => {
    const abnParts: string[] = []
    const edgeParts: string[] = []
    const notTestedParts: string[] = []
    const okParts: string[] = []
    const trendParts: Record<Trend, string[]> = {
      better: [],
      stable: [],
      worse: [],
      new: [],
      gone: [],
      na: [],
    }
    for (const p of ORDER) {
      if (mode === 'trend') {
        const t = partTrend(D, p, from, to).t
        trendParts[t].push(p)
      } else {
        const s = partStatus(D, p, year)
        if (s === 'abn') abnParts.push(p)
        else if (s === 'edge') edgeParts.push(p)
        else if (s === 'not_tested') notTestedParts.push(p)
        else if (s === 'ok') okParts.push(p)
      }
    }
    return {
      abn: abnParts.length,
      edge: edgeParts.length,
      notTested: notTestedParts.length,
      ok: okParts.length,
      abnParts,
      edgeParts,
      notTestedParts,
      trendParts,
    }
  }, [mode, year, from, to])

  // 趋势面板顶部统一整理「原文无单位」与「单位不一致」说明，不在每个点重复标 ⚠
  const { missingUnitSummary, mismatchUnitItems } = useMemo(() => {
    const missByMetric = new Map<string, number[]>()
    const mismatch: string[] = []
    for (const k of TREND_METRICS) {
      for (const p of D.series[k] ?? []) {
        if (!p.flag) continue
        const label = METRIC_LABEL[k] ?? k
        if (p.flag.includes('不一致')) {
          mismatch.push(`${label} ${p.year}（${p.flag}）`)
        } else {
          const arr = missByMetric.get(label) ?? []
          arr.push(p.year)
          missByMetric.set(label, arr)
        }
      }
    }
    const missStr = Array.from(missByMetric.entries())
      .map(([m, ys]) => `${m} ${ys.join('、')}`)
      .join('；')
    return { missingUnitSummary: missStr, mismatchUnitItems: mismatch }
  }, [])

  const sp = sel ? D.parts[sel] : null

  const renderLegendItems = () =>
    mode === 'year'
      ? (Object.keys(STATUS_COLOR) as Status[]).map(s => (
          <span key={s}>
            <i className={s === 'not_tested' ? 'not-tested' : ''} style={{ background: s === 'not_tested' ? undefined : STATUS_COLOR[s] }} />
            {STATUS_LABEL[s]}
          </span>
        ))
      : (Object.keys(TREND_COLOR) as (keyof typeof TREND_COLOR)[]).map(t => (
          <span key={t}>
            <i style={{ background: TREND_COLOR[t] }} />
            {TREND_LABEL[t]}
          </span>
        ))

  const renderPartsList = () => (
    <ul className="plist">
      {ORDER.map(p => {
        const nt = isPartNotTested(p)
        return (
          <li key={p}>
            <button type="button" className={sel === p ? 'on' : ''} onClick={() => selectPart(p)}>
              <span className={'dot' + (nt ? ' not-tested' : '')} style={{ background: nt ? undefined : colorOf(p) }} />
              {D.parts[p].label}
              {!(PART_MESH[p] ?? []).length && <small>（侧栏）</small>}
              <em>{statusTextOf(p)}</em>
            </button>
          </li>
        )
      })}
    </ul>
  )

  const renderSelectedCard = () => {
    if (!sp || !sel) return null
    return (
      <div className="card selected">
        <div className="row">
          <h2>{sp.label}</h2>
          <button type="button" className="link" onClick={() => setSel(null)}>关闭</button>
        </div>
        <div className="tl">
          {ALL.map(y => {
            const isMiss = missing.has(y)
            const s = partStatus(D, sel, y)
            const isNt = !isMiss && s === 'not_tested'
            return (
              <span
                key={y}
                className={isMiss ? 'miss' : isNt ? 'not-tested' : ''}
                style={{ background: isMiss || isNt ? undefined : STATUS_COLOR[s] }}
                title={isMiss ? '无报告' : `${y}：${STATUS_LABEL[s]}`}
              >
                {String(y).slice(2)}
              </span>
            )
          })}
        </div>
        {D.years.slice().reverse().map(y => {
          const e = sp.by_year[String(y)]
          const s = partStatus(D, sel, y)
          if (!e && s !== 'not_tested') return null
          const metricsEntries = Object.entries(e?.metrics ?? {}).filter(([, m]) => typeof m === 'object')
          const findingsList = e?.findings ?? []
          return (
            <div key={y} className={'yr' + (y === year && mode === 'year' ? ' cur' : '')}>
              <div className="yh">
                <b>{y}</b>
                <code>{e?.report_id ?? ''}</code>
              </div>
              {s === 'not_tested' ? (
                <p className="find muted-note">当年未查该项</p>
              ) : (
                <>
                  {findingsList.map((f, i) => (
                    <p key={i} className="find">
                      <span className="lv" style={{ background: STATUS_COLOR[findingStatus(f)] }}>{f.level}</span>
                      {f.text}
                      {f.page ? <small> p{f.page}</small> : null}
                      {f.report_advice_quote ? <q>{f.report_advice_quote.slice(0, 80)}</q> : null}
                    </p>
                  ))}
                  {metricsEntries.map(([k, m]) => (
                    <span key={k} className="mchip" style={{ borderColor: STATUS_COLOR[metricStatus(m)] }}>
                      {METRIC_LABEL[k] ?? k} {m.value}{m.unit ?? ''}{m.ref_this_year ? ` [${m.ref_this_year}]` : ''}
                    </span>
                  ))}
                  {findingsList.length === 0 && metricsEntries.length === 0 && (
                    <p className="find muted-note">已查，未见阳性或异常指标</p>
                  )}
                </>
              )}
            </div>
          )
        })}
        <h4>关键指标（含当年参考区间带）</h4>
        {Array.from(new Set(D.years.flatMap(y => Object.keys(sp.by_year[String(y)]?.metrics ?? {}))))
          .filter(k => (D.series[k] ?? []).length >= 2)
          .map(k => (
            <div key={k} className="mini">
              <span>{METRIC_LABEL[k] ?? k}</span>
              <LineChart pts={D.series[k]} years={ALL} norm={norm} h={90} />
            </div>
          ))}
      </div>
    )
  }

  const renderFollowups = () => (
    <ul className="fu">
      {D.followups.slice().reverse().map((f, i) => (
        <li key={i}>
          <b>{f.year}</b> {f.title}
          <small>{f.interval ? ` · 建议${f.interval}` : ''} · {f.report_id}{f.page ? ' p' + f.page : ''}</small>
          <em>{f.completed_record}</em>
        </li>
      ))}
    </ul>
  )

  const renderTrendMetrics = () => (
    <>
      <div className="row">
        <h3>指标多年趋势</h3>
        <div className="seg">
          <button type="button" className={!norm ? 'on' : ''} onClick={() => setNorm(false)}>原始值+区间带</button>
          <button type="button" className={norm ? 'on' : ''} onClick={() => setNorm(true)}>区间位置 %</button>
        </div>
      </div>
      {(missingUnitSummary || mismatchUnitItems.length > 0) && (
        <div className="flag-summary" role="note" aria-label="单位说明图例">
          {missingUnitSummary && (
            <p className="flag-summary-line">
              <span className="flag-icon-dash" aria-hidden />
              <span>⚠ 单位缺失（点上以虚线圆点标记）：{missingUnitSummary}</span>
            </p>
          )}
          {mismatchUnitItems.length > 0 && (
            <p className="flag-summary-line flag-summary-warn">
              <span className="flag-icon-hollow" aria-hidden />
              <span>单位不一致（空心点且断线）：{mismatchUnitItems.join('；')}</span>
            </p>
          )}
        </div>
      )}
      <div className="grid">
        {TREND_METRICS.filter(k => (D.series[k] ?? []).length).map(k => {
          const pts = D.series[k] ?? []
          const latestPt = pts[pts.length - 1]
          return (
            <div key={k} className="tc">
              <h5>
                {METRIC_LABEL[k] ?? k}
                <small>{pts.length} 次</small>
              </h5>
              {latestPt && (
                <div className="tc-kpi mobile-only">
                  <div className="tc-kpi-main">
                    <strong className="tc-kpi-num">{latestPt.value}</strong>
                    {latestPt.unit && <span className="tc-kpi-unit">{latestPt.unit}</span>}
                  </div>
                  <span className="tc-kpi-meta">
                    {latestPt.year}年{latestPt.ref ? ` · 参考 ${latestPt.ref}` : ''}
                  </span>
                </div>
              )}
              <LineChart pts={pts} years={ALL} norm={norm} />
            </div>
          )
        })}
      </div>
    </>
  )

  const renderHeatmap = () => (
    <>
      <h3>器官 × 年份</h3>
      <div className="hm-wrap">
        <table className="hm">
          <thead>
            <tr>
              <th />
              {ALL.map(y => <th key={y} className={missing.has(y) ? 'miss' : ''}>{y}</th>)}
            </tr>
          </thead>
          <tbody>
            {ORDER.map(p => (
              <tr key={p}>
                <td>{D.parts[p].label}</td>
                {ALL.map(y => {
                  const isMiss = missing.has(y)
                  const s = partStatus(D, p, y)
                  const isNt = !isMiss && s === 'not_tested'
                  return (
                    <td
                      key={y}
                      className={isMiss ? 'miss' : isNt ? 'not-tested' : ''}
                      style={{ background: isMiss || isNt ? undefined : STATUS_COLOR[s] }}
                      title={isMiss ? '无报告' : `${D.parts[p].label} ${y}：${STATUS_LABEL[s]}`}
                      onClick={() => {
                        selectPart(p)
                        if (!isMiss) setYear(y)
                      }}
                    />
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )

  const renderTrendContent = () => (
    <>
      {renderTrendMetrics()}
      {renderHeatmap()}
    </>
  )

  return (
    <div className="page">
      <header className="top">
        <div className="brand">
          <span className="logo" aria-hidden><span /><span /></span>
          <div>
            <h1>身体档案 3D</h1>
            <p>体检档案可视化 · {FIRST}–{LAST} · 本地离线</p>
          </div>
        </div>
        <nav className="links">
          <div className="seg desktop-only" role="group" aria-label="视图模式">
            <button type="button" className={!lite ? 'on' : ''} onClick={() => setLite(false)}>3D 视图</button>
            <button type="button" className={lite ? 'on' : ''} onClick={() => setLite(true)}>2D 简易模式</button>
          </div>
          <div className="seg" role="group" aria-label="分析模式">
            {(['year', 'trend'] as const).map(m => (
              <button
                key={m}
                type="button"
                className={mode === m ? 'on' : ''}
                onClick={() => {
                  setMode(m)
                  if (m === 'trend') setTab('trend')
                }}
              >
                {m === 'year' ? '单年快照' : '趋势模式'}
              </button>
            ))}
          </div>
          <div className="seg desktop-only" role="group" aria-label="主题">
            {['auto', 'light', 'dark'].map(t => (
              <button type="button" key={t} className={theme === t ? 'on' : ''} onClick={() => setTheme(t)}>
                {t === 'auto' ? '跟随' : t === 'light' ? '浅色' : '深色'}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <div className="card yearbar">
        {mode === 'year' ? (
          <>
            <span className="lbl">年份</span>
            <div ref={yearsRef} className="years" role="tablist" aria-label="体检年份">
              {ALL.map(y => (
                <button
                  key={y}
                  type="button"
                  disabled={missing.has(y)}
                  className={(y === year ? 'on ' : '') + (missing.has(y) ? 'miss' : '')}
                  title={missing.has(y) ? '该年无报告' : `${y} 年体检档案`}
                  onClick={() => setYear(y)}
                >
                  {y}
                  {missing.has(y) ? <small>无报告</small> : null}
                </button>
              ))}
            </div>
            <input
              type="range"
              min={ALL[0]}
              max={ALL[ALL.length - 1]}
              step={1}
              value={year}
              aria-label="年份滑块"
              onChange={e => {
                const y = +e.target.value
                if (!missing.has(y)) setYear(y)
              }}
            />
          </>
        ) : (
          <>
            <span className="lbl">对比</span>
            <select aria-label="起始年份" value={from} onChange={e => setFrom(+e.target.value)}>
              {D.years.map(y => <option key={y} value={y} disabled={y >= to}>{y}</option>)}
            </select>
            <span>→</span>
            <select aria-label="结束年份" value={to} onChange={e => setTo(+e.target.value)}>
              {D.years.map(y => <option key={y} value={y} disabled={y <= from}>{y}</option>)}
            </select>
            <span className="muted">缺年 {D.missing_years.join('、') || '无'} 自动跳过</span>
          </>
        )}
        <div className="legend">
          {renderLegendItems()}
        </div>
      </div>

      <main className="layout">
        <section
          ref={stageRef}
          className="stage"
          aria-label={lite ? '2D 简易身体' : '3D 身体'}
          onPointerDown={e => {
            stageDownPos.current = { x: e.clientX, y: e.clientY }
          }}
          onClick={e => {
            if (stageDownPos.current) {
              const dist = Math.hypot(e.clientX - stageDownPos.current.x, e.clientY - stageDownPos.current.y)
              if (dist > 8) return
            }
            const target = e.target as Element | null
            const circle = target?.closest?.('.oa3d-callout-svg circle') as SVGCircleElement | null
            if (circle) {
              const part = circle.dataset.part
              if (part) {
                selectPart(part)
                return
              }
              const allCircles = Array.from(stageRef.current?.querySelectorAll<SVGCircleElement>('.oa3d-callout-svg circle') ?? [])
              const idx = allCircles.indexOf(circle)
              if (idx >= 0 && pins[idx]) {
                const p = MESH_PART[pins[idx].key]
                if (p) selectPart(p)
              }
              return
            }
            // 手机端为彩色圆点提供 ≥44px 热区容差，点圆点附近直接打开对应部位抽屉
            if (window.innerWidth <= 768 && target?.tagName.toLowerCase() === 'canvas') {
              const allCircles = Array.from(stageRef.current?.querySelectorAll<SVGCircleElement>('.oa3d-callout-svg circle') ?? [])
              let bestPart: string | null = null
              let bestDist = 24
              allCircles.forEach((c, idx) => {
                if (c.style.opacity === '0') return
                const r = c.getBoundingClientRect()
                if (r.width === 0 && r.height === 0) return
                const cx = r.left + r.width / 2
                const cy = r.top + r.height / 2
                const d = Math.hypot(e.clientX - cx, e.clientY - cy)
                if (d < bestDist) {
                  bestDist = d
                  bestPart = c.dataset.part || (pins[idx] ? MESH_PART[pins[idx].key] ?? null : null)
                }
              })
              if (bestPart) selectPart(bestPart)
            }
          }}
        >
          {lite ? (
            <Body2D
              parts={ORDER}
              getLabel={p => D.parts[p].label}
              getColor={colorOf}
              getStatusText={statusTextOf}
              isNotTested={isPartNotTested}
              selectedPart={sel}
              onSelect={p => selectPart(p)}
            />
          ) : (
            <AnatomyViewer
              defaultSex="male"
              showSexToggle={false}
              pins={pins}
              highlightedKeys={highlighted}
              keyColors={keyColors}
              labels={ZH_LABELS}
              i18n={ZH_I18N}
              modelUrls={MODEL_URLS}
              hoverHint="点击查看档案"
              onStructureClick={key => {
                const p = MESH_PART[key]
                if (p) selectPart(p)
              }}
            />
          )}
          <p className="hint">
            {lite
              ? '2D 简易省电模式（无 WebGL）· 点击器官或标签查看跨年档案'
              : '拖动旋转 · 双指捏合或 Ctrl/⌘+滚轮缩放 · 右键平移 · 点器官看跨年档案'}
          </p>
        </section>

        {/* 桌面端侧栏 */}
        <aside className="side desktop-only">
          <div className="card">
            <h3>部位</h3>
            {renderPartsList()}
          </div>
          {renderSelectedCard()}
          <div className="card">
            <h3>复查闭环</h3>
            {renderFollowups()}
          </div>
        </aside>
      </main>

      {/* 手机首屏底部摘要卡（Tremor KPI 大数字 + shadcn Card） */}
      <section
        className={'card mobile-summary-card mobile-only' + (mode === 'trend' ? ' is-trend' : '')}
        aria-label="体检状态摘要卡"
        onPointerDown={e => { dragStartY.current = e.clientY }}
        onPointerUp={e => {
          if (dragStartY.current != null) {
            const dy = e.clientY - dragStartY.current
            dragStartY.current = null
            if (dy < -20) {
              setDrawerOpen(true)
            }
          }
        }}
      >
        <div className="summary-card-header">
          <div className="summary-card-meta">
            <span className="summary-card-title">
              {mode === 'trend' ? `${from}→${to} 趋势摘要` : `${year}年 体检摘要`}
            </span>
            {sp && (
              <span className="summary-active-badge">
                当前：{sp.label}
              </span>
            )}
          </div>
          <button
            type="button"
            className="summary-open-btn"
            onClick={() => setDrawerOpen(true)}
          >
            {sp ? `${sp.label}卡片` : '更多面板'}
          </button>
        </div>

        {mode === 'trend' ? (
          <div className="summary-kpi-grid is-trend" role="group" aria-label="趋势分类统计">
            {TREND_ORDER.map(t => {
              const parts = summaryStats.trendParts[t]
              return (
                <button
                  key={t}
                  type="button"
                  className={`kpi-tile kpi-trend kpi-trend-${t}`}
                  onClick={() => {
                    if (parts.length > 0 && (!sel || partTrend(D, sel, from, to).t !== t)) {
                      setSel(parts[0])
                    }
                    setTab('detail')
                    setDrawerOpen(true)
                  }}
                >
                  <span className="kpi-label">
                    <i className="kpi-dot" style={{ background: TREND_COLOR[t] }} aria-hidden />
                    {TREND_LABEL[t]}
                  </span>
                  <span className="kpi-value-row">
                    <strong className="kpi-num">{parts.length}</strong>
                    <span className="kpi-unit">项</span>
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="summary-kpi-grid" role="group" aria-label="偏离、边缘与未查项统计">
            <button
              type="button"
              className="kpi-tile kpi-abn"
              onClick={() => {
                if (summaryStats.abnParts.length > 0 && (!sel || partStatus(D, sel, year) !== 'abn')) {
                  setSel(summaryStats.abnParts[0])
                }
                setTab('detail')
                setDrawerOpen(true)
              }}
            >
              <span className="kpi-label">
                <i className="kpi-dot" style={{ background: STATUS_COLOR.abn }} aria-hidden />
                偏离
              </span>
              <span className="kpi-value-row">
                <strong className="kpi-num">{summaryStats.abn}</strong>
                <span className="kpi-unit">项</span>
              </span>
            </button>

            <button
              type="button"
              className="kpi-tile kpi-edge"
              onClick={() => {
                if (summaryStats.edgeParts.length > 0 && (!sel || partStatus(D, sel, year) !== 'edge')) {
                  setSel(summaryStats.edgeParts[0])
                }
                setTab('detail')
                setDrawerOpen(true)
              }}
            >
              <span className="kpi-label">
                <i className="kpi-dot" style={{ background: STATUS_COLOR.edge }} aria-hidden />
                边缘
              </span>
              <span className="kpi-value-row">
                <strong className="kpi-num">{summaryStats.edge}</strong>
                <span className="kpi-unit">项</span>
              </span>
            </button>

            <button
              type="button"
              className="kpi-tile kpi-nt"
              onClick={() => {
                if (summaryStats.notTestedParts.length > 0 && (!sel || partStatus(D, sel, year) !== 'not_tested')) {
                  setSel(summaryStats.notTestedParts[0])
                }
                setTab('detail')
                setDrawerOpen(true)
              }}
            >
              <span className="kpi-label">
                <i className="kpi-dot not-tested" aria-hidden />
                未查
              </span>
              <span className="kpi-value-row">
                <strong className="kpi-num">{summaryStats.notTested}</strong>
                <span className="kpi-unit">项</span>
              </span>
            </button>
          </div>
        )}

        <div className="summary-tracker" aria-hidden>
          {mode === 'trend' ? (
            TREND_ORDER.map(t => {
              const count = summaryStats.trendParts[t].length
              return count > 0 ? (
                <span key={t} style={{ flex: count, background: TREND_COLOR[t] }} />
              ) : null
            })
          ) : (
            <>
              {summaryStats.abn > 0 && <span style={{ flex: summaryStats.abn, background: STATUS_COLOR.abn }} />}
              {summaryStats.edge > 0 && <span style={{ flex: summaryStats.edge, background: STATUS_COLOR.edge }} />}
              {summaryStats.ok > 0 && <span style={{ flex: summaryStats.ok, background: STATUS_COLOR.ok }} />}
              {summaryStats.notTested > 0 && <span className="not-tested" style={{ flex: summaryStats.notTested }} />}
            </>
          )}
        </div>
      </section>

      {/* 桌面端趋势面板 */}
      {(mode === 'trend' || Q.get('panel') === '1') && (
        <section className="card trend desktop-only">
          {renderTrendContent()}
        </section>
      )}

      {/* 移动端底部抽屉遮罩（展开时点击收起） */}
      {drawerOpen && (
        <div
          className="mobile-drawer-backdrop mobile-only"
          aria-hidden
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* 移动端底部抽屉（Bottom Sheet，宽度 ≤ 768px 启用） */}
      <section
        className={'mobile-drawer' + (drawerOpen ? ' open' : '')}
        aria-label="档案详情抽屉"
        aria-hidden={!drawerOpen}
      >
        <div
          className="drawer-handle-bar"
          onPointerDown={e => { dragStartY.current = e.clientY }}
          onPointerUp={e => {
            if (dragStartY.current != null) {
              const dy = e.clientY - dragStartY.current
              dragStartY.current = null
              if (dy < -20) { setDrawerOpen(true); return }
              if (dy > 20) { setDrawerOpen(false); return }
            }
            setDrawerOpen(v => !v)
          }}
        >
          <span className="drawer-pill" aria-hidden />
          <div className="drawer-summary">
            <span>{sp ? `${sp.label} · 跨年档案` : '健康档案面板'}</span>
            <button
              type="button"
              className="drawer-toggle-btn"
              onClick={e => { e.stopPropagation(); setDrawerOpen(v => !v) }}
            >
              {drawerOpen ? '收起' : '展开'}
            </button>
          </div>
        </div>

        <div className="drawer-tabs" role="tablist" aria-label="抽屉标签页">
          {([
            ['detail', '部位卡片'],
            ['trend', '全身指标'],
            ['matrix', '热力矩阵'],
            ['followup', '复查闭环'],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              className={tab === k ? 'on' : ''}
              onClick={() => {
                setTab(k)
                setDrawerOpen(true)
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="drawer-body">
          {tab === 'detail' && (
            <div className="drawer-pane">
              {sp && sel ? (
                <>
                  {renderSelectedCard()}
                  <details className="card mobile-fold">
                    <summary>切换其他部位（共 {ORDER.length} 项）</summary>
                    <div className="mobile-fold-body">
                      {renderPartsList()}
                    </div>
                  </details>
                </>
              ) : (
                <div className="card">
                  <h3>选择部位查看档案</h3>
                  {renderPartsList()}
                </div>
              )}
            </div>
          )}
          {tab === 'trend' && (
            <div className="drawer-pane trend">
              {renderTrendMetrics()}
            </div>
          )}
          {tab === 'matrix' && (
            <div className="drawer-pane">
              <div className="card">
                {renderHeatmap()}
              </div>
            </div>
          )}
          {tab === 'followup' && (
            <div className="drawer-pane">
              <div className="card">
                <h3>复查闭环</h3>
                {renderFollowups()}
              </div>
            </div>
          )}

          {/* 折叠次要控件：状态图例、2D/3D切换、主题与免责说明 */}
          <details className="card mobile-fold">
            <summary>视图设置与状态图例</summary>
            <div className="mobile-fold-body">
              <div className="mobile-setting-row">
                <span>人体视图</span>
                <div className="seg" role="group" aria-label="移动端视图模式">
                  <button type="button" className={!lite ? 'on' : ''} onClick={() => setLite(false)}>3D 视图</button>
                  <button type="button" className={lite ? 'on' : ''} onClick={() => setLite(true)}>2D 简易</button>
                </div>
              </div>
              <div className="mobile-setting-row">
                <span>界面主题</span>
                <div className="seg" role="group" aria-label="移动端主题">
                  {['auto', 'light', 'dark'].map(t => (
                    <button type="button" key={t} className={theme === t ? 'on' : ''} onClick={() => setTheme(t)}>
                      {t === 'auto' ? '跟随' : t === 'light' ? '浅色' : '深色'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="legend mobile-fold-legend">
                {renderLegendItems()}
              </div>
            </div>
          </details>
        </div>
      </section>

      <footer className="foot">
        <p><b>仅档案事实解读，非诊断。</b>颜色规则：该年报告阳性 L3+ 或指标超出当年参考区间 = 偏离；L1–L2 或位于区间边缘 10% = 接近边缘；已查且未见阳性 = 正常；报告未含该部位项目 = 当年未查（斜纹）。</p>
        <p>{ATTRIBUTION} · 代码 MIT · 模型 CC BY 4.0（已修改：着色与标注） · 仅个人本地使用</p>
      </footer>
    </div>
  )
}
