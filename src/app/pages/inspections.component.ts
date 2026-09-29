import { Component, inject } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { Store } from '@ngrx/store'
import { TableModule } from 'primeng/table'
import { TagModule } from 'primeng/tag'
import { ButtonModule } from 'primeng/button'
import { DialogModule } from 'primeng/dialog'
import { InputTextModule } from 'primeng/inputtext'
import { TextareaModule } from 'primeng/textarea'
import { SelectButtonModule } from 'primeng/selectbutton'
import { WeldState } from '../store/weld.reducer'
import * as A from '../store/weld.actions'
import type { BatchResult, Defect, DefectLevel } from '../types'

@Component({
  selector:'app-inspections', standalone:true, imports:[CommonModule,FormsModule,TableModule,TagModule,ButtonModule,DialogModule,InputTextModule,TextareaModule,SelectButtonModule],
  template:`
    <main class="page"><div class="page-head"><div><p class="eyebrow">NDT / 返修闭环</p><h1>检测计划与复检批次</h1><p>检测员提交复检结果即生成批次版本；合格转待复检由质量负责人确认，不合格退回返修并累计次数，退回保留缺陷，重新检测合格前不得锁定。</p></div><p-button label="提交复检结果" icon="pi pi-plus" (onClick)="dialog = true" /></div>
      <div class="grid-2"><section class="card"><h2 class="panel-title">批量检测计划</h2><p-table [value]="state.plans" [paginator]="true" [rows]="6"><ng-template #header><tr><th>计划编号</th><th>日期</th><th>方法</th><th>焊缝</th><th>检测人</th><th>状态</th></tr></ng-template><ng-template #body let-plan><tr><td>{{plan.id}}</td><td>{{plan.date}}</td><td>{{plan.method}}</td><td>{{plan.weldIds.length}} 条</td><td>{{plan.inspector}}</td><td><p-tag [value]="plan.state" [severity]="plan.state === '已完成' ? 'success' : plan.state === '执行中' ? 'info' : 'warn'" /></td></tr></ng-template></p-table></section>
      <aside class="card"><h2 class="panel-title">复检批次与返修状态</h2><div class="step" *ngFor="let weld of repairWelds"><div><b>{{weld.id}} · {{weld.component}}</b><small>{{weld.defects.length}} 个缺陷 · 已返修 {{weld.repairs}} 次 · 当前状态 {{weld.status}}</small></div><p-tag [value]="latestBatch(weld.id) ? ('复检批次 v' + latestBatch(weld.id)!.version + ' · ' + latestBatch(weld.id)!.status) : '暂无复检批次'" severity="warn" /></div><p class="muted">提交复检后自动生成批次版本，质量负责人在审核锁定页确认或退回；另一窗口先处理时旧页面不得覆盖新结论。</p></aside></div>

      <section class="card mt-4"><h2 class="panel-title">复检批次记录（双方留痕）</h2><p-table [value]="state.batches" [paginator]="true" [rows]="6"><ng-template #header><tr><th>批次编号</th><th>焊缝</th><th>版本</th><th>结论</th><th>方法</th><th>提交人 / 时间</th><th>状态</th><th>质量负责人记录</th></tr></ng-template><ng-template #body let-batch><tr><td>{{batch.id}}</td><td><b>{{batch.weldId}}</b></td><td><p-tag [value]="'v' + batch.version" severity="info" /></td><td><p-tag [value]="batch.result" [severity]="batch.result === '合格' ? 'success' : 'danger'" /></td><td>{{batch.method}}</td><td>{{batch.submittedBy}}<small class="block">{{batch.submittedAt}}</small></td><td><p-tag [value]="batch.status" [severity]="batch.status === '已确认' ? 'success' : batch.status === '已退回' ? 'danger' : batch.status === '已取代' ? 'warn' : 'info'" /></td><td><span *ngIf="batch.reviewedBy">{{batch.reviewedBy}}<small class="block">{{batch.reviewedAt}}</small><small class="block note">{{batch.reviewNote}}</small></span><span class="muted" *ngIf="!batch.reviewedBy">待确认</span></td></tr></ng-template></p-table></section>

      <section class="card mt-4"><h2 class="panel-title">检测结果与缺陷处置</h2><p-table [value]="defects" [paginator]="true" [rows]="8"><ng-template #header><tr><th>缺陷编号</th><th>焊缝</th><th>位置 / 长度</th><th>类型 / 等级</th><th>检测方法</th><th>报告</th><th>处置状态</th></tr></ng-template><ng-template #body let-item><tr><td>{{item.defect.id}}</td><td>{{item.weld.id}}</td><td>{{item.defect.position}}% · {{item.defect.length}}mm</td><td>{{item.defect.type}} · {{item.defect.level}}</td><td>{{item.defect.method}}</td><td>{{item.defect.report}}</td><td><p-tag [value]="dispositionLabel(item.defect.disposition)" [severity]="item.defect.disposition === '已关闭' ? 'success' : item.defect.disposition === '返修中' ? 'danger' : 'warn'" /></td></tr></ng-template></p-table></section>

      <p-dialog header="提交复检结果（生成批次版本）" [(visible)]="dialog" [modal]="true" [style]="{width:'620px'}"><div class="form"><label>焊缝编号</label><select [(ngModel)]="form.weldId"><option *ngFor="let weld of state.welds" [value]="weld.id">{{weld.id}} · {{weld.component}}</option></select><label>复检结论</label><p-selectbutton [options]="resultOptions" [(ngModel)]="form.result" /><label>检测方法</label><select [(ngModel)]="form.method"><option>UT</option><option>MT</option><option>PT</option><option>UT + MT</option></select><label>缺陷位置（0–100%）</label><input pInputText type="number" [(ngModel)]="form.position" /><label>缺陷类型</label><input pInputText [(ngModel)]="form.type" placeholder="如：未熔合" /><label>缺陷等级</label><select [(ngModel)]="form.level"><option *ngFor="let l of levels" [value]="l">{{l}}</option></select><label>长度（mm）</label><input pInputText type="number" [(ngModel)]="form.length" /><label>报告编号与说明</label><textarea pTextarea [(ngModel)]="form.report" rows="3"></textarea></div><ng-template #footer><p-button label="取消" severity="secondary" (onClick)="dialog=false" /><p-button label="提交复检批次" [disabled]="!form.weldId || !form.report" (onClick)="submit()" /></ng-template></p-dialog>
    </main>
  `,
  styles:[`.step{display:grid;grid-template-columns:1fr auto;gap:9px;padding:12px 0;border-bottom:1px solid #edf0f5}.step>div,.step small{display:block}.step small{color:#7a8798;margin-top:4px}.form{display:grid;gap:9px}.form input,.form select,.form textarea{padding:9px;border:1px solid #cbd5e1;border-radius:6px;width:100%}.block{display:block;color:#7a8798;margin-top:3px}.block.note{color:#b91c1c;margin-top:2px}.muted{color:#7a8798}.mt-4{margin-top:16px}`],
})
export class InspectionsComponent {
  private readonly store = inject(Store<{ welds: WeldState }>)
  state!: WeldState
  dialog = false
  resultOptions: BatchResult[] = ['合格', '不合格']
  levels: DefectLevel[] = ['Ⅰ级', 'Ⅱ级', 'Ⅲ级', 'Ⅳ级']
  form = { weldId:'W-104', result:'合格' as BatchResult, method:'UT', position:42, type:'夹渣', level:'Ⅱ级' as DefectLevel, length:12, report:'UT-2026-0929-08；返修后复检，按 NB/T 47013.3 评定。' }
  constructor() { this.store.select('welds').subscribe((state) => this.state = state) }
  get repairWelds() { return (this.state?.welds ?? []).filter((item) => ['返修中','待复检'].includes(item.status)) }
  get defects() { return (this.state?.welds ?? []).flatMap((weld) => weld.defects.map((defect) => ({ weld, defect }))) }
  latestBatch(weldId: string) { return (this.state?.batches ?? []).filter((b) => b.weldId === weldId).sort((a, b) => b.version - a.version)[0] }
  dispositionLabel(d: string) { return d === '已关闭' ? '已关闭' : d === '返修中' ? '返修中' : '未处置' }
  submit() {
    const defects: Defect[] = this.form.type.trim() ? [{
      id: `D-${Date.now().toString().slice(-6)}`, position: Number(this.form.position), type: this.form.type.trim(),
      length: Number(this.form.length), level: this.form.level, method: this.form.method, report: this.form.report, disposition: '未处置',
    }] : []
    this.store.dispatch(A.submitReinspection({ weldId: this.form.weldId, result: this.form.result, method: this.form.method, defects, note: this.form.report }))
    this.dialog = false
  }
}
