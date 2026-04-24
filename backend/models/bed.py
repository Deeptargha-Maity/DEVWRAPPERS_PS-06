from pydantic import BaseModel
from typing import Optional
import time


class Bed(BaseModel):
    id: int
    is_occupied: bool = False
    patient_id: Optional[str] = None
    reserved_by: Optional[str] = None
    reserved_until: Optional[float] = None


class BedAssignRequest(BaseModel):
    patient_id: str
    bed_id: Optional[int] = None


class ReservationCreate(BaseModel):
    ambulance_id: str
    patient_name: str
    severity: str
    eta_minutes: int = 15


class Reservation(BaseModel):
    id: str
    ambulance_id: str
    patient_name: str
    severity: str
    bed_id: int
    created_at: float = 0.0
    expires_at: float = 0.0

    def is_expired(self) -> bool:
        return time.time() > self.expires_at
