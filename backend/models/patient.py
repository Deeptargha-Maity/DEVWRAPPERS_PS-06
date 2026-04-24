from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum
import time
import uuid


class SeverityLevel(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


SEVERITY_SCORES = {
    SeverityLevel.CRITICAL: 10,
    SeverityLevel.HIGH: 7,
    SeverityLevel.MEDIUM: 4,
    SeverityLevel.LOW: 1,
}

MCI_SURVIVAL_SCORES = {
    SeverityLevel.CRITICAL: 4,
    SeverityLevel.HIGH: 10,
    SeverityLevel.MEDIUM: 7,
    SeverityLevel.LOW: 2,
}


class PatientCreate(BaseModel):
    name: str
    age: int
    severity: SeverityLevel
    chief_complaint: str
    survival_probability: Optional[float] = 0.75


class Patient(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8].upper())
    name: str
    age: int
    severity: SeverityLevel
    chief_complaint: str
    arrival_time: float = Field(default_factory=time.time)
    priority_score: float = 0.0
    bed_id: Optional[int] = None
    status: str = "waiting"
    survival_probability: float = 0.75

    def waiting_minutes(self) -> float:
        return (time.time() - self.arrival_time) / 60.0

    def calculate_priority(self, decay_factor: float = 0.5, mci_mode: bool = False) -> float:
        if mci_mode:
            base = MCI_SURVIVAL_SCORES[self.severity]
        else:
            base = SEVERITY_SCORES[self.severity]
        return round(base + (self.waiting_minutes() * decay_factor), 3)
