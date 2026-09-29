import { Component, inject } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { RouterLink } from '@angular/router'
import { Store } from '@ngrx/store'
import { TableModule } from 'primeng/table'
import { TagModule } from 'primeng/tag'
import { ButtonModule } from 'primeng/button'
import { DialogModule } from 'primeng/dialog'
import { InputTextModule } from 'primeng/inputtext'
import { TextareaModule } from 'primeng/textarea'
import { WeldState } from '../store/weld.reducer'
import * as A from '../store/weld.actions'
import type { ReviewBatch, ReviewNotice, Weld } from '../types'

@Component({
  selector:'app-inspections', standalone:true, imports:[CommonModule,FormsModule,RouterLink,TableModule,TagModule,ButtonModule,DialogModule,InputTextModule,TextareaModule],
  template:`
    <main class="page"><div class="page-head"><div><p class="eyebrow">NDT / 返修闭环</p><h1>检测计划与返修复检</h1><p>检测员只提交结果；质量负责人确认或退回。旧页面不能覆盖新结论，双方记录均保留。</p></div></div>
      <section class="notice-stack" *ngIf="state.notices.length"><article *ngFor="let notice of state.notices" [class.conflict]="notice.kind === '版本冲突'"><i class="pi" [class.pi-info-circle]="notice.kind==='版本冲突'" [class.pi-ban]="notice.kind==='确认拦截'"></i><div><b>{{notice.title}}</b><p>{{notice.detail}}</p></div><p-button size="small" text label="查看新版本" icon="pi pi-arrow-refresh" (onClick)="viewLatest(notice)" /><p-button size="small" text icon="pi pi-times" (onClick)="dismiss(notice)" /></article></section>
      <div class="grid-2"><section class="card"><h2 class="panel-title">批量检测计划</h2><p-table [value]="state.plans" [paginator]="true" [rows]="5"><ng-template #header><tr><th>计划编号</th><th>日期</th><th>方法</th><th>焊缝</th><th>检测人</th><th>状态</th></tr></ng-template><ng-template #body let-plan><tr><td>{{plan.id}}</td><td>{{plan.date}}</td><td>{{plan.method}}</td><td>{{plan.weldIds.length}} 条</td><td>{{plan.inspector}}</td><td><p-tag [value]="plan.state" [severity]="plan.state === '已完成' ? 'success' : plan.state === '执行中' ? 'info' : 'warn'" /></td></tr></ng-template></p-table></section>
      <aside class="card"><h2 class="panel-title">复检批次版本</h2><div class="step" *ngFor="let weld of activeWelds"><div class="step-main"><b>{{weld.id}} · {{weld.component}}</b><small>已返修 {{weld.repairs}} 次 · {{weld.defects.length}} 条缺陷记录 · 当前 v{{weld.reviewVersion}}</small></div><p-tag [value]="weld.status" [severity]="severity(weld.status)" /><div class="batch-line"><span>{{batch(weld)?.id || '尚未提交'}} · {{batch(weld)?.status || '检测员可提交'}}</span><p-button label="提交/重新提交" icon="pi pi-send" size="small" [disabled]="!canSubmit(weld)" (onClick)="openSubmit(weld)" /></div></div></aside></div>
      <section class="card mt-4"><h2 class="panel-title">检测结果与缺陷明细</h2><p-table [value]="defects" [paginator]="true" [rows]="8"><ng-template #header><tr><th>缺陷编号</th><th>焊缝 / 版本</th><th>位置 / 长度</th><th>类型 / 等级</th><th>检测方法 / 报告</th><th>缺陷处置</th><th>审核</th></tr></ng-template><ng-template #body let-item><tr><td>{{item.defect.id}}</td><td>{{item.weld.id}}<small class="block">复检 v{{item.weld.reviewVersion}}</small></td><td>{{item.defect.position}}% · {{item.defect.length}}mm</td><td>{{item.defect.type}} · {{item.defect.level}}</td><td>{{item.defect.method}}<small class="block">{{item.defect.report}}</small></td><td><p-tag [value]="item.defect.status" [severity]="item.defect.status === '关闭' ? 'success' : item.defect.status === '返修中' ? 'danger' : 'warn'" /><small class="block">{{item.defect.disposition || '等待质量结论'}}</small></td><td><a routerLink="/approvals"><p-button label="查看确认/退回" size="small" text /></a></td></tr></ng-template></p-table></section>
      <section class="card mt-4"><h2 class="panel-title">双方记录与历史版本</h2><p-table [value]="state.reviewBatches" [paginator]="true" [rows]="6"><ng-template #header><tr><th>批次版本</th><th>焊缝</th><th>检测员提交</th><th>负责人结论</th><th>状态</th><th>双方记录</th></tr></ng-template><ng-template #body let-batch><tr><td><b>{{batch.id}}</b><small class="block">revision {{batch.revision}}</small></td><td>{{batch.items[0]?.weldId}}</td><td>{{batch.inspector}} · {{batch.submittedAt}}<small class="block">{{batch.items[0]?.result}} · {{batch.items[0]?.comment}}</small></td><td>{{batch.decidedBy || '待周倩处理'}}<small class="block">{{batch.decisionComment || batch.decidedAt || '—'}}</small></td><td><p-tag [value]="batch.status" [severity]="batch.status === '已确认' ? 'success' : batch.status === '已退回' ? 'danger' : batch.status === '已作废' ? 'secondary' : 'warn'" /></td><td><span *ngFor="let h of batch.history" class="history-chip">{{h.actor}} / {{h.action}} / v{{h.actualVersion}}</span></td></tr></ng-template></p-table></section>
      <p-dialog header="提交复检结果（带批次版本）" [(visible)]="dialog" [modal]="true" [style]="{width:'650px'}"><div class="form" *ngIf="editing"><div class="dialog-title"><div><b>{{editing.id}} · {{editing.component}}</b><small>返修 {{editing.repairs}} 次不会因退回清零；原缺陷保留并生成新版本。</small></div><p-tag value="基于 v{{form.expectedVersion}}" severity="info" /></div><label>复检结果</label><select [(ngModel)]="form.result"><option value="合格">合格</option><option value="不合格">不合格（继续返修）</option></select><label>检测方法</label><select [(ngModel)]="form.method"><option>UT</option><option>MT</option><option>PT</option><option>UT + MT</option></select><label>报告编号</label><input pInputText [(ngModel)]="form.report" /><label>检测说明 / 缺陷位置</label><textarea pTextarea [(ngModel)]="form.comment" rows="4"></textarea><p class="tip"><i class="pi pi-shield"></i> 提交时校验 v{{form.expectedVersion}}；若其他窗口已更新，本次旧提交会被拦截并提示查看新版本。</p></div><ng-template #footer><p-button label="取消" severity="secondary" (onClick)="dialog=false" /><p-button label="提交给质量负责人" icon="pi pi-check" [disabled]="!form.report || !form.comment" (onClick)="submit()" /></ng-template></p-dialog>
    </main>
  `,
  styles:[`.step{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px;padding:12px 0;border-bottom:1px solid #edf0f5}.step-main b,.step-main small{display:block}.step-main small,.batch-line span{color:#7a8798;font-size:13px}.batch-line{grid-column:1/-1;display:flex;justify-content:space-between;gap:10px;align-items:center}.form{display:grid;gap:9px}.form input,.form select,.form textarea{padding:9px;border:1px solid #cbd5e1;border-radius:6px;width:100%}.dialog-title{display:flex;justify-content:space-between;gap:12px;padding:10px;background:#f8fafc;border-radius:7px}.dialog-title b,.dialog-title small{display:block}.dialog-title small{color:#7a8798;margin-top:4px}.tip{background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:9px;font-size:13px}.block{display:block;color:#7a8798;margin-top:3px}.history-chip{display:inline-block;margin:2px 4px 2px 0;padding:3px 7px;background:#f1f5f9;border-radius:10px;font-size:12px;color:#475569}.mt-4{margin-top:16px}.notice-stack{display:grid;gap:8px;margin-bottom:14px}.notice-stack article{display:flex;align-items:center;gap:10px;border:1px solid #fed7aa;background:#fff7ed;border-left:4px solid #f97316;border-radius:7px;padding:10px 12px}.notice-stack article.conflict{border-color:#bfdbfe;background:#eff6ff;border-left-color:#2563eb}.notice-stack i{font-size:17px;color:#f97316}.notice-stack .conflict i{color:#2563eb}.notice-stack article>div{flex:1}.notice-stack p{font-size:13px}`],
})
export class InspectionsComponent {
  private readonly store = inject(Store<{ welds: WeldState }>)
  state!: WeldState
  dialog = false
  editing?: Weld
  form = { weldId:'', result:'合格' as '合格' | '不合格', method:'UT', report:'', comment:'', expectedVersion:0 }

  constructor() { this.store.select('welds').subscribe((state) => this.state = state) }
  get activeWelds() { return (this.state?.welds ?? []).filter((item) => ['返修中','待复检','待质量确认'].includes(item.status)) }
  get defects() { return (this.state?.welds ?? []).flatMap((weld) => weld.defects.map((defect) => ({ weld, defect }))) }
  batch(weld: Weld) {
    return (this.state?.reviewBatches ?? []).find((batch) => batch.id === weld.reviewBatchId)
      ?? (this.state?.reviewBatches ?? []).filter((batch) => batch.items.some((item) => item.weldId === weld.id))
        .sort((a, b) => b.revision - a.revision)[0] as ReviewBatch | undefined
  }
  canSubmit(weld: Weld) { return ['返修中', '待复检'].includes(weld.status) }
  severity(status: string) {
    return status === '合格' ? 'success' : status === '返修中' ? 'danger' : status === '待质量确认' ? 'warn' : 'secondary'
  }
  openSubmit(weld: Weld) {
    const defect = weld.defects.find((item) => item.status !== '关闭')
    this.editing = weld
    this.dialog = true
    this.form = {
      weldId: weld.id,
      result: '合格',
      method: defect?.method || 'UT',
      report: defect ? `${defect.report}-R${weld.repairs + 1}` : `NDT-${Date.now()}`,
      comment: defect ? `针对 ${defect.id}（${defect.type}，${defect.position}%）返修后复检。` : '',
      expectedVersion: weld.reviewVersion,
    }
  }
  submit() {
    this.store.dispatch(A.submitReview({
      batchId: `RB-${this.form.weldId}`,
      weldId: this.form.weldId,
      result: this.form.result,
      method: this.form.method,
      report: this.form.report,
      comment: this.form.comment,
      expectedVersion: this.form.expectedVersion,
      inspector: '赵岚',
    }))
    this.dialog = false
  }
  viewLatest(notice: ReviewNotice) { this.store.dispatch(A.viewLatestReview({ batchId: notice.batchId, weldId: notice.weldId })) }
  dismiss(notice: ReviewNotice) { this.store.dispatch(A.dismissReviewNotice({ id: notice.id })) }
}
