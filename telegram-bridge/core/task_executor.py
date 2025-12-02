"""
Task Executor - Spawns and manages droid exec processes
"""
import os
import json
import asyncio
import logging
from typing import Optional, Dict, Any, Callable, AsyncIterator
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

from .repositories import get_task_repo, get_session_repo, get_chat_repo

logger = logging.getLogger(__name__)


class TaskStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class TaskResult:
    success: bool
    result: str
    session_id: Optional[str] = None
    duration_ms: int = 0
    num_turns: int = 0
    error: Optional[str] = None
    raw_output: Optional[Dict[str, Any]] = None


@dataclass
class Task:
    id: str
    prompt: str
    project_dir: str
    session_id: Optional[str] = None  # For continuing sessions
    autonomy_level: str = "high"  # low, medium, high
    model: Optional[str] = None  # Model to use (e.g., claude-sonnet-4-20250514)
    reasoning_effort: Optional[str] = None  # off, low, medium, high
    status: TaskStatus = TaskStatus.PENDING
    result: Optional[TaskResult] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    process: Optional[asyncio.subprocess.Process] = None


class TaskExecutor:
    """
    Executes tasks using droid exec (headless mode).
    Manages session continuity and result parsing.
    """
    
    def __init__(self):
        self._tasks: Dict[str, Task] = {}
        self._session_map: Dict[str, str] = {}  # project_dir -> session_id
    
    async def execute_task(
        self,
        task_id: str,
        prompt: str,
        project_dir: str,
        session_id: Optional[str] = None,
        autonomy_level: str = "high",
        model: Optional[str] = None,
        reasoning_effort: Optional[str] = None,
        source: str = "api",
        on_progress: Optional[Callable[[str], None]] = None
    ) -> TaskResult:
        """
        Execute a task using droid exec.
        
        Args:
            task_id: Unique task identifier
            prompt: The task/prompt to execute
            project_dir: Working directory for droid
            session_id: Optional session ID to continue
            autonomy_level: low, medium, or high
            model: Optional model ID (e.g., claude-sonnet-4-20250514)
            reasoning_effort: Optional reasoning effort (off, low, medium, high)
            source: Source of the task (telegram, web, api)
            on_progress: Optional callback for progress updates
        
        Returns:
            TaskResult with success status and output
        """
        # Use stored session_id if available for this project
        if not session_id and project_dir in self._session_map:
            session_id = self._session_map[project_dir]
            logger.info(f"Continuing session {session_id} for {project_dir}")
        
        task = Task(
            id=task_id,
            prompt=prompt,
            project_dir=project_dir,
            session_id=session_id,
            autonomy_level=autonomy_level,
            model=model,
            reasoning_effort=reasoning_effort
        )
        self._tasks[task_id] = task
        
        # Log task to database
        try:
            get_task_repo().create(
                task_id=task_id,
                prompt=prompt,
                project_dir=project_dir,
                source=source,
                session_id=session_id,
                model=model
            )
        except Exception as e:
            logger.error(f"Failed to log task to database: {e}")
        
        try:
            task.status = TaskStatus.RUNNING
            task.started_at = datetime.utcnow()
            
            result = await self._run_droid_exec(task, on_progress)
            
            task.status = TaskStatus.COMPLETED if result.success else TaskStatus.FAILED
            task.result = result
            task.completed_at = datetime.utcnow()
            
            # Store session_id for future continuation
            if result.session_id:
                self._session_map[project_dir] = result.session_id
                logger.info(f"Stored session {result.session_id} for {project_dir}")
                
                # Ensure session exists in database (for custom tasks)
                try:
                    session_repo = get_session_repo()
                    existing_session = session_repo.get_by_id(result.session_id)
                    if not existing_session:
                        # Create session record for custom task
                        from pathlib import Path
                        session_name = Path(project_dir).name or "custom-task"
                        logger.info(f"Creating session record for custom task: {result.session_id}")
                        session_repo.create(
                            session_id=result.session_id,
                            name=session_name,
                            project_dir=project_dir,
                            status="running",
                            control_state="remote_active"
                        )
                        
                        # Add chat messages for the task
                        try:
                            chat_repo = get_chat_repo()
                            # Add user message
                            chat_repo.create(
                                session_id=result.session_id,
                                msg_type="user",
                                content=prompt,
                                source="web"
                            )
                            # Add assistant response
                            chat_repo.create(
                                session_id=result.session_id,
                                msg_type="assistant",
                                content=result.result or "",
                                status="success" if result.success else "error",
                                duration_ms=result.duration_ms,
                                num_turns=result.num_turns,
                                source="web"
                            )
                        except Exception as e:
                            logger.error(f"Failed to add chat messages: {e}")
                except Exception as e:
                    logger.error(f"Failed to create session record: {e}")
            
            # Log task completion to database
            try:
                get_task_repo().complete(
                    task_id=task_id,
                    success=result.success,
                    result=result.result[:5000] if result.result else None,  # Truncate
                    duration_ms=result.duration_ms,
                    num_turns=result.num_turns,
                    error=result.error,
                    session_id=result.session_id
                )
            except Exception as e:
                logger.error(f"Failed to log task completion: {e}")
            
            return result
            
        except asyncio.CancelledError:
            task.status = TaskStatus.CANCELLED
            task.completed_at = datetime.utcnow()
            # Log cancellation
            try:
                get_task_repo().complete(
                    task_id=task_id,
                    success=False,
                    error="Task cancelled"
                )
            except Exception:
                pass
            raise
        except Exception as e:
            logger.exception(f"Task {task_id} failed with exception")
            task.status = TaskStatus.FAILED
            task.completed_at = datetime.utcnow()
            task.result = TaskResult(
                success=False,
                result="",
                error=str(e)
            )
            # Log failure to database
            try:
                get_task_repo().complete(
                    task_id=task_id,
                    success=False,
                    error=str(e)
                )
            except Exception:
                pass
            return task.result
    
    async def _run_droid_exec(
        self,
        task: Task,
        on_progress: Optional[Callable[[str], None]] = None
    ) -> TaskResult:
        """Run droid exec and parse output."""
        
        # Build command
        cmd = ["droid", "exec"]
        
        # Add model if specified
        if task.model:
            cmd.extend(["--model", task.model])
        
        # Add reasoning effort if specified
        if task.reasoning_effort:
            cmd.extend(["--reasoning-effort", task.reasoning_effort])
        
        # Add autonomy level
        if task.autonomy_level:
            cmd.extend(["--auto", task.autonomy_level])
        
        # Add session ID for continuation
        if task.session_id:
            cmd.extend(["--session-id", task.session_id])
        
        # Add working directory
        cmd.extend(["--cwd", task.project_dir])
        
        # Use JSON output for structured parsing
        cmd.extend(["--output-format", "json"])
        
        # Add the prompt
        cmd.append(task.prompt)
        
        logger.info(f"Executing: {' '.join(cmd)}")
        
        # Run the command with DROID_EXEC_MODE env var
        env = os.environ.copy()
        env["DROID_EXEC_MODE"] = "1"
        
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=task.project_dir,
            env=env
        )
        task.process = process
        
        stdout, stderr = await process.communicate()
        
        stdout_str = stdout.decode("utf-8", errors="replace").strip()
        stderr_str = stderr.decode("utf-8", errors="replace").strip()
        
        logger.info(f"droid exec exit code: {process.returncode}")
        
        if stderr_str:
            logger.warning(f"droid exec stderr: {stderr_str}")
        
        # Parse JSON output
        if stdout_str:
            logger.info(f"Raw stdout ({len(stdout_str)} chars): {stdout_str[:500]}")
            
            # droid exec outputs JSON with --output-format json
            # Clean the output - remove BOM and other invisible chars
            clean_stdout = stdout_str.strip()
            # Remove BOM if present
            if clean_stdout.startswith('\ufeff'):
                clean_stdout = clean_stdout[1:]
            # Find the first { character (start of JSON)
            json_start = clean_stdout.find('{')
            if json_start > 0:
                logger.info(f"Found JSON start at position {json_start}, skipping prefix: {repr(clean_stdout[:json_start])}")
                clean_stdout = clean_stdout[json_start:]
            
            # Try to parse the entire output first
            output = None
            try:
                output = json.loads(clean_stdout)
                logger.info(f"Parsed JSON successfully, type={output.get('type')}, has result={('result' in output)}")
            except json.JSONDecodeError as e:
                logger.warning(f"Full JSON parse failed: {e}")
                logger.warning(f"First 50 chars repr: {repr(clean_stdout[:50])}")
                # Try line by line as fallback
                for i, line in enumerate(stdout_str.split('\n')):
                    line = line.strip()
                    if not line:
                        continue
                    # Find JSON start in line
                    j_start = line.find('{')
                    if j_start >= 0:
                        json_line = line[j_start:]
                        try:
                            parsed = json.loads(json_line)
                            if "result" in parsed:
                                output = parsed
                                logger.info(f"Found JSON in line {i}: type={parsed.get('type')}")
                                break
                        except json.JSONDecodeError as e:
                            logger.warning(f"Line {i} JSON parse failed: {e}, line={repr(json_line[:50])}")
                            continue
            
            if output:
                # Extract the actual result content
                result_content = output.get("result", "")
                logger.info(f"Extracted result: {result_content[:200] if result_content else 'empty'}")
                
                # Clean up markdown headers
                if isinstance(result_content, str):
                    result_content = result_content.replace("# Answer\n\n", "").strip()
                
                return TaskResult(
                    success=not output.get("is_error", False),
                    result=result_content,
                    session_id=output.get("session_id"),
                    duration_ms=output.get("duration_ms", 0),
                    num_turns=output.get("num_turns", 0),
                    raw_output=output
                )
            else:
                # No valid JSON found, return raw output
                logger.warning("No valid JSON found in output, returning raw")
                return TaskResult(
                    success=process.returncode == 0,
                    result=stdout_str,
                    error=stderr_str if process.returncode != 0 else None
                )
        else:
            return TaskResult(
                success=False,
                result="",
                error=stderr_str or "No output from droid exec"
            )
    
    async def execute_task_streaming(
        self,
        task_id: str,
        prompt: str,
        project_dir: str,
        session_id: Optional[str] = None,
        autonomy_level: str = "high",
        model: Optional[str] = None
    ) -> AsyncIterator[Dict[str, Any]]:
        """
        Execute task with streaming output (stream-json format).
        Yields events as they occur.
        """
        if not session_id and project_dir in self._session_map:
            session_id = self._session_map[project_dir]
        
        task = Task(
            id=task_id,
            prompt=prompt,
            project_dir=project_dir,
            session_id=session_id,
            autonomy_level=autonomy_level,
            model=model
        )
        self._tasks[task_id] = task
        
        cmd = ["droid", "exec"]
        
        if task.model:
            cmd.extend(["--model", task.model])
        
        if task.autonomy_level:
            cmd.extend(["--auto", task.autonomy_level])
        
        if task.session_id:
            cmd.extend(["--session-id", task.session_id])
        
        cmd.extend(["--cwd", task.project_dir])
        cmd.extend(["--output-format", "stream-json"])
        cmd.append(task.prompt)
        
        logger.info(f"Executing (streaming): {' '.join(cmd)}")
        
        task.status = TaskStatus.RUNNING
        task.started_at = datetime.utcnow()
        
        # Set env var to skip Stop hook notification
        env = os.environ.copy()
        env["DROID_EXEC_MODE"] = "1"
        
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=task.project_dir,
            env=env
        )
        task.process = process
        
        final_result = None
        
        async for line in process.stdout:
            line_str = line.decode("utf-8", errors="replace").strip()
            if not line_str:
                continue
            
            try:
                event = json.loads(line_str)
                yield event
                
                # Capture completion event
                if event.get("type") == "completion":
                    final_result = event
                    # Store session_id
                    if event.get("session_id"):
                        self._session_map[project_dir] = event["session_id"]
                
            except json.JSONDecodeError:
                yield {"type": "raw", "content": line_str}
        
        await process.wait()
        
        task.completed_at = datetime.utcnow()
        task.status = TaskStatus.COMPLETED if process.returncode == 0 else TaskStatus.FAILED
        
        if final_result:
            task.result = TaskResult(
                success=process.returncode == 0,
                result=final_result.get("finalText", ""),
                session_id=final_result.get("session_id"),
                duration_ms=final_result.get("durationMs", 0),
                num_turns=final_result.get("numTurns", 0)
            )
    
    def cancel_task(self, task_id: str) -> bool:
        """Cancel a running task."""
        task = self._tasks.get(task_id)
        if not task or task.status != TaskStatus.RUNNING:
            return False
        
        if task.process:
            try:
                # Use kill() for immediate termination
                # terminate() can take 30+ seconds if process is waiting on LLM API
                task.process.kill()
                logger.info(f"Force killed task {task_id} (immediate cancellation)")
            except Exception as e:
                logger.error(f"Error cancelling task {task_id}: {e}")
            
            task.status = TaskStatus.CANCELLED
            return True
        
        return False
    
    def get_task(self, task_id: str) -> Optional[Task]:
        """Get task by ID."""
        return self._tasks.get(task_id)
    
    def get_session_id(self, project_dir: str) -> Optional[str]:
        """Get stored session ID for a project."""
        return self._session_map.get(project_dir)
    
    def clear_session(self, project_dir: str) -> bool:
        """Clear stored session for a project (start fresh)."""
        if project_dir in self._session_map:
            old_session_id = self._session_map[project_dir]
            del self._session_map[project_dir]
            logger.info(f"Cleared droid session {old_session_id} for {project_dir}")
            return True
        return False


# Global instance
task_executor = TaskExecutor()
