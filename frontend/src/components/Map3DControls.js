import React, { useState } from "react";
import "../App.css";

const Map3DControls = ({ onToggle3D }) => {
  const [is3DView, setIs3DView] = useState(false);

  const handleToggle = () => {
    const new3DState = !is3DView;
    setIs3DView(new3DState);
    onToggle3D?.(new3DState);

    const map = window._currentMapInstance;
    if (map) {
      map.setTilt(new3DState ? 45 : 0);
      map.setHeading(new3DState ? 45 : 0);
    }
  };

  return (
    <div className="map-3d-controls">
      <button className={`map-3d-btn ${is3DView ? "active" : ""}`} onClick={handleToggle}>
        {is3DView ? "3D (DEMO)" : "3D (DEMO)"}
      </button>

      {is3DView && (
        <>
          <button className="map-3d-btn" onClick={() => {
            const map = window._currentMapInstance;
            const heading = map?.getHeading?.() || 0;
            map?.setHeading(heading - 15);
          }}>⟲</button>

          <button className="map-3d-btn" onClick={() => {
            const map = window._currentMapInstance;
            const heading = map?.getHeading?.() || 0;
            map?.setHeading(heading + 15);
          }}>⟳</button>
        </>
      )}
    </div>
  );
};

export default Map3DControls;
