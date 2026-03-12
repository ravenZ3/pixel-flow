import { memo, useCallback, ReactNode } from 'react'
import { useReactFlow } from 'reactflow'
import { tv } from 'tailwind-variants'
import usePipelineStore from '@/store/pipelineStore'

// ─── Styles ───────────────────────────────────────────────────────────────────

const node = tv({
  slots: {
    root: [
      'relative group rounded border',
      'transition-all duration-200',
      'bg-zinc-900/90 backdrop-blur-md',
      'min-w-[220px]',
    ],
    header: [
      'flex items-center justify-between',
      'px-3 py-2',
      'border-b border-zinc-800/50',
    ],
    label: [
      'text-[10px] font-bold tracking-[0.15em]',
      'text-zinc-500 uppercase font-mono',
    ],
    badgeSlot: 'ml-2',
    body: 'p-3',
    deleteBtn: [
      'absolute -top-2 -right-2 w-5 h-5',
      'flex items-center justify-center',
      'bg-zinc-900 border border-zinc-800',
      'text-zinc-500 hover:text-red-400',
      'text-xs rounded-full z-20 shadow-lg',
      'opacity-0 group-hover:opacity-100',
      'transition-all scale-75 group-hover:scale-100',
    ],
  },
  variants: {
    selected: {
      true: {
        root: 'ring-1 shadow-lg',
      },
      false: {
        root: 'border-zinc-800 hover:border-zinc-700',
      },
    },
    intent: {
      pink: {},
      yellow: {},
    },
  },
  compoundVariants: [
    {
      selected: true,
      intent: 'pink',
      class: {
        root: 'border-cyberpink ring-cyberpink/20 shadow-[0_0_15px_rgba(255,0,86,0.3)]',
      },
    },
    {
      selected: true,
      intent: 'yellow',
      class: {
        root: 'border-yellow-500 ring-yellow-500/20 shadow-[0_0_15px_rgba(234,179,8,0.3)]',
      },
    },
  ],
  defaultVariants: {
    selected: false,
    intent: 'pink',
  },
})

// ─── Types ────────────────────────────────────────────────────────────────────

interface NodeWrapperProps {
  id: string
  label: string
  selected?: boolean
  intent?: 'pink' | 'yellow'
  badge?: ReactNode
  children: ReactNode
}

// ─── Component ────────────────────────────────────────────────────────────────

function NodeWrapper({ id, label, selected, intent = 'pink', badge, children }: NodeWrapperProps) {
  const { setNodes, setEdges } = useReactFlow()
  const { activePreviewNodeId, setActivePreviewNodeId } = usePipelineStore()

  const deleteNode = useCallback(() => {
    setNodes(nds => nds.filter(n => n.id !== id))
    setEdges(eds => eds.filter(e => e.source !== id && e.target !== id))
    if (activePreviewNodeId === id) setActivePreviewNodeId(null)
  }, [id, setNodes, setEdges, activePreviewNodeId, setActivePreviewNodeId])

  const styles = node({ selected, intent })

  return (
    <div className={styles.root()}>

      <button onClick={deleteNode} className={styles.deleteBtn()}>
        ×
      </button>

      <div className={styles.header()}>
        <span className={styles.label()}>{label}</span>
        {badge && <div className={styles.badgeSlot()}>{badge}</div>}
      </div>

      <div className={styles.body()}>
        {children}
      </div>

    </div>
  )
}

export default memo(NodeWrapper)
