import asyncio
from backend.services.priority_engine import priority_engine
from backend.services.bed_service import bed_service
from backend.websocket.manager import manager


async def background_scheduler():
    """Runs every 10 seconds: recalculates priorities, cleans expired reservations."""
    while True:
        await asyncio.sleep(10)
        await priority_engine.tick()
        await bed_service.cleanup_expired_reservations()

        # Broadcast full system state for any new connections
        state = {
            "patients": priority_engine.full_state(),
            "beds": bed_service.beds_summary(),
            "mci_mode": priority_engine.mci_mode,
        }
        await manager.broadcast("full_state", state)
