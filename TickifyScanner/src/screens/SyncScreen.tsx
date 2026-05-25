import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { syncOfflineTickets } from '../api/scannerApi';
import { useScannerStore } from '../stores/useScannerStore';

type Props = NativeStackScreenProps<RootStackParamList, 'Sync'>;

export default function SyncScreen({ route }: Props) {
    const routeShowId = route.params?.showId;
    const scannedTickets = useScannerStore((state) => state.scannedTickets);
    const markTicketSynced = useScannerStore((state) => state.markTicketSynced);
    const markTicketFailed = useScannerStore((state) => state.markTicketFailed);
    const clearSyncedTickets = useScannerStore((state) => state.clearSyncedTickets);

    const [isSyncing, setIsSyncing] = useState(false);
    const [message, setMessage] = useState('');

    const pendingGroups = useMemo(() => {
        const pending = scannedTickets.filter(ticket => {
            if (routeShowId && ticket.showId !== routeShowId) return false;
            return !ticket.synced && ticket.status === 'LOCAL_VALID';
        });

        return pending.reduce<Record<string, typeof pending>>((acc, ticket) => {
            acc[ticket.showId] = acc[ticket.showId] || [];
            acc[ticket.showId].push(ticket);
            return acc;
        }, {});
    }, [routeShowId, scannedTickets]);

    const pendingList = Object.values(pendingGroups).flat();

    const handleSync = async () => {
        if (pendingList.length === 0) {
            setMessage('Không có vé offline nào cần đồng bộ.');
            return;
        }

        setIsSyncing(true);
        setMessage('');
        try {
            let totalSuccess = 0;
            let totalFailed = 0;

            for (const [showId, tickets] of Object.entries(pendingGroups)) {
                const response = await syncOfflineTickets(showId, tickets);
                totalSuccess += response.successCount;
                totalFailed += response.failedCount;

                response.results.forEach((result) => {
                    if (result.success) {
                        markTicketSynced(showId, result.ticketId, 'Đã sync và chuyển sang USED');
                    } else {
                        const status = result.reason === 'USED' ? 'SERVER_USED' : 'ERROR';
                        markTicketFailed(showId, result.ticketId, status, result.reason || 'Sync thất bại');
                    }
                });
            }

            setMessage(`Đồng bộ xong: ${totalSuccess} vé thành công, ${totalFailed} vé cần kiểm tra.`);
        } catch (err: any) {
            setMessage(err.message || 'Không đồng bộ được. Kiểm tra mạng/server rồi thử lại.');
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.summaryCard}>
                <Text style={styles.title}>Đồng bộ vé offline</Text>
                <Text style={styles.subtitle}>Các vé quét offline sẽ được gửi lên server và đổi status thành USED.</Text>
                <Text style={styles.count}>{pendingList.length} vé đang chờ đồng bộ</Text>

                <TouchableOpacity style={styles.primaryButton} onPress={handleSync} disabled={isSyncing}>
                    {isSyncing ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Đồng bộ ngay</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={styles.secondaryButton} onPress={() => clearSyncedTickets(routeShowId)}>
                    <Text style={styles.secondaryButtonText}>Xóa lịch sử đã sync</Text>
                </TouchableOpacity>

                {!!message && <Text style={styles.message}>{message}</Text>}
            </View>

            <FlatList
                data={scannedTickets.filter(ticket => !routeShowId || ticket.showId === routeShowId)}
                keyExtractor={(item) => `${item.showId}-${item.ticketId}-${item.scannedAt}`}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                    <View style={styles.ticketCard}>
                        <Text style={styles.ticketId} numberOfLines={1}>{item.ticketId}</Text>
                        <Text style={styles.ticketMeta}>{item.showName || item.showId}</Text>
                        <Text style={styles.ticketStatus}>
                            {item.synced ? 'Đã dùng / USED' : item.status === 'SERVER_USED' ? 'Server báo đã dùng' : item.status === 'DUPLICATE_LOCAL' ? 'Quét trùng' : 'Chờ sync'}
                        </Text>
                        {!!item.message && <Text style={styles.ticketMessage}>{item.message}</Text>}
                    </View>
                )}
                ListEmptyComponent={<Text style={styles.empty}>Chưa có lịch sử quét vé.</Text>}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f6f7fb' },
    summaryCard: { margin: 16, backgroundColor: '#fff', borderRadius: 18, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
    title: { fontSize: 22, fontWeight: '800', color: '#101828' },
    subtitle: { color: '#667085', marginTop: 6, lineHeight: 20 },
    count: { marginTop: 14, color: '#262880', fontWeight: '800', fontSize: 16 },
    primaryButton: { backgroundColor: '#262880', marginTop: 14, padding: 14, borderRadius: 12, alignItems: 'center' },
    primaryButtonText: { color: '#fff', fontWeight: '800' },
    secondaryButton: { backgroundColor: '#eef2ff', marginTop: 10, padding: 13, borderRadius: 12, alignItems: 'center' },
    secondaryButtonText: { color: '#262880', fontWeight: '800' },
    message: { marginTop: 12, color: '#344054', lineHeight: 20 },
    listContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
    ticketCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#eef0f4' },
    ticketId: { color: '#101828', fontWeight: '800' },
    ticketMeta: { color: '#667085', marginTop: 4 },
    ticketStatus: { color: '#262880', fontWeight: '800', marginTop: 8 },
    ticketMessage: { color: '#667085', marginTop: 4 },
    empty: { textAlign: 'center', color: '#98a2b3', marginTop: 30 },
});
