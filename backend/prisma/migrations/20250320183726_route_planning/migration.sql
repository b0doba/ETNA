-- CreateTable
CREATE TABLE "Path" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fromRoom" INTEGER NOT NULL,
    "toRoom" INTEGER NOT NULL,
    "waypoints" JSONB,
    CONSTRAINT "Path_fromRoom_fkey" FOREIGN KEY ("fromRoom") REFERENCES "Room" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Path_toRoom_fkey" FOREIGN KEY ("toRoom") REFERENCES "Room" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BuildingPath" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fromBuilding" INTEGER NOT NULL,
    "toBuilding" INTEGER NOT NULL,
    "waypoints" JSONB,
    CONSTRAINT "BuildingPath_fromBuilding_fkey" FOREIGN KEY ("fromBuilding") REFERENCES "Building" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BuildingPath_toBuilding_fkey" FOREIGN KEY ("toBuilding") REFERENCES "Building" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BuildingConnection" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fromBuilding" INTEGER NOT NULL,
    "toBuilding" INTEGER NOT NULL,
    "fromFloor" INTEGER NOT NULL,
    "toFloor" INTEGER NOT NULL,
    "waypoints" JSONB,
    CONSTRAINT "BuildingConnection_fromBuilding_fkey" FOREIGN KEY ("fromBuilding") REFERENCES "Building" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BuildingConnection_toBuilding_fkey" FOREIGN KEY ("toBuilding") REFERENCES "Building" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
