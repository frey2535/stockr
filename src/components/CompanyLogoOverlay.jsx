import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { GripHorizontal } from "lucide-react";

export default function CompanyLogoOverlay({ pageKey }) {
  const { data: settingsList = [] } = useQuery({
    queryKey: ["appSettings"],
    queryFn: () => base44.entities.AppSettings.list(),
    staleTime: 60000,
  });

  const settings = settingsList[0] || {};
  const logoUrl = settings.logo_url;
  const companyName = settings.company_name;

  const storageKey = `companyLogoPos_${pageKey}`;

  const [pos, setPos] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : { x: 16, y: 16 };
    } catch {
      return { x: 16, y: 16 };
    }
  });

  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  const onMouseDown = (e) => {
    dragging.current = true;
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.preventDefault();
  };

  const onTouchStart = (e) => {
    const touch = e.touches[0];
    dragging.current = true;
    offset.current = { x: touch.clientX - pos.x, y: touch.clientY - pos.y };
  };

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!dragging.current) return;
      setPos({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y });
    };
    const onTouchMove = (e) => {
      if (!dragging.current) return;
      const touch = e.touches[0];
      setPos({ x: touch.clientX - offset.current.x, y: touch.clientY - offset.current.y });
    };
    const stopDrag = () => {
      if (dragging.current) {
        dragging.current = false;
        setPos(p => {
          localStorage.setItem(storageKey, JSON.stringify(p));
          return p;
        });
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", stopDrag);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", stopDrag);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", stopDrag);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", stopDrag);
    };
  }, [storageKey]);

  if (!logoUrl) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: pos.x,
        top: pos.y,
        zIndex: 20,
        cursor: "grab",
        userSelect: "none",
        touchAction: "none",
      }}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
    >
      <div
        style={{
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(8px)",
          borderRadius: 12,
          boxShadow: "0 4px 20px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)",
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          border: "1px solid rgba(0,0,0,0.08)",
          minWidth: 80,
          maxWidth: 240,
        }}
      >
        <GripHorizontal style={{ width: 14, height: 14, color: "#bbb", flexShrink: 0 }} />
        <img
          src={logoUrl}
          alt={companyName || "Company Logo"}
          style={{ height: 36, width: "auto", maxWidth: 160, objectFit: "contain" }}
          draggable={false}
        />
        {companyName && (
          <span style={{ fontSize: 12, fontWeight: 600, color: "#333", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 100 }}>
            {companyName}
          </span>
        )}
      </div>
    </div>
  );
}