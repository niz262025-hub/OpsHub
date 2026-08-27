import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>OPSHUB / PHASE 0</Text>
        <Text style={styles.title}>Private trade, built on trust.</Text>
        <Text style={styles.body}>The mobile foundation is ready for future product work.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f3ed' },
  content: { flex: 1, justifyContent: 'center', padding: 32 },
  eyebrow: { color: '#d95d39', fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  title: { color: '#17221f', fontSize: 46, lineHeight: 48, marginTop: 24 },
  body: { color: '#60716b', fontSize: 18, lineHeight: 27, marginTop: 20 },
});
