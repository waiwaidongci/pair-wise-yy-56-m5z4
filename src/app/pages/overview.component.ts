import { Component, inject } from '@angular/core'
import { CommonModule } from '@angular/common'
import { Store } from '@ngrx/store'
import { TableModule } from 'primeng/table'
import { TagModule } from 'primeng/tag'
import { ButtonModule } from 'primeng/button'
import { SelectModule } from 'primeng/select'
import { FormsModule } from '@angular/forms'
import { WeldState } from '../store/weld.reducer'
import * as A from '../store/weld.actions'
import type { ReviewNotice, Weld } from '../types'

@Component({
  selector:'app-overview', standalone:true, imports:[CommonModule,TableModule,TagModule,ButtonModule,SelectModule,FormsModule],
  template:`
    <main class="page"><div class="page-head"><div><p class="eyebrow">焊缝、资质与检测比例</p><h1>焊缝台账总览</h1><p>复检批次版本确认后同步状态；资质过期或比例不足会在锁定前列出具体焊缝和原因。</p></div><p-button label="批量导入焊缝" icon="pi pi-upload" severity="secondary" /></div>
      <section class="notice-stack" *ngIf="state.notices.length"><article *ngFor="let notice of state.notices" [class.conflict]="notice.kind === '版本冲突'"><i class="pi" [class.pi-info-circle]="notice.kind==='版本冲突'" [class.pi-ban]="notice.kind==='确认拦截'"></i><div><b>{{notice.title}}</b><p>{{notice.detail}}</p></div><p-button size="small" text label="查看新版本" icon="pi pi-arrow-refresh" (onClick)="viewLatest(notice)" /><p-button size="small" text icon="pi pi-times" (onClick)="dismiss(notice)" /></article></section>
      <div class="grid-4"><article class="card metric"><span>焊缝总数</span><strong>{{state.welds.length}}</strong><small>{{located}} 条已建地图定位</small></article><article class="card metric"><span>待检测 / 返修 / 确认</span><strong class="warning">{{pending}}</strong><small>{{activePlans}} 项计划进行中</small></article><article class="card metric"><span>资质或比例预警</span><strong class="danger">{{warnings}}</strong><small>必须处理后才可锁定</small></article><article class="card metric"><span>批次版本</span><strong>v{{state.version}}</strong><small>{{state.locked ? '已签字锁定' : '可继续修改'}}</small></article></div>
      <div class="grid-2"><section class="card"><div class="toolbar"><p-select [options]="statusOptions" [(ngModel)]="filter" (ngModelChange)="applyFilter($event)" placeholder="筛选状态" styleClass="w-full md:w-40" /><span class="spacer"></span><p-button label="导出焊缝台账" icon="pi pi-file-excel" severity="secondary" /></div><p-table [value]="filtered" [paginator]="true" [rows]="8" selectionMode="single" (onRowSelect)="select($event.data)" dataKey="id"><ng-template #header><tr><th>焊缝 / 构件</th><th>方法与焊工</th><th>检测</th><th>返修</th><th>状态 / 版本</th></tr></ng-template><ng-template #body let-weld><tr><td><b>{{weld.id}}</b><small class="block">{{weld.drawing}} · {{weld.component}}</small></td><td>{{weld.method}} · {{weld.welder}}<small class="block" [class.danger]="!weld.qualificationValid">{{weld.qualificationValid ? '资质有效' : '资质已过期 / 到期'}}</small></td><td><b [class.danger]="weld.inspectionRatio < weld.requiredRatio">{{weld.inspectionRatio}}% / {{weld.requiredRatio}}%</b><small class="block">要求检测比例</small></td><td>{{weld.repairs}} 次<small class="block" *ngIf="weld.repairs >= 2">重复返修关注</small></td><td><p-tag [value]="weld.status" [severity]="severity(weld.status)" /><small class="block">复检 v{{weld.reviewVersion}}</small></td></tr></ng-template></p-table></section>
      <aside class="card"><h2 class="panel-title">规则预警（确认前列明焊缝与原因）</h2><div class="warning-row" *ngFor="let row of warningRows"><i [class.red]="row.level==='danger'" [class.amber]="row.level==='warn'"></i><div><b>{{row.title}}</b><p>{{row.detail}}</p></div></div><p class="empty" *ngIf="!warningRows.length">当前无资质、比例或重复返修预警。</p></aside></div>
    </main>
  `,
  styles:[`.block{display:block;color:#7a8798;margin-top:3px}.warning-row{display:flex;gap:10px;padding:12px 0;border-bottom:1px solid #edf0f5}.warning-row i{width:6px;border-radius:5px;background:#f59e0b}.warning-row i.red{background:#ef4444}.warning-row i.amber{background:#f59e0b}.warning-row div{flex:1}.warning-row p{margin:4px 0 0;font-size:13px}.empty{color:#7a8798;font-size:13px}.notice-stack{display:grid;gap:8px;margin-bottom:14px}.notice-stack article{display:flex;align-items:center;gap:10px;border:1px solid #fed7aa;background:#fff7ed;border-left:4px solid #f97316;border-radius:7px;padding:10px 12px}.notice-stack article.conflict{border-color:#bfdbfe;background:#eff6ff;border-left-color:#2563eb}.notice-stack i{font-size:17px;color:#f97316}.notice-stack .conflict i{color:#2563eb}.notice-stack article>div{flex:1}.notice-stack p{font-size:13px}`],
})
export class OverviewComponent {
  private readonly store = inject(Store<{ welds: WeldState }>)
  state!: WeldState
  filter = '全部'
  statusOptions = ['全部','待检测','合格','返修中','待复检','待质量确认','已关闭']
  constructor() { this.store.select('welds').subscribe((state) => this.state = state) }
  get filtered() { return this.filter === '全部' ? this.state?.welds ?? [] : (this.state?.welds ?? []).filter((item) => item.status === this.filter) }
  get pending() { return (this.state?.welds ?? []).filter((item) => ['待检测','返修中','待复检','待质量确认'].includes(item.status)).length }
  get located() { return (this.state?.welds ?? []).filter((item) => item.x >= 0 && item.y >= 0).length }
  get activePlans() { return (this.state?.plans ?? []).filter((plan) => plan.state !== '已完成').length }
  get warnings() { return this.warningRows.length }
  get warningRows() {
    return (this.state?.welds ?? []).flatMap((weld) => {
      const rows: { level:'danger'|'warn'; title:string; detail:string }[] = []
      if (!weld.qualificationValid) rows.push({ level:'danger', title:`${weld.id} 焊工资质已过期 / 到期`, detail:`${weld.welder} 证书 ${weld.qualification}，不能确认或锁定。` })
      if (weld.inspectionRatio < weld.requiredRatio) rows.push({ level:'danger', title:`${weld.id} 检测比例不足`, detail:`当前 ${weld.inspectionRatio}%，要求 ${weld.requiredRatio}%，需补足复检比例。` })
      if (weld.repairs >= 2) rows.push({ level:'warn', title:`${weld.id} 已返修 ${weld.repairs} 次`, detail:'同一焊缝重复返修，需负责人复核返修工艺。' })
      return rows
    })
  }
  severity(status: string) {
    return status === '合格' || status === '已关闭' ? 'success' : status === '返修中' ? 'danger' : status === '待质量确认' ? 'warn' : 'secondary'
  }
  applyFilter(status: string) { this.store.dispatch(A.filterStatus({ status })) }
  select(weld: Weld | Weld[] | undefined) { if (weld && !Array.isArray(weld)) this.store.dispatch(A.selectWeld({ id: weld.id })) }
  viewLatest(notice: ReviewNotice) { this.store.dispatch(A.viewLatestReview({ batchId: notice.batchId, weldId: notice.weldId })) }
  dismiss(notice: ReviewNotice) { this.store.dispatch(A.dismissReviewNotice({ id: notice.id })) }
}
