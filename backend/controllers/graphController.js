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
    const { name, type, floorId, buildingId, coordinates, iconUrl } = req.body;

    if (!name || !type || !coordinates) {
      return res.status(400).json({ error: "Hiányzó adatok!" });
    }

    const newNode = await prisma.node.create({
      data: {
        name,
        type,
        floorId,
        buildingId,
        coordinates: coordinates ? JSON.stringify(coordinates) : [],
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


function calculateDistance(coord1, coord2) {
  const R = 6371e3;
  const toRad = deg => (deg * Math.PI) / 180;
  const φ1 = toRad(coord1[1]), φ2 = toRad(coord2[1]);
  const Δφ = toRad(coord2[1] - coord1[1]);
  const Δλ = toRad(coord2[0] - coord1[0]);

  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 🔹 Új él létrehozása
async function createEdge(req, res) {
  try {
    const { fromNodeId, toNodeId, type, iconUrl } = req.body;

    if (!fromNodeId || !toNodeId || !type) {
      return res.status(400).json({ error: "Hiányzó adatok!" });
    }

    const fromNode = await prisma.node.findUnique({ where: { id: fromNodeId } });
    const toNode = await prisma.node.findUnique({ where: { id: toNodeId } });

    if (!fromNode || !toNode) {
      return res.status(404).json({ error: "Nem található az egyik node." });
    }

    const coord1 = JSON.parse(fromNode.coordinates)[0];
    const coord2 = JSON.parse(toNode.coordinates)[0];
    const distance = calculateDistance(coord1, coord2);

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
