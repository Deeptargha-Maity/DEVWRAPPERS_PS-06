from fastapi import APIRouter, HTTPException
from backend.models.bed import ReservationCreate
from backend.services.bed_service import bed_service

router = APIRouter(prefix="/reserve", tags=["Reservations"])


@router.post("")
async def create_reservation(data: ReservationCreate):
    res = await bed_service.create_reservation(
        data.ambulance_id, data.patient_name, data.severity, data.eta_minutes
    )
    if not res:
        raise HTTPException(status_code=409, detail="No available beds for reservation")
    return {
        "success": True,
        "reservation_id": res.id,
        "bed_id": res.bed_id,
        "expires_in_minutes": 30,
    }


@router.get("")
async def list_reservations():
    return {"reservations": bed_service.get_reservations()}


@router.delete("/{reservation_id}")
async def cancel_reservation(reservation_id: str):
    ok = await bed_service.cancel_reservation(reservation_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Reservation not found")
    return {"success": True}
