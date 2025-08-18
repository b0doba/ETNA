/*
  Warnings:

  - You are about to drop the column `latitude` on the `Node` table. All the data in the column will be lost.
  - You are about to drop the column `longitude` on the `Node` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Node" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "floorId" INTEGER,
    "buildingId" INTEGER,
    "coordinates" JSONB,
    "iconUrl" TEXT,
    CONSTRAINT "Node_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Node_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Node" ("buildingId", "floorId", "iconUrl", "id", "name", "type") SELECT "buildingId", "floorId", "iconUrl", "id", "name", "type" FROM "Node";
DROP TABLE "Node";
ALTER TABLE "new_Node" RENAME TO "Node";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
