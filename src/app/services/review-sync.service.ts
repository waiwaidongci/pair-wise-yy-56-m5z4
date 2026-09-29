import { inject, Injectable } from '@angular/core'
import { ActionsSubject, Store } from '@ngrx/store'
import { filter } from 'rxjs'
import * as A from '../store/weld.actions'
import type { ReviewSyncPayload } from '../types'
import type { WeldState } from '../store/weld.reducer'

const CHANNEL_NAME = 'steel-weld-review-batch-v1'
const QUEUE_KEY = 'steel-weld-review-actions-v1'
const APPLIED_KEY = 'steel-weld-review-applied-v1'

@Injectable({ providedIn: 'root' })
export class ReviewSyncService {
  private readonly store = inject(Store<{ welds: WeldState }>)
  private readonly actions$ = inject(ActionsSubject)
  private channel?: BroadcastChannel
  private readonly sessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`

  start() {
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(CHANNEL_NAME)
      this.channel.onmessage = (event: MessageEvent<ReviewSyncPayload>) => this.receive(event.data)
    }
    this.replayMissedActions()

    this.actions$.pipe(
      filter((action): action is ReturnType<typeof A.submitReview> | ReturnType<typeof A.decideReview> =>
        action.type === A.submitReview.type || action.type === A.decideReview.type),
    ).subscribe((action) => {
      const { type, ...props } = action
      const payload: ReviewSyncPayload = {
        id: Date.now() + Math.random(),
        type,
        props,
        at: new Date().toISOString(),
      }
      this.markApplied(payload.id)
      this.persist(payload)
      this.channel?.postMessage(payload)
    })
  }

  private receive(payload: ReviewSyncPayload) {
    if (this.appliedInSession().has(payload.id)) return
    this.markApplied(payload.id)
    const props = { ...payload.props, type: payload.type }
    this.store.dispatch(A.receiveReviewAction({
      kind: payload.type === A.submitReview.type ? 'submit' : 'decide',
      props,
    }))
  }

  private replayMissedActions() {
    setTimeout(() => {
      try {
        const raw = localStorage.getItem(QUEUE_KEY)
        if (!raw) return
        const payloads = JSON.parse(raw) as ReviewSyncPayload[]
        payloads.slice(-30).forEach((payload) => this.receive(payload))
      } catch {
        // 浏览器禁用存储时，只保留当前窗口内的版本保护。
      }
    }, 260)
  }

  private appliedInSession(): Set<number> {
    try {
      const raw = sessionStorage.getItem(APPLIED_KEY)
      return new Set(raw ? JSON.parse(raw) as number[] : [])
    } catch {
      return new Set()
    }
  }

  private markApplied(id: number) {
    try {
      const applied = this.appliedInSession()
      applied.add(id)
      sessionStorage.setItem(APPLIED_KEY, JSON.stringify([...applied].slice(-200)))
    } catch {
      // 忽略隐私模式或配额异常。
    }
  }

  private persist(payload: ReviewSyncPayload) {
    try {
      const previous = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]') as ReviewSyncPayload[]
      localStorage.setItem(QUEUE_KEY, JSON.stringify([...previous, payload].slice(-100)))
    } catch {
      // 忽略隐私模式或配额异常。
    }
  }
}
