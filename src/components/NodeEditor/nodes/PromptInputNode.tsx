"use client";

import { memo, useCallback, useRef, useEffect } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import usePipelineStore from '@/store/pipelineStore';
import NodeWrapper from './NodeWrapper'

import { handleRow } from "./handleStyles"


function PromptInputNode({ id, data, selected }: NodeProps) {
    const updateNodeData = usePipelineStore((s) => s.updateNodeData);
    const prompt = data.prompt ?? "";
    const negativePrompt = ""
    const handlePromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        updateNodeData(id, { prompt: e.target.value });
    }, [id, updateNodeData]);

    const handleNegativePromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        updateNodeData(id, { negativePrompt: e.target.value });
    }, [id, updateNodeData]);
    const rightRow = handleRow({ side: 'right' })

    return (
        <NodeWrapper id={id} label="Prompt Input" selected={selected}>
            <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-zinc-400">Prompt</label>
                    <textarea
                        value={prompt}
                        onChange={handlePromptChange}
                        className="w-full px-2 py-1 text-sm bg-zinc-800 border border-zinc-700 rounded"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-zinc-400">Negative Prompt</label>
                    <textarea
                        value={negativePrompt}
                        onChange={handleNegativePromptChange}
                        className="w-full px-2 py-1 text-sm bg-zinc-800 border border-zinc-700 rounded"
                    />
                </div>
                <div className="mt-4">
                    <div className={rightRow.row()}>
                        <span className={rightRow.label()}>
                            prompt
                        </span>
                        <Handle
                            type="source"
                            position={Position.Right}
                            id="prompt"
                            className={rightRow.handle()}
                        />
                    </div>
                </div>

            </div>
        </NodeWrapper>
    );
}

export default memo(PromptInputNode);