from fastapi import APIRouter, HTTPException
from backend.models.bed import BedAssignRequest
from backend.services.bed_service import bed_service
from backend.services.priority_engine import priority_engine
from backend.websocket.manager import manager

router = APIRouter(prefix="/beds", tags=["Beds"])


@router.get("")
async def get_beds():
    return bed_service.beds_summary()


@router.post("/assign")
async def assign_bed(req: BedAssignRequest):
    patient = priority_engine.get_patient(req.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if patient.status == "assigned":
        raise HTTPException(status_code=400, detail="Patient already has a bed")

    bed_id = await bed_service.assign_bed(req.patient_id, req.bed_id)
    if bed_id is None:
        raise HTTPException(status_code=409, detail="No available beds or bed already occupied")

    await priority_engine.assign_bed(req.patient_id, bed_id)
    return {"success": True, "bed_id": bed_id, "patient_id": req.patient_id}


@router.post("/release/{patient_id}")
async def release_bed(patient_id: str):
    ok = await bed_service.release_bed(patient_id)
    if not ok:
        raise HTTPException(status_code=404, detail="No bed assigned to this patient")
    await priority_engine.discharge_patient(patient_id)
    return {"success": True}
