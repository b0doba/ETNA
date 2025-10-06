import React, { useState, useMemo } from "react";
import "../AdminLook.css";

const AdminObjectFilter = ({ floors, applyFilter, resetFilter }) => {
  const [selectedCategory, setSelectedCategory] = useState("outdoor"); // "outdoor" | "indoor" | "all"
  const [selectedFloorNumber, setSelectedFloorNumber] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  const floorNumbers = useMemo(() => {
    return [...new Set((floors ?? []).map(f => f.number))].sort((a, b) => a - b);
  }, [floors]);

  const handleApplyFilter = () => {
    const filterData = { category: selectedCategory };
    if (selectedCategory === "indoor" && selectedFloorNumber !== null) {
      filterData.floorNumber = selectedFloorNumber;
    }
    applyFilter(filterData);
    setIsOpen(false);
  };

  return (
    <div>
      <button className="filter-button" onClick={() => setIsOpen(!isOpen)}>
        Szűrő
      </button>

      {isOpen && (
        <div className="filter-container">
          <label className="filter-container-lowtitle">Kategória:</label>
          <select
            value={selectedCategory}
            onChange={(e) => {
              const v = e.target.value;
              setSelectedCategory(v);
              setSelectedFloorNumber(null);
            }}
          >
            <option value="">Válassz</option>
            <option value="outdoor">Kültér</option>
            <option value="indoor">Beltér</option>
            <option value="all">Minden</option>
          </select>

          {selectedCategory === "indoor" && (
            <>
              <label className="filter-container-lowtitle">Emelet szám:</label>
              <select
                value={selectedFloorNumber ?? ""}
                onChange={(e) =>
                  setSelectedFloorNumber(e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">Válassz emelet számot</option>
                {floorNumbers.map((number) => (
                  <option key={number} value={number}>
                    {number}. emelet
                  </option>
                ))}
              </select>
            </>
          )}

          <button className="filter-apply-btn" onClick={handleApplyFilter}>
            Alkalmazás
          </button>
          <button className="filter-close-btn" onClick={() => setIsOpen(false)}>
            Mégse
          </button>
          <button
            className="filter-reset-btn"
            onClick={() => {
              resetFilter();
              setSelectedCategory("outdoor");
              setSelectedFloorNumber(null);
            }}
          >
            Szűrés visszaállítása
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminObjectFilter;
