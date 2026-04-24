from fastapi import APIRouter
from pydantic import BaseModel
from backend.services.priority_engine import priority_engine
from backend.services.bed_service import bed_service

router = APIRouter(prefix="/system", tags=["System"])


class ModeRequest(BaseModel):
    mci_mode: bool


@router.post("/mode")
async def set_mode(req: ModeRequest):
    await priority_engine.set_mci_mode(req.mci_mode)
    return {"success": True, "mci_mode": req.mci_mode}


@router.get("/status")
async def get_status():
    beds = bed_service.beds_summary()
    return {
        "mci_mode": priority_engine.mci_mode,
        "total_patients": len(priority_engine.full_state()),
        "waiting_patients": len(priority_engine.get_waiting_patients()),
        "beds": beds,
        "reservations": bed_service.get_reservations(),
    }
