import { createReducer, on } from '@ngrx/store'
import type {
  AuditEvent,
  Defect,
  InspectionPlan,
  ReviewBatch,
  ReviewDecision,
  ReviewNotice,
  Weld,
} from '../types'
import * as A from './weld.actions'

export interface WeldState {
  welds: Weld[]
  plans: InspectionPlan[]
  reviewBatches: ReviewBatch[]
  selectedId: string
  statusFilter: string
  locked: boolean
  version: number
  audit: AuditEvent[]
  notices: ReviewNotice[]
}

const nowTime = () => new Date().toLocaleString('zh-CN', {
  month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
})

let sequence = 0
const nextId = (prefix: string) => {
  sequence += 1
  return `${prefix}-${Date.now()}-${sequence}`
}

const audit = (actor: string, action: string, target: string, detail: string): AuditEvent =>
  ({ id: nextId('AE'), time: nowTime(), actor, action, target, detail })

const reviewBlockers = (weld: Weld | undefined) => {
  if (!weld) return ['焊缝台账中未找到该焊缝，不能确认']
  const reasons: string[] = []
  if (!weld.qualificationValid) reasons.push(`焊工资质已过期或到期不可确认（${weld.qualification}）`)
  if (weld.inspectionRatio < weld.requiredRatio) {
    reasons.push(`检测比例不足：当前 ${weld.inspectionRatio}%，要求 ${weld.requiredRatio}%`)
  }
  return reasons
}

const latestBatch = (batches: ReviewBatch[], batchNo: string) =>
  batches.filter((batch) => batch.batchNo === batchNo).sort((a, b) => b.revision - a.revision)[0]

const addDecision = (batches: ReviewBatch[], batchId: string | undefined, decision: ReviewDecision) =>
  batches.map((batch) => batch.id === batchId ? { ...batch, history: [...batch.history, decision] } : batch)

const conflictNotice = (title: string, detail: string, batchId?: string, weldId?: string): ReviewNotice =>
  ({ id: nextId('NT'), kind: '版本冲突', title, detail, batchId, weldId })

const interceptNotice = (title: string, detail: string, batchId?: string, weldId?: string): ReviewNotice =>
  ({ id: nextId('NT'), kind: '确认拦截', title, detail, batchId, weldId })

type SubmitProps = ReturnType<typeof A.submitReview>
type DecideProps = ReturnType<typeof A.decideReview>
type SubmitInput = Omit<SubmitProps, 'type'>
type DecideInput = Omit<DecideProps, 'type'>

function submitReview(state: WeldState, input: SubmitInput): WeldState {
  const batchNo = `RB-${input.weldId}`
  const weld = state.welds.find((item) => item.id === input.weldId)
  const attempted = state.reviewBatches
    .filter((batch) => batch.batchNo === batchNo)
    .sort((a, b) => b.revision - a.revision)[0]
  const currentVersion = weld?.reviewVersion ?? 0
  const staleDecision: ReviewDecision = {
    actor: input.inspector,
    action: '旧页拦截',
    result: '无效',
    comment: input.comment || '旧页面提交已被拦截，未覆盖新版本',
    at: nowTime(),
    expectedVersion: input.expectedVersion,
    actualVersion: currentVersion,
  }
  const staleAudit = audit(
    input.inspector,
    '旧版本提交拦截',
    input.weldId,
    `页面基于 v${input.expectedVersion}，当前为 v${currentVersion}；双方记录已保留`,
  )

  if (!weld || input.expectedVersion !== currentVersion) {
    return {
      ...state,
      reviewBatches: addDecision(state.reviewBatches, attempted?.id, staleDecision),
      audit: [staleAudit, ...state.audit],
      notices: [conflictNotice(
        `${input.weldId} 已有新复检版本`,
        `旧页 v${input.expectedVersion} 不能覆盖 v${currentVersion}，请查看新版本后重新处理。`,
        attempted?.id,
        input.weldId,
      ), ...state.notices],
    }
  }

  if (!['返修中', '待复检'].includes(weld.status)) {
    return {
      ...state,
      reviewBatches: addDecision(state.reviewBatches, attempted?.id, staleDecision),
      audit: [audit(input.inspector, '旧结论提交拦截', input.weldId, `焊缝当前为${weld.status}，旧页面不能替代已确认结论`), ...state.audit],
      notices: [conflictNotice(
        `${input.weldId} 已有新质量结论`,
        `该焊缝当前为${weld.status}，请查看最新批次 v${currentVersion}。`,
        attempted?.id,
        input.weldId,
      ), ...state.notices],
    }
  }

  const previous = latestBatch(state.reviewBatches, batchNo)
  if (previous && previous.status === '待质量确认') {
    return {
      ...state,
      audit: [audit(input.inspector, '重复提交拦截', input.weldId, `v${previous.revision} 正在等待质量负责人结论`), ...state.audit],
      notices: [interceptNotice('该复检批次仍在确认中', '请等待质量负责人确认或退回，不能重复提交。', previous.id, input.weldId), ...state.notices],
    }
  }

  const revision = (previous?.revision ?? 0) + 1
  const batchId = `${batchNo}-${revision}`
  const openDefectIds = weld.defects.filter((defect) => defect.status !== '关闭').map((defect) => defect.id)
  const batch: ReviewBatch = {
    id: batchId,
    batchNo,
    revision,
    batchVersion: revision,
    status: '待质量确认',
    inspector: input.inspector,
    submittedAt: nowTime(),
    items: [{
      weldId: input.weldId,
      result: input.result,
      method: input.method,
      report: input.report,
      comment: input.comment,
      defectIds: openDefectIds,
      inspector: input.inspector,
      submittedAt: nowTime(),
    }],
    history: [{
      actor: input.inspector,
      action: '提交复检',
      result: input.result,
      comment: input.comment,
      at: nowTime(),
      expectedVersion: input.expectedVersion,
      actualVersion: revision,
    }],
  }

  const supersedeId = previous?.status === '已退回' ? previous.id : undefined
  return {
    ...state,
    version: state.version + 1,
    welds: state.welds.map((item) => item.id === input.weldId ? {
      ...item,
      status: '待质量确认',
      reviewVersion: revision,
      reviewBatchId: batchId,
      defects: item.defects.map((defect) => defect.status === '关闭' ? defect : { ...defect, status: '待处置' as const }),
    } : item),
    reviewBatches: [
      batch,
      ...state.reviewBatches.map((item) => item.id === supersedeId ? { ...item, status: '已作废' as const } : item),
    ],
    audit: [
      audit(input.inspector, '提交复检', input.weldId, `${input.method} 复检${input.result}，批次 ${batchId} 等待质量确认`),
      ...(previous ? [audit('系统', '版本递增', input.weldId, `退回单 ${previous.id} 保留，生成新版本 v${revision}`)] : []),
      ...state.audit,
    ],
  }
}

function decideReview(state: WeldState, input: DecideInput): WeldState {
  const batch = state.reviewBatches.find((item) => item.id === input.batchId)
  if (!batch) {
    return {
      ...state,
      audit: [audit(input.actor, '旧版本审核拦截', input.batchId, '未找到该批次，可能其他窗口已生成新版本'), ...state.audit],
      notices: [conflictNotice('复检批次已变化', '当前审核页引用的批次不存在，请刷新查看新版本。', undefined), ...state.notices],
    }
  }

  if (input.expectedVersion !== batch.revision || batch.status !== '待质量确认') {
    const decision: ReviewDecision = {
      actor: input.actor,
      action: '旧页拦截',
      result: '无效',
      comment: input.comment || '旧审核页操作已拦截',
      at: nowTime(),
      expectedVersion: input.expectedVersion,
      actualVersion: batch.revision,
    }
    return {
      ...state,
      reviewBatches: addDecision(state.reviewBatches, batch.id, decision),
      audit: [audit(input.actor, '旧版本审核拦截', batch.id, `页面基于 v${input.expectedVersion}，当前为 v${batch.revision}`), ...state.audit],
      notices: [conflictNotice(`${batch.batchNo} 已有新版本或结论`, `旧审核页 v${input.expectedVersion} 不能覆盖 v${batch.revision}。`, batch.id, batch.items[0]?.weldId), ...state.notices],
    }
  }

  if (input.decision === '退回') {
    const weldIds = batch.items.map((item) => item.weldId)
    const decision: ReviewDecision = {
      actor: input.actor, action: '退回', result: '不合格', comment: input.comment, at: nowTime(),
      expectedVersion: input.expectedVersion, actualVersion: batch.revision,
    }
    return {
      ...state,
      version: state.version + 1,
      reviewBatches: state.reviewBatches.map((item) => item.id === batch.id ? {
        ...item,
        status: '已退回',
        decidedBy: input.actor,
        decidedAt: nowTime(),
        decisionComment: input.comment,
        history: [...item.history, decision],
      } : item),
      welds: state.welds.map((weld) => weldIds.includes(weld.id) ? {
        ...weld,
        status: '返修中',
        defects: weld.defects.map((defect): Defect => defect.status === '关闭' ? defect : {
          ...defect,
          status: '返修中',
          disposition: `质量退回：${input.comment}`,
        }),
      } : weld),
      audit: [
        audit(input.actor, '退回复检', batch.id, `保留原返修次数与缺陷；原因：${input.comment}`),
        ...weldIds.map((id) => audit('系统', '状态同步', id, '检测页、地图颜色和审批时间线已同步为返修中')),
        ...state.audit,
      ],
    }
  }

  const blockers = batch.items.flatMap((item) => {
    const weld = state.welds.find((weldItem) => weldItem.id === item.weldId)
    return reviewBlockers(weld).map((reason) => `${item.weldId}：${reason}`)
  })
  if (blockers.length) {
    const detail = blockers.join('；')
    return {
      ...state,
      reviewBatches: addDecision(state.reviewBatches, batch.id, {
        actor: input.actor, action: '旧页拦截', result: '无效', comment: `确认被规则拦截：${detail}`, at: nowTime(),
      }),
      audit: [audit(input.actor, '确认规则拦截', batch.id, detail), ...state.audit],
      notices: [interceptNotice('确认前必须处理以下问题', detail, batch.id, batch.items.map((item) => item.weldId).join(',')), ...state.notices],
    }
  }

  const itemById = new Map(batch.items.map((item) => [item.weldId, item]))
  const decision: ReviewDecision = {
    actor: input.actor, action: '确认', result: batch.items.every((item) => item.result === '合格') ? '合格' : '不合格',
    comment: input.comment, at: nowTime(), expectedVersion: input.expectedVersion, actualVersion: batch.revision,
  }
  return {
    ...state,
    version: state.version + 1,
    reviewBatches: state.reviewBatches.map((item) => item.id === batch.id ? {
      ...item,
      status: '已确认',
      decidedBy: input.actor,
      decidedAt: nowTime(),
      decisionComment: input.comment,
      history: [...item.history, decision],
    } : item),
    welds: state.welds.map((weld) => {
      const item = itemById.get(weld.id)
      if (!item) return weld
      const passed = item.result === '合格'
      return {
        ...weld,
        status: passed ? '合格' : '返修中',
        defects: weld.defects.map((defect): Defect => {
          if (!item.defectIds.includes(defect.id)) return defect
          return passed
            ? { ...defect, status: '关闭', disposition: `复检合格，${input.actor} 确认` }
            : { ...defect, status: '返修中', disposition: `确认不合格，继续返修：${input.comment}` }
        }),
      }
    }),
    audit: [
      audit(input.actor, '确认复检', batch.id, `批次 v${batch.revision} 已确认；缺陷处置、地图和审批状态同步`),
      ...batch.items.map((item) => audit('系统', '状态同步', item.weldId, item.result === '合格' ? '缺陷关闭，焊缝状态更新为合格' : '缺陷保留，焊缝状态更新为返修中')),
      ...state.audit,
    ],
  }
}

const initialAudit: AuditEvent[] = [
  { id: 'AE-1', time: '09-29 16:38', actor: '赵岚', action: '提交复检', target: 'W-104', detail: 'RB-W-104-1 返修后 UT 复检合格，等待周倩确认' },
  { id: 'AE-2', time: '09-29 15:12', actor: '陈锋', action: '录入缺陷', target: 'W-107', detail: '翼缘板端部未熔合，长度 18mm，Ⅲ级' },
  { id: 'AE-3', time: '09-29 14:20', actor: '系统', action: '资质预警', target: 'W-109', detail: '焊工证书 2026-10-01 到期，确认前必须处理' },
]

export const initialState: WeldState = {
  welds: [],
  plans: [],
  reviewBatches: [],
  selectedId: '',
  statusFilter: '全部',
  locked: false,
  version: 12,
  audit: initialAudit,
  notices: [],
}

export const weldReducer = createReducer(
  initialState,
  on(A.loadWeldsSuccess, (state, { welds, plans, reviewBatches }) => ({
    ...state,
    welds,
    plans,
    reviewBatches,
    selectedId: state.selectedId || welds[0]?.id || '',
  })),
  on(A.selectWeld, (state, { id }) => ({ ...state, selectedId: id })),
  on(A.filterStatus, (state, { status }) => ({ ...state, statusFilter: status })),
  on(A.createPlan, (state, { plan }) => ({ ...state, plans: [plan, ...state.plans], version: state.version + 1 })),
  on(A.submitReview, (state, props) => submitReview(state, props)),
  on(A.decideReview, (state, props) => decideReview(state, props)),
  on(A.receiveReviewAction, (state, { kind, props }) =>
    kind === 'submit' ? submitReview(state, props as SubmitInput) : decideReview(state, props as DecideInput)),
  on(A.dismissReviewNotice, (state, { id }) => ({ ...state, notices: state.notices.filter((notice) => notice.id !== id) })),
  on(A.viewLatestReview, (state, { weldId }) => weldId ? { ...state, selectedId: weldId } : state),
  on(A.lockBaseline, (state, { actor = '周倩' }) => {
    const blockers = state.welds.flatMap((weld) => {
      const reasons: string[] = []
      if (['待检测', '返修中', '待复检', '待质量确认'].includes(weld.status)) reasons.push(`状态为${weld.status}`)
      if (!weld.qualificationValid) reasons.push(`焊工资质 ${weld.qualification} 已过期`)
      if (weld.inspectionRatio < weld.requiredRatio) reasons.push(`比例 ${weld.inspectionRatio}% 低于 ${weld.requiredRatio}%`)
      return reasons.map((reason) => `${weld.id}：${reason}`)
    })
    if (blockers.length) {
      return {
        ...state,
        audit: [audit(actor, '锁定拦截', '检测批次', blockers.join('；')), ...state.audit],
        notices: [interceptNotice('检测批次暂不能锁定', blockers.join('；')), ...state.notices],
      }
    }
    return {
      ...state,
      locked: true,
      audit: [audit(actor, '签字锁定', '检测批次', '复检结论、缺陷处置、资质和检测比例已确认') , ...state.audit],
    }
  }),
)
