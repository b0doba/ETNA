const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const app = express();

app.use(express.json());
app.use(cors());

// API az épületek lekérésére
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
          ? [JSON.parse(building.coordinates)] // JSON-string konvertálása tömbbé
          : []
        },
        properties: {
          id: building.id,
          name: building.name,
          shortName: building.shortName ?? null,
          group: building.group ?? null,
          coordinates: building.coordinates ? JSON.parse(building.coordinates) : null, 
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

// **API a termek lekérésére**
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
          ? [JSON.parse(room.coordinates)] // JSON-string konvertálása tömbbé
          : []
        },
        properties: {
          id: room.id,
          name: room.name,
          floor: room.floor.number,
          floorId: room.floor.id,
          type: room.type,
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

// API a szintek (floors) lekérésére
app.get("/api/floors", async (req, res) => {
  try {
    const floors = await prisma.floor.findMany({
      include: {
        building: true,
        rooms: true,
      },
    });

    const geoJsonData = {
      type: "FeatureCollection",
      features: floors.map((floor) => ({
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: floor.coordinates
            ? [JSON.parse(floor.coordinates)]
            : [],
        },
        properties: {
          id: floor.id,
          number: floor.number,
          height: floor.height,
          building: floor.building.name,
          buildingId: floor.building.id,
          category: "floor",
        },
      })),
    };

    res.json(geoJsonData);
  } catch (error) {
    console.error("🚨 Hiba történt:", error);
    res.status(500).json({ error: "Nem sikerült lekérni a szinteket." });
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
        update: {
          name: building.properties.name || buildingName,
          shortName: building.properties.shortName || existingBuilding.shortName,
          group: building.properties.group || existingBuilding.group,
          coordinates: JSON.stringify(cleanedCoordinates),
        },
        create: {
          id: building.properties.id,
          name: buildingName,
          shortName: building.properties.shortName || "",
          group: building.properties.group || "",
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
      const roomType = room.properties.type || existingRoom.type || "Unknown";

      console.log("📌 Mentendő adatok:", {
        id: room.properties.id,
        name: roomName,
        type: roomType,
        coordinates: cleanedCoordinates,
      });

      await prisma.room.upsert({
        where: { id: room.properties.id },
        update: {
          name: room.properties.name || roomName,
          type: room.properties.type || roomType,
          coordinates: JSON.stringify(cleanedCoordinates),
        },
        create: {
          id: room.properties.id,
          name: roomName,
          type: roomType,
          coordinates: JSON.stringify(cleanedCoordinates),
          floorId: existingRoom.floorId
        },
      });
    }

    res.json({ success: true, message: "Szobák frissítve!" });
  } catch (error) {
    console.error("🚨 Hiba az szobák frissítésekor:", error);
    res.status(500).json({ error: "Nem sikerült frissíteni az szobákat." });
  }
});

app.post('/api/updateFloors', async (req, res) => {
  try {
    const updatedFloors = req.body;
    console.log("🔄 Frissített szintek:", JSON.stringify(updatedFloors, null, 2));

    for (const floor of updatedFloors.features) {
      console.log(`🛠 Frissítés alatt: Floor ID = ${floor.properties.id}`);

      const existingFloor = await prisma.floor.findUnique({
        where: { id: floor.properties.id },
      });

      if (!existingFloor) {
        console.warn(`⚠️ Kihagyott frissítés: Floor ID=${floor.properties.id} nem létezik.`);
        continue;
      }

      const cleanedCoordinates =
        floor.geometry.coordinates.length === 1
          ? floor.geometry.coordinates[0]
          : floor.geometry.coordinates;

      console.log("📌 Mentendő adatok:", {
        id: floor.properties.id,
        coordinates: cleanedCoordinates,
      });

      await prisma.floor.upsert({
        where: { id: floor.properties.id },
        update: {
          number: floor.properties.number || existingFloor.number,
          height: floor.properties.height || existingFloor.height,
          coordinates: JSON.stringify(cleanedCoordinates), 
        },
        create: {
          id: floor.properties.id,
          number: existingFloor.number,
          height: existingFloor.height,
          buildingId: existingFloor.buildingId,
          coordinates: JSON.stringify(cleanedCoordinates),
        },
      });
    }

    res.json({ success: true, message: "Szintek frissítve!" });
  } catch (error) {
    console.error("🚨 Hiba a szintek frissítésekor:", error);
    res.status(500).json({ error: "Nem sikerült frissíteni a szinteket." });
  }
});


// Backend - Keresési API
app.get("/api/search", async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ error: "A keresési lekérdezés szükséges." });
    }

    // Keresés épületekre
    const buildings = await prisma.building.findMany({
      where: {
        OR: [
          { name: { contains: query} },
          { shortName: { contains: query } }
        ]
      }
    });

    // Keresés termekre (és hozzákapcsoljuk a szintjüket is!)
    const rooms = await prisma.room.findMany({
      where: { name: { contains: query } },
      include: { floor: { include: { building: true } } },
    });

    res.json({ buildings, rooms });
  } catch (error) {
    console.error("🚨 Hiba a keresés során:", error);
    res.status(500).json({ error: "Hiba történt a keresés során." });
  }
});

// Új épület létrehozása
app.post("/api/createBuildings", async (req, res) => {
  try {
    const { name, shortName, group, coordinates } = req.body;

    if (!name || !coordinates) {
      return res.status(400).json({ error: "Név és koordináták szükségesek!" });
    }

    const newBuilding = await prisma.building.create({
      data: {
        name,
        shortName: shortName || null,
        group: group ? JSON.stringify(group) : null,
        coordinates: coordinates ? [JSON.stringify(coordinates)] : [],
      },
    });

    res.status(201).json({ success: true, message: "Épület sikeresen létrehozva!", building: newBuilding });
  } catch (error) {
    console.error("🚨 Hiba az épület létrehozásakor:", error);
    res.status(500).json({ error: "Nem sikerült létrehozni az épületet." });
  }
});

// Új emelet létrehozása
app.post("/api/createFloors", async (req, res) => {
  try {
    const { buildingId, number, height, coordinates } = req.body;

    if (!buildingId || number === undefined || height === undefined) {
      return res.status(400).json({ error: "Minden mező kitöltése kötelező!" });
    }

    const newFloor = await prisma.floor.create({
      data: {
        buildingId,
        number,
        height,
        coordinates: coordinates ? [JSON.stringify(coordinates)] : [],
      },
    });

    res.status(201).json({ success: true, message: "Emelet sikeresen létrehozva!", floor: newFloor });
  } catch (error) {
    console.error("🚨 Hiba az emelet létrehozásakor:", error);
    res.status(500).json({ error: "Nem sikerült létrehozni az emeletet." });
  }
});

// Új terem létrehozása
app.post("/api/createRooms", async (req, res) => {
  try {
    const { floorId, name, type, coordinates } = req.body;

    if (!floorId || !name || !type) {
      return res.status(400).json({ error: "Minden mező kitöltése kötelező!" });
    }

    const newRoom = await prisma.room.create({
      data: {
        floorId,
        name,
        type,
        coordinates: coordinates ? [JSON.stringify(coordinates)] : [],
      },
    });

    res.status(201).json({ success: true, message: "Terem sikeresen létrehozva!", room: newRoom });
  } catch (error) {
    console.error("🚨 Hiba a terem létrehozásakor:", error);
    res.status(500).json({ error: "Nem sikerült létrehozni a termet." });
  }
});

app.delete("/api/deleteBuilding/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Az épület ID megadása kötelező!" });
    }

    const buildingId = parseInt(id, 10);

    // Ellenőrizzük, hogy létezik-e az épület
    const building = await prisma.building.findUnique({
      where: { id: buildingId },
      include: { floors: { include: { rooms: true } } } // Betöltjük az emeleteket és szobákat is
    });

    if (!building) {
      return res.status(404).json({ error: "Az épület nem található!" });
    }

    // Törlés: Először szobákat, majd szinteket, végül az épületet töröljük
    for (const floor of building.floors) {
      await prisma.room.deleteMany({ where: { floorId: floor.id } }); // Szobák törlése
    }
    await prisma.floor.deleteMany({ where: { buildingId } }); // Szintek törlése
    await prisma.building.delete({ where: { id: buildingId } }); // Épület törlése

    res.status(200).json({ success: true, message: "Épület és összes emelete és terme törölve!" });
  } catch (error) {
    console.error("🚨 Hiba az épület törlésekor:", error);
    res.status(500).json({ error: "Nem sikerült törölni az épületet." });
  }
});

app.delete("/api/deleteFloor/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Az emelet ID megadása kötelező!" });
    }

    const floorId = parseInt(id, 10);

    // Ellenőrizzük, hogy létezik-e az emelet
    const floor = await prisma.floor.findUnique({
      where: { id: floorId },
      include: { rooms: true } // Betöltjük a szobákat is
    });

    if (!floor) {
      return res.status(404).json({ error: "Az emelet nem található!" });
    }

    // Törlés: Először szobákat, majd az emeletet töröljük
    await prisma.room.deleteMany({ where: { floorId } }); // Szobák törlése
    await prisma.floor.delete({ where: { id: floorId } }); // Emelet törlése

    res.status(200).json({ success: true, message: "Emelet és összes terme törölve!" });
  } catch (error) {
    console.error("🚨 Hiba az emelet törlésekor:", error);
    res.status(500).json({ error: "Nem sikerült törölni az emeletet." });
  }
});

app.delete("/api/deleteRoom/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "A szoba ID megadása kötelező!" });
    }

    const roomId = parseInt(id, 10);

    // Ellenőrizzük, hogy létezik-e a szoba
    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      return res.status(404).json({ error: "A szoba nem található!" });
    }

    // Szoba törlése
    await prisma.room.delete({ where: { id: roomId } });

    res.status(200).json({ success: true, message: "Szoba sikeresen törölve!" });
  } catch (error) {
    console.error("🚨 Hiba a szoba törlésekor:", error);
    res.status(500).json({ error: "Nem sikerült törölni a szobát." });
  }
});

// Szerver indítása
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Szerver fut a http://localhost:${PORT} címen`);
});
