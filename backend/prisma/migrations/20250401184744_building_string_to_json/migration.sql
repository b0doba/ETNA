-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Building" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "coordinates" JSONB,
    "group" TEXT,
    "gather" TEXT
);
INSERT INTO "new_Building" ("coordinates", "gather", "group", "id", "name", "shortName") SELECT "coordinates", "gather", "group", "id", "name", "shortName" FROM "Building";
DROP TABLE "Building";
ALTER TABLE "new_Building" RENAME TO "Building";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
