import { createAction, props } from '@ngrx/store'
import type { BatchResult, InspectionPlan, Weld, WeldStatus } from '../types'

export const loadWelds = createAction('[Weld] Load')
export const loadWeldsSuccess = createAction('[Weld API] Load Success', props<{ welds: Weld[]; plans: InspectionPlan[] }>())
export const selectWeld = createAction('[Weld] Select', props<{ id: string }>())
export const filterStatus = createAction('[Weld] Filter Status', props<{ status: string }>())
export const advanceWeld = createAction('[Weld] Advance', props<{ id: string; status: WeldStatus }>())
export const createPlan = createAction('[Inspection] Create Plan', props<{ plan: InspectionPlan }>())

/** 检测员提交复检结果（生成批次版本；合格→待复检，不合格→返修中并累加返修次数） */
export const submitReinspection = createAction('[Inspection] Submit Reinspection', props<{ weldId: string; result: BatchResult; method: string; defects: Weld['defects']; note: string }>())
/** 质量负责人确认批次（expectedVersion 为页面打开时的批次版本，不一致说明另一窗口已更新） */
export const confirmBatch = createAction('[Approval] Confirm Batch', props<{ batchId: string; expectedVersion: number; note?: string }>())
/** 质量负责人退回批次（保留返修次数与缺陷，重新检测合格前不得锁定） */
export const rejectBatch = createAction('[Approval] Reject Batch', props<{ batchId: string; expectedVersion: number; note: string }>())
/** 模拟另一窗口抢先处理（批次版本 +1），用于演示旧页面并发冲突 */
export const externalUpdateBatch = createAction('[Approval] External Update Batch', props<{ batchId: string }>())
/** 关闭冲突提示并刷新到新版本 */
export const clearConflict = createAction('[Approval] Clear Conflict')
export const clearLockBlockers = createAction('[Approval] Clear Lock Blockers')

export const lockBaseline = createAction('[Approval] Lock Baseline')
