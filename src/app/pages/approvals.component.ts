import { Component, inject } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { Store } from '@ngrx/store'
import { ButtonModule } from 'primeng/button'
import { TimelineModule } from 'primeng/timeline'
import { TagModule } from 'primeng/tag'
import { DialogModule } from 'primeng/dialog'
import { TextareaModule } from 'primeng/textarea'
import { TableModule } from 'primeng/table'
import { WeldState } from '../store/weld.reducer'
import * as A from '../store/weld.actions'
import type { ReviewBatch, ReviewNotice, Weld } from '../types'

@Component({
  selector:'app-approvals', standalone:true, imports:[CommonModule,FormsModule,ButtonModule,TimelineModule,TagModule,DialogModule,TextareaModule,TableModule],
  template:`
    <main class="page"><div class="page-head"><div><p class="eyebrow">签字、版本与追溯</p><h1>逐段确认与锁定</h1><p>质量负责人确认合格或退回复检；资质、比例不足会逐条拦截。锁定前状态、缺陷处置和地图已同步。</p></div><p-button [label]="state.locked ? '已锁定' : '签字锁定检测批次'" icon="pi pi-lock" [disabled]="state.locked" (onClick)="lock()" /></div>
      <section class="notice-stack" *ngIf="state.notices.length"><article *ngFor="let notice of state.notices" [class.conflict]="notice.kind === '版本冲突'"><i class="pi" [class.pi-info-circle]="notice.kind==='版本冲突'" [class.pi-ban]="notice.kind==='确认拦截'"></i><div><b>{{notice.title}}</b><p>{{notice.detail}}</p></div><p-button size="small" text label="查看新版本" icon="pi pi-arrow-refresh" (onClick)="viewLatest(notice)" /><p-button size="small" text icon="pi pi-times" (onClick)="dismiss(notice)" /></article></section>
      <div class="grid-2"><section class="card"><h2 class="panel-title">待质量确认复检批次</h2><div class="review" *ngFor="let batch of pendingBatches"><div class="batch-main"><b>{{batch.id}} <p-tag [value]="batch.status" severity="warn" /></b><small *ngFor="let item of batch.items">{{item.weldId}} · {{weld(item.weldId)?.component}} · 提交 {{item.result}} · {{item.method}} · {{item.report}}</small><small>检测员：{{batch.inspector}} · {{batch.submittedAt}}</small></div><div class="blockers" *ngIf="blockers(batch).length"><p *ngFor="let reason of blockers(batch)"><i class="pi pi-exclamation-triangle"></i>{{reason}}</p></div><p class="ok" *ngIf="!blockers(batch).length"><i class="pi pi-check-circle"></i>资质和检测比例满足确认条件</p><div class="actions"><p-button label="退回保留返修" severity="danger" size="small" (onClick)="openReturn(batch)" /><p-button label="确认结论" size="small" [disabled]="!!blockers(batch).length" (onClick)="confirm(batch)" /></div></div><p class="empty" *ngIf="!pendingBatches.length">暂无待确认批次。</p></section>
      <aside class="card"><h2 class="panel-title">审批时间线</h2><p-timeline [value]="state.audit" align="left"><ng-template #content let-event><div class="audit"><div><b>{{event.actor}} · {{event.action}}</b><span>{{event.time}}</span></div><p><strong>{{event.target}}</strong> {{event.detail}}</p></div></ng-template></p-timeline></aside></div>
      <section class="card mt-4"><h2 class="panel-title">批次版本与双方记录</h2><p-table [value]="state.reviewBatches" [paginator]="true" [rows]="7"><ng-template #header><tr><th>批次</th><th>检测员提交</th><th>负责人结论</th><th>状态</th><th>版本链</th></tr></ng-template><ng-template #body let-batch><tr><td><b>{{batch.id}}</b><small class="block">batch {{batch.batchNo}} / revision {{batch.revision}}</small></td><td>{{batch.inspector}} · {{batch.submittedAt}}<small class="block">{{batch.items[0]?.result}} · {{batch.items[0]?.comment}}</small></td><td>{{batch.decidedBy || '待处理'}}<small class="block">{{batch.decidedAt || '—'}} · {{batch.decisionComment || '—'}}</small></td><td><p-tag [value]="batch.status" [severity]="batch.status === '已确认' ? 'success' : batch.status === '已退回' ? 'danger' : batch.status === '已作废' ? 'secondary' : 'warn'" /></td><td><span *ngFor="let h of batch.history" class="history-chip">{{h.actor}} {{h.action}}<b>v{{h.actualVersion}}</b></span></td></tr></ng-template></p-table></section>
      <section class="card mt-4"><h2 class="panel-title">锁定前检查</h2><div class="snapshot"><div><b>v{{state.version}}</b><small>确认后状态、缺陷处置、地图颜色和审批时间线使用同一批次版本</small></div><p-tag [value]="state.locked ? '已签字锁定' : '可编辑'" [severity]="state.locked ? 'success' : 'warn'" /></div><ul class="lock-list" *ngIf="lockBlockers.length"><li *ngFor="let item of lockBlockers">{{item}}</li></ul><p class="ok" *ngIf="!lockBlockers.length"><i class="pi pi-check-circle"></i>所有焊缝已合格或关闭，资质与比例满足锁定条件。</p></section>
      <p-dialog header="退回复检批次" [(visible)]="returnDialog" [modal]="true" [style]="{width:'520px'}"><div *ngIf="returning" class="return-form"><p><b>{{returning.id}}</b> 退回后焊缝回到返修中，返修次数和原缺陷均保留；检测员重新检测合格并再次提交后才可锁定。</p><p class="stale" *ngIf="returning.status !== '待质量确认'"><i class="pi pi-info-circle"></i>该页面引用旧版本，当前批次状态为 {{returning.status}}。</p><label>退回原因</label><textarea pTextarea rows="4" [(ngModel)]="returnReason" placeholder="请写明缺陷、比例或报告问题"></textarea></div><ng-template #footer><p-button label="取消" severity="secondary" (onClick)="returnDialog=false" /><p-button label="确认退回" severity="danger" [disabled]="!returnReason.trim()" (onClick)="submitReturn()" /></ng-template></p-dialog>
    </main>
  `,
  styles:[`.review{display:grid;grid-template-columns:minmax(0,1fr);gap:9px;padding:13px 0;border-bottom:1px solid #edf0f5}.batch-main b,.batch-main small{display:block}.batch-main small{color:#7a8798;margin-top:4px}.actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}.blockers{background:#fff1f2;border:1px solid #fecdd3;border-radius:6px;padding:9px}.blockers p,.ok,.lock-list{margin:3px 0}.blockers i,.ok i{margin-right:5px}.ok{color:#15803d;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:9px}.audit{background:#fff;border:1px solid #e1e7ef;border-radius:6px;padding:10px}.audit>div{display:flex;justify-content:space-between;gap:8px}.audit span{color:#7a8798;font-size:12px}.audit p{margin:5px 0 0;font-size:13px}.snapshot{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:12px;background:#f8fafc;border-radius:6px}.snapshot b,.snapshot small{display:block}.snapshot small{color:#7a8798;margin-top:4px}.history-chip{display:inline-block;margin:2px 4px 2px 0;padding:3px 7px;background:#f1f5f9;border-radius:10px;font-size:12px;color:#475569}.history-chip b{margin-left:3px}.block{display:block;color:#7a8798;margin-top:3px}.empty{color:#7a8798}.lock-list li{margin:6px 0;color:#b91c1c}.return-form{display:grid;gap:10px}.return-form textarea{padding:9px;border:1px solid #cbd5e1;border-radius:6px;width:100%}.stale{background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:6px;padding:9px}.mt-4{margin-top:16px}.notice-stack{display:grid;gap:8px;margin-bottom:14px}.notice-stack article{display:flex;align-items:center;gap:10px;border:1px solid #fed7aa;background:#fff7ed;border-left:4px solid #f97316;border-radius:7px;padding:10px 12px}.notice-stack article.conflict{border-color:#bfdbfe;background:#eff6ff;border-left-color:#2563eb}.notice-stack i{font-size:17px;color:#f97316}.notice-stack .conflict i{color:#2563eb}.notice-stack article>div{flex:1}.notice-stack p{font-size:13px}`],
})
export class ApprovalsComponent {
  private readonly store = inject(Store<{ welds: WeldState }>)
  state!: WeldState
  returnDialog = false
  returning?: ReviewBatch
  returnReason = ''
  constructor() { this.store.select('welds').subscribe((state) => this.state = state) }
  get pendingBatches() {
    return (this.state?.reviewBatches ?? []).filter((batch) => batch.status === '待质量确认')
  }
  get lockBlockers() {
    return (this.state?.welds ?? []).flatMap((weld) => {
      const reasons: string[] = []
      if (['待检测','返修中','待复检','待质量确认'].includes(weld.status)) reasons.push(`状态为${weld.status}`)
      if (!weld.qualificationValid) reasons.push(`焊工资质 ${weld.qualification} 已过期`)
      if (weld.inspectionRatio < weld.requiredRatio) reasons.push(`检测比例 ${weld.inspectionRatio}% 低于要求 ${weld.requiredRatio}%`)
      return reasons.map((reason) => `${weld.id}：${reason}`)
    })
  }
  weld(id: string) { return (this.state?.welds ?? []).find((item) => item.id === id) }
  blockers(batch: ReviewBatch) {
    return batch.items.flatMap((item) => {
      const weld: Weld | undefined = this.weld(item.weldId)
      const reasons: string[] = []
      if (!weld) reasons.push('焊缝台账中不存在')
      else {
        if (!weld.qualificationValid) reasons.push(`焊工资质已过期/到期（${weld.welder}，${weld.qualification}）`)
        if (weld.inspectionRatio < weld.requiredRatio) reasons.push(`检测比例不足：${weld.inspectionRatio}% / ${weld.requiredRatio}%`)
      }
      return reasons.map((reason) => `${item.weldId}：${reason}`)
    })
  }
  confirm(batch: ReviewBatch) {
    this.store.dispatch(A.decideReview({
      batchId: batch.id,
      decision: '确认',
      actor: '周倩',
      comment: '复检结论、资质和比例满足要求',
      expectedVersion: batch.revision,
    }))
  }
  openReturn(batch: ReviewBatch) {
    this.returning = batch
    this.returnReason = ''
    this.returnDialog = true
  }
  submitReturn() {
    if (!this.returning) return
    this.store.dispatch(A.decideReview({
      batchId: this.returning.id,
      decision: '退回',
      actor: '周倩',
      comment: this.returnReason,
      expectedVersion: this.returning.revision,
    }))
    this.returnDialog = false
  }
  lock() { this.store.dispatch(A.lockBaseline({ actor:'周倩' })) }
  viewLatest(notice: ReviewNotice) { this.store.dispatch(A.viewLatestReview({ batchId: notice.batchId, weldId: notice.weldId })) }
  dismiss(notice: ReviewNotice) { this.store.dispatch(A.dismissReviewNotice({ id: notice.id })) }
}
