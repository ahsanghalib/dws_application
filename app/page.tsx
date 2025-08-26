"use client";

import type React from "react";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Box {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  text: string;
  fontSize: number;
}

const generateUniqueColors = (count: number): string[] => {
  const colors: string[] = [];
  const goldenAngle = 137.508; // Golden angle in degrees

  for (let i = 0; i < count; i++) {
    const hue = (i * goldenAngle) % 360;
    const saturation = 65 + (i % 3) * 10; // 65%, 75%, 85%
    const lightness = 25 + (i % 4) * 5; // 50%, 55%, 60%, 65%
    colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
  }

  return colors;
};
const GRID_SIZE = 60 / 3;
const UNIQUE_COLORS = generateUniqueColors(101);
const SNAP_DISTANCE = 20;
const DEFAULT_BOX_SIZE = 60;
const MAX_BOXES = 101;
const STORAGE_KEY = "dws_app";

const getNextBoxPosition = (existingBoxes: Box[]): { x: number; y: number } => {
  if (existingBoxes.length === 0) {
    return { x: 200, y: 200 };
  }

  const lastBox = existingBoxes[existingBoxes.length - 1];

  return {
    x: lastBox.x + lastBox.size,
    y: lastBox.y,
  };
};

const DragDropBoxes = () => {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [selectedBox, setSelectedBox] = useState<number | null>(null);
  const [newBoxSize, setNewBoxSize] = useState(DEFAULT_BOX_SIZE);
  const [newFontSize, setNewFontSize] = useState(14);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [editingBox, setEditingBox] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [zoom, setZoom] = useState(1);
  const [hoveredBox, setHoveredBox] = useState<number | null>(null);
  const [touchStartTime, setTouchStartTime] = useState(0);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(
    null,
  );
  const [lastTouchDistance, setLastTouchDistance] = useState(0);
  const [isPinching, setIsPinching] = useState(false);
  const [editingListItem, setEditingListItem] = useState<number | null>(null);
  const [listEditText, setListEditText] = useState("");
  const [windowWidth, setWindowWidth] = useState(1024); // Default to desktop size
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanningGrid, setIsPanningGrid] = useState(false);
  const [gridPan, setGridPan] = useState({ x: 0, y: 0 });
  const [panStartPos, setPanStartPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const updateWindowWidth = () => {
      setWindowWidth(window.innerWidth);
    };

    // Set initial width
    updateWindowWidth();

    // Add resize listener
    window.addEventListener("resize", updateWindowWidth);

    return () => window.removeEventListener("resize", updateWindowWidth);
  }, []);

  const saveData = useCallback(
    async (
      boxesToSave: Box[],
      zoomToSave: number,
      themeToSave: boolean,
      gridPanning: { x: number; y: number },
      toEdge: boolean,
    ) => {
      const data = {
        boxes: boxesToSave,
        zoom: zoomToSave,
        theme: themeToSave,
        panning: gridPanning,
        timestamp: Date.now(),
      };

      // Save to localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        console.log("[v0] Saved to localStorage:", {
          boxes: boxesToSave.length,
          panning: gridPanning,
          zoom: zoomToSave,
          theme: themeToSave,
        });
      } catch (error) {
        console.error("[v0] Failed to save to localStorage:", error);
      }

      if (toEdge) {
        //  Saving to Edge Config
        try {
          const response = await fetch("/api/boxes", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
          });

          const result = await response.json();
          if (result.success) {
            console.log("[v0] Saved to Edge Config:", result.timestamp);
          } else {
            console.error("[v0] Failed to save to Edge Config:", result.error);
          }
        } catch (error) {
          console.error("[v0] Edge Config save error:", error);
        }
      }
    },
    [],
  );

  const loadData = useCallback(async () => {
    // Try Edge Config first
    try {
      const response = await fetch("/api/boxes");
      const result = await response.json();
      console.log("result", result);

      if (result.success && result.data.boxes && result.data.boxes.length > 0) {
        console.log("[v0] Loaded from Edge Config:", {
          boxes: result.data.boxes.length,
          zoom: result.data.zoom,
          panning: result.data.gridPanning,
          source: result.source,
        });
        return result.data;
      }
    } catch (error) {
      console.error("[v0] Failed to load from Edge Config:", error);
    }

    // fallback to localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        console.log("[v0] Loaded from localStorage:", {
          boxes: data.boxes?.length || 0,
          panning: data.gridPanning,
          zoom: data.zoom || 1,
          theme: data.theme || false,
        });
        return {
          boxes: data.boxes || [],
          panning: data.gridPanning,
          zoom: data.zoom || 1,
          theme: data.theme || false,
        };
      }
    } catch (error) {
      console.error("[v0] Failed to load from localStorage:", error);
    }
    return { boxes: [], zoom: 1, theme: false, panning: { x: 0, y: 0 } };
  }, []);

  useEffect(() => {
    const loadInitialData = async () => {
      const data = await loadData();
      console.log(data.panning);
      setBoxes(data.boxes);
      setZoom(data.zoom);
      setGridPan(data.panning || { x: 0, y: 0 });
    };

    loadInitialData();
  }, []);

  useEffect(() => {
    saveData(boxes, zoom, isDarkTheme, gridPan, false);
  }, [boxes, zoom, isDarkTheme, gridPan]);

  // useEffect(() => {
  //   const savedPan = localStorage.getItem(PAN_STORAGE_KEY);
  //   if (savedPan) {
  //     try {
  //       const parsedPan = JSON.parse(savedPan);
  //       setGridPan(parsedPan);
  //     } catch (error) {
  //       console.error("Failed to load pan from localStorage:", error);
  //     }
  //   }
  // }, []);

  // useEffect(() => {
  //   localStorage.setItem(PAN_STORAGE_KEY, JSON.stringify(gridPan));
  // }, [gridPan]);

  const handleGridMouseDown = (e: React.MouseEvent) => {
    console.log(
      "[v0] Grid mouse down - button:",
      e.button,
      "shiftKey:",
      e.shiftKey,
    );
    if (e.button === 1 || e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      setIsPanningGrid(true);
      setPanStartPos({
        x: e.clientX - gridPan.x,
        y: e.clientY - gridPan.y,
      });
      console.log("[v0] Started panning grid");
    }
  };

  const snapToGrid = (value: number) => {
    return Math.round(value / SNAP_DISTANCE) * SNAP_DISTANCE;
  };

  const checkCollision = (
    box: Box,
    newX: number,
    newY: number,
    excludeId?: number,
  ) => {
    return boxes.some((otherBox) => {
      if (otherBox.id === box.id || otherBox.id === excludeId) return false;

      const boxRight = newX + box.size;
      const boxBottom = newY + box.size;
      const otherRight = otherBox.x + otherBox.size;
      const otherBottom = otherBox.y + otherBox.size;

      return !(
        boxRight <= otherBox.x ||
        newX >= otherRight ||
        boxBottom <= otherBox.y ||
        newY >= otherBottom
      );
    });
  };

  const addBox = useCallback(() => {
    if (boxes.length >= MAX_BOXES) return;

    const usedColors = new Set(boxes.map((box) => box.color));
    const availableColors = UNIQUE_COLORS.filter(
      (color) => !usedColors.has(color),
    );
    const selectedColor =
      availableColors.length > 0
        ? availableColors[0]
        : UNIQUE_COLORS[boxes.length % UNIQUE_COLORS.length];

    const position = getNextBoxPosition(boxes);

    const newBox: Box = {
      id: Date.now(),
      x: position.x,
      y: position.y,
      size: newBoxSize,
      color: selectedColor,
      text: `Box ${boxes.length + 1}`,
      fontSize: newFontSize,
    };

    const newBoxes = [...boxes, newBox];
    setBoxes(newBoxes);
    saveData(newBoxes, zoom, isDarkTheme, gridPan, false);
  }, [boxes, newBoxSize, newFontSize, zoom, gridPan, isDarkTheme]);

  const deleteBox = (boxId: number) => {
    setBoxes((prev) => prev.filter((box) => box.id !== boxId));
    if (selectedBox === boxId) {
      setSelectedBox(null);
    }
    if (editingBox === boxId) {
      setEditingBox(null);
      setEditText("");
    }
    if (editingListItem === boxId) {
      setEditingListItem(null);
      setListEditText("");
    }
  };

  const handleMouseDown = (e: React.MouseEvent, boxId: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (!containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const box = boxes.find((b) => b.id === boxId);
    if (!box) return;

    const mouseX = (e.clientX - containerRect.left) / zoom;
    const mouseY = (e.clientY - containerRect.top) / zoom;

    setSelectedBox(boxId);
    setIsDragging(true);
    setDragOffset({
      x: mouseX - box.x,
      y: mouseY - box.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanningGrid) {
      const newPan = {
        x: e.clientX - panStartPos.x,
        y: e.clientY - panStartPos.y,
      };
      console.log("[v0] Panning grid to:", newPan);
      setGridPan(newPan);
      return;
    }

    if (!isDragging || !selectedBox || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const box = boxes.find((b) => b.id === selectedBox);
    if (!box) return;

    const mouseX = (e.clientX - containerRect.left) / zoom;
    const mouseY = (e.clientY - containerRect.top) / zoom;

    const newX = snapToGrid(mouseX - dragOffset.x);
    const newY = snapToGrid(mouseY - dragOffset.y);

    const boundedX = Math.max(
      0,
      Math.min(containerRect.width / zoom - box.size, newX),
    );
    const boundedY = Math.max(
      0,
      Math.min(containerRect.height / zoom - box.size, newY),
    );

    if (!checkCollision(box, boundedX, boundedY, selectedBox)) {
      setBoxes((prev) =>
        prev.map((b) =>
          b.id === selectedBox ? { ...b, x: boundedX, y: boundedY } : b,
        ),
      );
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
    setIsPanningGrid(false); // <-- Grid panning stop
  };

  const handleContainerClick = (_: React.MouseEvent) => {
    if (isDragging) return;
    setSelectedBox(null);
    setEditingBox(null);
  };

  const handleDoubleClick = (e: React.MouseEvent, boxId: number) => {
    e.stopPropagation();
    const box = boxes.find((b) => b.id === boxId);
    if (box) {
      setEditingBox(boxId);
      setEditText(box.text);
    }
  };

  const handleTextSubmit = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && editingBox) {
      setBoxes((prev) =>
        prev.map((box) =>
          box.id === editingBox ? { ...box, text: editText } : box,
        ),
      );
      setEditingBox(null);
      setEditText("");
    } else if (e.key === "Escape") {
      setEditingBox(null);
      setEditText("");
    }
  };

  const clearBoxes = () => {
    setBoxes([]);
    setSelectedBox(null);
    setEditingBox(null);
    setEditingListItem(null);
    setListEditText("");
    localStorage.removeItem(STORAGE_KEY);
    console.log("[v0] Cleared all boxes and localStorage");
  };

  const getTouchDistance = (touches: React.TouchList) => {
    const touch1 = touches[0];
    const touch2 = touches[1];
    return Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2),
    );
  };

  const handleTouchStart = (e: React.TouchEvent, boxId: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.touches.length > 1) return;

    if (!containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const box = boxes.find((b) => b.id === boxId);
    if (!box) return;

    const touch = e.touches[0];
    const touchX = (touch.clientX - containerRect.left) / zoom;
    const touchY = (touch.clientY - containerRect.top) / zoom;

    setSelectedBox(boxId);
    setTouchStartTime(Date.now());

    const timer = setTimeout(() => {
      setHoveredBox(boxId);
    }, 500); // 500ms long press
    setLongPressTimer(timer);

    setDragOffset({
      x: touchX - box.x,
      y: touchY - box.y,
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();

    if (e.touches.length === 2) {
      setIsPinching(true);
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        setLongPressTimer(null);
      }

      const distance = getTouchDistance(e.touches);
      if (lastTouchDistance > 0) {
        const scale = distance / lastTouchDistance;
        const zoomDelta = (scale - 1) * 0.5;
        setZoom((prevZoom) => Math.max(0.5, Math.min(2, prevZoom + zoomDelta)));
      }
      setLastTouchDistance(distance);
      return;
    }

    if (!selectedBox || !containerRef.current || e.touches.length !== 1) return;

    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const box = boxes.find((b) => b.id === selectedBox);
    if (!box) return;

    const touch = e.touches[0];
    const touchX = (touch.clientX - containerRect.left) / zoom;
    const touchY = (touch.clientY - containerRect.top) / zoom;

    if (!isDragging) {
      const moveDistance = Math.sqrt(
        Math.pow(touchX - (box.x + dragOffset.x), 2) +
          Math.pow(touchY - (box.y + dragOffset.y), 2),
      );
      if (moveDistance > 10) {
        setIsDragging(true);
      } else {
        return;
      }
    }

    const newX = snapToGrid(touchX - dragOffset.x);
    const newY = snapToGrid(touchY - dragOffset.y);

    const boundedX = Math.max(
      0,
      Math.min(containerRect.width / zoom - box.size, newX),
    );
    const boundedY = Math.max(
      0,
      Math.min(containerRect.height / zoom - box.size, newY),
    );

    if (!checkCollision(box, boundedX, boundedY, selectedBox)) {
      setBoxes((prev) =>
        prev.map((b) =>
          b.id === selectedBox ? { ...b, x: boundedX, y: boundedY } : b,
        ),
      );
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();

    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }

    if (isPinching) {
      setIsPinching(false);
      setLastTouchDistance(0);
      return;
    }

    if (!isDragging && selectedBox) {
      const touchDuration = Date.now() - touchStartTime;
      if (touchDuration < 300) {
        const box = boxes.find((b) => b.id === selectedBox);
        if (box) {
          setEditingBox(selectedBox);
          setEditText(box.text);
        }
      }
    }

    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
    setHoveredBox(null);
  };

  const handleContainerTouch = (e: React.TouchEvent) => {
    if (isDragging || isPinching) return;
    if (e.touches.length === 1) {
      setSelectedBox(null);
      setEditingBox(null);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((prevZoom) => Math.max(0.5, Math.min(2, prevZoom + zoomDelta)));
    }
  };

  const handleListTextEdit = (boxId: number, newText: string) => {
    setBoxes((prev) =>
      prev.map((box) => (box.id === boxId ? { ...box, text: newText } : box)),
    );
    setEditingListItem(null);
    setListEditText("");
  };

  const startListEdit = (boxId: number, currentText: string) => {
    setEditingListItem(boxId);
    setListEditText(currentText);
  };

  const focusBox = (boxId: number) => {
    setSelectedBox(boxId);
    if (boxId && containerRef.current) {
      const boxElement = containerRef.current.querySelector(
        `[data-box-id="${boxId}"]`,
      );
      if (boxElement) {
        boxElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  };

  const toggleTheme = () => {
    setIsDarkTheme(!isDarkTheme);
  };

  return (
    <div
      className={`min-h-screen p-2 sm:p-4 lg:p-6 transition-colors duration-300 ${
        isDarkTheme ? "bg-gray-900 text-white" : "bg-background text-foreground"
      }`}
    >
      <div className="max-w-7xl mx-auto">
        <div className="mb-3 sm:mb-4 lg:mb-6">
          <div className="flex items-center justify-between mb-2 sm:mb-3 lg:mb-4">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">
              DWS Alliance Layout
            </h1>
            <Button
              onClick={toggleTheme}
              variant="outline"
              size="sm"
              className={`h-8 sm:h-9 px-3 transition-colors ${
                isDarkTheme
                  ? "bg-gray-800 border-gray-600 hover:bg-gray-700 text-white disabled:bg-gray-700 disabled:text-gray-500"
                  : "bg-background border-border hover:bg-muted"
              }`}
            >
              {isDarkTheme ? "☀️" : "🌙"}
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4 mb-3 sm:mb-4 lg:mb-6">
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="boxSize"
                className={`text-xs sm:text-sm font-medium ${isDarkTheme ? "text-gray-200" : ""}`}
              >
                Box Size (px)
              </Label>
              <Input
                id="boxSize"
                type="number"
                value={newBoxSize}
                onChange={(e) =>
                  setNewBoxSize(
                    Math.max(
                      20,
                      Math.min(
                        200,
                        Number.parseInt(e.target.value) || DEFAULT_BOX_SIZE,
                      ),
                    ),
                  )
                }
                className={`h-9 sm:h-10 text-sm sm:text-base ${
                  isDarkTheme
                    ? "bg-gray-800 border-gray-600 text-white placeholder-gray-400"
                    : ""
                }`}
                min="20"
                max="200"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="fontSize"
                className={`text-xs sm:text-sm font-medium ${isDarkTheme ? "text-gray-200" : ""}`}
              >
                Font Size (px)
              </Label>
              <Input
                id="fontSize"
                type="number"
                value={newFontSize}
                onChange={(e) =>
                  setNewFontSize(
                    Math.max(
                      8,
                      Math.min(48, Number.parseInt(e.target.value) || 14),
                    ),
                  )
                }
                className={`h-9 sm:h-10 text-sm sm:text-base ${
                  isDarkTheme
                    ? "bg-gray-800 border-gray-600 text-white placeholder-gray-400"
                    : ""
                }`}
                min="8"
                max="48"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-1 flex flex-col gap-1.5">
              <Label
                className={`text-xs sm:text-sm font-medium ${isDarkTheme ? "text-gray-200" : ""}`}
              >
                Actions
              </Label>
              <Button
                onClick={addBox}
                disabled={boxes.length >= MAX_BOXES}
                className={`h-9 sm:h-10 text-xs sm:text-sm font-medium px-3 sm:px-4 ${
                  isDarkTheme
                    ? "bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-700 disabled:text-gray-400"
                    : ""
                }`}
              >
                <span className="sm:hidden">
                  Add ({boxes.length}/{MAX_BOXES})
                </span>
                <span className="hidden sm:inline lg:hidden">
                  Add Box ({boxes.length}/{MAX_BOXES})
                </span>
                <span className="hidden lg:inline">
                  Add Box{" "}
                  {boxes.length >= MAX_BOXES
                    ? `(${MAX_BOXES} max)`
                    : `(${boxes.length}/${MAX_BOXES})`}
                </span>
              </Button>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs sm:text-sm font-medium opacity-0">
                Clear
              </Label>
              <Button
                variant="outline"
                onClick={clearBoxes}
                className={`h-9 sm:h-10 text-xs sm:text-sm font-medium px-3 sm:px-4 ${
                  isDarkTheme
                    ? "bg-gray-800 border-gray-600 hover:bg-gray-700 text-white"
                    : "bg-transparent"
                }`}
              >
                Clear All
              </Button>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                className={`text-xs sm:text-sm font-medium ${isDarkTheme ? "text-gray-200" : ""}`}
              >
                Zoom Level
              </Label>
              <div
                className={`h-9 sm:h-10 flex items-center justify-center text-xs sm:text-sm font-medium rounded-md border ${
                  isDarkTheme
                    ? "text-gray-300 bg-gray-800 border-gray-600"
                    : "text-muted-foreground bg-muted/50 border"
                }`}
              >
                {Math.round(zoom * 100)}%
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
          <div className="lg:w-80 xl:w-96">
            <div
              className={`border rounded-lg p-3 sm:p-4 shadow-sm ${
                isDarkTheme ? "bg-gray-800 border-gray-600" : "bg-card border"
              }`}
            >
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h2 className="text-base sm:text-lg font-semibold">Box List</h2>
                <span
                  className={`text-xs sm:text-sm ${isDarkTheme ? "text-gray-400" : "text-muted-foreground"}`}
                >
                  {boxes.length}/{MAX_BOXES}
                </span>
              </div>

              {boxes.length === 0 ? (
                <div
                  className={`text-center py-6 sm:py-8 ${isDarkTheme ? "text-gray-400" : "text-muted-foreground"}`}
                >
                  <div className="text-2xl sm:text-3xl mb-2 opacity-50">📋</div>
                  <p className="text-xs sm:text-sm">No boxes created yet</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {boxes.map((box, index) => (
                    <div
                      key={box.id}
                      data-box-id={box.id}
                      className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border transition-all cursor-pointer ${
                        selectedBox === box.id
                          ? isDarkTheme
                            ? "bg-blue-900/30 border-blue-700 ring-1 ring-blue-600"
                            : "bg-blue-50 border-blue-200 ring-1 ring-blue-300"
                          : isDarkTheme
                            ? "bg-gray-700 hover:bg-gray-600 border-gray-600"
                            : "bg-background hover:bg-muted/50 border-border"
                      }`}
                      onClick={() => focusBox(box.id)}
                    >
                      <div
                        className="w-4 h-4 sm:w-5 sm:h-5 rounded flex-shrink-0 border border-white/20"
                        style={{ backgroundColor: box.color }}
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 sm:gap-2 mb-1">
                          <span
                            className={`text-xs sm:text-sm font-medium ${
                              isDarkTheme
                                ? "text-gray-400"
                                : "text-muted-foreground"
                            }`}
                          >
                            #{index + 1}
                          </span>
                          <span
                            className={`text-xs ${isDarkTheme ? "text-gray-400" : "text-muted-foreground"}`}
                          >
                            {box.size}×{box.size}px
                          </span>
                        </div>

                        {editingListItem === box.id ? (
                          <input
                            type="text"
                            value={listEditText}
                            onChange={(e) => setListEditText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleListTextEdit(box.id, listEditText);
                              } else if (e.key === "Escape") {
                                setEditingListItem(null);
                                setListEditText("");
                              }
                            }}
                            onBlur={() =>
                              handleListTextEdit(box.id, listEditText)
                            }
                            className={`w-full text-xs sm:text-sm bg-transparent border-none outline-none p-0 font-medium ${
                              isDarkTheme ? "text-white" : ""
                            }`}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <p
                            className="text-xs sm:text-sm font-medium truncate cursor-text"
                            onClick={(e) => {
                              e.stopPropagation();
                              startListEdit(box.id, box.text);
                            }}
                            title={box.text}
                          >
                            {box.text}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startListEdit(box.id, box.text);
                          }}
                          className={`p-1 rounded transition-colors ${
                            isDarkTheme
                              ? "hover:bg-gray-600 text-gray-400 hover:text-gray-200"
                              : "hover:bg-muted text-muted-foreground hover:text-foreground"
                          }`}
                          title="Edit text"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteBox(box.id);
                          }}
                          className={`p-1 rounded transition-colors ${
                            isDarkTheme
                              ? "hover:bg-red-900/50 text-gray-400 hover:text-red-400"
                              : "hover:bg-red-50 text-muted-foreground hover:text-red-600"
                          }`}
                          title="Delete box"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t">
                <Button
                  onClick={addBox}
                  disabled={boxes.length >= MAX_BOXES}
                  variant="outline"
                  className={`w-full h-8 sm:h-9 text-xs sm:text-sm ${
                    isDarkTheme
                      ? "bg-gray-800 border-gray-600 hover:bg-gray-700 text-white disabled:bg-gray-700 disabled:text-gray-500"
                      : ""
                  }`}
                >
                  + Add New
                </Button>
              </div>

              <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t">
                <Button
                  onClick={() =>
                    saveData(boxes, zoom, isDarkTheme, gridPan, true)
                  }
                  variant="outline"
                  className={`w-full h-8 sm:h-9 text-xs sm:text-sm ${
                    isDarkTheme
                      ? "bg-green-800 border-green-600 hover:bg-green-700 text-white disabled:bg-green-700 disabled:text-green-500"
                      : ""
                  }`}
                >
                  Save
                </Button>
              </div>

              <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t">
                {selectedBox && (
                  <div
                    className={`text-xs sm:text-sm font-medium p-2 sm:p-3 rounded-md border ${
                      isDarkTheme
                        ? "text-blue-300 bg-blue-900/30 border-blue-700"
                        : "text-blue-600 bg-blue-50 border-blue-200"
                    }`}
                  >
                    <span className="font-semibold">
                      Box {selectedBox.toString().slice(0, 2).toUpperCase()}{" "}
                      selected.
                    </span>{" "}
                    <span className="hidden sm:inline">
                      {isDragging
                        ? "Dragging..."
                        : "Click and drag to move, double-click to edit text."}
                    </span>
                    <span className="sm:hidden">
                      {isDragging
                        ? "Dragging..."
                        : "Tap to edit, long press to delete."}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t">
                <div
                  className={`text-xs sm:text-sm font-medium p-2 sm:p-3 rounded-md border ${
                    isDarkTheme
                      ? "text-blue-300 bg-blue-900/30 border-blue-700"
                      : "text-blue-600 bg-blue-50 border-blue-200"
                  }`}
                >
                  <span className="font-semibold">by Knight XIII</span>
                </div>
              </div>
            </div>
          </div>

          <div
            ref={containerRef}
            className="relative w-full h-[700px] border-0 border-dashed border-border rounded-lg bg-muted/20 overflow-hidden"
            onClick={handleContainerClick}
            onMouseDown={handleGridMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onWheel={handleWheel}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div
              className="absolute inset-0"
              style={{
                //             backgroundImage: `
                //   linear-gradient(to right, #e2e8f0 1px, transparent 1px),
                //   linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)
                // `,
                backgroundSize: `${GRID_SIZE * zoom}px ${GRID_SIZE * zoom}px`,
                backgroundPosition: `${gridPan.x % (GRID_SIZE * zoom)}px ${gridPan.y % (GRID_SIZE * zoom)}px`,
                transform: `translate(${gridPan.x}px, ${gridPan.y}px) scale(${zoom})`,
                transformOrigin: "0 0",
                cursor: isPanningGrid
                  ? "grabbing"
                  : isDragging
                    ? "grabbing"
                    : "grab",
              }}
            >
              {boxes.map((box) => (
                <div
                  key={box.id}
                  data-box-id={box.id}
                  className={`absolute rounded-sm transition-all select-none flex items-center justify-center text-white font-semibold ${
                    selectedBox === box.id
                      ? "ring-2 sm:ring-4 ring-blue-400 ring-opacity-75 scale-105"
                      : "hover:scale-105"
                  }`}
                  style={{
                    left: box.x,
                    top: box.y,
                    width: box.size,
                    height: box.size,
                    backgroundColor: box.color,
                    cursor:
                      isDragging && selectedBox === box.id
                        ? "grabbing"
                        : "grab",
                    transition:
                      isDragging && selectedBox === box.id
                        ? "none"
                        : "transform 0.2s ease, box-shadow 0.2s ease",
                    minWidth:
                      windowWidth < 640
                        ? "48px"
                        : windowWidth < 1024
                          ? "44px"
                          : box.size,
                    minHeight:
                      windowWidth < 640
                        ? "48px"
                        : windowWidth < 1024
                          ? "44px"
                          : box.size,
                  }}
                  onMouseDown={(e) => handleMouseDown(e, box.id)}
                  onDoubleClick={(e) => handleDoubleClick(e, box.id)}
                  onMouseEnter={() => setHoveredBox(box.id)}
                  onMouseLeave={() => setHoveredBox(null)}
                  onTouchStart={(e) => handleTouchStart(e, box.id)}
                >
                  {editingBox === box.id ? (
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={handleTextSubmit}
                      onBlur={() => {
                        setBoxes((prev) =>
                          prev.map((b) =>
                            b.id === editingBox ? { ...b, text: editText } : b,
                          ),
                        );
                        setEditingBox(null);
                        setEditText("");
                      }}
                      className="bg-transparent border-none outline-none text-center text-white placeholder-white/70 w-full px-1"
                      style={{
                        fontSize: Math.max(
                          windowWidth < 640
                            ? 10
                            : windowWidth < 1024
                              ? 12
                              : box.fontSize,
                          box.fontSize,
                        ),
                        padding: "2px",
                      }}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span
                      style={{
                        fontSize: newFontSize,
                        lineHeight: "1.2",
                      }}
                      className="text-center px-1 break-words leading-tight"
                    >
                      {box.text}
                    </span>
                  )}

                  {hoveredBox === box.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteBox(box.id);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        deleteBox(box.id);
                      }}
                      className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition-colors shadow-lg border-2 border-white z-100 cursor-pointer"
                      style={{
                        width:
                          windowWidth < 640
                            ? "28px"
                            : windowWidth < 1024
                              ? "32px"
                              : "24px",
                        height:
                          windowWidth < 640
                            ? "28px"
                            : windowWidth < 1024
                              ? "32px"
                              : "24px",
                        fontSize:
                          windowWidth < 640
                            ? "12px"
                            : windowWidth < 1024
                              ? "14px"
                              : "12px",
                      }}
                      title="Delete box"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              ))}

              {boxes.length === 0 && (
                <div
                  className={`absolute inset-0 flex items-center justify-center text-center p-4 sm:p-6 ${
                    isDarkTheme ? "text-gray-400" : "text-muted-foreground"
                  }`}
                >
                  <div className="max-w-sm">
                    <div className="text-4xl sm:text-5xl lg:text-6xl mb-3 sm:mb-4 opacity-50">
                      📦
                    </div>
                    <p className="text-sm sm:text-base lg:text-lg font-medium mb-2">
                      No boxes yet
                    </p>
                    <p className="text-xs sm:text-sm opacity-75">
                      Tap "Add Box" to start creating and organizing boxes on
                      the grid
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DragDropBoxes;
