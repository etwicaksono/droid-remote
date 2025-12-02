"""
Task Executor - Spawns and manages droid exec processes
"""
import os
import re
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
    
    def _parse_activity_line(self, line: str) -> Optional[Dict[str, Any]]:
        """Parse a stderr line to extract tool activity information."""
        
        # Common patterns from droid CLI output
        # [READ] (file, offset: X, limit: Y)
        # [EDIT] (file) - Succeeded
        # [EXECUTE] command
        # [Grep] pattern
        # [Glob] patterns
        # [Create] file
        
        patterns = [
            # Tool invocations with details
            (r'\[(\w+)\]\s*\(([^)]+)\)', 'tool_start'),
            (r'\[(\w+)\]\s*(.+)', 'tool_info'),
            # Status updates
            (r'Read (\d+) lines?\.?', 'read_complete'),
            (r'Succeeded\. File edited\. \(([^)]+)\)', 'edit_complete'),
            (r'✓\s*(.+)', 'success'),
            (r'Error:\s*(.+)', 'error'),
            # Execution status
            (r'Executing\.\.\.', 'executing'),
            (r'Completed', 'completed'),
        ]
        
        for pattern, activity_type in patterns:
            match = re.search(pattern, line, re.IGNORECASE)
            if match:
                return {
                    'type': activity_type,
                    'tool': match.group(1) if activity_type in ['tool_start', 'tool_info'] else None,
                    'details': match.group(2) if len(match.groups()) > 1 else match.group(1),
                    'raw': line
                }
        
        # Return raw line if it looks like activity (not empty, not just whitespace)
        if line.strip() and not line.startswith('{'):
            return {
                'type': 'raw',
                'raw': line
            }
        
        return None
    
    async def _run_droid_exec(
        self,
        task: Task,
        on_progress: Optional[Callable[[str], None]] = None
    ) -> TaskResult:
        """Run droid exec and parse output with real-time streaming."""
        
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
        
        # Use text output for real-time activity streaming
        # JSON format suppresses activity output
        cmd.extend(["--output-format", "text"])
        
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
        
        # Stream stdout for real-time activity (droid outputs activity to stdout in text mode)
        stderr_lines = []
        stdout_lines = []
        final_result_lines = []
        in_final_answer = False
        
        async def read_stderr():
            async for line in process.stderr:
                line_str = line.decode("utf-8", errors="replace").rstrip()
                if line_str:
                    stderr_lines.append(line_str)
        
        async def read_stdout():
            nonlocal in_final_answer
            async for line in process.stdout:
                line_str = line.decode("utf-8", errors="replace").rstrip()
                if line_str:
                    stdout_lines.append(line_str)
                    logger.debug(f"stdout line: {line_str[:100]}")
                    
                    # Check if we're entering the final answer section
                    if '# Answer' in line_str or line_str.startswith('Answer:'):
                        in_final_answer = True
                    
                    if in_final_answer:
                        final_result_lines.append(line_str)
                    elif on_progress:
                        # Send progress update for activity lines
                        activity = self._parse_activity_line(line_str)
                        if activity:
                            logger.info(f"Sending activity: {activity.get('type')} - {activity.get('raw', '')[:50]}")
                            on_progress(activity)
        
        # Read both streams concurrently
        await asyncio.gather(read_stderr(), read_stdout())
        await process.wait()
        
        stdout_str = '\n'.join(stdout_lines).strip()
        stderr_str = '\n'.join(stderr_lines).strip()
        
        logger.info(f"droid exec exit code: {process.returncode}")
        
        if stderr_str:
            logger.warning(f"droid exec stderr: {stderr_str[:500]}")
        
        # Parse text output
        if stdout_str:
            logger.info(f"Raw stdout ({len(stdout_str)} chars): {stdout_str[:500]}")
            
            # Extract the final answer from text output
            result_content = '\n'.join(final_result_lines).strip()
            
            # Clean up markdown headers
            if result_content.startswith('# Answer'):
                result_content = result_content.replace('# Answer', '', 1).strip()
            if result_content.startswith('Answer:'):
                result_content = result_content.replace('Answer:', '', 1).strip()
            
            # If no "Answer" section found, use the last part of stdout as result
            if not result_content:
                # Try to find a meaningful result in the output
                lines = stdout_str.split('\n')
                # Skip activity lines and find content
                content_lines = []
                for line in reversed(lines):
                    stripped = line.strip()
                    if not stripped:
                        continue
                    # Skip tool activity lines
                    if stripped.startswith('[') and ']' in stripped[:20]:
                        break
                    content_lines.insert(0, stripped)
                result_content = '\n'.join(content_lines).strip()
            
            # If still no content, use full stdout
            if not result_content:
                result_content = stdout_str
            
            # Try to extract session_id from output (look for pattern like "Session: xxx")
            session_id = None
            session_match = re.search(r'[Ss]ession[:\s]+([a-f0-9-]{36})', stdout_str)
            if session_match:
                session_id = session_match.group(1)
                logger.info(f"Extracted session_id: {session_id}")
            
            logger.info(f"Extracted result ({len(result_content)} chars): {result_content[:200]}")
            
            return TaskResult(
                success=process.returncode == 0,
                result=result_content,
                session_id=session_id,
                duration_ms=0,
                num_turns=0,
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
