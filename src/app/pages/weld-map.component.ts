import { Component, inject } from '@angular/core'
import { CommonModule } from '@angular/common'
import { RouterLink } from '@angular/router'
import { Store } from '@ngrx/store'
import { ButtonModule } from 'primeng/button'
import { TagModule } from 'primeng/tag'
import { DialogModule } from 'primeng/dialog'
import { WeldState } from '../store/weld.reducer'
import * as A from '../store/weld.actions'
import type { ReviewNotice, Weld } from '../types'

@Component({
  selector:'app-weld-map', standalone:true, imports:[CommonModule,RouterLink,ButtonModule,TagModule,DialogModule],
  template:`
    <main class="page"><div class="page-head"><div><p class="eyebrow">二维构件定位</p><h1>构件焊缝地图</h1><p>批次确认后地图颜色和缺陷标记同步变化；退回保留缺陷，合格复检后才可关闭。</p></div><p-button label="批量生成检测计划" icon="pi pi-calendar-plus" (onClick)="planDialog = true" /></div>
      <section class="notice-stack" *ngIf="state.notices.length"><article *ngFor="let notice of state.notices" [class.conflict]="notice.kind === '版本冲突'"><i class="pi" [class.pi-info-circle]="notice.kind==='版本冲突'" [class.pi-ban]="notice.kind==='确认拦截'"></i><div><b>{{notice.title}}</b><p>{{notice.detail}}</p></div><p-button size="small" text label="查看新版本" icon="pi pi-arrow-refresh" (onClick)="viewLatest(notice)" /><p-button size="small" text icon="pi pi-times" (onClick)="dismiss(notice)" /></article></section>
      <div class="map-grid"><section class="card drawing-card"><div class="drawing-head"><span>构件图 SG-07-屋面梁 · 展开示意</span><span>单位：mm · 比例 1:50</span></div><svg viewBox="0 0 100 90" class="weld-map"><defs><pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M5 0H0V5" fill="none" stroke="#dbe2ea" stroke-width=".2"/></pattern></defs><rect x="3" y="3" width="94" height="84" fill="url(#grid)" stroke="#334155"/><path d="M8 20H92M8 42H92M8 66H92" stroke="#94a3b8" stroke-width="4"/><path d="M16 12V78M42 12V78M70 12V78M86 12V78" stroke="#cbd5e1" stroke-width="7"/><g *ngFor="let weld of state.welds"><circle [attr.cx]="weld.x" [attr.cy]="weld.y" r="3.2" [attr.fill]="color(weld)" [class.stale]="isWaiting(weld)" stroke="#fff" stroke-width="1" (click)="select(weld)" /><text [attr.x]="weld.x+4" [attr.y]="weld.y-4" class="label">{{weld.id}}·v{{weld.reviewVersion}}</text><circle *ngFor="let defect of openDefects(weld)" [attr.cx]="weld.x + defect.position / 30" [attr.cy]="weld.y + 4" r="1.4" fill="#dc2626" /><circle *ngFor="let defect of closedDefects(weld)" [attr.cx]="weld.x + defect.position / 30" [attr.cy]="weld.y + 4" r="1.2" fill="#16a34a" /></g><text x="50" y="86" class="axis">构件长度方向 →</text></svg><div class="legend"><span><i class="green"></i>合格 / 已关闭</span><span><i class="purple"></i>待质量确认</span><span><i class="red"></i>返修 / 资质过期</span><span><i class="amber"></i>待检测</span></div></section>
        <aside class="card"><h2 class="panel-title">焊缝明细</h2><div *ngIf="selected" class="detail"><div class="detail-head"><div><small>{{selected.drawing}}</small><h3>{{selected.id}} · {{selected.component}}</h3></div><p-tag [value]="selected.status" [severity]="severity(selected.status)" /></div><div class="kv"><span>复检批次版本</span><b>{{batchLabel(selected)}}</b></div><div class="kv"><span>焊接方法</span><b>{{selected.method}} / {{selected.joint}}</b></div><div class="kv"><span>焊工</span><b [class.danger]="!selected.qualificationValid">{{selected.welder}} · {{selected.qualification}}</b></div><div class="kv"><span>检测比例</span><b [class.danger]="selected.inspectionRatio < selected.requiredRatio">{{selected.inspectionRatio}}% / {{selected.requiredRatio}}%</b></div><div class="kv"><span>返修次数</span><b>{{selected.repairs}}</b></div><h3>缺陷记录（{{openDefects(selected).length}} 个未关闭）</h3><div *ngFor="let defect of selected.defects" class="defect" [class.closed]="defect.status === '关闭'"><b>{{defect.id}} · {{defect.type}}</b><p>位置 {{defect.position}}% · 长度 {{defect.length}}mm · {{defect.level}} · {{defect.method}}</p><small>{{defect.status}} · {{defect.disposition || '等待质量结论'}}</small></div><p class="muted" *ngIf="!selected.defects.length">当前无缺陷记录。</p><a routerLink="/inspections"><p-button label="进入复检批次" icon="pi pi-wrench" styleClass="w-full" /></a></div></aside></div>
      <p-dialog header="生成批量检测计划" [(visible)]="planDialog" [modal]="true" [style]="{width:'560px'}"><div class="dialog-form"><label>检测方法</label><select><option>UT 超声检测</option><option>MT 磁粉检测</option><option>UT + MT</option></select><label>计划日期</label><input type="date" value="2026-09-30" /><label>检测人员</label><select><option>陈锋</option><option>赵岚</option></select><p>系统将排除资质已过期焊工完成的焊缝，并提示检测比例不足项。</p></div><ng-template #footer><p-button label="取消" severity="secondary" (onClick)="planDialog = false" /><p-button label="生成计划" (onClick)="createPlan()" /></ng-template></p-dialog>
    </main>
  `,
  styles:[`.map-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(310px,.65fr);gap:16px}.drawing-card{padding:0;overflow:hidden}.drawing-head{display:flex;justify-content:space-between;padding:13px 16px;background:#f8fafc;border-bottom:1px solid #e1e7ef;color:#64748b;font-size:13px}.weld-map{width:100%;height:min(62vh,620px);display:block;background:#fff}.weld-map circle{cursor:pointer}.weld-map .stale{stroke:#facc15;stroke-width:1.6}.label{font-size:2.3px;font-weight:700;fill:#334155}.axis{font-size:2.2px;fill:#94a3b8}.legend{display:flex;gap:16px;flex-wrap:wrap;padding:12px 16px;border-top:1px solid #e1e7ef;color:#667085;font-size:13px}.legend span{display:flex;align-items:center;gap:5px}.legend i{width:10px;height:10px;border-radius:50%;display:inline-block}.legend .green{background:#16a34a}.legend .purple{background:#7c3aed}.legend .red{background:#dc2626}.legend .amber{background:#f59e0b}.detail-head{display:flex;justify-content:space-between}.detail-head small{color:#7a8798}.detail-head h3{margin:5px 0}.kv{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #edf0f5}.kv span{color:#667085}.defect{margin-top:10px;padding:10px;background:#fff1f2;border-left:3px solid #ef4444;border-radius:5px}.defect.closed{background:#f0fdf4;border-left-color:#16a34a}.defect p{margin:4px 0}.defect small{color:#64748b}.dialog-form{display:grid;gap:8px}.dialog-form input,.dialog-form select{padding:9px;border:1px solid #cbd5e1;border-radius:6px}.muted{color:#7a8798}.notice-stack{display:grid;gap:8px;margin-bottom:14px}.notice-stack article{display:flex;align-items:center;gap:10px;border:1px solid #fed7aa;background:#fff7ed;border-left:4px solid #f97316;border-radius:7px;padding:10px 12px}.notice-stack article.conflict{border-color:#bfdbfe;background:#eff6ff;border-left-color:#2563eb}.notice-stack i{font-size:17px;color:#f97316}.notice-stack .conflict i{color:#2563eb}.notice-stack article>div{flex:1}.notice-stack p{font-size:13px}`],
})
export class WeldMapComponent {
  readonly store = inject(Store<{ welds: WeldState }>)
  state!: WeldState
  planDialog = false
  constructor() { this.store.select('welds').subscribe((state) => this.state = state) }
  get selected() { return this.state?.welds.find((item) => item.id === this.state.selectedId) }
  select(weld: Weld) { this.store.dispatch(A.selectWeld({ id: weld.id })) }
  openDefects(weld: Weld) { return weld.defects.filter((defect) => defect.status !== '关闭') }
  closedDefects(weld: Weld) { return weld.defects.filter((defect) => defect.status === '关闭') }
  isWaiting(weld: Weld) { return weld.status === '待质量确认' }
  batchLabel(weld: Weld) { return `${weld.reviewBatchId || `RB-${weld.id}`} · v${weld.reviewVersion}` }
  severity(status: string) {
    return status === '合格' || status === '已关闭' ? 'success' : status === '返修中' ? 'danger' : status === '待质量确认' ? 'warn' : 'secondary'
  }
  color(weld: Weld) {
    if (weld.status === '合格' || weld.status === '已关闭') return '#16a34a'
    if (weld.status === '返修中' || !weld.qualificationValid) return '#dc2626'
    if (weld.status === '待质量确认') return '#7c3aed'
    return '#f59e0b'
  }
  createPlan() { this.store.dispatch(A.createPlan({ plan:{ id:`IP-${Date.now().toString().slice(-6)}`, date:'2026-09-30', method:'UT + MT', weldIds:['W-105','W-106','W-108'], inspector:'陈锋', state:'待执行' } })); this.planDialog = false }
  viewLatest(notice: ReviewNotice) { this.store.dispatch(A.viewLatestReview({ batchId: notice.batchId, weldId: notice.weldId })) }
  dismiss(notice: ReviewNotice) { this.store.dispatch(A.dismissReviewNotice({ id: notice.id })) }
}
