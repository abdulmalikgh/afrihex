import { PlaceholderScreen } from '../../../screens/PlaceholderScreen';

export function CertificatesScreen() {
  return (
    <PlaceholderScreen
      eyebrow="Verify"
      title="Verify public address certificates"
      description="Certificate status, revocation, signature validity, issuer, issued date, and PDF sharing will live here."
      code="GH-CERT-ABC123"
      primaryAction="Verify certificate"
    />
  );
}
