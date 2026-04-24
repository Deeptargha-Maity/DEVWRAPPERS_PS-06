# Emergency Room Management System (ER Command)

A full-stack, real-time web application that dynamically manages patient triage and resource allocation in an emergency room environment. Built with a Python FastAPI backend and a vanilla HTML/CSS/JS frontend.

## Prerequisites

- **Python 3.10+** (Python 3.13 was used for the local virtual environment)

## Setup Instructions

Follow these steps to run the application locally on your machine.

### 1. Open your terminal

Navigate to the project root directory:
```bash
cd /Users/deeparghamaity/Desktop/test4
```

### 2. Create and Activate a Virtual Environment

It is highly recommended to use a virtual environment to manage dependencies.

**Create the virtual environment:**
```bash
python3 -m venv venv
```

**Activate the virtual environment:**
- On Mac/Linux:
  ```bash
  source venv/bin/activate
  ```
- On Windows:
  ```bash
  venv\Scripts\activate
  ```

### 3. Install Dependencies

With the virtual environment activated, install the required packages:
```bash
pip install -r requirements.txt
```

### 4. Start the Application Server

Run the backend server using Uvicorn. Since the application serves the frontend static files directly, you only need to run this one command:
```bash
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

### 5. Access the ER Dashboard

Open your web browser and navigate to:
**http://localhost:8000**

You should see the green-themed ER Command dashboard load up with a "Live" WebSocket connection indicator in the top right corner.

## Key Features
- **Dynamic Priority Engine**: Patient priority decays and increases automatically based on wait times.
- **Bed Management**: Assign and release beds without conflicts or double-booking.
- **Pre-Arrival Reservations**: Allow ambulances to reserve beds up to 30 minutes in advance.
- **MCI Mode**: Switch from standard severity-based triage to survival-probability triage during Mass Casualty Incidents.
- **Real-Time WebSockets**: DOM updates happen instantly across all connected browsers without page reloads.
