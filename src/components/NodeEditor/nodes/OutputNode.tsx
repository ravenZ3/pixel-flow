import { memo, useEffect, useRef } from 'react'
import { Handle, Position, NodeProps, useEdges } from 'reactflow'
import { tv } from 'tailwind-variants'
import usePipelineStore from '@/store/pipelineStore'
import { Badge } from '@/components/ui/badge'
import NodeWrapper from './NodeWrapper'

const outputRing = tv({
  base: 'rounded transition-all duration-200',
  variants: {
    active: {
      true: 'ring-1 ring-yellow-400 shadow-[0_0_12px_rgba(255,215,0,0.15)]',
      false: '',
    },
  },
  defaultVariants: {
    active: false,
  },
})

import { handleRow } from './handleStyles'

function OutputNode({ id, selected }: NodeProps) {
  const edges = useEdges()
  const nodeOutputs = usePipelineStore(s => s.nodeOutputs)
  const { activePreviewNodeId, setActivePreviewNodeId } = usePipelineStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const output = nodeOutputs[id]
  const image = output?.["image:output"] as ImageBitmap | undefined
  const isActive = activePreviewNodeId === id

  const isMaskConnected = edges.some(
    e => e.target === id && e.targetHandle === 'mask:input'
  )

  const leftRow = handleRow({ side: 'left' })

  useEffect(() => {
    if (selected && !isActive) setActivePreviewNodeId(id)
  }, [selected, isActive, id, setActivePreviewNodeId])

  useEffect(() => {
    if (!image || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const thumbWidth = 320
    canvas.width = thumbWidth
    canvas.height = (image.height / image.width) * thumbWidth
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  }, [image])

  return (
    <div className={outputRing({ active: isActive })}>
      <NodeWrapper
        id={id}
        label="Output"
        selected={selected}
        intent="yellow"
        badge={
          isActive && (
            <Badge
              variant="outline"
              className="text-cyan-400 lowercase border-cyan-400 text-[10px] h-4 px-1 leading-none"
            >
              active
            </Badge>
          )
        }
      >

        {/* Thumbnail */}
        <div className="w-[200px] h-[130px] bg-zinc-800 rounded overflow-hidden mb-2">
          {image
            ? <canvas ref={canvasRef} className="w-full h-full object-contain block" />
            : <div className="w-full h-full flex items-center justify-center text-[10px] text-zinc-600 font-mono">no image</div>
          }
        </div>


        <div className={leftRow.row()}>
          <Handle type="target" position={Position.Left} id="image:input" className="!left-[-20px]" />
          <span className={leftRow.label()}>image</span>
        </div>


        <div className={leftRow.row()}>
          <Handle type="target" position={Position.Left} id="mask:input" className="!left-[-20px]" />
          <span className={leftRow.labelTwo()}>mask</span>
        </div>

      </NodeWrapper>
    </div>
  )
}


export default memo(OutputNode)

