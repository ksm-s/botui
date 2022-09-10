
import { BotuiTypes } from 'types'
import type { blockData, blockMeta, History, Block, BotuiInterface, plugin, callbackFunction } from 'types'

export const BOTUI_TYPES = BotuiTypes

function createBlock (type: string, meta: blockMeta, data: blockData): Block {
  return {
    type: type,
    meta: meta,
    data: data
  }
}

function resolveManager () {
  let resolver = (...args: any[]) => {}

  return {
    set: (callback: any): void => {
      resolver = callback
    },
    resolve: (...args: any[]) => resolver(...args)
  }
}

function blockManager (callback = (history: History = []) => {}) {
  let history: History = []
  return {
    getAll: () => history,
    get: (index = 0) => history[index],
    add: (block: Block): number => {
      const length = history.push(block)
      callback(history)
      return length - 1
    },
    update: (index: number, block: Block): void => {
      history[index] = block
      callback(history)
    },
    remove: (index: number): void => {
      history.splice(index, 1)
      callback(history)
    },
    clear: (): void => {
      history = []
      callback(history)
    }
  }
}

function actionManager (callback = (action: Block | null) => {}) {
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
    }
  }
}

export const botuiControl = (): BotuiInterface => {
  const plugins: plugin[] = []
  const stateResolver = resolveManager()

  const callbacks = {
    [BOTUI_TYPES.MESSAGE]: () => {},
    [BOTUI_TYPES.ACTION]: () => {}
  }

  const doCallback = (state = '', data: any) => {
    const callback = callbacks[state] as Function
    callback(data)
  }

  const runWithPlugins = (input: Block): Block => {
    let output = input
    plugins.forEach((plugin: plugin) => {
      output = plugin?.(input)
    })
    return output
  }

  const blocks = blockManager((history) => {
    doCallback(BOTUI_TYPES.MESSAGE, history)
  })

  const currentAction = actionManager((action) => {
    doCallback(BOTUI_TYPES.ACTION, action)
  })

  const botuiInterface: BotuiInterface = {
    message: {
      add: (data: blockData = { text: '' }, meta: blockMeta = {}): Promise<number> => {
        return new Promise((resolve) => {
          stateResolver.set(resolve)

          const index = blocks.add(
            runWithPlugins(
              createBlock(BOTUI_TYPES.MESSAGE, meta, data)
            )
          )

          stateResolver.resolve(index)
        })
      },
      getAll: (): Promise<Block[]> => Promise.resolve(blocks.getAll()),
      get: (index: number = 0): Promise<Block> => Promise.resolve(blocks.get(index)),
      remove: (index: number = 0): Promise<void> => {
        blocks.remove(index)
        return Promise.resolve()
      },
      update: (index: number = 0, block: Block): Promise<void> => {
        blocks.update(index, runWithPlugins(block))
        return Promise.resolve()
      },
      removeAll: (): Promise<void> => {
        blocks.clear()
        return Promise.resolve()
      }
    },
    action: (data: blockData = { text: '' }, meta: blockMeta = {}): Promise<void> => {
      return new Promise((resolve: any) => {
        const action = createBlock(BOTUI_TYPES.ACTION, meta, data)
        currentAction.set(action)

        stateResolver.set((resolvedData: blockData) => {
          currentAction.clear()

          if (meta.ephemeral !== true) { // ephemeral = short-lived
            blocks.add(createBlock(BOTUI_TYPES.MESSAGE, {
              previous: meta
            }, resolvedData))
          }

          resolve(resolvedData)
        })
      })
    },
    wait: (meta: blockMeta = { waitTime: 0 }): Promise<void> => {
      const forwardMeta = {
        ...meta,
        waiting: true,
        ephemeral: true // to not add to message history
      }

      if (forwardMeta?.waitTime) {
        setTimeout(() => botuiInterface.next(forwardMeta), forwardMeta.waitTime)
      }

      return botuiInterface.action({}, forwardMeta)
    },
    onChange: (state: BotuiTypes, cb: callbackFunction): BotuiInterface => {
      callbacks[state] = cb
      return botuiInterface
    },
    next: (...args: any[]): BotuiInterface => {
      stateResolver.resolve(...args)
      return botuiInterface
    },
    use: (plugin: plugin): BotuiInterface => {
      plugins.push(plugin)
      return botuiInterface
    }
  }

  return botuiInterface
}
