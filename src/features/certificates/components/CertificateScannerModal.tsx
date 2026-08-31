import { useEffect, useState, type ReactNode } from 'react';
import { Linking, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { X } from 'lucide-react-native';

import { AppButton, AppText } from '../../../components';
import { colors } from '../../../constants/colors';
import { radius } from '../../../constants/radius';
import { spacing } from '../../../constants/spacing';
import { extractCertificateId } from '../utils/certificateId';

type CertificateScannerModalProps = {
  visible: boolean;
  onClose: () => void;
  onDetected: (certificateId: string) => void;
};

/**
 * Scans the QR code printed on a certificate. The code encodes the full
 * verification URL rather than a bare ID, so anything that isn't in that shape
 * is ignored and the camera keeps looking — scanning a poster or a Wi-Fi code
 * should not send a stray string to the verification endpoint.
 */
export function CertificateScannerModal({
  visible,
  onClose,
  onDetected,
}: CertificateScannerModalProps) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {/*
        A Modal renders outside the app's view hierarchy, so the safe-area values
        from the root provider don't reach it — react-native-safe-area-context
        asks for its own provider at the root of a modal. Without this the close
        button sits under the status bar on notched devices.
      */}
      <SafeAreaProvider>
        <ScannerContent visible={visible} onClose={onClose} onDetected={onDetected} />
      </SafeAreaProvider>
    </Modal>
  );
}

function ScannerContent({ visible, onClose, onDetected }: CertificateScannerModalProps) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [detected, setDetected] = useState(false);
  const [unrecognized, setUnrecognized] = useState(false);

  // A hidden Modal unmounts its children, so closing usually resets this state
  // by itself. Re-arming on `visible` as well means the scanner still works on a
  // second open if that ever stops being true — and pairs with the mount guard
  // below, which keeps the camera off rather than filming a closed sheet.
  useEffect(() => {
    if (!visible) {
      setDetected(false);
      setUnrecognized(false);
    }
  }, [visible]);

  const handleBarcodeScanned = ({ data }: BarcodeScanningResult) => {
    // The camera keeps firing while a code is in frame; the first accepted scan
    // wins and the rest are dropped so a single code can't submit twice.
    if (detected) {
      return;
    }

    const certificateId = extractCertificateId(data);

    if (!certificateId) {
      setUnrecognized(true);
      return;
    }

    setDetected(true);
    onDetected(certificateId);
  };

  return (
    <View style={styles.container}>
      {/* Mounted only while open so the camera is released when it isn't. */}
      {visible && permission?.granted ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handleBarcodeScanned}
        />
      ) : null}

      <View style={[styles.overlay, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.toolbar}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close the scanner"
            hitSlop={12}
            style={styles.close}
          >
            <X color={colors.text} size={22} />
          </Pressable>
        </View>

        <PermissionGate
          permission={permission}
          onRequestPermission={requestPermission}
          unrecognized={unrecognized}
        />
      </View>
    </View>
  );
}

type PermissionGateProps = {
  permission: ReturnType<typeof useCameraPermissions>[0];
  onRequestPermission: () => void;
  unrecognized: boolean;
};

function PermissionGate({ permission, onRequestPermission, unrecognized }: PermissionGateProps) {
  if (!permission) {
    return (
      <Message title="Preparing the camera" body="This only takes a moment." />
    );
  }

  if (!permission.granted) {
    // Manual entry always remains available on the screen behind this, so a
    // refused camera closes off one route to a certificate, never the feature.
    return permission.canAskAgain ? (
      <Message
        title="Camera access needed"
        body="AfriHex uses the camera only to read the QR code on a certificate."
      >
        <AppButton onPress={onRequestPermission}>Allow camera access</AppButton>
      </Message>
    ) : (
      <Message
        title="Camera access is off"
        body="Turn the camera on for AfriHex in your device settings, or close this and type the certificate ID instead."
      >
        <AppButton variant="secondary" onPress={() => void Linking.openSettings()}>
          Open settings
        </AppButton>
      </Message>
    );
  }

  return (
    <View style={styles.viewfinderArea}>
      <View style={styles.viewfinder} />
      <AppText variant="caption" tone="muted" align="center" style={styles.hint}>
        {unrecognized
          ? "That code isn't an AfriHex certificate. Point the camera at the QR code printed on the certificate."
          : 'Point the camera at the QR code printed on the certificate.'}
      </AppText>
    </View>
  );
}

function Message({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <View style={styles.message}>
      <AppText variant="subtitle" align="center">
        {title}
      </AppText>
      <AppText variant="caption" tone="muted" align="center">
        {body}
      </AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  overlay: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  close: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.round,
    backgroundColor: colors.card,
  },
  viewfinderArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  viewfinder: {
    width: 240,
    height: 240,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.primaryLight,
  },
  hint: {
    maxWidth: 300,
  },
  message: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
});
