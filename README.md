# ER Command 🏥
**A Professional Real-Time Emergency Room Management System**

ER Command is a full-stack, real-time web application that dynamically manages patient triage and resource allocation in an emergency room environment. It features a modern, dark-themed clinical dashboard built with a Python FastAPI backend and a vanilla HTML/CSS/JS frontend.

---

## ✨ Key Features
- **Dynamic Priority Engine**: Patient priority decays and increases automatically based on wait times.
- **Real-Time WebSockets**: DOM updates happen instantly across all connected browsers without page reloads.
- **Bed Management**: Assign and release beds without conflicts or double-booking.
- **Pre-Arrival Reservations**: Allow ambulances to reserve beds up to 30 minutes in advance.
- **MCI Mode**: Switch from standard severity-based triage to survival-probability triage during Mass Casualty Incidents.
- **Professional Clinical UI**: Responsive dark theme with smooth micro-animations and zero clutter.

---

## 🚀 Setup Instructions

Follow these steps to run the application locally on your machine.

### 1. Clone the Repository
Open your terminal and clone this repository to your local machine:
```bash
git clone https://github.com/yourusername/er-command.git
cd er-command
```

### 2. Create and Activate a Virtual Environment
It is highly recommended to use a virtual environment to manage dependencies.

**Create the virtual environment:**
```bash
python -m venv venv
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
Run the backend server. The application serves the frontend static files directly from the backend, so you only need to run this one command:
```bash
python -m backend.main
```
*(Alternatively, you can run `uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload` for development mode).*

### 5. Access the ER Dashboard
Open your web browser and navigate to:
**http://localhost:8000**

You should see the ER Command dashboard load up with a "Live" WebSocket connection indicator in the top right corner.

---

## 🌐 Deployment (Render)

This application is ready to be deployed for free on [Render](https://render.com). 
1. Create a **New Web Service** and connect your GitHub repository.
2. Set the **Build Command** to: `pip install -r requirements.txt`
3. Set the **Start Command** to: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`

## 🌐 Live Demo

The project is deployed and accessible online:

👉 Official Website: https://er-command.onrender.com

You can explore all features directly through the live interface without any local setup.
---
*Built by Deeptargha Maity🍃 (DEVWRAPPERS)*
