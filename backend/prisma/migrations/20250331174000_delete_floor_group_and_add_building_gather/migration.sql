/*
  Warnings:

  - You are about to drop the column `group` on the `Floor` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Building" ADD COLUMN "gather" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Floor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "buildingId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "height" REAL NOT NULL,
    "coordinates" JSONB,
    CONSTRAINT "Floor_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Floor" ("buildingId", "coordinates", "height", "id", "number") SELECT "buildingId", "coordinates", "height", "id", "number" FROM "Floor";
DROP TABLE "Floor";
ALTER TABLE "new_Floor" RENAME TO "Floor";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
