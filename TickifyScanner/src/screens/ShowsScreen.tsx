import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { getAssignedShows, getShowPublicKey } from '../api/scannerApi';
import { useScannerStore } from '../stores/useScannerStore';
import { AssignedShow } from '../types/scanner';
import { formatDateTime, getShowBadgeLabel, getShowTimeState } from '../utils/showUtils';

type Props = NativeStackScreenProps<RootStackParamList, 'Shows'>;

export default function ShowsScreen({ navigation }: Props) {
    const user = useScannerStore((state) => state.user);
    const logout = useScannerStore((state) => state.logout);
    const setSelectedShow = useScannerStore((state) => state.setSelectedShow);
    const savePublicKey = useScannerStore((state) => state.savePublicKey);
    const pendingCount = useScannerStore((state) => state.scannedTickets.filter(t => !t.synced && t.status === 'LOCAL_VALID').length);

    const [shows, setShows] = useState<AssignedShow[]>([]);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [openingShowId, setOpeningShowId] = useState<string | null>(null);

    const sortedShows = useMemo(() => {
        return [...shows].sort((a, b) => {
            const stateA = getShowTimeState(a) === 'ongoing' ? 0 : 1;
            const stateB = getShowTimeState(b) === 'ongoing' ? 0 : 1;
            return stateA - stateB || new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
        });
    }, [shows]);

    const loadShows = useCallback(async () => {
        setError('');
        try {
            const response = await getAssignedShows();
            setShows(response.docs || []);
        } catch (err: any) {
            setError(err.message || 'Không tải được danh sách show.');
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadShows();
    }, [loadShows]);

    const openScanner = async (show: AssignedShow) => {
        setOpeningShowId(show._id);
        try {
            const keyResponse = await getShowPublicKey(show._id);
            savePublicKey(show._id, keyResponse.data.public_key);
            const showWithKey = { ...show, public_key: keyResponse.data.public_key };
            setSelectedShow(showWithKey);
            navigation.navigate('Scanner', { show: showWithKey });
        } catch (err: any) {
            setError(err.message || 'Không tải được public key của show.');
        } finally {
            setOpeningShowId(null);
        }
    };

    const handleLogout = () => {
        logout();
        navigation.replace('Login');
    };

    const renderShow = ({ item }: { item: AssignedShow }) => {
        const state = getShowTimeState(item);
        const isOngoing = state === 'ongoing';

        return (
            <TouchableOpacity
                style={[styles.showCard, isOngoing && styles.ongoingCard]}
                onPress={() => openScanner(item)}
                disabled={openingShowId === item._id}
            >
                <View style={styles.showHeader}>
                    <Text style={styles.showName}>{item.name}</Text>
                    <View style={[styles.badge, isOngoing && styles.ongoingBadge]}>
                        <Text style={[styles.badgeText, isOngoing && styles.ongoingBadgeText]}>{getShowBadgeLabel(state)}</Text>
                    </View>
                </View>
                <Text style={styles.showTime}>{formatDateTime(item.start_time)} → {formatDateTime(item.end_time)}</Text>
                <Text style={styles.venue}>{item.venue_id?.name || 'Chưa có địa điểm'}</Text>
                {openingShowId === item._id && <ActivityIndicator style={styles.cardLoading} color="#262880" />}
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Xin chào, {user?.first_name || 'Staff'}</Text>
                    <Text style={styles.subGreeting}>Chọn show để tải public key và bắt đầu quét.</Text>
                </View>
                <TouchableOpacity onPress={handleLogout}><Text style={styles.logout}>Đăng xuất</Text></TouchableOpacity>
            </View>

            <View style={styles.syncBox}>
                <Text style={styles.syncText}>{pendingCount} vé offline chưa đồng bộ</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Sync', undefined)}>
                    <Text style={styles.syncLink}>Mở đồng bộ</Text>
                </TouchableOpacity>
            </View>

            {isLoading ? (
                <ActivityIndicator style={{ marginTop: 40 }} color="#262880" />
            ) : (
                <FlatList
                    data={sortedShows}
                    keyExtractor={(item) => item._id}
                    renderItem={renderShow}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadShows(); }} />}
                    ListEmptyComponent={<Text style={styles.empty}>Bạn chưa được phân công show nào.</Text>}
                    ListHeaderComponent={!!error ? <Text style={styles.errorText}>{error}</Text> : null}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f6f7fb' },
    header: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
    greeting: { fontSize: 22, fontWeight: '800', color: '#101828' },
    subGreeting: { color: '#667085', marginTop: 4 },
    logout: { color: '#b42318', fontWeight: '700', marginTop: 4 },
    syncBox: { marginHorizontal: 18, marginBottom: 8, padding: 14, borderRadius: 14, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-between' },
    syncText: { color: '#344054', fontWeight: '600' },
    syncLink: { color: '#262880', fontWeight: '800' },
    listContent: { padding: 18, gap: 12 },
    showCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#eef0f4', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
    ongoingCard: { borderColor: '#22c55e', backgroundColor: '#f0fdf4' },
    showHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' },
    showName: { flex: 1, fontSize: 17, fontWeight: '800', color: '#101828' },
    showTime: { color: '#344054', marginTop: 10, lineHeight: 20 },
    venue: { color: '#667085', marginTop: 4 },
    badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, backgroundColor: '#eef2ff' },
    badgeText: { color: '#3538cd', fontWeight: '700', fontSize: 12 },
    ongoingBadge: { backgroundColor: '#dcfce7' },
    ongoingBadgeText: { color: '#15803d' },
    cardLoading: { marginTop: 12 },
    errorText: { color: '#b42318', marginBottom: 12, lineHeight: 20 },
    empty: { textAlign: 'center', color: '#667085', marginTop: 40 },
});
