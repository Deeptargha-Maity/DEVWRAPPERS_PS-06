import asyncio
import time
from typing import Dict, List, Optional
from backend.models.patient import Patient, PatientCreate
from backend.websocket.manager import manager


class PriorityEngine:
    def __init__(self):
        self._patients: Dict[str, Patient] = {}
        self._mci_mode: bool = False
        self._decay_factor: float = 0.5
        self._lock = asyncio.Lock()

    @property
    def mci_mode(self) -> bool:
        return self._mci_mode

    async def set_mci_mode(self, enabled: bool):
        async with self._lock:
            self._mci_mode = enabled
        await manager.broadcast("mode_changed", {"mci_mode": enabled})

    async def add_patient(self, data: PatientCreate) -> Patient:
        patient = Patient(**data.model_dump())
        patient.priority_score = patient.calculate_priority(self._decay_factor, self._mci_mode)
        async with self._lock:
            self._patients[patient.id] = patient
        await manager.broadcast("patient_added", self._serialize_patient(patient))
        await self._broadcast_sorted_queue()
        return patient

    async def remove_patient(self, patient_id: str) -> bool:
        async with self._lock:
            if patient_id not in self._patients:
                return False
            del self._patients[patient_id]
        await self._broadcast_sorted_queue()
        return True

    async def assign_bed(self, patient_id: str, bed_id: int):
        async with self._lock:
            if patient_id in self._patients:
                self._patients[patient_id].bed_id = bed_id
                self._patients[patient_id].status = "assigned"

    async def discharge_patient(self, patient_id: str):
        async with self._lock:
            if patient_id in self._patients:
                self._patients[patient_id].status = "discharged"
                self._patients[patient_id].bed_id = None

    def get_sorted_patients(self) -> List[Patient]:
        patients = list(self._patients.values())
        return sorted(patients, key=lambda p: p.priority_score, reverse=True)

    def get_patient(self, patient_id: str) -> Optional[Patient]:
        return self._patients.get(patient_id)

    def get_waiting_patients(self) -> List[Patient]:
        return [p for p in self.get_sorted_patients() if p.status == "waiting"]

    async def tick(self):
        async with self._lock:
            for patient in self._patients.values():
                patient.priority_score = patient.calculate_priority(
                    self._decay_factor, self._mci_mode
                )
        await self._broadcast_sorted_queue()

    async def _broadcast_sorted_queue(self):
        sorted_list = [self._serialize_patient(p) for p in self.get_sorted_patients()]
        await manager.broadcast("priority_updated", {"patients": sorted_list})

    def _serialize_patient(self, p: Patient) -> dict:
        return {
            "id": p.id,
            "name": p.name,
            "age": p.age,
            "severity": p.severity,
            "chief_complaint": p.chief_complaint,
            "priority_score": p.priority_score,
            "waiting_minutes": round(p.waiting_minutes(), 1),
            "bed_id": p.bed_id,
            "status": p.status,
            "arrival_time": p.arrival_time,
            "survival_probability": p.survival_probability,
        }

    def full_state(self) -> List[dict]:
        return [self._serialize_patient(p) for p in self.get_sorted_patients()]


priority_engine = PriorityEngine()
