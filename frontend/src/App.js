import React from "react";
import { BrowserRouter as Router, Route, Routes} from "react-router-dom";
import Map from "./components/Map.js";
import Info from "./components/InfoPage.js";
import Admin from "./components/AdminMap.js";
import "./App.css";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/map" element={<Map />} />
        <Route path="/" element={<Map />} />
        <Route path="/info" element={<Info />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </Router>
  );
}

export default App;
