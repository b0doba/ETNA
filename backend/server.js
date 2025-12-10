const express = require("express");
const cors = require("cors");

// Route-ok importálása
const buildingsRoutes = require("./routes/buildings");
const floorsRoutes = require("./routes/floors");
const roomsRoutes = require("./routes/rooms");
const searchRoutes = require("./routes/search");
const graphRoutes = require("./routes/graph");

const app = express();
app.use(express.json());
app.use(cors());

// API route-ok betöltése
app.use("/api", buildingsRoutes);
app.use("/api", floorsRoutes);
app.use("/api", roomsRoutes);
app.use("/api", searchRoutes);
app.use("/api", graphRoutes);

// Szerver indítása
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Szerver fut a http://localhost:${PORT} címen`);
});
