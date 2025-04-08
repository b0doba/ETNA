// deleteAllEdges.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteAllEdges() {
  try {
    const deleted = await prisma.edge.deleteMany({});
    console.log(`🗑️ Törölt edge-ek száma: ${deleted.count}`);
  } catch (error) {
    console.error("❌ Hiba az edge-ek törlésekor:", error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllEdges();
