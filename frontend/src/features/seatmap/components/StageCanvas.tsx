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

const SeatNode = React.memo(({
    seat, isSelected, isHovered, hoverStatus, isMatchingCombo, isZoomedIn,
    onClick, onMouseEnter, onMouseLeave
}: any) => {
    const isAvailable = seat.status === 'available' || seat.status === 1;

    let seatColor = "#cbd5e1";
    let strokeColor = "#94a3b8";

    if (isAvailable) {
        seatColor = "#ffffff";
        strokeColor = "#3b82f6";
        if (isHovered && hoverStatus === 'success') {
            seatColor = "#bfdbfe";
        }
        if (isHovered && hoverStatus === 'error') {
            seatColor = "#fecaca";
            strokeColor = "#ef4444";
        }
    }

    if (isSelected) {
        if (!isAvailable) {
            seatColor = "#ef4444";
            strokeColor = "#7f1d1d";
        } else {
            seatColor = "#ec4899";
            strokeColor = "#be185d";
        }
    }

    return (
        <Circle
            x={seat.x}
            y={seat.y}
            radius={1.2}
            fill={seatColor}
            stroke={strokeColor}
            strokeWidth={0.2}
            opacity={isAvailable && !isMatchingCombo && !isSelected ? 0.2 : 1}
            perfectDrawEnabled={false}
            listening={isZoomedIn}
            hitStrokeWidth={1.2}
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
    zoneSummaries = {}
}) => {
    const { selectedSeats, toggleSeat, comboCount } = useCartStore();

    const [tooltip, setTooltip] = useState<any>({ visible: false, x: 0, y: 0, content: null, status: 'success' });
    const [hoveredIds, setHoveredIds] = useState<string[]>([]);
    const [hoverStatus, setHoverStatus] = useState<'success' | 'error' | null>(null);

    const stageRef = useRef<Konva.Stage>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [stageConfig, setStageConfig] = useState({ scale: 1, x: 0, y: 0 });
    const ZOOM_THRESHOLD = 2.5;
    const isZoomedIn = stageConfig.scale >= ZOOM_THRESHOLD;

    const normalizedSeatsData = useMemo(() => {
        return seatsData.map((s, index) => {
            const uniqueId = s._id || `seat-${s.zone_id || 'zone'}-${s.row}-${s.col_index}-${index}`;

            return {
                ...s,
                id: uniqueId,
                _id: s._id
            };
        });
    }, [seatsData]);

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
        if (seatsData.length === 0) return { mapBounds: null, zoneLabels: [], assetLabels: [] };

        const xs = seatsData.map(s => s.x);
        const ys = seatsData.map(s => s.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys) - 200;
        const maxY = Math.max(...ys);

        const zLabels = zonesData.map(zone => {
            const seatsInZone = seatsData.filter(s => s.zone_id === zone._id);
            if (seatsInZone.length === 0) return null;
            const avgX = seatsInZone.reduce((sum, s) => sum + s.x, 0) / seatsInZone.length;
            const avgY = seatsInZone.reduce((sum, s) => sum + s.y, 0) / seatsInZone.length;
            return { id: zone._id, name: zone.name, x: avgX, y: avgY };
        }).filter(Boolean);

        const aLabels = mapAssets.map(asset => {
            const match = asset.path_data.match(/M\s*([-\d.]+)[,\s]+([-\d.]+)/);
            if (match) {
                return { id: asset.asset_id, name: asset.asset_id.replace('asset_', '').replace(/_/g, ' ').toUpperCase(), x: parseFloat(match[1]) + 50, y: parseFloat(match[2]) + 50 };
            }
            return null;
        }).filter(Boolean);

        return {
            mapBounds: { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY, centerX: minX + (maxX - minX) / 2, centerY: minY + (maxY - minY) / 2 },
            zoneLabels: zLabels,
            assetLabels: aLabels
        };
    }, [seatsData, zonesData, mapAssets]);

    useEffect(() => {
        if (mapBounds) {
            const padding = 100;
            const containerWidth = window.innerWidth;
            const containerHeight = 600;

            const scaleX = containerWidth / (mapBounds.width + padding);
            const scaleY = containerHeight / (mapBounds.height + padding);
            const optimalScale = Math.min(scaleX, scaleY, 2);

            setStageConfig({
                scale: optimalScale,
                x: containerWidth / 2 - mapBounds.centerX * optimalScale,
                y: containerHeight / 2 - mapBounds.centerY * optimalScale
            });
        }
    }, [mapBounds?.minX, mapBounds?.maxX, mapBounds?.minY, mapBounds?.maxY]);

    const getZoneColor = useCallback((zoneId: string) => {
        const summary = zoneSummaries[zoneId];
        if (!summary) return { fill: "#bfdbfe", stroke: "#3b82f6" };

        let totalAvailable = 0;
        Object.keys(summary).forEach(key => {
            if (key.includes(':count')) {
                totalAvailable += parseInt(summary[key] || "0", 10);
            }
        });

        if (totalAvailable <= 0) return { fill: "#e2e8f0", stroke: "#94a3b8" };
        if (totalAvailable < 50) return { fill: "#fef08a", stroke: "#eab308" };
        return { fill: "#bfdbfe", stroke: "#3b82f6" };
    }, [zoneSummaries]);

    const handleMouseEnter = useCallback((e: any, seat: any, isAvailable: boolean) => {
        if (isAvailable) {
            const stage = e.target.getStage();
            if (stage) stage.container().style.cursor = 'pointer';
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
                        title: `Combo ${cluster.length} vé - Khu ${seat.zone || ''}`,
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
            if (stage) stage.container().style.cursor = 'grab';
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

    const handleZoneClick = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
        if (isZoomedIn) return;
        const box = e.target.getClientRect({ skipTransform: true });
        const padding = 60;
        const scaleX = window.innerWidth / (box.width + padding * 2);
        const scaleY = 600 / (box.height + padding * 2);
        const optimalScale = Math.min(scaleX, scaleY, 4);
        setStageConfig({ scale: optimalScale, x: window.innerWidth / 2 - (box.x + box.width / 2) * optimalScale, y: 600 / 2 - (box.y + box.height / 2) * optimalScale });
    };

    const handleZoomButton = (direction: 1 | -1) => {
        const scaleBy = 1.3;
        const oldScale = stageConfig.scale;
        let newScale = Math.max(0.2, Math.min(direction === 1 ? oldScale * scaleBy : oldScale / scaleBy, 15));
        const centerX = window.innerWidth / 2;
        const centerY = 600 / 2;
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
    const minimapScale = mapBounds ? Math.min(MINIMAP_SIZE / mapBounds.width, MINIMAP_SIZE / mapBounds.height) * 0.85 : 1;
    const minimapX = mapBounds ? (MINIMAP_SIZE - mapBounds.width * minimapScale) / 2 - mapBounds.minX * minimapScale : 0;
    const minimapY = mapBounds ? (MINIMAP_SIZE - mapBounds.height * minimapScale) / 2 - mapBounds.minY * minimapScale : 0;

    return (
        <div className="w-full h-full relative cursor-grab active:cursor-grabbing bg-[#f8fafc] overflow-hidden">
            <Stage
                ref={stageRef}
                width={window.innerWidth}
                height={600}
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
                        <Path key={`asset-${idx}`} data={asset.path_data} fill="#334155" stroke="#0f172a" strokeWidth={1} />
                    ))}
                    {assetLabels.map((lbl: any, idx) => (
                        <Text key={`albl-${idx}`} x={lbl.x} y={lbl.y} text={lbl.name} fontSize={16} fill="white" fontStyle="bold" align="center" verticalAlign="middle" offsetX={37} opacity={0.8} listening={false} />
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
                                stroke={isZoomedIn ? "#cbd5e1" : colors.stroke}
                                strokeWidth={1 / stageConfig.scale}
                                opacity={isZoomedIn ? 0.3 : 0.8}
                                perfectDrawEnabled={false}
                                listening={!isZoomedIn}
                                onClick={handleZoneClick}
                                onTap={handleZoneClick}
                                onMouseEnter={(e) => {
                                    const stage = e.target.getStage();
                                    if (stage && !isZoomedIn) {
                                        stage.container().style.cursor = 'zoom-in';
                                        (e.target as Konva.Path).opacity(1);
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    const stage = e.target.getStage();
                                    if (stage) {
                                        stage.container().style.cursor = 'grab';
                                        (e.target as Konva.Path).opacity(0.8);
                                    }
                                }}
                            />
                        );
                    })}
                    {!isZoomedIn && zoneLabels.map((lbl: any, idx) => (
                        <Text key={`zlbl-${idx}`} x={lbl.x} y={lbl.y} text={lbl.name} fontSize={30} fill="#41444b" fontStyle="bold" align="center" offsetX={20} offsetY={10} listening={false} />
                    ))}
                </Layer>

                {isZoomedIn && <Layer>{renderedSeats}</Layer>}
            </Stage>

            {mapBounds && (
                <div className="absolute bottom-4 left-4 z-10 bg-white/90 backdrop-blur-sm rounded-lg shadow-xl border border-slate-200 overflow-hidden pointer-events-none" style={{ width: MINIMAP_SIZE, height: MINIMAP_SIZE }}>
                    <Stage width={MINIMAP_SIZE} height={MINIMAP_SIZE}>
                        <Layer>
                            {mapAssets.map((asset, idx) => (
                                <Path key={`mini-asset-${idx}`} data={asset.path_data} fill="#475569" x={minimapX} y={minimapY} scaleX={minimapScale} scaleY={minimapScale} />
                            ))}
                            {zonesData.map((zone, idx) => {
                                const colors = getZoneColor(zone._id);
                                return (
                                    <Path key={`mini-zone-${idx}`} data={zone.path_data || zone.layout_map} fill={colors.fill} stroke={colors.stroke} strokeWidth={2} x={minimapX} y={minimapY} scaleX={minimapScale} scaleY={minimapScale} />
                                );
                            })}
                            <Rect
                                x={minimapX + (-stageConfig.x / stageConfig.scale) * minimapScale}
                                y={minimapY + (-stageConfig.y / stageConfig.scale) * minimapScale}
                                width={(window.innerWidth / stageConfig.scale) * minimapScale}
                                height={(600 / stageConfig.scale) * minimapScale}
                                stroke="#ef4444"
                                strokeWidth={2}
                                cornerRadius={2}
                            />
                        </Layer>
                    </Stage>
                </div>
            )}

            <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-1 bg-white/90 backdrop-blur shadow-xl rounded-lg border border-slate-200 overflow-hidden pointer-events-auto">
                <button onClick={() => handleZoomButton(1)} className="w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-primary transition-colors text-xl font-medium active:bg-slate-200" >+</button>
                <div className="w-full h-[1px] bg-slate-200"></div>
                <button onClick={() => handleZoomButton(-1)} className="w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-primary transition-colors text-2xl font-medium active:bg-slate-200" >-</button>
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
        </div>
    );
}