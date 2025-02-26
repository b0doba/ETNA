const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const app = express();

app.use(express.json());
app.use(cors());

// **1️⃣ API az épületek lekérésére**
app.get("/api/buildings", async (req, res) => {
  try {
    const buildings = await prisma.building.findMany({
      include: { floors: true },
    });

    const geoJsonData = {
      type: "FeatureCollection",
      features: buildings.map((building) => ({
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: building.coordinates
          ? [JSON.parse(building.coordinates)] // 🔹 JSON-string konvertálása tömbbé
          : []
        },
        properties: {
          id: building.id,
          name: building.name,
          category: "building",
        },
      })),
    };

    res.json(geoJsonData);
  } catch (error) {
    console.error("🚨 Hiba történt:", error);
    res.status(500).json({ error: "Nem sikerült lekérni az épületeket." });
  }
});

// **2️⃣ API a termek lekérésére**
app.get("/api/rooms", async (req, res) => {
  try {
    const rooms = await prisma.room.findMany({
      include: { floor: { include: { building: true } } },
    });

    const geoJsonData = {
      type: "FeatureCollection",
      features: rooms.map((room) => ({
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: room.coordinates
          ? [JSON.parse(room.coordinates)] // 🔹 JSON-string konvertálása tömbbé
          : []
        },
        properties: {
          id: room.id,
          name: room.name,
          floor: room.floor.number,
          building: room.floor.building.name,
          category: "room",
        },
      })),
    };

    res.json(geoJsonData);
  } catch (error) {
    console.error("🚨 Hiba történt:", error);
    res.status(500).json({ error: "Hiba a termek lekérdezésekor" });
  }
});

app.post('/api/updateBuildings', async (req, res) => {
  try {
    const updatedBuildings = req.body;
    console.log("🔄 Frissített épületek:", JSON.stringify(updatedBuildings, null, 2));

    for (const building of updatedBuildings.features) {
      console.log(`🛠 Frissítés alatt: Build ID = ${building.properties.id}`);

      const existingBuilding = await prisma.building.findUnique({
        where: { id: building.properties.id }
      });

      if (!existingBuilding) {
        console.warn(`⚠️ Kihagyott frissítés: Building ID=${building.properties.id} nem létezik.`);
        continue;
      }

      const cleanedCoordinates = building.geometry.coordinates.length === 1
        ? building.geometry.coordinates[0]
        : building.geometry.coordinates;

      const buildingName = building.properties.name || existingBuilding.name; // Ha nincs name, akkor használjuk a meglévőt

      console.log("📌 Mentendő adatok:", {
        id: building.properties.id,
        name: buildingName,
        coordinates: cleanedCoordinates,
      });

      await prisma.building.upsert({
        where: { id: building.properties.id },
        update: { coordinates: JSON.stringify(cleanedCoordinates) },
        create: {
          id: building.properties.id,
          name: buildingName, // Most már biztosan van értéke
          coordinates: JSON.stringify(cleanedCoordinates),
        },
      });
    }

    res.json({ success: true, message: "Épületek frissítve!" });
  } catch (error) {
    console.error("🚨 Hiba az épületek frissítésekor:", error);
    res.status(500).json({ error: "Nem sikerült frissíteni az épületeket." });
  }
});


app.post('/api/updateRooms', async (req, res) => {
  try {
    const updatedRooms = req.body;
    console.log("🔄 Frissített szobák:", JSON.stringify(updatedRooms, null, 2));

    for (const room of updatedRooms.features) {
      console.log(`🛠 Frissítés alatt: Room ID = ${room.properties.id}`);

      const existingRoom = await prisma.room.findUnique({
        where: { id: room.properties.id }
      });

      if (!existingRoom) {
        console.warn(`⚠️ Kihagyott frissítés: Room ID=${room.properties.id} nem létezik.`);
        continue;
      }

      const cleanedCoordinates = room.geometry.coordinates.length === 1
        ? room.geometry.coordinates[0]
        : room.geometry.coordinates;

      const roomName = room.properties.name || existingRoom.name; // Ha nincs name, akkor használjuk a meglévőt

      console.log("📌 Mentendő adatok:", {
        id: room.properties.id,
        name: roomName,
        coordinates: cleanedCoordinates,
      });

      await prisma.room.upsert({
        where: { id: room.properties.id },
        update: { coordinates: JSON.stringify(cleanedCoordinates) },
        create: {
          id: room.properties.id,
          name: roomName,
          coordinates: JSON.stringify(cleanedCoordinates),
        },
      });
    }

    res.json({ success: true, message: "Szobák frissítve!" });
  } catch (error) {
    console.error("🚨 Hiba az szobák frissítésekor:", error);
    res.status(500).json({ error: "Nem sikerült frissíteni az szobákat." });
  }
});


// **Szerver indítása**
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Szerver fut a http://localhost:${PORT} címen`);
});
