const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// 🔹 Összes csomópont lekérése
async function getNodes(req, res) {
  try {
    const nodes = await prisma.node.findMany();
    res.json(nodes);
  } catch (error) {
    console.error("🚨 Hiba a csomópontok lekérdezésekor:", error);
    res.status(500).json({ error: "Hiba történt a csomópontok lekérdezésekor." });
  }
}

// 🔹 Új csomópont létrehozása
async function createNode(req, res) {
  try {
    const { name, type, floorId, buildingId, latitude, longitude, iconUrl } = req.body;

    if (!name || !type || !latitude || !longitude) {
      return res.status(400).json({ error: "Hiányzó adatok!" });
    }

    let parsedCoordinates;
    try {
      parsedCoordinates = JSON.parse(coordinates);
      if (!Array.isArray(parsedCoordinates) || !Array.isArray(parsedCoordinates[0])) {
        throw new Error("Hibás koordináta formátum!");
      }
    } catch (error) {
      return res.status(400).json({ error: "A koordináták nem érvényes JSON formátumban vannak!" });
    }

    const newNode = await prisma.node.create({
      data: {
        name,
        type,
        floorId,
        buildingId,
        coordinates: JSON.stringify(parsedCoordinates),
        iconUrl,
      },
    });

    res.status(201).json({ success: true, node: newNode });
  } catch (error) {
    console.error("🚨 Hiba a csomópont létrehozásakor:", error);
    res.status(500).json({ error: "Nem sikerült létrehozni a csomópontot." });
  }
}

async function deleteNode(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Node ID megadása szükséges!" });
    }

    // 🔥 Először töröljük az éleket, amelyek erre a Node-ra hivatkoznak
    await prisma.edge.deleteMany({
      where: {
        OR: [{ fromNodeId: Number(id) }, { toNodeId: Number(id) }],
      },
    });

    // 🔥 Majd töröljük magát a csomópontot
    const deletedNode = await prisma.node.delete({
      where: { id: Number(id) },
    });

    res.json({ success: true, message: "Node törölve!", node: deletedNode });
  } catch (error) {
    console.error("🚨 Hiba a csomópont törlésekor:", error);
    res.status(500).json({ error: "Nem sikerült törölni a csomópontot." });
  }
}

// 🔹 Összes él lekérése
async function getEdges(req, res) {
  try {
    const edges = await prisma.edge.findMany();
    res.json(edges);
  } catch (error) {
    console.error("🚨 Hiba az élek lekérdezésekor:", error);
    res.status(500).json({ error: "Hiba történt az élek lekérdezésekor." });
  }
}

// 🔹 Új él létrehozása
async function createEdge(req, res) {
  try {
    const { fromNodeId, toNodeId, distance, type, iconUrl } = req.body;

    if (!fromNodeId || !toNodeId || !distance || !type) {
      return res.status(400).json({ error: "Hiányzó adatok!" });
    }

    const newEdge = await prisma.edge.create({
      data: {
        fromNodeId,
        toNodeId,
        distance,
        type,
        iconUrl,
      },
    });

    res.status(201).json({ success: true, edge: newEdge });
  } catch (error) {
    console.error("🚨 Hiba az él létrehozásakor:", error);
    res.status(500).json({ error: "Nem sikerült létrehozni az élt." });
  }
}

module.exports = { getNodes, createNode, deleteNode, getEdges, createEdge };
