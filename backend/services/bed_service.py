import asyncio
import time
import uuid
from typing import Dict, List, Optional
from backend.models.bed import Bed, Reservation
from backend.websocket.manager import manager


TOTAL_BEDS = 50
RESERVATION_TIMEOUT_MINUTES = 30


class BedService:
    def __init__(self):
        self._beds: Dict[int, Bed] = {
            i: Bed(id=i) for i in range(1, TOTAL_BEDS + 1)
        }
        self._reservations: Dict[str, Reservation] = {}
        self._lock = asyncio.Lock()

    def get_all_beds(self) -> List[Bed]:
        return list(self._beds.values())

    def get_available_beds(self) -> List[Bed]:
        now = time.time()
        available = []
        for bed in self._beds.values():
            if bed.is_occupied:
                continue
            if bed.reserved_by:
                res = self._reservations.get(bed.reserved_by)
                if res and not res.is_expired():
                    continue  # still reserved
            available.append(bed)
        return available

    async def assign_bed(self, patient_id: str, bed_id: Optional[int] = None) -> Optional[int]:
        async with self._lock:
            if bed_id is not None:
                bed = self._beds.get(bed_id)
                if not bed or bed.is_occupied:
                    return None
                # Check reservation conflict
                if bed.reserved_by:
                    res = self._reservations.get(bed.reserved_by)
                    if res and not res.is_expired():
                        return None
            else:
                # Auto-assign first available
                available = self.get_available_beds()
                if not available:
                    return None
                bed = available[0]
                bed_id = bed.id

            bed.is_occupied = True
            bed.patient_id = patient_id
            bed.reserved_by = None
            bed.reserved_until = None

        await manager.broadcast("bed_assigned", {
            "bed_id": bed_id,
            "patient_id": patient_id
        })
        return bed_id

    async def release_bed(self, patient_id: str) -> bool:
        async with self._lock:
            for bed in self._beds.values():
                if bed.patient_id == patient_id:
                    bed.is_occupied = False
                    bed.patient_id = None
                    await manager.broadcast("bed_released", {"bed_id": bed.id})
                    return True
        return False

    async def create_reservation(self, ambulance_id: str, patient_name: str,
                                  severity: str, eta_minutes: int) -> Optional[Reservation]:
        async with self._lock:
            available = self.get_available_beds()
            if not available:
                return None
            bed = available[0]
            now = time.time()
            res = Reservation(
                id=str(uuid.uuid4())[:8].upper(),
                ambulance_id=ambulance_id,
                patient_name=patient_name,
                severity=severity,
                bed_id=bed.id,
                created_at=now,
                expires_at=now + (RESERVATION_TIMEOUT_MINUTES * 60),
            )
            self._reservations[res.id] = res
            bed.reserved_by = res.id
            bed.reserved_until = res.expires_at

        await manager.broadcast("reservation_created", {
            "reservation_id": res.id,
            "bed_id": res.bed_id,
            "patient_name": res.patient_name,
            "expires_in_minutes": RESERVATION_TIMEOUT_MINUTES,
        })
        return res

    async def cancel_reservation(self, reservation_id: str) -> bool:
        async with self._lock:
            res = self._reservations.get(reservation_id)
            if not res:
                return False
            bed = self._beds.get(res.bed_id)
            if bed and bed.reserved_by == reservation_id:
                bed.reserved_by = None
                bed.reserved_until = None
            del self._reservations[reservation_id]
        return True

    async def cleanup_expired_reservations(self):
        async with self._lock:
            expired = [r for r in self._reservations.values() if r.is_expired()]
            for res in expired:
                bed = self._beds.get(res.bed_id)
                if bed and bed.reserved_by == res.id:
                    bed.reserved_by = None
                    bed.reserved_until = None
                del self._reservations[res.id]
                await manager.broadcast("reservation_expired", {"reservation_id": res.id})

    def beds_summary(self) -> dict:
        total = TOTAL_BEDS
        occupied = sum(1 for b in self._beds.values() if b.is_occupied)
        reserved = sum(
            1 for b in self._beds.values()
            if b.reserved_by and not self._reservations.get(b.reserved_by, Reservation(
                id="", ambulance_id="", patient_name="", severity="", bed_id=0,
                created_at=0, expires_at=0
            )).is_expired()
        )
        return {
            "total": total,
            "occupied": occupied,
            "reserved": reserved,
            "available": total - occupied - reserved,
            "beds": [self._bed_dict(b) for b in self._beds.values()],
        }

    def _bed_dict(self, b: Bed) -> dict:
        res = self._reservations.get(b.reserved_by) if b.reserved_by else None
        return {
            "id": b.id,
            "is_occupied": b.is_occupied,
            "patient_id": b.patient_id,
            "reserved_by": b.reserved_by,
            "reservation_patient": res.patient_name if res else None,
        }

    def get_reservations(self) -> List[dict]:
        return [
            {
                "id": r.id,
                "ambulance_id": r.ambulance_id,
                "patient_name": r.patient_name,
                "severity": r.severity,
                "bed_id": r.bed_id,
                "expires_in": max(0, round((r.expires_at - time.time()) / 60, 1)),
            }
            for r in self._reservations.values()
            if not r.is_expired()
        ]


bed_service = BedService()
