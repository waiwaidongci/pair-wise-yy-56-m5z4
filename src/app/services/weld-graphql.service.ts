import { inject, Injectable } from '@angular/core'
import { Apollo, gql } from 'apollo-angular'
import { map } from 'rxjs'
import type { InspectionPlan, ReviewBatch, Weld } from '../types'

const WELDS_QUERY = gql`
  query Welds {
    welds {
      id drawing component joint method welder qualification qualificationValid
      inspectionRatio requiredRatio status x y repairs reviewVersion reviewBatchId
      defects { id position type length level method report status disposition }
    }
    plans { id date method weldIds inspector state }
    reviewBatches {
      id batchNo revision batchVersion status inspector submittedAt decidedBy decidedAt decisionComment
      items { weldId result method report comment defectIds inspector submittedAt }
      history { actor action result comment at expectedVersion actualVersion }
    }
  }
`

@Injectable({ providedIn: 'root' })
export class WeldGraphqlService {
  private readonly apollo = inject(Apollo)
  load() {
    return this.apollo.watchQuery<{ welds: Weld[]; plans: InspectionPlan[]; reviewBatches: ReviewBatch[] }>({
      query: WELDS_QUERY,
      fetchPolicy: 'cache-first',
    }).valueChanges.pipe(map((result) => result.data))
  }
}
