import asyncio

import pytest

from app.core.events import EventBus


@pytest.mark.asyncio
async def test_publish_delivers_to_subscriber():
    bus = EventBus()
    bus.bind_loop(asyncio.get_running_loop())
    queue = bus.subscribe(1)

    bus.publish(1, {"event": "progress", "data": {"pct": 50}})

    event = await asyncio.wait_for(queue.get(), timeout=1)
    assert event["event"] == "progress"
    assert event["data"]["pct"] == 50


@pytest.mark.asyncio
async def test_publish_ignored_without_subscriber():
    bus = EventBus()
    bus.bind_loop(asyncio.get_running_loop())

    # Ne doit pas lever d'exception même si personne n'écoute ce job.
    bus.publish(999, {"event": "progress", "data": {}})


@pytest.mark.asyncio
async def test_unsubscribe_stops_delivery():
    bus = EventBus()
    bus.bind_loop(asyncio.get_running_loop())
    queue = bus.subscribe(1)
    bus.unsubscribe(1, queue)

    bus.publish(1, {"event": "progress", "data": {}})
    assert queue.empty()
