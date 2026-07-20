import asyncio


class EventBus:
    """Bus d'événements en mémoire par job (§1.3), utilisé par le worker et le SSE (P1-08).

    `publish` est thread-safe : les hooks yt-dlp s'exécutent dans un thread
    (`asyncio.to_thread`), pas dans la boucle asyncio principale.
    """

    def __init__(self) -> None:
        self._subscribers: dict[int, list[asyncio.Queue]] = {}
        self._loop: asyncio.AbstractEventLoop | None = None

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def subscribe(self, job_id: int) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue()
        self._subscribers.setdefault(job_id, []).append(queue)
        return queue

    def unsubscribe(self, job_id: int, queue: asyncio.Queue) -> None:
        subscribers = self._subscribers.get(job_id, [])
        if queue in subscribers:
            subscribers.remove(queue)
        if not subscribers:
            self._subscribers.pop(job_id, None)

    def publish(self, job_id: int, event: dict) -> None:
        subscribers = self._subscribers.get(job_id, [])
        for queue in subscribers:
            if self._loop and self._loop.is_running():
                self._loop.call_soon_threadsafe(queue.put_nowait, event)
            else:
                queue.put_nowait(event)


bus = EventBus()
