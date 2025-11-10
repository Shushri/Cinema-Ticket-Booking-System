import express from "express";
import bodyParser from "body-parser";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = 3000;

// MySQL connection
const db = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// Helper to get primary key field
function getIdField(table) {
  switch (table) {
    case "Movies": return "movie_id";
    case "Theaters": return "theater_id";
    case "Showtimes": return "showtime_id";
    case "Bookings": return "booking_id";
    default: return "id";
  }
}

// Home page
app.get("/", (req, res) => {
  res.render("index.ejs", { table: null, data: null, error: null, pk: null });
});

// View selected table
app.post("/view", async (req, res) => {
  const selectedTable = req.body.table;
  try {
    const [rows] = await db.query(`SELECT * FROM ${selectedTable}`);
    const pk = getIdField(selectedTable);
    res.render("index.ejs", { table: selectedTable, data: rows, error: null, pk });
  } catch (err) {
    console.error(err);
    res.render("index.ejs", { table: null, data: null, error: "❌ Error fetching data.", pk: null });
  }
});

// Add form page
app.get("/add/:table", (req, res) => {
  res.render("add.ejs", { table: req.params.table, message: null, error: null });
});

// Add new record
app.post("/add/:table", async (req, res) => {
  const { table } = req.params;
  const b = req.body;

  try {
    if (table === "Movies")
      await db.query("INSERT INTO Movies (movie_name, genre, duration) VALUES (?, ?, ?)", [b.movie_name, b.genre, b.duration]);
    else if (table === "Theaters")
      await db.query("INSERT INTO Theaters (theater_name, location) VALUES (?, ?)", [b.theater_name, b.location]);
    else if (table === "Showtimes")
      await db.query("INSERT INTO Showtimes (movie_id, theater_id, show_date, show_time) VALUES (?, ?, ?, ?)", [b.movie_id, b.theater_id, b.show_date, b.show_time]);
    else if (table === "Bookings")
      await db.query("INSERT INTO Bookings (user_id, showtime_id, seats_booked) VALUES (?, ?, ?)", [b.user_id, b.showtime_id, b.seats_booked]);

    res.render("add.ejs", { table, message: "✅ Record added successfully!", error: null });
  } catch (err) {
    console.error(err);
    res.render("add.ejs", { table, message: null, error: "❌ Error adding record." });
  }
});

// Delete record safely
app.post("/delete/:table/:id", async (req, res) => {
  const { table, id } = req.params;
  const idField = getIdField(table);

  try {
    await db.beginTransaction();

    if (table === "Movies") {
      await db.query("DELETE b FROM Bookings b JOIN Showtimes s ON b.showtime_id = s.showtime_id WHERE s.movie_id = ?", [id]);
      await db.query("DELETE FROM Showtimes WHERE movie_id = ?", [id]);
      await db.query("DELETE FROM Movies WHERE movie_id = ?", [id]);
    } else if (table === "Theaters") {
      await db.query("DELETE b FROM Bookings b JOIN Showtimes s ON b.showtime_id = s.showtime_id WHERE s.theater_id = ?", [id]);
      await db.query("DELETE FROM Showtimes WHERE theater_id = ?", [id]);
      await db.query("DELETE FROM Theaters WHERE theater_id = ?", [id]);
    } else if (table === "Showtimes") {
      await db.query("DELETE FROM Bookings WHERE showtime_id = ?", [id]);
      await db.query("DELETE FROM Showtimes WHERE showtime_id = ?", [id]);
    } else {
      await db.query(`DELETE FROM ${table} WHERE ${idField} = ?`, [id]);
    }

    await db.commit();

    const [rows] = await db.query(`SELECT * FROM ${table}`);
    res.render("index.ejs", { table, data: rows, error: null, pk: idField });
  } catch (err) {
    await db.rollback();
    console.error("Delete error:", err);
    res.render("index.ejs", { table: null, data: null, error: "❌ Failed to delete record.", pk: null });
  }
});

// Edit form
app.get("/edit/:table/:id", async (req, res) => {
  const { table, id } = req.params;
  const idField = getIdField(table);
  try {
    const [rows] = await db.query(`SELECT * FROM ${table} WHERE ${idField} = ?`, [id]);
    res.render("edit.ejs", { table, record: rows[0], message: null, error: null });
  } catch (err) {
    console.error(err);
    res.render("edit.ejs", { table, record: null, message: null, error: "Error fetching record." });
  }
});

// Edit submit
app.post("/edit/:table/:id", async (req, res) => {
  const { table, id } = req.params;
  const b = req.body;

  try {
    if (table === "Movies")
      await db.query("UPDATE Movies SET movie_name=?, genre=?, duration=? WHERE movie_id=?", [b.movie_name, b.genre, b.duration, id]);
    else if (table === "Theaters")
      await db.query("UPDATE Theaters SET theater_name=?, location=? WHERE theater_id=?", [b.theater_name, b.location, id]);
    else if (table === "Showtimes")
      await db.query("UPDATE Showtimes SET movie_id=?, theater_id=?, show_date=?, show_time=? WHERE showtime_id=?", [b.movie_id, b.theater_id, b.show_date, b.show_time, id]);
    else if (table === "Bookings")
      await db.query("UPDATE Bookings SET user_id=?, showtime_id=?, seats_booked=? WHERE booking_id=?", [b.user_id, b.showtime_id, b.seats_booked, id]);

    res.render("edit.ejs", { table, record: b, message: "✅ Record updated successfully!", error: null });
  } catch (err) {
    console.error(err);
    res.render("edit.ejs", { table, record: b, message: null, error: "❌ Error updating record." });
  }
});

app.listen(port, () => console.log(`🎥 Server running at http://localhost:${port}`));
