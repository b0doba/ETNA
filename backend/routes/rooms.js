const express = require("express");
const {
  getRooms,
  updateRooms,
  createRooms,
  deleteRoom,
  copyRoom
} = require("../controllers/roomController");

const router = express.Router();

router.get("/rooms", getRooms);
router.post("/updateRooms", updateRooms);
router.post("/createRooms", createRooms);
router.delete("/deleteRoom/:id", deleteRoom);
router.post("/rooms/:id/copy", copyRoom);

module.exports = router;
