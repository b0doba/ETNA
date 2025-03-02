import React, { useState } from "react";
import searchIcon from "../assets/icons/arrow.svg";
import routeIcon from "../assets/icons/pitch.svg";
import "../App.css";

const SearchPanel = ({ onSearch, onRouteSearch, onGroupSelect  }) => {
  const [showRouteInputs, setShowRouteInputs] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [startPoint, setStartPoint] = useState("");
  const [destination, setDestination] = useState("");

  
  const handleSearch = () => {
    onSearch(searchQuery);
  };
  
  // Keresési funkció az útvonalhoz
  const handleRouteSearch = () => {
    if (startPoint && destination) {
      console.log("Útvonaltervezés innen:", startPoint, "ide:", destination);
      // Itt lehet majd API hívást csinálni vagy útvonalat megjeleníteni
    } else {
      alert("Kérlek add meg mindkét helyet az útvonaltervezéshez!");
    }
  };



  return (
    <>
    {/* Kategória gombok az oldal tetején */}
    <div className="category-buttons">
        <button className="category-btn" onClick={() => onGroupSelect("Kollégiumok")}>Kollégiumok</button>
        <button className="category-btn" onClick={() => onGroupSelect("Sportcsarnokok")}>Sportcsarnokok</button>
        <button className="category-btn" onClick={() => onGroupSelect("Parkolók")}>Parkolók</button>
        <button className="category-btn">Rendezvények</button>
      </div>
      {/* Keresőpanel */}
    <div className="search-panel">
      {!showRouteInputs ? (
        <div className="search-bar">
          <input
            type="text"
            placeholder="Keresés..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button className="search-btn" onClick={handleSearch}>
            <img src={searchIcon} alt="Keresés" />
          </button>
          <button className="route-btn" onClick={() => setShowRouteInputs(true)}>
            <img src={routeIcon} alt="Útvonaltervezés" />
          </button>
        </div>
      ) : (
        <div className="route-inputs">
          <input
            type="text"
            placeholder="Kiindulópont"
            value={startPoint}
            onChange={(e) => setStartPoint(e.target.value)}
          />
          <input
            type="text"
            placeholder="Úticél"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          />
          <button className="route-btn search-route-btn" onClick={handleRouteSearch}>
            Útvonaltervezés
          </button>
          <button className="route-btn" onClick={() => setShowRouteInputs(false)}>Vissza</button>
        </div>
      )}
      <p className="description">Írd le hova szeretnél menni!</p>
    </div>
    </>
  );
};

export default SearchPanel;
