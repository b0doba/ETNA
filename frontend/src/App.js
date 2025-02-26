import React from "react";
import { BrowserRouter as Router, Route, Routes} from "react-router-dom";
import Map from "./components/Map.js"; // 🔹 Győződj meg róla, hogy a fájlnév pontosan stimmel
import Admin from "./components/AdminMap.js";
import "./App.css";

function App() {
  return (
    <Router>
      <Routes>
      <Route path="/map" element={<Map />} />
      <Route path="/" element={<Map />} />
      <Route path="/admin" element={<Admin />} />
      </Routes>
    </Router>
  );
}

export default App;
