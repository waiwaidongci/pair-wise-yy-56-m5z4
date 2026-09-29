export type WeldStatus = '待检测' | '合格' | '返修中' | '待复检' | '已关闭'
export type DefectLevel = 'Ⅰ级' | 'Ⅱ级' | 'Ⅲ级' | 'Ⅳ级'
export type DefectDisposition = '未处置' | '返修中' | '已关闭'

export interface Defect {
  id: string
  position: number
  type: string
  length: number
  level: DefectLevel
  method: string
  report: string
  disposition: DefectDisposition
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
}

export interface InspectionPlan {
  id: string
  date: string
  method: string
  weldIds: string[]
  inspector: string
  state: '待执行' | '执行中' | '已完成'
}

/** 复检结论：检测员提交的批次结果 */
export type BatchResult = '合格' | '不合格'
/** 批次审核状态：待质量负责人确认 / 已确认 / 已退回 / 被更新的新批次取代 */
export type BatchStatus = '待确认' | '已确认' | '已退回' | '已取代'

/** 复检批次：一次提交生成一个版本，双方各执一份记录，旧页面不得覆盖新结论 */
export interface ReinspectionBatch {
  id: string
  weldId: string
  /** 同一焊缝内单调递增的批次版本号 */
  version: number
  result: BatchResult
  method: string
  /** 提交时附带的缺陷快照 */
  defects: Defect[]
  status: BatchStatus
  submittedBy: string
  submittedAt: string
  reviewedBy?: string
  reviewedAt?: string
  reviewNote?: string
}

/** 锁定拦截项：具体焊缝 + 原因 */
export interface LockBlocker {
  weldId: string
  component: string
  reasons: string[]
}

/** 旧页面与新结论冲突时的提示信息 */
export interface ConflictInfo {
  batchId: string
  weldId: string
  oldVersion: number
  newVersion: number
  message: string
}

export interface AuditEvent {
  id: string
  time: string
  actor: string
  action: string
  target: string
  detail: string
}
