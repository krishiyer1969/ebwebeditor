import React, { useRef, useState } from "react";

const GRID_SIZE = 100;
const ACTIVITY_SIZE = 50;
const SURFACE_PX = 2000;

const ACTIVITIES = [
  { type: "Start", emoji: "🟢" },
  { type: "Stop", emoji: "🔴" },
  { type: "Sequence", emoji: "🔗" },
  { type: "Recv", emoji: "📥" },
];

function ActivityComponent({ id, type, emoji, draggable = true, onDragStart }) {
  return (
    <div
      draggable={draggable}
      onDragStart={(e) => onDragStart?.(e, { id, type })}
      style={{
        width: ACTIVITY_SIZE,
        height: ACTIVITY_SIZE,
        cursor: "grab",
        userSelect: "none",
        border: "1px solid #777",
        borderRadius: 8,
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        background: "#fff",
        fontSize: 12,
      }}
      title={type}
    >
      <span aria-hidden="true">{emoji}</span>
      <span>{type}</span>
    </div>
  );
}

function Toolbox({ onDragStart }) {
  return (
    <aside
      style={{
        backgroundColor: "lightblue",
        padding: 12,
        borderRight: "1px solid #ccc",
        flexBasis: "15%",
        maxWidth: "15%",
        minWidth: "15%",
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      <h2 style={{ fontSize: 14, margin: "0 0 8px 0" }}>Toolbox</h2>
      <div style={{ display: "grid", gap: 8 }}>
        {ACTIVITIES.map((a) => (
          <ActivityComponent
            key={a.type}
            id={`palette-${a.type}`}
            type={a.type}
            emoji={a.emoji}
            onDragStart={(e) => onDragStart(e, { type: a.type, source: "palette" })}
          />
        ))}
      </div>
    </aside>
  );
}

function Canvas({ items, setItems, connections, setConnections }) {
  const viewportRef = useRef(null);
  const surfaceRef = useRef(null);
  const nextIdRef = useRef(1);

  const [pendingSourceId, setPendingSourceId] = useState(null);
  const [previewPoint, setPreviewPoint] = useState(null);

  const idToItem = React.useMemo(() => {
    const m = new Map();
    for (const it of items) m.set(it.id, it);
    return m;
  }, [items]);

  const getItemCenterPx = (it) => ({
    x: it.col * GRID_SIZE + GRID_SIZE / 2,
    y: it.row * GRID_SIZE + GRID_SIZE / 2,
  });

  const snapToCell = (clientX, clientY) => {
    const rect = surfaceRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (x < 0 || y < 0) return null;
    return { col: Math.floor(x / GRID_SIZE), row: Math.floor(y / GRID_SIZE) };
  };

  const onDrop = (e) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/json");
    if (!raw) return;
    let data; try { data = JSON.parse(raw); } catch { return; }

    const cell = snapToCell(e.clientX, e.clientY);
    if (!cell) return;

    if (data.source === "palette") {
      setItems((prev) => {
        const draft = [...prev];
        const existingIdx = draft.findIndex((it) => it.col === cell.col && it.row === cell.row);
        const newItem = { id: nextIdRef.current++, type: data.type, col: cell.col, row: cell.row };
        if (existingIdx !== -1) {
          const existingId = draft[existingIdx].id;
          setConnections((conns) => conns.filter((c) => c.fromId !== existingId && c.toId !== existingId));
          draft[existingIdx] = newItem;
          return draft;
        }
        return [...draft, newItem];
      });
    } else if (data.source === "canvas") {
      setItems((prev) => {
        const draft = [...prev];
        const movingIdx = draft.findIndex((it) => it.id === data.id);
        if (movingIdx === -1) return prev;

        const existingIdx = draft.findIndex((it) => it.col === cell.col && it.row === cell.row);
        if (existingIdx !== -1 && draft[existingIdx].id !== data.id) {
          const removedId = draft[existingIdx].id;
          draft.splice(existingIdx, 1);
          const adjustedMovingIdx = movingIdx > existingIdx ? movingIdx - 1 : movingIdx;
          draft[adjustedMovingIdx] = { ...draft[adjustedMovingIdx], col: cell.col, row: cell.row };
          setConnections((conns) => conns.filter((c) => c.fromId !== removedId && c.toId !== removedId));
          return draft;
        }
        draft[movingIdx] = { ...draft[movingIdx], col: cell.col, row: cell.row };
        return draft;
      });
    }
  };

  const onStartHandleClick = (e, id) => {
    e.stopPropagation();
    setPendingSourceId(id);
    setPreviewPoint(null);
  };

  const onActivityClickAsTarget = (e, id) => {
    if (!pendingSourceId) return;
    if (id === pendingSourceId) {
      setPendingSourceId(null);
      setPreviewPoint(null);
      return;
    }
    setConnections((prev) => {
      const withoutExisting = prev.filter((c) => c.fromId !== pendingSourceId);
      return [...withoutExisting, { fromId: pendingSourceId, toId: id }];
    });
    setPendingSourceId(null);
    setPreviewPoint(null);
  };

  return (
    <div
      ref={viewportRef}
      style={{ position: "relative", overflow: "auto", height: "100%", boxSizing: "border-box", flex: 1 }}
    >
      <section
        ref={surfaceRef}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onMouseMove={(e) => {
          if (!pendingSourceId || !surfaceRef.current) return;
          const rect = surfaceRef.current.getBoundingClientRect();
          const x = Math.max(0, Math.min(SURFACE_PX, e.clientX - rect.left));
          const y = Math.max(0, Math.min(SURFACE_PX, e.clientY - rect.top));
          setPreviewPoint({ x, y });
        }}
        onMouseLeave={() => { if (pendingSourceId) setPreviewPoint(null); }}
        style={{
          width: SURFACE_PX,
          height: SURFACE_PX,
          backgroundColor: "lightgray",
          backgroundImage: `linear-gradient(to right, black 1px, transparent 1px), linear-gradient(to bottom, black 1px, transparent 1px)`,
          backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
          position: "relative",
        }}
      >
        <svg width={SURFACE_PX} height={SURFACE_PX} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <defs>
            <marker id="startDot" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
              <circle cx="3" cy="3" r="2" fill="blue" />
            </marker>
            <marker id="arrowHead" markerWidth="10" markerHeight="10" refX="10" refY="5" orient="auto">
              <path d="M0,0 L10,5 L0,10 Z" fill="blue" />
            </marker>
          </defs>

          {pendingSourceId && previewPoint && (() => {
            const from = idToItem.get(pendingSourceId);
            if (!from) return null;
            const a = getItemCenterPx(from);
            const b = previewPoint;
            return (
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="blue" strokeWidth={2} strokeDasharray="6,4" markerStart="url(#startDot)" markerEnd="url(#arrowHead)" />
            );
          })()}

          {connections.map((c, idx) => {
            const from = idToItem.get(c.fromId);
            const to = idToItem.get(c.toId);
            if (!from || !to) return null;
            const a = getItemCenterPx(from);
            const b = getItemCenterPx(to);
            return (
              <line key={idx} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="blue" strokeWidth={2} markerStart="url(#startDot)" markerEnd="url(#arrowHead)" />
            );
          })}
        </svg>

        {items.map((it) => {
          const meta = ACTIVITIES.find((a) => a.type === it.type) || { emoji: "❓" };
          const left = it.col * GRID_SIZE + (GRID_SIZE - ACTIVITY_SIZE) / 2;
          const top = it.row * GRID_SIZE + (GRID_SIZE - ACTIVITY_SIZE) / 2;
          const isArmed = pendingSourceId === it.id;

          return (
            <div key={it.id} style={{ position: "absolute", left, top }}>
              <div
                onClick={(e) => onActivityClickAsTarget(e, it.id)}
                style={{ position: "relative", cursor: pendingSourceId ? "copy" : "default" }}
              >
                <ActivityComponent id={it.id} type={it.type} emoji={meta.emoji} onDragStart={(e) => e.dataTransfer.setData("application/json", JSON.stringify({ source: "canvas", id: it.id, type: it.type }))} />
                <div
                  onClick={(e) => onStartHandleClick(e, it.id)}
                  style={{
                    position: "absolute",
                    top: ACTIVITY_SIZE / 2 - 6,
                    right: -8,
                    width: 12,
                    height: 12,
                    borderRadius: 12,
                    background: isArmed ? "#1f2937" : "#000",
                    border: "1px solid #fff",
                    cursor: isArmed ? "grabbing" : "crosshair",
                  }}
                />
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

export default function EBWebEditor() {
  const [items, setItems] = useState([]);
  const [connections, setConnections] = useState([]);

  return (
    <div style={{ width: 1000, height: 700, border: "1px solid #000", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <Toolbox onDragStart={(e, data) => { e.dataTransfer.setData("application/json", JSON.stringify(data)); e.dataTransfer.effectAllowed = "copy"; }} />
        <Canvas items={items} setItems={setItems} connections={connections} setConnections={setConnections} />
      </div>
    </div>
  );
}
