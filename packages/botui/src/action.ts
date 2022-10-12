import type { Block, BlockData, BlockMeta, WithWildcards } from './block'
export interface ActionInterface {
  get: () => Promise<Block>
  set: (data: BlockData, meta: BlockMeta) => Promise<WithWildcards<{}>>
}

export function actionManager(callback = (action: Block | null) => {}) {
  let currentAction: Block | null = null

  return {
    get: () => currentAction,
    set: (action: Block) => {
      currentAction = action
      callback(currentAction)
    },
    clear: () => {
      currentAction = null
      callback(currentAction)
    },
  }
}
