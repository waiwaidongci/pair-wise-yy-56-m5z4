import { createReducer, on } from '@ngrx/store'
import type { AuditEvent, InspectionPlan, LockBlocker, ReinspectionBatch, Weld } from '../types'
import * as A from './weld.actions'

export interface WeldState {
  welds: Weld[]
  plans: InspectionPlan[]
  batches: ReinspectionBatch[]
  selectedId: string
  statusFilter: string
  locked: boolean
  version: number
  audit: AuditEvent[]
  /** 旧页面提交时发现批次已被其他窗口更新 → 弹出提示，旧结论不覆盖 */
  conflict: { batchId: string; weldId: string; oldVersion: number; newVersion: number; message: string } | null
  /** 锁定被拦截时的具体焊缝与原因 */
  lockBlockers: LockBlocker[] | null
}

const now = () => new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })

const audit: AuditEvent[] = [
  { id: 'AE-1', time: '16:38', actor: '赵岚', action: '提交复检', target: 'W-104', detail: '返修后 UT 复检合格（批次 v1），等待质量负责人确认' },
  { id: 'AE-2', time: '15:12', actor: '陈锋', action: '录入缺陷', target: 'W-107', detail: '翼缘板端部夹渣，长度 12mm，Ⅱ级' },
  { id: 'AE-3', time: '14:20', actor: '系统', action: '资质预警', target: 'W-109', detail: '焊工证书 2026-10-01 到期，不得列入后续检测计划' },
]

/** 复检批次种子：W-104 待确认的 v1；W-107 已退回的 v1（保留返修次数与缺陷） */
const batches: ReinspectionBatch[] = [
  { id: 'RB-1', weldId: 'W-104', version: 1, result: '合格', method: 'UT', defects: [], status: '待确认', submittedBy: '赵岚', submittedAt: '09-29 16:38' },
  { id: 'RB-2', weldId: 'W-107', version: 1, result: '不合格', method: 'MT', defects: [], status: '已退回', submittedBy: '陈锋', submittedAt: '09-28 10:05', reviewedBy: '质量负责人', reviewedAt: '09-28 11:20', reviewNote: '未熔合缺陷评定依据不足，返修后重新检测，返修次数保留' },
]

export const initialState: WeldState = { welds: [], plans: [], batches, selectedId: '', statusFilter: '全部', locked: false, version: 12, audit, conflict: null, lockBlockers: null }

/** 锁定前校验：列出不满足条件的具体焊缝与原因 */
function collectBlockers(welds: Weld[], batches: ReinspectionBatch[]): LockBlocker[] {
  const blockers: LockBlocker[] = []
  for (const weld of welds) {
    const reasons: string[] = []
    if (!weld.qualificationValid) reasons.push(`焊工资质已过期（${weld.qualification}）`)
    if (weld.inspectionRatio < weld.requiredRatio) reasons.push(`检测比例不足（实测 ${weld.inspectionRatio}% / 要求 ${weld.requiredRatio}%）`)
    if (weld.defects.some((d) => d.disposition !== '已关闭')) reasons.push('存在未处置缺陷，复检合格确认前不得关闭')
    if (weld.status === '待检测' || weld.status === '返修中' || weld.status === '待复检') reasons.push(`焊缝状态为「${weld.status}」，复检未闭环`)
    if (batches.some((b) => b.weldId === weld.id && b.status === '待确认')) reasons.push('复检批次待质量负责人确认')
    if (reasons.length) blockers.push({ weldId: weld.id, component: weld.component, reasons })
  }
  return blockers
}

export const weldReducer = createReducer(
  initialState,
  on(A.loadWeldsSuccess, (state, { welds, plans }) => ({ ...state, welds, plans, selectedId: state.selectedId || welds[0]?.id || '' })),
  on(A.selectWeld, (state, { id }) => ({ ...state, selectedId: id })),
  on(A.filterStatus, (state, { status }) => ({ ...state, statusFilter: status })),
  on(A.advanceWeld, (state, { id, status }) => ({ ...state, version: state.version + 1, welds: state.welds.map((weld) => weld.id === id ? { ...weld, status } : weld), audit: [{ id: `AE-${Date.now()}`, time: now(), actor: '当前审核人', action: '状态流转', target: id, detail: `状态变更为 ${status}` }, ...state.audit] })),
  on(A.createPlan, (state, { plan }) => ({ ...state, plans: [plan, ...state.plans], version: state.version + 1 })),

  // 检测员提交复检结果：生成批次版本；同焊缝旧的待确认批次标记「已取代」，双方记录均保留
  on(A.submitReinspection, (state, { weldId, result, method, defects, note }) => {
    const weld = state.welds.find((w) => w.id === weldId)
    if (!weld) return state
    const version = state.batches.filter((b) => b.weldId === weldId).reduce((max, b) => Math.max(max, b.version), 0) + 1
    const batch: ReinspectionBatch = {
      id: `RB-${Date.now()}`, weldId, version, result, method,
      defects: defects.map((d) => ({ ...d, disposition: result === '合格' ? '未处置' : '返修中' })),
      status: '待确认', submittedBy: '当前检测员', submittedAt: now(),
    }
    const welds = state.welds.map((w) => {
      if (w.id !== weldId) return w
      const openDefects = defects.map((d) => ({ ...d, disposition: (result === '合格' ? '未处置' : '返修中') as '未处置' | '返修中' }))
      return {
        ...w,
        // 不合格：退回返修并累加返修次数；合格：进入待复检等待质量负责人确认
        status: result === '合格' ? '待复检' as const : '返修中' as const,
        repairs: result === '合格' ? w.repairs : w.repairs + 1,
        defects: [...w.defects.map((d) => ({ ...d, disposition: (d.disposition === '已关闭' ? '已关闭' : '返修中') as '已关闭' | '返修中' })), ...openDefects],
      }
    })
    const superseded = state.batches.filter((b) => b.weldId === weldId && b.status === '待确认')
    const batches = [batch, ...state.batches.map((b) => superseded.includes(b) ? { ...b, status: '已取代' as const } : b)]
    const audit: AuditEvent[] = [
      { id: `AE-${Date.now()}`, time: now(), actor: '当前检测员', action: '提交复检', target: weldId, detail: `复检批次 v${version} 提交（${method}，结论「${result}」），${note}${result === '合格' ? '，等待质量负责人确认' : '，退回返修并累计返修次数'}` },
      ...superseded.map((b) => ({ id: `AE-${Date.now()}-${b.id}`, time: now(), actor: '系统', action: '批次取代', target: weldId, detail: `复检批次 v${b.version} 已被新版本 v${version} 取代，原记录保留可查` })),
      ...state.audit,
    ]
    return { ...state, welds, batches, version: state.version + 1, audit }
  }),

  // 质量负责人确认批次：版本不一致说明旧页面已过期 → 拦截并提示查看新版本，绝不覆盖新结论
  on(A.confirmBatch, (state, { batchId, expectedVersion, note }) => {
    const batch = state.batches.find((b) => b.id === batchId)
    if (!batch || batch.status !== '待确认') return state
    if (batch.version !== expectedVersion) {
      return {
        ...state,
        conflict: { batchId, weldId: batch.weldId, oldVersion: expectedVersion, newVersion: batch.version, message: `该复检批次已在其他窗口更新（当前 v${batch.version}），你打开的是 v${expectedVersion} 旧页面。旧结论未覆盖新结论，双方记录均已保留，请刷新查看新版本。` },
        audit: [{ id: `AE-${Date.now()}`, time: now(), actor: '质量负责人', action: '冲突拦截', target: batch.weldId, detail: `旧页面（v${expectedVersion}）尝试确认复检批次，当前为 v${batch.version}，操作未生效，新结论未被覆盖` }, ...state.audit],
      }
    }
    const batches = state.batches.map((b) => b.id === batchId ? { ...b, status: '已确认' as const, reviewedBy: '质量负责人', reviewedAt: now(), reviewNote: note } : b)
    // 确认后：焊缝合格、缺陷处置关闭 —— 检测页/地图/审批页读取同一状态同步变化
    const welds = state.welds.map((w) => w.id === batch.weldId ? { ...w, status: '合格' as const, defects: w.defects.map((d) => ({ ...d, disposition: '已关闭' as const })) } : w)
    return { ...state, welds, batches, version: state.version + 1, audit: [{ id: `AE-${Date.now()}`, time: now(), actor: '质量负责人', action: '确认复检', target: batch.weldId, detail: `复检批次 v${batch.version} 已确认（结论「合格」），焊缝转合格、缺陷关闭、地图颜色同步${note ? `；${note}` : ''}` }, ...state.audit] }
  }),

  // 质量负责人退回批次：保留返修次数与缺陷，重新检测合格前不得锁定
  on(A.rejectBatch, (state, { batchId, expectedVersion, note }) => {
    const batch = state.batches.find((b) => b.id === batchId)
    if (!batch || batch.status !== '待确认') return state
    if (batch.version !== expectedVersion) {
      return {
        ...state,
        conflict: { batchId, weldId: batch.weldId, oldVersion: expectedVersion, newVersion: batch.version, message: `该复检批次已在其他窗口更新（当前 v${batch.version}），你打开的是 v${expectedVersion} 旧页面。退回操作未覆盖新结论，双方记录均已保留，请刷新查看新版本。` },
        audit: [{ id: `AE-${Date.now()}`, time: now(), actor: '质量负责人', action: '冲突拦截', target: batch.weldId, detail: `旧页面（v${expectedVersion}）尝试退回复检批次，当前为 v${batch.version}，操作未生效，新结论未被覆盖` }, ...state.audit],
      }
    }
    const batches = state.batches.map((b) => b.id === batchId ? { ...b, status: '已退回' as const, reviewedBy: '质量负责人', reviewedAt: now(), reviewNote: note } : b)
    // 退回后：焊缝保持返修中，返修次数与缺陷保留，重新检测合格提交新批次并确认前不得锁定
    const welds = state.welds.map((w) => w.id === batch.weldId ? { ...w, status: '返修中' as const, repairs: w.repairs + 1, defects: w.defects.map((d) => ({ ...d, disposition: '返修中' as const })) } : w)
    return { ...state, welds, batches, version: state.version + 1, audit: [{ id: `AE-${Date.now()}`, time: now(), actor: '质量负责人', action: '退回复检', target: batch.weldId, detail: `复检批次 v${batch.version} 已退回：${note}；返修次数与缺陷保留，重新检测合格并确认前不予锁定` }, ...state.audit] }
  }),

  // 模拟另一窗口抢先确认：批次版本 +1，旧页面随后操作即触发冲突
  on(A.externalUpdateBatch, (state, { batchId }) => {
    const batch = state.batches.find((b) => b.id === batchId)
    if (!batch || batch.status !== '待确认') return state
    const version = batch.version + 1
    const batches = state.batches.map((b) => b.id === batchId ? { ...b, version, status: '已确认' as const, reviewedBy: '质量负责人（另一窗口）', reviewedAt: now(), reviewNote: '另一窗口已抢先确认' } : b)
    const welds = state.welds.map((w) => w.id === batch.weldId ? { ...w, status: '合格' as const, defects: w.defects.map((d) => ({ ...d, disposition: '已关闭' as const })) } : w)
    return { ...state, welds, batches, version: state.version + 1, audit: [{ id: `AE-${Date.now()}`, time: now(), actor: '质量负责人', action: '异地确认', target: batch.weldId, detail: `另一窗口已抢先确认复检批次（v${batch.version} → v${version}），本窗口旧结论不得覆盖` }, ...state.audit] }
  }),

  on(A.clearConflict, (state) => ({ ...state, conflict: null })),
  on(A.clearLockBlockers, (state) => ({ ...state, lockBlockers: null })),

  // 签字锁定：前置列出资质过期 / 比例不足 / 缺陷未处置 / 批次未确认的具体焊缝与原因
  on(A.lockBaseline, (state) => {
    const blockers = collectBlockers(state.welds, state.batches)
    if (blockers.length) {
      return {
        ...state,
        lockBlockers: blockers,
        audit: [{ id: `AE-${Date.now()}`, time: now(), actor: '系统', action: '锁定拦截', target: '检测批次', detail: `存在 ${blockers.length} 条焊缝不满足锁定条件：${blockers.map((b) => `${b.weldId}（${b.reasons.join('；')}）`).join('；')}` }, ...state.audit],
      }
    }
    return { ...state, locked: true, lockBlockers: null, audit: [{ id: `AE-${Date.now()}`, time: now(), actor: '质量负责人', action: '签字锁定', target: '检测批次', detail: '焊工资质、检测比例、缺陷处置与复检闭环均已确认，版本快照只读' }, ...state.audit] }
  }),
)
