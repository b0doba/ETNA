const express = require("express");
const {
  getRooms,
  updateRooms,
  createRooms,
  deleteRoom
} = require("../controllers/roomController");

const router = express.Router();

router.get("/rooms", getRooms);
router.post("/updateRooms", updateRooms);
router.post("/createRooms", createRooms);
router.delete("/deleteRoom/:id", deleteRoom);

module.exports = router;
