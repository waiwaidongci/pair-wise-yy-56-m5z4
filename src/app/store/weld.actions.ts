import { createAction, props } from '@ngrx/store'
import type { InspectionPlan, ReviewBatch, ReviewResult, Weld } from '../types'

export const loadWelds = createAction('[Weld] Load')
export const loadWeldsSuccess = createAction(
  '[Weld API] Load Success',
  props<{ welds: Weld[]; plans: InspectionPlan[]; reviewBatches: ReviewBatch[] }>(),
)
export const selectWeld = createAction('[Weld] Select', props<{ id: string }>())
export const filterStatus = createAction('[Weld] Filter Status', props<{ status: string }>())
export const createPlan = createAction('[Inspection] Create Plan', props<{ plan: InspectionPlan }>())

export const submitReview = createAction(
  '[Review] Submit',
  props<{
    batchId: string
    weldId: string
    result: Exclude<ReviewResult, '无效'>
    method: string
    report: string
    comment: string
    expectedVersion: number
    inspector: string
  }>(),
)

export const decideReview = createAction(
  '[Review] Decide',
  props<{
    batchId: string
    decision: '确认' | '退回'
    actor: string
    comment: string
    expectedVersion: number
  }>(),
)

export const dismissReviewNotice = createAction('[Review] Dismiss Notice', props<{ id: string }>())
export const viewLatestReview = createAction('[Review] View Latest', props<{ batchId?: string; weldId?: string }>())
export const receiveReviewAction = createAction(
  '[Review] Remote Action',
  props<{ kind: 'submit' | 'decide'; props: Record<string, unknown> }>(),
)
export const lockBaseline = createAction('[Approval] Lock Baseline', props<{ actor?: string }>())
