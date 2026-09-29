import { ApplicationConfig } from '@angular/core'
import { provideRouter } from '@angular/router'
import { provideStore } from '@ngrx/store'
import { providePrimeNG } from 'primeng/config'
import Aura from '@primeng/themes/aura'
import { provideApollo } from 'apollo-angular'
import { ApolloLink, InMemoryCache, Observable } from '@apollo/client/core'
import { routes } from './app.routes'
import { weldReducer } from './store/weld.reducer'

const mockGraphqlLink = new ApolloLink((operation) => new Observable((observer) => {
  setTimeout(() => {
    observer.next({ data: operation.operationName === 'Welds' ? mockData : {} })
    observer.complete()
  }, 180)
}))

const mockData = {
  welds: [
    { id:'W-101', drawing:'SG-04-钢柱', component:'KZ-12 / 柱翼缘', joint:'全熔透坡口焊', method:'GMAW', welder:'王凯', qualification:'GB/T 9448 · 2027-06', qualificationValid:true, inspectionRatio:100, requiredRatio:100, status:'合格', x:18, y:24, repairs:0, reviewVersion:1, reviewBatchId:'RB-W-101-1', defects:[] },
    { id:'W-104', drawing:'SG-07-屋面梁', component:'GL-21 / 下翼缘', joint:'对接焊缝', method:'SAW', welder:'刘强', qualification:'GB/T 9448 · 2028-03', qualificationValid:true, inspectionRatio:100, requiredRatio:100, status:'待质量确认', x:48, y:38, repairs:2, reviewVersion:1, reviewBatchId:'RB-W-104-1', defects:[{id:'D-31',position:42,type:'夹渣',length:12,level:'Ⅱ级',method:'UT',report:'UT-2026-0918',status:'待处置',disposition:''}] },
    { id:'W-107', drawing:'SG-07-屋面梁', component:'GL-21 / 腹板', joint:'角焊缝', method:'FCAW', welder:'赵明', qualification:'GB/T 9448 · 2027-01', qualificationValid:true, inspectionRatio:20, requiredRatio:20, status:'返修中', x:61, y:42, repairs:1, reviewVersion:1, reviewBatchId:'RB-W-107-1', defects:[{id:'D-32',position:68,type:'未熔合',length:18,level:'Ⅲ级',method:'MT',report:'MT-2026-0921',status:'返修中',disposition:'质量退回：缺陷反射体仍超标'}] },
    { id:'W-109', drawing:'SG-12-平台梁', component:'PL-08 / 节点板', joint:'角焊缝', method:'SMAW', welder:'孙鹏', qualification:'GB/T 9448 · 2026-10-01', qualificationValid:false, inspectionRatio:10, requiredRatio:20, status:'待质量确认', x:78, y:60, repairs:1, reviewVersion:1, reviewBatchId:'RB-W-109-1', defects:[{id:'D-33',position:31,type:'气孔',length:6,level:'Ⅱ级',method:'UT',report:'UT-2026-0929-09',status:'待处置',disposition:''}] },
    { id:'W-112', drawing:'SG-12-平台梁', component:'PL-08 / 腹板', joint:'组合焊缝', method:'GMAW', welder:'王凯', qualification:'GB/T 9448 · 2027-06', qualificationValid:true, inspectionRatio:50, requiredRatio:50, status:'已关闭', x:36, y:68, repairs:0, reviewVersion:1, reviewBatchId:'RB-W-112-1', defects:[] },
  ],
  plans: [
    { id:'IP-2026-0930-A', date:'2026-09-30', method:'UT + MT', weldIds:['W-105','W-106','W-108'], inspector:'陈锋', state:'待执行' },
    { id:'IP-2026-0929-B', date:'2026-09-29', method:'UT', weldIds:['W-104','W-109'], inspector:'赵岚', state:'执行中' },
  ],
  reviewBatches: [
    { id:'RB-W-101-1', batchNo:'RB-W-101', revision:1, batchVersion:1, status:'已确认', inspector:'赵岚', submittedAt:'09-28 10:22', decidedBy:'周倩', decidedAt:'09-28 11:05', decisionComment:'一次检测合格', items:[{weldId:'W-101',result:'合格',method:'UT',report:'UT-2026-0928-01',comment:'一次检测合格',defectIds:[],inspector:'赵岚',submittedAt:'09-28 10:22'}], history:[{actor:'赵岚',action:'提交复检',result:'合格',comment:'一次检测合格',at:'09-28 10:22',expectedVersion:0,actualVersion:1},{actor:'周倩',action:'确认',result:'合格',comment:'一次检测合格',at:'09-28 11:05',expectedVersion:1,actualVersion:1}] },
    { id:'RB-W-104-1', batchNo:'RB-W-104', revision:1, batchVersion:1, status:'待质量确认', inspector:'赵岚', submittedAt:'09-29 16:38', decidedBy:'', decidedAt:'', decisionComment:'', items:[{weldId:'W-104',result:'合格',method:'UT',report:'UT-2026-0929-08',comment:'返修后复检合格，原夹渣位置已闭合',defectIds:['D-31'],inspector:'赵岚',submittedAt:'09-29 16:38'}], history:[{actor:'赵岚',action:'提交复检',result:'合格',comment:'返修后复检合格，原夹渣位置已闭合',at:'09-29 16:38',expectedVersion:0,actualVersion:1}] },
    { id:'RB-W-107-1', batchNo:'RB-W-107', revision:1, batchVersion:1, status:'已退回', inspector:'赵岚', submittedAt:'09-29 13:10', decidedBy:'周倩', decidedAt:'09-29 14:02', decisionComment:'缺陷反射体仍超标', items:[{weldId:'W-107',result:'不合格',method:'MT',report:'MT-2026-0929-04',comment:'端部仍有线性显示',defectIds:['D-32'],inspector:'赵岚',submittedAt:'09-29 13:10'}], history:[{actor:'赵岚',action:'提交复检',result:'不合格',comment:'端部仍有线性显示',at:'09-29 13:10',expectedVersion:0,actualVersion:1},{actor:'周倩',action:'退回',result:'不合格',comment:'缺陷反射体仍超标',at:'09-29 14:02',expectedVersion:1,actualVersion:1}] },
    { id:'RB-W-109-1', batchNo:'RB-W-109', revision:1, batchVersion:1, status:'待质量确认', inspector:'赵岚', submittedAt:'09-29 17:05', decidedBy:'', decidedAt:'', decisionComment:'', items:[{weldId:'W-109',result:'合格',method:'UT',report:'UT-2026-0929-09',comment:'返修后气孔闭合，但证书和比例需负责人判断',defectIds:['D-33'],inspector:'赵岚',submittedAt:'09-29 17:05'}], history:[{actor:'赵岚',action:'提交复检',result:'合格',comment:'返修后气孔闭合，但证书和比例需负责人判断',at:'09-29 17:05',expectedVersion:0,actualVersion:1}] },
    { id:'RB-W-112-1', batchNo:'RB-W-112', revision:1, batchVersion:1, status:'已确认', inspector:'赵岚', submittedAt:'09-27 09:18', decidedBy:'周倩', decidedAt:'09-27 09:40', decisionComment:'资料齐全', items:[{weldId:'W-112',result:'合格',method:'UT + MT',report:'NDT-2026-0927-02',comment:'资料齐全',defectIds:[],inspector:'赵岚',submittedAt:'09-27 09:18'}], history:[{actor:'赵岚',action:'提交复检',result:'合格',comment:'资料齐全',at:'09-27 09:18',expectedVersion:0,actualVersion:1},{actor:'周倩',action:'确认',result:'合格',comment:'资料齐全',at:'09-27 09:40',expectedVersion:1,actualVersion:1}] },
  ],
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideStore({ welds: weldReducer }),
    providePrimeNG({ theme: { preset: Aura, options: { darkModeSelector: false } } }),
    provideApollo(() => ({ cache: new InMemoryCache(), link: mockGraphqlLink })),
  ],
}
