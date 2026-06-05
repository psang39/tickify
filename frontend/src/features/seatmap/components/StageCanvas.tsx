import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Stage, Layer, Path, Circle, Rect, Text } from 'react-konva';
import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useCartStore, findCluster, hasOrphanSeat } from '@/store/useCartStore';

interface StageCanvasProps {
    mapAssets: any[];
    zonesData: any[];
    seatsData: any[];
    zoneSummaries?: Record<string, any>;
    ticketTypeDictionary: Record<string, any>;
    zoneDictionary?: Record<string, any>;
    onStandingZoneClick?: (zone: any) => void;
}

export const buildSeatMapCache = (allSeats: any[]) => {
    const rowMap = new Map<string, any[]>();

    allSeats.forEach(s => {
        if (!s.row || s.col_index === undefined || !s.zone_id) return;

        const rowKey = `${s.zone_id}_${s.row}`;

        if (!rowMap.has(rowKey)) rowMap.set(rowKey, []);
        rowMap.get(rowKey)!.push(s);
    });

    for (const [_, seatsInRow] of rowMap.entries()) {
        seatsInRow.sort((a, b) => Number(a.col_index) - Number(b.col_index));
    }

    return rowMap;
};
const getPathBounds = (pathData?: string) => {
    if (!pathData) return null;

    try {
        const path = new Konva.Path({
            data: pathData,
        });

        const rect = path.getClientRect({
            skipTransform: true,
        });

        if (
            !Number.isFinite(rect.x) ||
            !Number.isFinite(rect.y) ||
            !Number.isFinite(rect.width) ||
            !Number.isFinite(rect.height)
        ) {
            return null;
        }

        return {
            minX: rect.x,
            minY: rect.y,
            maxX: rect.x + rect.width,
            maxY: rect.y + rect.height,
            width: rect.width,
            height: rect.height,
            centerX: rect.x + rect.width / 2,
            centerY: rect.y + rect.height / 2,
        };
    } catch {
        return null;
    }
};
const SeatNode = React.memo(({
    seat, isSelected, isHovered, hoverStatus, isMatchingCombo, isZoomedIn,
    onClick, onMouseEnter, onMouseLeave
}: any) => {
    const isAvailable = seat.status === 'available' || seat.status === 1;

    let seatColor = "#9ca3af";

    if (isAvailable) {
        seatColor = "#ffffff";
        if (isHovered && hoverStatus === 'success') {
            seatColor = "#bfdbfe";
        }
        if (isHovered && hoverStatus === 'error') {
            seatColor = "#fecaca";
        }
    }

    if (isSelected) {
        if (!isAvailable) {
            seatColor = "#7b8190";
        } else {
            seatColor = "#ec008c";
        }
    }

    return (
        <Circle
            x={seat.x}
            y={seat.y}
            radius={1.2}
            fill={seatColor}
            opacity={isAvailable && !isMatchingCombo && !isSelected ? 0.28 : 1}
            perfectDrawEnabled={false}
            listening={isZoomedIn}
            hitStrokeWidth={2}
            onClick={() => onClick(seat)}
            onTap={() => onClick(seat)}
            onMouseEnter={(e) => onMouseEnter(e, seat, isAvailable)}
            onMouseLeave={onMouseLeave}
        />
    );
}, (prev, next) => {
    return prev.isSelected === next.isSelected &&
        prev.isHovered === next.isHovered &&
        prev.hoverStatus === next.hoverStatus &&
        prev.isMatchingCombo === next.isMatchingCombo &&
        prev.isZoomedIn === next.isZoomedIn &&
        prev.seat.status === next.seat.status;
});

export const StageCanvas: React.FC<StageCanvasProps> = ({
    mapAssets,
    zonesData,
    seatsData,
    ticketTypeDictionary,
    zoneSummaries = {},
    zoneDictionary = {},
    onStandingZoneClick
}) => {
    const { selectedSeats, toggleSeat, comboCount } = useCartStore();

    const [tooltip, setTooltip] = useState<any>({ visible: false, x: 0, y: 0, content: null, status: 'success' });
    const [zoneTooltip, setZoneTooltip] = useState({
        visible: false,
        x: 0,
        y: 0,
        zoneName: "",
        availableCount: 0,
        minPrice: 0,
    });
    const [hoveredIds, setHoveredIds] = useState<string[]>([]);
    const [hoverStatus, setHoverStatus] = useState<'success' | 'error' | null>(null);

    const stageRef = useRef<Konva.Stage>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [containerSize, setContainerSize] = useState({ width: 900, height: 640 });

    useEffect(() => {
        const node = containerRef.current;
        if (!node) return;

        const updateSize = () => {
            const rect = node.getBoundingClientRect();
            setContainerSize({
                width: Math.max(360, Math.floor(rect.width)),
                height: Math.max(480, Math.floor(rect.height)),
            });
        };

        updateSize();
        const observer = new ResizeObserver(updateSize);
        observer.observe(node);

        return () => observer.disconnect();
    }, []);

    const [stageConfig, setStageConfig] = useState({ scale: 1, x: 0, y: 0 });
    const ZOOM_THRESHOLD = 1.5;
    const isZoomedIn = stageConfig.scale >= ZOOM_THRESHOLD;

    const drawableSeatsData = useMemo(() => {
        return seatsData.filter((seat: any) => !zoneDictionary[String(seat.zone_id)]?.is_standing);
    }, [seatsData, zoneDictionary]);

    const normalizedSeatsData = useMemo(() => {
        return drawableSeatsData.map((s, index) => {
            const uniqueId = s._id || `seat-${s.zone_id || 'zone'}-${s.row}-${s.col_index}-${index}`;

            return {
                ...s,
                id: uniqueId,
                _id: s._id
            };
        });
    }, [drawableSeatsData]);

    const rowMapCache = useMemo(() => buildSeatMapCache(normalizedSeatsData), [normalizedSeatsData]);

    const validSeatIdsForCombo = useMemo(() => {
        if (comboCount === 1) return null;

        const validIds = new Set<string>();

        rowMapCache.forEach(seatsInRow => {
            let streak: any[] = [];
            for (let i = 0; i < seatsInRow.length; i++) {
                const s = seatsInRow[i];
                const isAvailable = s.status === 1 || s.status === 'available';

                if (isAvailable) {
                    if (streak.length === 0) {
                        streak.push(s);
                    } else {
                        if (Number(s.col_index) === Number(streak[streak.length - 1].col_index) + 1) {
                            streak.push(s);
                        } else {
                            if (streak.length >= comboCount) {
                                streak.forEach(st => validIds.add(st.id));
                            }
                            streak = [s];
                        }
                    }
                } else {
                    if (streak.length >= comboCount) {
                        streak.forEach(st => validIds.add(st.id));
                    }
                    streak = [];
                }
            }
            if (streak.length >= comboCount) {
                streak.forEach(st => validIds.add(st.id));
            }
        });
        return validIds;
    }, [rowMapCache, comboCount]);

    const { mapBounds, zoneLabels, assetLabels } = useMemo(() => {
        const boundsList: any[] = [];

        // 1. Bounds từ seats
        if (drawableSeatsData.length > 0) {
            const xs = drawableSeatsData
                .map(s => Number(s.x))
                .filter(Number.isFinite);

            const ys = drawableSeatsData
                .map(s => Number(s.y))
                .filter(Number.isFinite);

            if (xs.length > 0 && ys.length > 0) {
                boundsList.push({
                    minX: Math.min(...xs),
                    maxX: Math.max(...xs),
                    minY: Math.min(...ys),
                    maxY: Math.max(...ys),
                });
            }
        }

        // 2. Bounds từ zones
        zonesData.forEach(zone => {
            const bounds = getPathBounds(zone.path_data || zone.layout_map);
            if (bounds) boundsList.push(bounds);
        });

        // 3. Bounds từ assets
        mapAssets.forEach(asset => {
            const bounds = getPathBounds(asset.path_data);
            if (bounds) boundsList.push(bounds);
        });

        if (boundsList.length === 0) {
            return { mapBounds: null, zoneLabels: [], assetLabels: [] };
        }

        const minX = Math.min(...boundsList.map(b => b.minX));
        const maxX = Math.max(...boundsList.map(b => b.maxX));
        const minY = Math.min(...boundsList.map(b => b.minY));
        const maxY = Math.max(...boundsList.map(b => b.maxY));

        const zLabels = zonesData.map(zone => {
            const bounds = getPathBounds(zone.path_data || zone.layout_map);

            if (bounds) {
                return {
                    id: zone._id,
                    name: zone.name,
                    x: bounds.centerX,
                    y: bounds.centerY,
                };
            }

            // Fallback nếu zone không có path hợp lệ
            const seatsInZone = drawableSeatsData.filter(s => s.zone_id === zone._id);

            if (seatsInZone.length === 0) return null;

            const avgX = seatsInZone.reduce((sum, s) => sum + Number(s.x), 0) / seatsInZone.length;
            const avgY = seatsInZone.reduce((sum, s) => sum + Number(s.y), 0) / seatsInZone.length;

            return {
                id: zone._id,
                name: zone.name,
                x: avgX,
                y: avgY,
            };
        }).filter(Boolean);

        const aLabels = mapAssets.map(asset => {
            const bounds = getPathBounds(asset.path_data);

            if (!bounds) return null;

            return {
                id: asset.asset_id,
                name: asset.asset_id.replace('asset_', '').replace(/_/g, ' ').toUpperCase(),
                x: bounds.centerX,
                y: bounds.centerY,
            };
        }).filter(Boolean);

        return {
            mapBounds: {
                minX,
                maxX,
                minY,
                maxY,
                width: maxX - minX,
                height: maxY - minY,
                centerX: minX + (maxX - minX) / 2,
                centerY: minY + (maxY - minY) / 2,
            },
            zoneLabels: zLabels,
            assetLabels: aLabels,
        };
    }, [drawableSeatsData, zonesData, mapAssets]);

    useEffect(() => {
        if (mapBounds) {
            const padding = 100;
            const containerWidth = containerSize.width;
            const containerHeight = containerSize.height;

            const scaleX = containerWidth / (mapBounds.width + padding);
            const scaleY = containerHeight / (mapBounds.height + padding);
            const optimalScale = Math.min(scaleX, scaleY, 2);

            setStageConfig({
                scale: optimalScale,
                x: containerWidth / 2 - mapBounds.centerX * optimalScale,
                y: containerHeight / 2 - mapBounds.centerY * optimalScale
            });
        }
    }, [mapBounds?.minX, mapBounds?.maxX, mapBounds?.minY, mapBounds?.maxY, containerSize.width, containerSize.height]);
    const getZoneMinPrice = (summary: any) => {
        if (!summary || !summary.tiers) return 0;
        const tierIds = Object.keys(summary.tiers);

        const prices = tierIds
            .filter(id => summary.tiers[id].count > 0)
            .map(id => ticketTypeDictionary[id]?.price || 0);

        return prices.length > 0 ? Math.min(...prices) : 0;
    };
    const getZoneColor = useCallback((zoneId: string) => {
        const summary = zoneSummaries[zoneId];
        const secondaryColor = "#4651C9";

        if (!summary || !summary.tiers) {
            return { fill: secondaryColor };
        }

        const totalAvailable = Object.values(summary.tiers).reduce(
            (acc: number, tier: any) => acc + (tier.count || 0),
            0
        );

        if (totalAvailable <= 0) {
            return { fill: "#C1C1CA" };
        }

        return { fill: secondaryColor };
    }, [zoneSummaries]);

    const handleZoneMouseEnter = (e: any, zone: any) => {
        const stage = e.target.getStage();
        const pointerPosition = stage.getPointerPosition();
        const summary = zoneSummaries?.[zone._id];
        const minPrice = getZoneMinPrice(summary);
        if (!summary) return;

        const totalAvailable = Object.values(summary.tiers || {}).reduce(
            (acc: number, tier: any) => acc + (tier.count || 0),
            0
        );

        setZoneTooltip({
            visible: true,
            x: pointerPosition.x,
            y: pointerPosition.y,
            zoneName: zone.name || "Khu vực",
            availableCount: totalAvailable,
            minPrice: minPrice || 0,
        });
    };

    const handleZoneMouseMove = (e: any) => {
        if (isZoomedIn) {
            setZoneTooltip(prev => ({ ...prev, visible: false }));
            return;
        }

        const stage = e.target.getStage();
        const pointerPosition = stage.getPointerPosition();

        if (!pointerPosition) return;

        setZoneTooltip(prev => ({
            ...prev,
            x: pointerPosition.x,
            y: pointerPosition.y,
        }));
    };


    const handleZoneMouseLeave = () => {
        // Tắt tooltip khi chuột rời khỏi zone
        setZoneTooltip(prev => ({ ...prev, visible: false }));
    };
    const handleMouseEnter = useCallback((e: any, seat: any, isAvailable: boolean) => {
        if (!isZoomedIn) {
            setTooltip((prev: any) => ({ ...prev, visible: false }));
            return;
        }

        if (isAvailable) {
            const stage = e.target.getStage();
            if (stage) stage.container().style.cursor = 'default';
        }


        if (timerRef.current) clearTimeout(timerRef.current);
        const stage = e.target.getStage();
        const pos = stage.getPointerPosition();

        const seatIdentifier = seat.id;

        if (!isAvailable) {
            setHoveredIds([seatIdentifier]);
            setHoverStatus('error');
            timerRef.current = setTimeout(() => {
                setTooltip({
                    visible: true, x: pos.x, y: pos.y, status: 'error',
                    content: { title: "Không thể chọn", message: "Ghế này đã có người đặt hoặc không hợp lệ" }
                });
            }, 250);
            return;
        }

        const cluster = findCluster(seat, comboCount, rowMapCache);

        if (cluster.length > 0) {
            const currentSelectedIds = selectedSeats.map(s => s.id);
            const pendingIds = Array.from(new Set([...currentSelectedIds, ...cluster.map(s => s.id)]));

            if (hasOrphanSeat(pendingIds, rowMapCache)) {
                setHoveredIds(cluster.map(s => s.id));
                setHoverStatus('error');
                timerRef.current = setTimeout(() => {
                    setTooltip({
                        visible: true, x: pos.x, y: pos.y, status: 'error',
                        content: { title: "Lỗi ghế mồ côi", message: "Sẽ để lại 1 ghế trống đơn lẻ!" }
                    });
                }, 250);
                return;
            }

            setHoveredIds(cluster.map(s => s.id));
            setHoverStatus('success');

            const totalPrice = cluster.reduce((sum, s) => sum + (ticketTypeDictionary[s.ticket_type_id]?.price || 0), 0);
            const labels = cluster.map(s => s.seat_number || s.id).join(", ");

            timerRef.current = setTimeout(() => {
                setTooltip({
                    visible: true, x: pos.x, y: pos.y, status: 'success',
                    content: {
                        title: `Combo ${cluster.length} vé - Khu ${zoneDictionary[seat.zone_id]?.name || ''}`,
                        seats: labels,
                        total: totalPrice
                    }
                });
            }, 250);
        } else {
            setHoveredIds([seatIdentifier]);
            setHoverStatus('error');

            timerRef.current = setTimeout(() => {
                setTooltip({
                    visible: true, x: pos.x, y: pos.y, status: 'error',
                    content: { title: "Không đủ chỗ", message: `Cần ${comboCount} ghế trống liền nhau` }
                });
            }, 250);
        }
    }, [comboCount, rowMapCache, selectedSeats, ticketTypeDictionary]);

    const handleMouseLeave = useCallback((e?: any) => {
        if (e) {
            const stage = e.target?.getStage();
            if (stage) stage.container().style.cursor = 'default';
        }

        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        setHoveredIds([]);
        setHoverStatus(null);
        setTooltip((prev: any) => ({ ...prev, visible: false }));
    }, []);

    const handleSeatClick = useCallback((seat: any) => {
        if (seat.status !== 'available' && seat.status !== 1) return;
        toggleSeat(seat, rowMapCache);
    }, [rowMapCache, toggleSeat]);

    const handleZoneClick = (e: KonvaEventObject<MouseEvent | TouchEvent>, zone?: any) => {
        if (isZoomedIn) return;
        if (zone?.is_standing) {
            onStandingZoneClick?.(zone);
            return;
        }
        const box = e.target.getClientRect({ skipTransform: true });
        const padding = 60;
        const scaleX = containerSize.width / (box.width + padding * 2);
        const scaleY = containerSize.height / (box.height + padding * 2);
        const optimalScale = Math.min(scaleX, scaleY, 4);
        setStageConfig({ scale: optimalScale, x: containerSize.width / 2 - (box.x + box.width / 2) * optimalScale, y: containerSize.height / 2 - (box.y + box.height / 2) * optimalScale });
    };
    const clearAllTooltips = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }

        setHoveredIds([]);
        setHoverStatus(null);
        setTooltip((prev: any) => ({ ...prev, visible: false }));
        setZoneTooltip(prev => ({ ...prev, visible: false }));

        const stage = stageRef.current;
        if (stage) {
            stage.container().style.cursor = 'default';
        }
    }, []);
    useEffect(() => {
        clearAllTooltips();
    }, [isZoomedIn, clearAllTooltips]);


    const handleZoomButton = (direction: 1 | -1) => {
        clearAllTooltips();
        const scaleBy = 1.3;
        const oldScale = stageConfig.scale;
        let newScale = Math.max(0.2, Math.min(direction === 1 ? oldScale * scaleBy : oldScale / scaleBy, 15));
        const centerX = containerSize.width / 2;
        const centerY = containerSize.height / 2;
        const mousePointTo = { x: (centerX - stageConfig.x) / oldScale, y: (centerY - stageConfig.y) / oldScale };
        setStageConfig({ scale: newScale, x: centerX - mousePointTo.x * newScale, y: centerY - mousePointTo.y * newScale });
    };

    const handleWheel = (e: any) => {
        e.evt.preventDefault();

        const stage = stageRef.current;
        if (!stage) return;
        const oldScale = stage.scaleX();
        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        const mousePointTo = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
        let newScale = Math.max(0.2, Math.min(e.evt.deltaY < 0 ? oldScale * 1.1 : oldScale / 1.1, 15));
        const newPos = { x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale };
        stage.scale({ x: newScale, y: newScale });
        stage.position(newPos);
        stage.batchDraw();
        setStageConfig({ scale: newScale, x: newPos.x, y: newPos.y });
    };

    const renderedSeats = useMemo(() => {
        return normalizedSeatsData.map((seat: any) => {
            const isSelected = selectedSeats.some(s => s.id === seat.id);
            const isHovered = hoveredIds.includes(seat.id);
            const isMatchingCombo = validSeatIdsForCombo === null || validSeatIdsForCombo.has(seat.id);

            return (
                <SeatNode
                    key={seat.id}
                    seat={seat}
                    isSelected={isSelected}
                    isHovered={isHovered}
                    hoverStatus={hoverStatus}
                    isMatchingCombo={isMatchingCombo}
                    isZoomedIn={isZoomedIn}
                    onClick={handleSeatClick}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                />
            );
        });
    }, [normalizedSeatsData, selectedSeats, hoveredIds, hoverStatus, isZoomedIn, validSeatIdsForCombo, handleSeatClick, handleMouseEnter, handleMouseLeave]);

    const MINIMAP_SIZE = 140;
    const MINIMAP_PADDING = 12;

    const minimapScale = mapBounds
        ? Math.min(
            (MINIMAP_SIZE - MINIMAP_PADDING * 2) / mapBounds.width,
            (MINIMAP_SIZE - MINIMAP_PADDING * 2) / mapBounds.height
        )
        : 1;

    const minimapX = mapBounds
        ? MINIMAP_PADDING + ((MINIMAP_SIZE - MINIMAP_PADDING * 2) - mapBounds.width * minimapScale) / 2 - mapBounds.minX * minimapScale
        : 0;

    const minimapY = mapBounds
        ? MINIMAP_PADDING + ((MINIMAP_SIZE - MINIMAP_PADDING * 2) - mapBounds.height * minimapScale) / 2 - mapBounds.minY * minimapScale
        : 0;
    return (
        <div ref={containerRef} className="w-full h-full relative cursor-default bg-white dark:bg-slate-900/90 overflow-hidden">
            <Stage
                ref={stageRef}
                width={containerSize.width}
                height={containerSize.height}
                onWheel={handleWheel}
                draggable={true}
                x={stageConfig.x}
                y={stageConfig.y}
                scaleX={stageConfig.scale}
                scaleY={stageConfig.scale}
                onDragMove={(e) => {
                    if (e.target === stageRef.current) {
                        setStageConfig(prev => ({ ...prev, x: e.target.x(), y: e.target.y() }));
                    }
                }}
            >
                <Layer>
                    {mapAssets.map((asset, idx) => (
                        <Path key={`asset-${idx}`} data={asset.path_data} fill="#334155" />
                    ))}
                    {assetLabels.map((lbl: any, idx) => (
                        <Text
                            key={`albl-${idx}`}
                            x={lbl.x - 100}
                            y={lbl.y - 10}
                            width={200}
                            height={20}
                            text={lbl.name}
                            fontSize={16}
                            fill="white"
                            fontStyle="bold"
                            align="center"
                            verticalAlign="middle"
                            opacity={0.8}
                            listening={false}
                        />
                    ))}
                </Layer>

                <Layer>
                    {zonesData.map((zone, idx) => {
                        const colors = getZoneColor(zone._id);
                        return (
                            <Path
                                key={`zone-${idx}`}
                                data={zone.path_data || zone.layout_map}
                                fill={colors.fill}
                                strokeWidth={1 / stageConfig.scale}
                                opacity={isZoomedIn ? 0.9 : 0.96}
                                perfectDrawEnabled={false}
                                listening={!isZoomedIn}
                                onClick={(e) => handleZoneClick(e, zone)}
                                onTap={(e) => handleZoneClick(e, zone)}
                                onMouseEnter={(e) => {
                                    const stage = e.target.getStage();
                                    if (stage && !isZoomedIn) {
                                        stage.container().style.cursor = 'default';
                                        (e.target as Konva.Path).opacity(1);
                                        handleZoneMouseEnter(e, zone);
                                    }

                                }}
                                onMouseMove={handleZoneMouseMove}
                                onMouseLeave={(e) => {
                                    const stage = e.target.getStage();
                                    if (stage) {
                                        stage.container().style.cursor = 'default';
                                        (e.target as Konva.Path).opacity(0.96);
                                        handleZoneMouseLeave();
                                    }
                                }}
                            />

                        );
                    })}
                    {!isZoomedIn && zoneLabels.map((lbl: any, idx) => (
                        <Text
                            key={`zlbl-${idx}`}
                            x={lbl.x - 150}
                            y={lbl.y - 18}
                            width={300}
                            height={36}
                            text={zoneDictionary[lbl.id]?.is_standing ? `${lbl.name} · GA` : lbl.name}
                            fontSize={25}
                            fill="#ffffff"
                            fontStyle="bold"
                            align="center"
                            verticalAlign="middle"
                            listening={false}
                        />
                    ))}
                </Layer>

                {isZoomedIn && <Layer>{renderedSeats}</Layer>}
            </Stage>

            {mapBounds && (
                <div className="absolute bottom-4 left-4 z-10 bg-white/90 dark:bg-slate-950/90 backdrop-blur-sm rounded-lg shadow-xl border border-slate-200 dark:border-white/10 overflow-hidden pointer-events-none" style={{ width: MINIMAP_SIZE, height: MINIMAP_SIZE }}>
                    <Stage width={MINIMAP_SIZE} height={MINIMAP_SIZE}>
                        <Layer>
                            {mapAssets.map((asset, idx) => (
                                <Path key={`mini-asset-${idx}`} data={asset.path_data} fill="#475569" x={minimapX} y={minimapY} scaleX={minimapScale} scaleY={minimapScale} />
                            ))}
                            {zonesData.map((zone, idx) => {
                                const colors = getZoneColor(zone._id);
                                return (
                                    <Path key={`mini-zone-${idx}`} data={zone.path_data || zone.layout_map} fill={colors.fill} strokeWidth={2} x={minimapX} y={minimapY} scaleX={minimapScale} scaleY={minimapScale} />
                                );
                            })}
                            <Rect
                                x={minimapX + (-stageConfig.x / stageConfig.scale) * minimapScale}
                                y={minimapY + (-stageConfig.y / stageConfig.scale) * minimapScale}
                                width={(containerSize.width / stageConfig.scale) * minimapScale}
                                height={(containerSize.height / stageConfig.scale) * minimapScale}
                                stroke="#ef4444"
                                strokeWidth={2}
                                cornerRadius={2}
                            />
                        </Layer>
                    </Stage>
                </div>
            )}

            <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-1 bg-white/90 dark:bg-slate-950/90 backdrop-blur shadow-xl rounded-lg border border-slate-200 dark:border-white/10 overflow-hidden pointer-events-auto">
                <button onClick={() => handleZoomButton(1)} className="w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-primary transition-colors text-xl font-medium active:bg-slate-200 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-pink-300 dark:active:bg-white/15" >+</button>
                <div className="w-full h-[1px] bg-slate-200 dark:bg-slate-700/70"></div>
                <button onClick={() => handleZoomButton(-1)} className="w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-primary transition-colors text-2xl font-medium active:bg-slate-200 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-pink-300 dark:active:bg-white/15" >-</button>
            </div>

            {tooltip.visible && (
                <div
                    className={`absolute z-[100] p-3 rounded-lg shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-full mt-[-15px] transition-all duration-100 ease-out
                        ${tooltip.status === 'success' ? 'bg-slate-900 border-l-4 border-blue-500' : 'bg-red-900 border-l-4 border-red-500'}`}
                    style={{ left: tooltip.x, top: tooltip.y }}
                >
                    <div className="text-white min-w-[150px]">
                        <p className="text-[11px] font-bold uppercase opacity-70 mb-1">{tooltip.content.title}</p>
                        {tooltip.status === 'success' ? (
                            <>
                                <p className="text-lg font-mono text-blue-400 break-words max-w-[200px] leading-tight mb-2">
                                    {tooltip.content.seats}
                                </p>
                                <div className="border-t border-slate-700 pt-2 flex justify-between items-center">
                                    <span className="text-xs text-slate-400">Tổng cộng:</span>
                                    <span className="text-sm font-bold text-orange-400">
                                        {tooltip.content.total.toLocaleString('vi-VN')} đ
                                    </span>
                                </div>
                            </>
                        ) : (
                            <p className="text-sm text-red-200 mt-1">{tooltip.content.message}</p>
                        )}
                    </div>
                    <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full border-8 border-transparent 
                        ${tooltip.status === 'success' ? 'border-t-slate-900' : 'border-t-red-900'}`}></div>
                </div>
            )}
            {zoneTooltip.visible && (
                <div
                    className="absolute z-50 pointer-events-none bg-slate-900/95 backdrop-blur-md border border-slate-700 text-white p-4 rounded-xl shadow-2xl transition-opacity duration-150 ease-out"
                    style={{
                        // Cộng thêm 15px để Tooltip không bị che bởi chính con trỏ chuột
                        top: zoneTooltip.y + 15,
                        left: zoneTooltip.x + 15,
                        transform: 'translate(0, 0)'
                    }}
                >
                    <h4 className="font-bold text-base text-blue-300 mb-2 border-b border-slate-700 pb-2">
                        {zoneTooltip.zoneName}
                    </h4>

                    <div className="flex flex-col gap-1.5 text-sm">
                        <div className="flex justify-between items-center gap-6">
                            <span className="text-slate-400">Tình trạng:</span>
                            {zoneTooltip.availableCount > 0 ? (
                                <span className="font-medium text-emerald-400">
                                    Còn <span className="font-bold">{zoneTooltip.availableCount}</span> vé
                                </span>
                            ) : (
                                <span className="font-medium text-red-400">Hết vé</span>
                            )}
                        </div>

                        <div className="flex justify-between items-center gap-6">
                            <span className="text-slate-400">Giá chỉ từ:</span>
                            <span className="font-bold text-pink-400 font-mono tracking-tight">
                                {zoneTooltip.minPrice.toLocaleString('vi-VN')} đ
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}