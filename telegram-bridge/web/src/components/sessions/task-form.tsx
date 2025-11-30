'use client'

import { useState, type FormEvent } from 'react'
import { Play, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectItem, SelectContent } from '@/components/ui/select'
import { useSessionActions } from '@/hooks/use-session-actions'
import type { TaskResponse } from '@/types'

const AVAILABLE_MODELS = [
  { id: 'default', name: 'Default (from settings)' },
  { id: 'gpt-5.1-codex', name: 'GPT-5.1 Codex' },
  { id: 'gpt-5.1', name: 'GPT-5.1' },
  { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5' },
  { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5' },
]

interface TaskFormProps {
  defaultProjectDir?: string
  sessionId?: string
  onComplete?: (result: TaskResponse) => void
}

export function TaskForm({ defaultProjectDir = '', sessionId, onComplete }: TaskFormProps) {
  const [prompt, setPrompt] = useState('')
  const [projectDir, setProjectDir] = useState(defaultProjectDir)
  const [model, setModel] = useState('default')
  const [result, setResult] = useState<TaskResponse | null>(null)
  const { executeTask, loading } = useSessionActions()

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!prompt.trim() || !projectDir.trim()) return

    try {
      const response = await executeTask({
        prompt: prompt.trim(),
        projectDir: projectDir.trim(),
        sessionId,
        model: model === 'default' ? undefined : model,
      })
      setResult(response)
      onComplete?.(response)
    } catch (error) {
      console.error('Task execution failed:', error)
      setResult({
        success: false,
        result: '',
        task_id: '',
        duration_ms: 0,
        num_turns: 0,
        error: String(error),
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Execute Task</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="projectDir">Project Directory</Label>
            <Input
              id="projectDir"
              placeholder="/path/to/project"
              value={projectDir}
              onChange={(e) => setProjectDir(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectContent>
                {AVAILABLE_MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prompt">Task / Instruction</Label>
            <Textarea
              id="prompt"
              placeholder="Describe what you want Droid to do..."
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>

          <Button
            type="submit"
            disabled={loading || !prompt.trim() || !projectDir.trim()}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Execute Task
              </>
            )}
          </Button>
        </form>

        {result && (
          <div className="mt-4 p-3 rounded-md bg-muted">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`h-2 w-2 rounded-full ${result.success ? 'bg-green-500' : 'bg-red-500'}`}
              />
              <span className="font-medium">
                {result.success ? 'Success' : 'Failed'}
              </span>
              {result.duration_ms > 0 && (
                <span className="text-xs text-muted-foreground">
                  ({result.duration_ms}ms, {result.num_turns} turns)
                </span>
              )}
            </div>
            {result.error && (
              <p className="text-sm text-destructive">{result.error}</p>
            )}
            {result.result && (
              <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-60">
                {result.result}
              </pre>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
