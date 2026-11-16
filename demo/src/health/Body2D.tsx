import { useState } from 'react'

export interface Body2DProps {
  parts: string[]
  getLabel: (part: string) => string
  getColor: (part: string) => string
  getStatusText: (part: string) => string
  isNotTested: (part: string) => boolean
  selectedPart: string | null
  onSelect: (part: string) => void
}

interface OrganPos {
  cx: number
  cy: number
  side: 'left' | 'right'
  ly: number
}

const ORGAN_POS: Record<string, OrganPos> = {
  eye: { cx: 180, cy: 44, side: 'left', ly: 42 },
  oral: { cx: 180, cy: 62, side: 'right', ly: 56 },
  throat: { cx: 180, cy: 82, side: 'left', ly: 86 },
  thyroid: { cx: 180, cy: 96, side: 'right', ly: 96 },
  heart: { cx: 189, cy: 138, side: 'right', ly: 130 },
  liver: { cx: 162, cy: 170, side: 'left', ly: 156 },
  blood: { cx: 180, cy: 168, side: 'right', ly: 174 },
  gallbladder: { cx: 165, cy: 189, side: 'left', ly: 198 },
  kidney: { cx: 196, cy: 212, side: 'right', ly: 218 },
  anorectal: { cx: 180, cy: 256, side: 'left', ly: 252 },
  body: { cx: 204, cy: 312, side: 'right', ly: 266 },
}

export function Body2D({
  parts,
  getLabel,
  getColor,
  getStatusText,
  isNotTested,
  selectedPart,
  onSelect,
}: Body2DProps) {
  const [hovered, setHovered] = useState<string | null>(null)

  const fillFor = (p: string) => (isNotTested(p) ? 'url(#pat-not-tested)' : getColor(p))

  const renderOrganShape = (p: string) => {
    const fill = fillFor(p)
    const stroke = getColor(p)
    const isSel = selectedPart === p || hovered === p
    const sw = isSel ? 2.5 : 1.4

    switch (p) {
      case 'eye':
        return (
          <g>
            <circle cx={171} cy={44} r={5.5} fill={fill} stroke={stroke} strokeWidth={sw} />
            <circle cx={189} cy={44} r={5.5} fill={fill} stroke={stroke} strokeWidth={sw} />
          </g>
        )
      case 'oral':
        return <rect x={171} y={58} width={18} height={8} rx={4} fill={fill} stroke={stroke} strokeWidth={sw} />
      case 'throat':
        return <rect x={175} y={73} width={10} height={18} rx={5} fill={fill} stroke={stroke} strokeWidth={sw} />
      case 'heart':
        return (
          <path
            d="M189 148 C189 148 177 139 177 131 C177 126 181 123 185 123 C187.5 123 189 125 189 127 C189 125 190.5 123 193 123 C197 123 201 126 201 131 C201 139 189 148 189 148 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
          />
        )
      case 'liver':
        return (
          <path
            d="M148 162 C148 155 168 154 178 160 C176 171 162 180 150 178 C147 176 147 168 148 162 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
          />
        )
      case 'gallbladder':
        return <ellipse cx={165} cy={189} rx={6.5} ry={4.8} fill={fill} stroke={stroke} strokeWidth={sw} />
      case 'kidney':
        return (
          <g>
            <ellipse cx={163} cy={212} rx={6} ry={9.5} fill={fill} stroke={stroke} strokeWidth={sw} />
            <ellipse cx={197} cy={212} rx={6} ry={9.5} fill={fill} stroke={stroke} strokeWidth={sw} />
          </g>
        )
      case 'blood':
        return (
          <g>
            <path
              d="M180 116 L180 226 M180 148 L166 162 M180 148 L194 162 M180 226 L168 246 M180 226 L192 246"
              fill="none"
              stroke={stroke}
              strokeWidth={isSel ? 3.5 : 2.4}
              strokeLinecap="round"
            />
            <circle cx={180} cy={168} r={6} fill={fill} stroke={stroke} strokeWidth={sw} />
          </g>
        )
      case 'anorectal':
        return (
          <path
            d="M162 242 C162 234 198 234 198 242 C198 252 186 256 180 268 C174 256 162 252 162 242 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
          />
        )
      case 'body':
        return (
          <circle cx={204} cy={312} r={7.5} fill={fill} stroke={stroke} strokeWidth={sw} />
        )
      default: {
        const pos = ORGAN_POS[p] ?? { cx: 180, cy: 200 }
        return <circle cx={pos.cx} cy={pos.cy} r={7} fill={fill} stroke={stroke} strokeWidth={sw} />
      }
    }
  }

  return (
    <div className="oa3d-viewer oa3d-lite" aria-label="2D 简易人体视图">
      <div className="oa3d-canvas oa3d-lite-canvas">
        {hovered && (
          <div className="oa3d-hover-tag" aria-live="polite">
            <span className="oa3d-hover-name">{getLabel(hovered)} · {getStatusText(hovered)}</span>
            <span className="oa3d-hover-hint">点击查看档案</span>
          </div>
        )}
        <svg viewBox="0 0 360 420" className="body2d-svg" role="img" aria-label="人体器官状态示意">
          <defs>
            <pattern id="pat-not-tested" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
              <rect width="3" height="6" fill="#868e96" />
              <rect x="3" width="3" height="6" fill="#dee2e6" />
            </pattern>
          </defs>

          {/* 人体轮廓 (2D Silhouette) */}
          <path
            className="body2d-silhouette"
            d="M180 18
               C196 18 206 30 206 48
               C206 63 197 73 190 77
               L190 90
               C214 94 234 104 240 124
               L252 212
               C254 220 244 224 240 216
               L226 140
               L218 140
               L220 242
               L212 384
               C211 394 197 394 196 384
               L186 268
               L174 268
               L164 384
               C163 394 149 394 148 384
               L140 242
               L142 140
               L134 140
               L120 216
               C116 224 106 220 108 212
               L120 124
               C126 104 146 94 170 90
               L170 77
               C163 73 154 63 154 48
               C154 30 164 18 180 18 Z"
          />

          {/* 引导虚线 */}
          {parts.map(p => {
            const pos = ORGAN_POS[p]
            if (!pos) return null
            const isSel = selectedPart === p || hovered === p
            const lx = pos.side === 'left' ? 104 : 256
            return (
              <polyline
                key={'line-' + p}
                points={`${lx},${pos.ly} ${(lx + pos.cx) / 2},${pos.ly} ${pos.cx},${pos.cy}`}
                fill="none"
                stroke={getColor(p)}
                strokeWidth={isSel ? 2 : 1.2}
                strokeDasharray="3 3"
                opacity={isSel ? 1 : 0.75}
              />
            )
          })}

          {/* 器官图形节点 */}
          {parts.map(p => {
            const isSel = selectedPart === p || hovered === p
            return (
              <g
                key={'organ-' + p}
                className={'body2d-organ' + (isSel ? ' is-active' : '')}
                onClick={() => onSelect(p)}
                onMouseEnter={() => setHovered(p)}
                onMouseLeave={() => setHovered(null)}
                role="button"
                tabIndex={0}
                aria-label={`${getLabel(p)}：${getStatusText(p)}`}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(p) } }}
              >
                {renderOrganShape(p)}
              </g>
            )
          })}

          {/* 左右两侧可点击标签胶囊 */}
          {parts.map(p => {
            const pos = ORGAN_POS[p]
            if (!pos) return null
            const isSel = selectedPart === p || hovered === p
            const bx = pos.side === 'left' ? 8 : 256
            const by = pos.ly - 14
            const bw = 96
            const bh = 28
            return (
              <g
                key={'tag-' + p}
                className={'body2d-tag' + (isSel ? ' is-active' : '')}
                transform={`translate(${bx}, ${by})`}
                onClick={() => onSelect(p)}
                onMouseEnter={() => setHovered(p)}
                onMouseLeave={() => setHovered(null)}
                role="button"
                tabIndex={0}
                aria-label={`${getLabel(p)} ${getStatusText(p)}`}
              >
                <rect
                  width={bw}
                  height={bh}
                  rx={8}
                  className="body2d-tag-bg"
                  stroke={isSel ? getColor(p) : 'var(--border)'}
                  strokeWidth={isSel ? 2 : 1}
                />
                <circle
                  cx={12}
                  cy={14}
                  r={5}
                  fill={fillFor(p)}
                  stroke={getColor(p)}
                  strokeWidth={1}
                />
                <text x={22} y={11.5} className="body2d-tag-title">{getLabel(p)}</text>
                <text x={22} y={23.5} className="body2d-tag-sub">{getStatusText(p)}</text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
