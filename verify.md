# Certificate API — Mobile Integration Guide

Audience: the mobile team, integrating the signed verification-certificate
feature. For the deeper "why signed certs matter to auditors/regulators"
story, see [CERTIFICATES.md](./CERTIFICATES.md) — this doc is narrower and
implementation-focused, and corrects two things that doc gets wrong about
routing (noted inline below, verified against the actual server code and
`cmd/server/routes.go` as of this writing).

## TL;DR

| Call | Auth | When you use it |
|---|---|---|
| `POST /v2/kyc/verify` | `X-API-Key` | The mobile call — user enters a GPS code, or taps "Use my location". A certificate is issued as a side effect. |
| `GET /v2/certificates/{id}/verify` | **None** | Check a cert's status (valid / revoked). Your main integration point after that. |
| `GET /v2/certificates/{id}/pdf` | **None** | Get a shareable, printable PDF (has a QR code baked in) |
| `GET /v2/certificates/{id}` | `X-API-Key` | Full JSON incl. subject/address/integrity (PII) — only if you need the raw payload |


Base URL: `https://api.afrihex.com`

## 1. How you get a certificate

**There's no standalone "issue a certificate" call.** For mobile, a
certificate is issued automatically as a side effect of `POST /v2/kyc/verify`
— see [The mobile flow](#the-mobile-flow--keep-it-simple) below for the exact
two ways to call it. (`POST /v2/verify/proximity` also issues certs, but
that's a separate feature — comparing a *declared* address against a live
device fix with mock-location/device-integrity checks, for a physical-visit
use case — not something the simple onboarding flow needs. If that comes up
later, it's the same response shape, see [BANKING_INTEGRATION.md](./BANKING_INTEGRATION.md).)

The response carries an optional `certificate` object:

```json
{
  "success": true,
  "data": {
    "verification_id": "...",
    "verified": true,
    "...": "...",
    "certificate": {
      "id": "cert_GPU4XBpCp7q",
      "verification_url": "https://api.afrihex.com/v2/certificates/cert_GPU4XBpCp7q/verify",
      "json_url": "https://api.afrihex.com/v2/certificates/cert_GPU4XBpCp7q",
      "pdf_url": "https://api.afrihex.com/v2/certificates/cert_GPU4XBpCp7q/pdf",
      "jwks_url": "https://api.afrihex.com/.well-known/verification-key.json",
      "issued_at": "2026-04-27T14:06:25Z"
    }
  }
}
```

`certificate` is **optional** (`omitempty`) — treat its absence as normal, not
an error. It's omitted when cert signing isn't configured server-side, or if
issuance failed for any reason; either way the verification call itself still
succeeded. Just check `data.certificate != null` before using it.

**Important — a certificate is not proof of a passing verification.** It's
issued for both successful and failed verification attempts; it's proof an
attempt happened and was signed, nothing more. Always read the actual result
off the verification response itself (`verified`, `result`/`confidence`)
before showing a "Verified" state in your UI — don't infer pass/fail from
whether a certificate exists.

### The mobile flow — keep it simple

`POST /v2/kyc/verify` accepts four input methods (`gps_fix`, `manual`,
`hex_code`, `gps_code`) because the API serves several different clients.
**The mobile app only needs two of them** — the same two the
[Address Widget](https://maps.afrihex.com/widget-demo) exposes on the web:
a GPS-code field, and a "Use my location" button. Don't build UI for
`hex_code` or `manual` entry; there's no mobile use case for them and it's
extra surface area for nothing.

The mobile app already has the user's `X-API-Key` from login, so the entire
feature is: collect one of the two inputs below, call `kyc/verify`, act on
the response. No separate "get a token" step, no config beyond the key you
already have.

**Option A — they type a GPS code:**

```json
POST /v2/kyc/verify
{
  "customer_id": "<your user id>",
  "method": "gps_code",
  "location": { "gps_code": "GA-142-7281" },
}
```

**Option B — "Use my location" (device GPS):**

```json
POST /v2/kyc/verify
{
  "customer_id": "<your user id>",
  "method": "gps_fix",
  "location": { "lat": 5.6037, "lng": -0.1870 },
}
```

That's the whole decision tree — one text field or one button tap, nothing
else to configure. 

Whichever option they use, the response shape (and the optional `certificate`
block from step 1) is identical — the rest of this doc doesn't change based
on which method they picked.

### The result screen

After a successful call, show the same fields the
[web widget](https://maps.afrihex.com/widget-demo)'s result card shows —
nothing extra needed:

| Shown as | Comes from |
|---|---|
| Hex address (e.g. `AF-GH-7-0GXTJJB0ZZZZZ`) | `data.hex_code` |
| GPS code (e.g. `GD-192-0070`) | `data.ghanapost_code` |
| Region / Area (e.g. "Greater Accra / Adenta") | `data.address.region` / `data.address.area` |
| Quality (e.g. "100%") | `data.quality_score` × 100 |
| Confidence (e.g. "medium") | `data.verification.confidence` |
| "View signed certificate" link | `data.certificate.pdf_url` — only show this row if `data.certificate` is present (see the optionality note above) |

That's it — six fields, one of them a link. Don't build anything beyond this
card for the success state; the failure state is just "verified: false" with
whatever region/quality data came back, same fields, no separate UI needed.

## 2. Checking a certificate's status — `GET /v2/certificates/{id}/verify`

This is your main integration point. No auth header, works for any cert ID,
and is what you'd call to re-check a cert later (e.g. before showing a
"Verified" badge on a profile screen, in case it's since been revoked).

```bash
curl https://api.afrihex.com/v2/certificates/cert_GPU4XBpCp7q/verify
```

```json
{
  "success": true,
  "data": {
    "valid": true,
    "certificate_id": "cert_GPU4XBpCp7q",
    "issued_at": "2026-04-27T14:06:25Z",
    "signature_valid": true,
    "revoked": false,
    "revoked_at": null,
    "revoke_reason": "",
    "signing_key_id": "v1",
    "issuer": "GhanaPostGPS Verification Service"
  }
}
```

`valid = signature_valid && !revoked`. In practice, just check `valid` — the
other fields exist for showing more detail in a UI if you want it (e.g. "This
certificate was revoked on 2026-05-01: customer disputed verification").

There is **no expiry** — certificates don't expire, they're only ever valid
or revoked. Don't build TTL/expiry handling for this.

Errors: `404` if the ID doesn't exist. Treat a 404 the same as `valid: false`
in your UI (don't distinguish "not found" from "invalid" for the end user).

## 3. Sharing a certificate — `GET /v2/certificates/{id}/pdf`

```bash
curl -o cert.pdf https://api.afrihex.com/v2/certificates/cert_GPU4XBpCp7q/pdf
```

No auth needed — this is the exact URL in `certificate.pdf_url` from step 1,
usable directly. Returns `Content-Type: application/pdf`. A4, single page,
has a QR code embedded that points at the `/verify` URL above, plus that URL
printed in plain text (survives black-and-white printing/scanning).

**This is a dedicated, separate, public endpoint** — not the same
content-negotiated path as `GET /v2/certificates/{id}` described in
[CERTIFICATES.md](./CERTIFICATES.md#pdf-format). That doc's endpoint table
and PDF section are stale on this point; trust this doc and the code
(`cmd/server/routes.go`, `GET /v2/certificates/{id}/pdf`, registered outside
the authenticated route group specifically so it needs no API key).

For a mobile app, the practical pattern is: open `pdf_url` in a share sheet /
in-app browser, or download it and hand it to the OS share intent. No need to
attach any auth header — it'll just work with the plain URL.

## 4. Full certificate JSON — `GET /v2/certificates/{id}` (auth required)

Only call this if you actually need the full payload (subject/address/
integrity fields) — most mobile flows won't. Requires `X-API-Key`.

```bash
curl -H "X-API-Key: $YOUR_KEY" https://api.afrihex.com/v2/certificates/cert_GPU4XBpCp7q
```

```json
{
  "success": true,
  "data": {
    "certificate": {
      "id": "cert_GPU4XBpCp7q",
      "version": 1,
      "issued_at": "2026-04-27T14:06:25Z",
      "issuer": {
        "name": "GhanaPostGPS Verification Service",
        "verification_base_url": "https://api.afrihex.com",
        "jwks_url": "https://api.afrihex.com/.well-known/verification-key.json"
      },
      "subject": { "customer_id": "cust_4821", "declared_address": "GK-0846-6875" },
      "verification": {
        "verification_id": "ver_xxx", "result": "NEAR", "verified": true,
        "confidence": 0.92, "device_distance_m": 12, "gps_accuracy_m": 8.5,
        "method": "proximity", "timestamp": "2026-04-27T14:06:25Z"
      },
      "address": {
        "gps_code": "GK-0846-6875", "region": "Greater Accra", "district": "Kpone Katamanso",
        "lat": 5.780952815725535, "lng": -0.1137042570848795, "quality_score": 0.85
      },
      "integrity": { "spoof_risk": "LOW", "fraud_risk_score": 0.0, "fraud_risk_level": "low", "ip_location_match": "NOT_PROVIDED" },
      "disclaimer": "This certificate attests that a device was detected within the stated distance of the declared address at the stated time. It does NOT confirm the identity of the device holder, duration of residency, or property ownership. Verification confidence is subject to GPS hardware accuracy and environmental conditions."
    },
    "signature": { "algorithm": "Ed25519", "kid": "v1", "signature": "<base64, 64 bytes>" }
  }
}
```

This endpoint also technically supports `Accept: application/pdf` /
`?format=pdf` content negotiation for a PDF response — but since that path
requires auth and the dedicated `/pdf` endpoint above doesn't, prefer the
dedicated one for anything you're going to share outside your own
authenticated app session.

Errors: `503 CERT_DISABLED` (signing not configured server-side — shouldn't
happen in production), `400 INVALID_PARAM`, `404 NOT_FOUND`, `500 INTERNAL`.

## Should you verify offline?

Almost certainly not — for a mobile app, calling `/verify` (step 2) covers
the real use case ("is this cert currently valid") with one HTTP call, no
crypto code to write or maintain.

Offline/local Ed25519 signature verification exists as an option (fetch the
cert + the public key from `/.well-known/verification-key.json`, verify the
signature yourself) for cases where you need to prove authenticity **without
any network call to us at all** — e.g. an auditor working from an exported
PDF. If that's a real requirement, read
[CERTIFICATES.md's "Independent path"](./CERTIFICATES.md#independent-path--verify-offline)
first: the signed bytes are Go's `json.Marshal` output (struct field order,
not JCS/RFC 8785 canonical JSON), which is a real footgun to reimplement
correctly in Swift/Kotlin JSON libraries that don't guarantee key order. Get
a second pair of eyes on it before shipping if you go this route.

## Quick reference

| Field | Notes |
|---|---|
| `certificate.id` | Opaque, high-entropy string (`cert_...`) — this **is** the capability/secret for the public endpoints, don't leak it anywhere you wouldn't leak a real credential |
| `valid` | The only field most UIs need — `signature_valid && !revoked` |
| No expiry field | Certs don't expire, only get revoked |
| Issued on both pass/fail | A cert existing ≠ verification passed — check the verification response's own `verified` field |
| `pdf_url` / `verification_url` | Both public, no auth, usable directly as-is |
| `json_url` (`GET /v2/certificates/{id}`) | Needs `X-API-Key` — only call if you need PII fields |
