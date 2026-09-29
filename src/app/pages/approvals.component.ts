import { Component, inject } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { Store } from '@ngrx/store'
import { ButtonModule } from 'primeng/button'
import { TimelineModule } from 'primeng/timeline'
import { TagModule } from 'primeng/tag'
import { TableModule } from 'primeng/table'
import { DialogModule } from 'primeng/dialog'
import { TextareaModule } from 'primeng/textarea'
import { WeldState } from '../store/weld.reducer'
import * as A from '../store/weld.actions'
import type { ReinspectionBatch } from '../types'

@Component({
  selector:'app-approvals', standalone:true, imports:[CommonModule,FormsModule,ButtonModule,TimelineModule,TagModule,TableModule,DialogModule,TextareaModule],
  template:`
    <main class="page"><div class="page-head"><div><p class="eyebrow">复检批次确认、版本与追溯</p><h1>逐段确认与锁定</h1><p>检测员提交复检批次（含版本号），质量负责人确认或退回；另一窗口先更新时旧页面不得覆盖新结论，锁定前逐项校验资质、比例与缺陷闭环。</p></div><p-button [label]="state.locked ? '已签字锁定' : '签字锁定检测批次'" icon="pi pi-lock" [disabled]="state.locked" (onClick)="lock()" /></div>

      <section class="card"><h2 class="panel-title">待确认复检批次</h2><p-table [value]="pendingBatches" [paginator]="true" [rows]="6"><ng-template #header><tr><th>批次编号</th><th>焊缝 / 构件</th><th>批次版本</th><th>结论</th><th>方法</th><th>提交人 / 时间</th><th>操作</th></tr></ng-template><ng-template #body let-batch><tr><td>{{batch.id}}</td><td><b>{{batch.weldId}}</b><small class="block">{{componentOf(batch.weldId)}}</small></td><td><p-tag [value]="'v' + batch.version" severity="info" /></td><td><p-tag [value]="batch.result" [severity]="batch.result === '合格' ? 'success' : 'danger'" /></td><td>{{batch.method}}</td><td>{{batch.submittedBy}}<small class="block">{{batch.submittedAt}}</small></td><td class="actions"><p-button label="确认合格" size="small" (onClick)="confirm(batch)" /><p-button label="退回" severity="danger" size="small" text (onClick)="openReject(batch)" /><p-button label="模拟其他窗口已更新" icon="pi pi-clone" size="small" severity="secondary" text (onClick)="external(batch)" /></td></tr></ng-template><ng-template #emptymessage><tr><td colspan="7" class="muted">暂无待确认复检批次。</td></tr></ng-template></p-table></section>

      <div class="grid-2 mt-4"><section class="card"><h2 class="panel-title">双方记录 · 复检批次历史</h2><p-table [value]="historyBatches" [paginator]="true" [rows]="6"><ng-template #header><tr><th>批次 / 版本</th><th>焊缝</th><th>结论</th><th>状态</th><th>提交记录</th><th>质量负责人记录</th></tr></ng-template><ng-template #body let-batch><tr><td>{{batch.id}}<small class="block">v{{batch.version}}</small></td><td>{{batch.weldId}}</td><td><p-tag [value]="batch.result" [severity]="batch.result === '合格' ? 'success' : 'danger'" /></td><td><p-tag [value]="batch.status" [severity]="batch.status === '已确认' ? 'success' : batch.status === '已退回' ? 'danger' : batch.status === '已取代' ? 'warn' : 'info'" /></td><td>{{batch.submittedBy}}<small class="block">{{batch.submittedAt}}</small></td><td><span *ngIf="batch.reviewedBy">{{batch.reviewedBy}}<small class="block">{{batch.reviewedAt}}</small><small class="block note">{{batch.reviewNote}}</small></span><span class="muted" *ngIf="!batch.reviewedBy">—</span></td></tr></ng-template></p-table></section>
      <aside class="card"><h2 class="panel-title">完整审计时间线</h2><p-timeline [value]="state.audit" align="left"><ng-template #content let-event><div class="audit"><div><b>{{event.actor}} · {{event.action}}</b><span>{{event.time}}</span></div><p><strong>{{event.target}}</strong> {{event.detail}}</p></div></ng-template></p-timeline></aside></div>

      <section class="card mt-4"><h2 class="panel-title">版本快照</h2><div class="snapshot"><div><b>v{{state.version}}</b><small>当前工作版本 · {{state.welds.length}} 条焊缝 · {{state.plans.length}} 个检测计划 · {{state.batches.length}} 个复检批次</small></div><p-tag [value]="state.locked ? '已签字锁定' : '可编辑'" [severity]="state.locked ? 'success' : 'warn'" /><p-button label="查看差异" text /></div><p>版本快照记录焊缝状态、复检批次版本、缺陷处置、返修次数和签字人。确认、退回与异地操作均留痕，旧页面提交不得覆盖新结论；任何后续修改必须从当前版本派生。</p></section>

      <p-dialog header="检测批次已在其他窗口更新" [(visible)]="conflictVisible" [modal]="true" [style]="{width:'520px'}"><div class="conflict" *ngIf="state.conflict"><i class="pi pi-exclamation-triangle"></i><div><p><b>{{state.conflict.weldId}} 复检批次已更新为 v{{state.conflict.newVersion}}</b>（本窗口打开时为 v{{state.conflict.oldVersion}}）</p><p>{{state.conflict.message}}</p></div></div><ng-template #footer><p-button label="查看新版本并刷新" icon="pi pi-refresh" (onClick)="refreshVersion()" /></ng-template></p-dialog>

      <p-dialog header="锁定条件不满足 · 请先处理以下焊缝" [(visible)]="blockerVisible" [modal]="true" [style]="{width:'620px'}"><div class="blocker" *ngFor="let b of state.lockBlockers"><b>{{b.weldId}} · {{b.component}}</b><ul><li *ngFor="let reason of b.reasons">{{reason}}</li></ul></div><p class="muted">焊工资质过期、检测比例不足、缺陷未处置或复检批次未确认时，质量负责人不得签字锁定。</p><ng-template #footer><p-button label="知道了" severity="secondary" (onClick)="blockerVisible = false" /></ng-template></p-dialog>

      <p-dialog header="退回复检批次" [(visible)]="rejectVisible" [modal]="true" [style]="{width:'520px'}"><div class="form"><label>退回意见（返修次数与缺陷将保留，重新检测合格并确认前不得锁定）</label><textarea pTextarea [(ngModel)]="rejectNote" rows="4" placeholder="如：缺陷评定依据不足，返修后重新检测"></textarea></div><ng-template #footer><p-button label="取消" severity="secondary" (onClick)="rejectVisible = false" /><p-button label="确认退回" severity="danger" [disabled]="!rejectNote.trim()" (onClick)="doReject()" /></ng-template></p-dialog>
    </main>
  `,
  styles:[`.block{display:block;color:#7a8798;margin-top:3px}.block.note{color:#b91c1c;margin-top:2px}.actions{white-space:nowrap}.actions .p-button{margin-right:4px}.review b,.review small{display:block}.review small{color:#7a8798;margin-top:4px}.audit{background:#fff;border:1px solid #e1e7ef;border-radius:6px;padding:10px}.audit>div{display:flex;justify-content:space-between}.audit span{color:#7a8798;font-size:12px}.audit p{margin:5px 0 0;font-size:13px}.snapshot{display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:center;padding:12px;background:#f8fafc;border-radius:6px}.snapshot b,.snapshot small{display:block}.snapshot small{color:#7a8798;margin-top:4px}.conflict{display:flex;gap:12px;align-items:flex-start;color:#92400e}.conflict i{font-size:26px;color:#f59e0b}.conflict p{margin:4px 0;font-size:13px}.blocker{padding:10px 0;border-bottom:1px solid #edf0f5}.blocker b{color:#b91c1c}.blocker ul{margin:6px 0 0;padding-left:20px;font-size:13px}.form{display:grid;gap:9px}.form textarea{padding:9px;border:1px solid #cbd5e1;border-radius:6px;width:100%}.muted{color:#7a8798}.mt-4{margin-top:16px}@media(max-width:760px){.actions .p-button{width:100%;margin:2px 0}}`],
})
export class ApprovalsComponent {
  private readonly store = inject(Store<{ welds: WeldState }>)
  state!: WeldState
  /** 本窗口打开时各批次的版本快照：提交时携带，用于并发冲突检测 */
  private viewVersions = new Map<string, number>()
  conflictVisible = false
  blockerVisible = false
  rejectVisible = false
  rejectTarget: ReinspectionBatch | null = null
  rejectNote = ''

  constructor() {
    this.store.select('welds').subscribe((state) => {
      this.state = state
      // 仅在初次加载 / 冲突刷新后同步本窗口版本快照，检测页新提交不会自动覆盖旧页面
      if (this.viewVersions.size === 0) this.syncVersions()
      this.conflictVisible = !!state.conflict
      this.blockerVisible = !!state.lockBlockers
    })
  }

  get pendingBatches() { return (this.state?.batches ?? []).filter((b) => b.status === '待确认') }
  get historyBatches() { return [...(this.state?.batches ?? [])].sort((a, b) => b.id.localeCompare(a.id)) }
  componentOf(weldId: string) { return this.state?.welds.find((w) => w.id === weldId)?.component ?? '' }

  private syncVersions() { this.viewVersions = new Map((this.state?.batches ?? []).map((b) => [b.id, b.version])) }

  confirm(batch: ReinspectionBatch) {
    this.store.dispatch(A.confirmBatch({ batchId: batch.id, expectedVersion: this.viewVersions.get(batch.id) ?? batch.version }))
  }
  openReject(batch: ReinspectionBatch) { this.rejectTarget = batch; this.rejectNote = ''; this.rejectVisible = true }
  doReject() {
    if (this.rejectTarget) this.store.dispatch(A.rejectBatch({ batchId: this.rejectTarget.id, expectedVersion: this.viewVersions.get(this.rejectTarget.id) ?? this.rejectTarget.version, note: this.rejectNote.trim() }))
    this.rejectVisible = false
  }
  external(batch: ReinspectionBatch) { this.store.dispatch(A.externalUpdateBatch({ batchId: batch.id })) }

  refreshVersion() { this.store.dispatch(A.clearConflict()); this.syncVersions() }
  lock() { this.store.dispatch(A.lockBaseline()) }
}
