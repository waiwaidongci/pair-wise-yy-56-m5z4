export type WeldStatus = '待检测' | '合格' | '返修中' | '待复检' | '待质量确认' | '已关闭'
export type DefectLevel = 'Ⅰ级' | 'Ⅱ级' | 'Ⅲ级' | 'Ⅳ级'
export type DefectStatus = '待处置' | '返修中' | '关闭'
export type ReviewResult = '合格' | '不合格' | '无效'
export type ReviewBatchStatus = '待质量确认' | '已确认' | '已退回' | '已作废'

export interface Defect {
  id: string
  position: number
  type: string
  length: number
  level: DefectLevel
  method: string
  report: string
  status: DefectStatus
  disposition?: string
}

export interface Weld {
  id: string
  drawing: string
  component: string
  joint: string
  method: string
  welder: string
  qualification: string
  qualificationValid: boolean
  inspectionRatio: number
  requiredRatio: number
  status: WeldStatus
  x: number
  y: number
  repairs: number
  defects: Defect[]
  reviewVersion: number
  reviewBatchId?: string
}

export interface InspectionPlan {
  id: string
  date: string
  method: string
  weldIds: string[]
  inspector: string
  state: '待执行' | '执行中' | '已完成'
}

export interface AuditEvent {
  id: string
  time: string
  actor: string
  action: string
  target: string
  detail: string
}

export interface ReviewItem {
  weldId: string
  result: ReviewResult
  method: string
  report: string
  comment: string
  defectIds: string[]
  inspector: string
  submittedAt: string
}

export interface ReviewDecision {
  actor: string
  action: '提交复检' | '确认' | '退回' | '旧页拦截'
  result: ReviewResult
  comment: string
  at: string
  expectedVersion?: number
  actualVersion?: number
}

export interface ReviewBatch {
  id: string
  batchNo: string
  revision: number
  batchVersion: number
  status: ReviewBatchStatus
  inspector: string
  submittedAt: string
  decidedBy?: string
  decidedAt?: string
  decisionComment?: string
  items: ReviewItem[]
  history: ReviewDecision[]
}

export interface ReviewNotice {
  id: string
  kind: '版本冲突' | '确认拦截'
  title: string
  detail: string
  batchId?: string
  weldId?: string
}

export interface ReviewSyncPayload {
  id: number
  type: string
  props?: Record<string, unknown>
  at: string
}
