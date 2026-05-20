import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useScannerStore } from '../stores/useScannerStore';

type Props = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'SyncKey'>;
};

export default function SyncKeyScreen({ navigation }: Props) {
    const offlineTickets = useScannerStore((state) => state.offlineTickets);
    const clearAllTickets = useScannerStore((state) => state.clearAllTickets);
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState('Chưa đồng bộ');
    const syncTicketsToServer = async () => {
        if (offlineTickets.length === 0) {
            alert("Không có vé nào cần đồng bộ!");
            return;
        }

        try {
            const response = await fetch('http://192.168.X.X:3000/api/v1/tickets/sync-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tickets: offlineTickets })
            });

            if (response.ok) {
                alert(`Đã đồng bộ thành công ${offlineTickets.length} vé!`);

                clearAllTickets();
            }
        } catch (error) {
            alert("Mất mạng! Hãy thử lại sau.");
        }
    };
    const fetchPublicKey = async () => {
        setIsLoading(true);
        setStatus('Đang tải Public Key...');

        try {
            // ⚠️ Đổi IP này thành IP LAN thật của máy tính bạn (VD: http://192.168.1.5:3000)
            // KHÔNG dùng localhost vì máy ảo điện thoại không hiểu localhost là máy tính của bạn
            const response = await fetch('http://192.168.X.X:3000/api/v1/keys/public');
            const data = await response.json();

            if (data.publicKey) {
                await SecureStore.setItemAsync('RSA_PUBLIC_KEY', data.publicKey);
                setStatus('Đồng bộ thành công!');
                setTimeout(() => {
                    navigation.replace('Scanner');
                }, 1000);
            }
        } catch (error) {
            console.error(error);
            setStatus('Lỗi kết nối tới Server');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.statusText}>{status}</Text>

            {isLoading ? (
                <ActivityIndicator size="large" color="#ec4899" />
            ) : (
                <View>
                    <TouchableOpacity style={styles.button} onPress={fetchPublicKey}>
                        <Text style={styles.buttonText}>Bắt đầu tải dữ liệu</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.button]} onPress={syncTicketsToServer}>
                        <Text style={styles.buttonText}>Đồng bộ {offlineTickets.length} vé đã quét</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    statusText: { fontSize: 18, marginBottom: 20, fontWeight: 'bold' },
    button: { backgroundColor: '#10b981', padding: 15, borderRadius: 10, width: '100%', alignItems: 'center' },
    buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});