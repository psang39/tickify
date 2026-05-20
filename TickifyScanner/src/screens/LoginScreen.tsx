import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

export default function LoginScreen({ navigation }: Props) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = () => {
        // Tạm thời bỏ qua gọi API đăng nhập, check hardcode cho nhanh
        if (username && password) {
            navigation.replace('SyncKey');
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Soát Vé Dề Dê</Text>
            <TextInput
                style={styles.input}
                placeholder="Tên đăng nhập"
                value={username}
                onChangeText={setUsername}
            />
            <TextInput
                style={styles.input}
                placeholder="Mật khẩu"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
            />
            <TouchableOpacity style={styles.button} onPress={handleLogin}>
                <Text style={styles.buttonText}>Đăng nhập</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#f8fafc' },
    title: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 40, color: '#ec4899' },
    input: { backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0' },
    button: { backgroundColor: '#ec4899', padding: 15, borderRadius: 10, alignItems: 'center' },
    buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});