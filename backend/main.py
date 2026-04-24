import asyncio
import sys
import os

# Ensure the parent directory is in the Python path so imports like 'backend.routes' work
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from backend.routes import patients, beds, reservations, system
from backend.websocket.manager import manager
from backend.services.priority_engine import priority_engine
from backend.services.bed_service import bed_service
from backend.utils.scheduler import background_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(background_scheduler())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="ER Management System",
    description="Real-time Emergency Room Management System",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(patients.router)
app.include_router(beds.router)
app.include_router(reservations.router)
app.include_router(system.router)

app.mount("/static", StaticFiles(directory="frontend"), name="static")


@app.get("/")
async def serve_frontend():
    return FileResponse("frontend/index.html")


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        state = {
            "patients": priority_engine.full_state(),
            "beds": bed_service.beds_summary(),
            "mci_mode": priority_engine.mci_mode,
            "reservations": bed_service.get_reservations(),
        }
        await manager.send_personal(websocket, "full_state", state)
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text('{"event":"pong","data":{}}')
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
    except Exception:
        await manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
