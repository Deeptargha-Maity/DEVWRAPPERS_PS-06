from fastapi import APIRouter, HTTPException
from backend.models.patient import PatientCreate
from backend.services.priority_engine import priority_engine
from backend.services.bed_service import bed_service

router = APIRouter(prefix="/patients", tags=["Patients"])


@router.post("")
async def add_patient(data: PatientCreate):
    patient = await priority_engine.add_patient(data)
    return {"success": True, "patient_id": patient.id, "patient": patient}


@router.get("")
async def list_patients():
    return {"patients": priority_engine.full_state()}


@router.delete("/{patient_id}")
async def remove_patient(patient_id: str):
    await bed_service.release_bed(patient_id)
    ok = await priority_engine.remove_patient(patient_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Patient not found")
    return {"success": True}
