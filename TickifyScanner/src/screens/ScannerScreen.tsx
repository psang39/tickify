import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useScannerStore } from '../stores/useScannerStore';
import { extractTicketId, offlineScanProcess } from '../utils/scannerUtils';
import { onlineCheckIn } from '../api/scannerApi';
import { ApiError } from '../api/client';
import { ScanMode } from '../types/scanner';
import { getShowBadgeLabel, getShowTimeState } from '../utils/showUtils';

type Props = NativeStackScreenProps<RootStackParamList, 'Scanner'>;

export default function ScannerScreen({ navigation, route }: Props) {
    const { show } = route.params;
    const [permission, requestPermission] = useCameraPermissions();
    const publicKey = useScannerStore((state) => state.publicKeysByShowId[show._id] || show.public_key);
    const addScannedTicket = useScannerStore((state) => state.addScannedTicket);
    const hasTicketInShow = useScannerStore((state) => state.hasTicketInShow);
    const allScannedTickets = useScannerStore((state) => state.scannedTickets);
    const scannedTickets = useMemo(
        () => allScannedTickets.filter((ticket) => ticket.showId === show._id),
        [allScannedTickets, show._id],
    );
    const pendingTickets = useMemo(
        () => scannedTickets.filter((ticket) => !ticket.synced && ticket.status === 'LOCAL_VALID'),
        [scannedTickets],
    );
    const markTicketSynced = useScannerStore((state) => state.markTicketSynced);

    const [mode, setMode] = useState<ScanMode>('online');
    const [scanned, setScanned] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [scanTitle, setScanTitle] = useState('Sẵn sàng quét vé');
    const [scanMessage, setScanMessage] = useState('Hướng camera vào QR trên vé của khách.');
    const [resultType, setResultType] = useState<'idle' | 'success' | 'warning' | 'error'>('idle');

    const showState = useMemo(() => getShowTimeState(show), [show]);

    if (!permission) return <View style={styles.container} />;

    if (!permission.granted) {
        return (
            <SafeAreaView style={styles.centerContainer}>
                <Text style={styles.permissionTitle}>Cần quyền Camera</Text>
                <Text style={styles.permissionText}>App cần camera để quét QR vé.</Text>
                <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
                    <Text style={styles.primaryButtonText}>Cấp quyền camera</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const saveOfflineValidTicket = (ticketId: string, message: string) => {
        const saved = addScannedTicket({
            ticketId,
            showId: show._id,
            showName: show.name,
            synced: false,
            status: 'LOCAL_VALID',
            message,
        });

        if (saved.status === 'DUPLICATE_LOCAL') {
            setResultType('warning');
            setScanTitle('Vé đã được quét trên máy này');
            setScanMessage('Không nên cho khách đi qua lần nữa nếu chưa xác minh với server.');
            return;
        }

        setResultType('success');
        setScanTitle('Vé hợp lệ');
        setScanMessage(mode === 'offline' ? 'Đã lưu vào danh sách chờ đồng bộ.' : message);
    };

    const handleOfflineScan = async (qrData: string) => {
        if (!publicKey) {
            setResultType('error');
            setScanTitle('Chưa có public key');
            setScanMessage('Hãy quay lại màn hình show và mở lại show này khi có mạng để tải public key.');
            return;
        }

        const result = await offlineScanProcess(qrData, publicKey);
        if (!result.success || !result.ticketId) {
            setResultType('error');
            setScanTitle('Vé không hợp lệ');
            setScanMessage(result.message);
            return;
        }

        if (hasTicketInShow(show._id, result.ticketId)) {
            setResultType('warning');
            setScanTitle('Vé đã được quét trên thiết bị này');
            setScanMessage('Cơ chế Set/local store đã chặn quét trùng vé này.');
            return;
        }

        saveOfflineValidTicket(result.ticketId, result.message);
    };

    const handleOnlineScan = async (qrData: string) => {
        const ticketId = extractTicketId(qrData);
        if (ticketId && hasTicketInShow(show._id, ticketId)) {
            setResultType('warning');
            setScanTitle('Vé đã được quét trên thiết bị này');
            setScanMessage('Không gửi lại server để tránh dùng vé nhiều lần.');
            return;
        }

        try {
            const response = await onlineCheckIn(show._id, qrData);
            const usedTicketId = response.ticketInfo?.ticket_id || ticketId;
            if (usedTicketId) {
                addScannedTicket({
                    ticketId: usedTicketId,
                    showId: show._id,
                    showName: show.name,
                    synced: true,
                    status: 'SYNCED_USED',
                    message: response.message,
                });
                markTicketSynced(show._id, usedTicketId, response.message);
            }
            setResultType('success');
            setScanTitle('Check-in thành công');
            setScanMessage('Server đã chuyển vé sang USED.');
        } catch (err: any) {
            const message = String(err.message || 'Không thể kết nối tới server');

            if (err instanceof ApiError && err.status < 500) {
                setResultType(message.includes('đã được sử dụng') ? 'warning' : 'error');
                setScanTitle(message.includes('đã được sử dụng') ? 'Vé đã dùng' : 'Server từ chối vé');
                setScanMessage(message);
                return;
            }

            setResultType('warning');
            setScanTitle('Không kết nối được server');
            setScanMessage('Đã thử chuyển sang quét offline trên thiết bị này.');
            await handleOfflineScan(qrData);
        }
    };

    const handleBarCodeScanned = async ({ data }: { type: string; data: string }) => {
        if (isProcessing) return;
        setScanned(true);
        setIsProcessing(true);
        setResultType('idle');
        setScanTitle('Đang xử lý...');
        setScanMessage('Vui lòng giữ nguyên vé trong vài giây.');

        try {
            if (mode === 'online') {
                await handleOnlineScan(data);
            } else {
                await handleOfflineScan(data);
            }
        } catch (err: any) {
            setResultType('error');
            setScanTitle('Lỗi xử lý vé');
            setScanMessage(err.message || 'Vui lòng thử lại.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.infoBar}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.showName}>{show.name}</Text>
                    <Text style={styles.showStatus}>{getShowBadgeLabel(showState)} · {pendingTickets.length} vé chờ sync</Text>
                </View>
                <TouchableOpacity style={styles.syncButton} onPress={() => navigation.navigate('Sync', { showId: show._id })}>
                    <Text style={styles.syncButtonText}>Sync</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.modeSwitch}>
                <TouchableOpacity
                    style={[styles.modeButton, mode === 'online' && styles.modeButtonActive]}
                    onPress={() => setMode('online')}
                >
                    <Text style={[styles.modeText, mode === 'online' && styles.modeTextActive]}>Online</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.modeButton, mode === 'offline' && styles.modeButtonActive]}
                    onPress={() => setMode('offline')}
                >
                    <Text style={[styles.modeText, mode === 'offline' && styles.modeTextActive]}>Offline</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.cameraWrapper}>
                <CameraView
                    style={StyleSheet.absoluteFillObject}
                    facing="back"
                    onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                    barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                />
                <View style={styles.overlay}>
                    <View style={styles.scanFrame} />
                </View>
            </View>

            <View style={[styles.resultBox, styles[`${resultType}Result` as keyof typeof styles] as object]}>
                <Text style={styles.resultTitle}>{scanTitle}</Text>
                <Text style={styles.resultMessage}>{scanMessage}</Text>
                {isProcessing && <ActivityIndicator color="#262880" style={{ marginTop: 8 }} />}
                {scanned && !isProcessing && (
                    <TouchableOpacity style={styles.nextButton} onPress={() => setScanned(false)}>
                        <Text style={styles.nextButtonText}>Quét vé tiếp theo</Text>
                    </TouchableOpacity>
                )}
            </View>

            <View style={styles.historyBox}>
                <Text style={styles.historyTitle}>Vé đã quét gần đây</Text>
                <FlatList
                    data={scannedTickets.slice(0, 5)}
                    keyExtractor={(item) => `${item.showId}-${item.ticketId}-${item.scannedAt}`}
                    renderItem={({ item }) => (
                        <View style={styles.historyItem}>
                            <Text style={styles.historyTicket} numberOfLines={1}>{item.ticketId}</Text>
                            <Text style={styles.historyStatus}>{item.synced ? 'Đã dùng / USED' : item.status === 'DUPLICATE_LOCAL' ? 'Quét trùng' : 'Chờ sync'}</Text>
                        </View>
                    )}
                    ListEmptyComponent={<Text style={styles.emptyHistory}>Chưa có vé nào được quét.</Text>}
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0b1020' },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fff' },
    permissionTitle: { fontSize: 22, fontWeight: '800', color: '#101828' },
    permissionText: { color: '#667085', marginTop: 8, marginBottom: 18 },
    primaryButton: { backgroundColor: '#262880', paddingHorizontal: 18, paddingVertical: 13, borderRadius: 12 },
    primaryButtonText: { color: '#fff', fontWeight: '800' },
    infoBar: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
    showName: { color: '#101828', fontSize: 18, fontWeight: '800' },
    showStatus: { color: '#667085', marginTop: 3 },
    syncButton: { backgroundColor: '#eef2ff', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
    syncButtonText: { color: '#262880', fontWeight: '800' },
    modeSwitch: { flexDirection: 'row', gap: 10, padding: 12, backgroundColor: '#fff' },
    modeButton: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center', backgroundColor: '#f2f4f7' },
    modeButtonActive: { backgroundColor: '#262880' },
    modeText: { color: '#344054', fontWeight: '800' },
    modeTextActive: { color: '#fff' },
    cameraWrapper: { flex: 1, overflow: 'hidden' },
    overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
    scanFrame: { width: 250, height: 250, borderWidth: 3, borderColor: '#fff', borderRadius: 24, backgroundColor: 'transparent' },
    resultBox: { margin: 12, padding: 14, borderRadius: 16, backgroundColor: '#fff' },
    idleResult: { borderLeftWidth: 5, borderLeftColor: '#98a2b3' },
    successResult: { borderLeftWidth: 5, borderLeftColor: '#22c55e' },
    warningResult: { borderLeftWidth: 5, borderLeftColor: '#f59e0b' },
    errorResult: { borderLeftWidth: 5, borderLeftColor: '#ef4444' },
    resultTitle: { fontSize: 17, fontWeight: '800', color: '#101828' },
    resultMessage: { color: '#475467', marginTop: 5, lineHeight: 19 },
    nextButton: { marginTop: 12, backgroundColor: '#262880', padding: 13, borderRadius: 12, alignItems: 'center' },
    nextButtonText: { color: '#fff', fontWeight: '800' },
    historyBox: { maxHeight: 160, backgroundColor: '#fff', padding: 12 },
    historyTitle: { fontWeight: '800', color: '#101828', marginBottom: 8 },
    historyItem: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eef0f4' },
    historyTicket: { flex: 1, color: '#344054', fontWeight: '600' },
    historyStatus: { color: '#262880', fontWeight: '800' },
    emptyHistory: { color: '#98a2b3' },
});
