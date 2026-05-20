import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useScannerStore } from '../stores/useScannerStore';
import { offlineScanProcess } from '../utils/scannerUtils';
import * as SecureStore from 'expo-secure-store';

export default function ScannerScreen() {
    const addTicket = useScannerStore((state) => state.addTicket);
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [scanResult, setScanResult] = useState('Hướng camera vào mã QR của vé');

    if (!permission) return <View />;

    if (!permission.granted) {
        return (
            <View style={styles.container}>
                <Text style={{ textAlign: 'center', marginBottom: 10 }}>Cần cấp quyền Camera để soát vé</Text>
                <Button onPress={requestPermission} title="Cấp quyền" />
            </View>
        );
    }

    const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
        setScanned(true);
        setScanResult(`Đang xử lý vé...`);

        const publicKey = await SecureStore.getItemAsync('RSA_PUBLIC_KEY');

        if (!publicKey) {
            setScanResult('LỖI: Chưa có Public Key. Hãy quay lại đồng bộ.');
            return;
        }
        offlineScanProcess(data, publicKey).then(result => {
            setScanResult(result.message);
            if (result.success && result.ticketId) {
                addTicket(result.ticketId);
            }
        }).catch(error => {
            console.error(error);
            setScanResult('Lỗi khi xử lý vé. Vui lòng thử lại.');
        });

        console.log("Public Key trong máy:", publicKey);

    };

    return (
        <View style={styles.container}>
            <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                barcodeScannerSettings={{
                    barcodeTypes: ["qr"],
                }}
            />

            {/* Khung nhắm QR */}
            <View style={styles.overlay}>
                <View style={styles.scanFrame} />
            </View>

            <View style={styles.resultBox}>
                <Text style={styles.resultText}>{scanResult}</Text>
                {scanned && (
                    <Button title="QUÉT VÉ TIẾP THEO" onPress={() => setScanned(false)} />
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center' },
    overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
    scanFrame: { width: 250, height: 250, borderWidth: 2, borderColor: '#ec4899', backgroundColor: 'transparent' },
    resultBox: { position: 'absolute', bottom: 40, left: 20, right: 20, backgroundColor: 'white', padding: 20, borderRadius: 10, alignItems: 'center', elevation: 5 },
    resultText: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' }
});