# Verify / Certificates page — information needed before build

**From:** mobile team · **Date:** 2026-08-22
**Scope:** the Verify tab as specified in `mobile-api.md` §📜 Certificates only.

We can build the core of this page from `mobile-api.md` today. This is the list of what is
still unspecified. Items marked **[BLOCKER]** stop us from starting or shipping; the rest we
can code around defensively but would rather not guess at.

Context for the asks below: `MOBILE_API_EXAMPLES.md` (the live-captured reference) has no
certificates section, so unlike Search and Directions, none of these shapes have been
confirmed against the running API. **Captured real responses would answer most of this list
at once** — that is the single most useful thing you can send us.

---

## A. `GET /v2/certificates/{id}/verify`

1. **[BLOCKER] Captured response for each state.** Please send real JSON + HTTP status for:
   a valid cert, a revoked cert, a cert whose signature fails, an unknown ID, and a
   malformed ID.
   The specific decision we need: is an unknown ID a **404** with
   `{success:false,error:{code:"NOT_FOUND",...}}`, or a **200** with `valid:false`?
   This decides whether the screen renders an error banner or a red "not valid" result card.

2. **Semantics of the three booleans.** Is `valid` a computed roll-up of
   `signature_valid && !revoked`, or is it independent of them? Which combinations can
   actually occur (e.g. can `valid:true` come back with `revoked:true`)? Which one is the
   headline status on the card?

3. **Revocation metadata.** Does the response carry `revoked_at`, a revocation reason, or
   who revoked it? The page is required to make revocation clear at a glance, and a date
   plus reason makes that materially better than a bare boolean.

4. **`issuer` type.** On `/verify` the sample is a plain string
   (`"GhanaPostGPS Verification Service"`), but in the full payload `issuer` is an object
   (`name`, `verification_base_url`, `jwks_url`). Please confirm the type on `/verify` — we
   don't want to guess and crash on a shape change.

5. **`issued_at` format.** Always RFC3339 UTC with `Z`, or can it carry an offset?

6. **Expiry.** Do certificates expire? If there is a validity window or `expires_at`, we
   should show "expired" as a state distinct from "revoked".

7. **Rate limiting.** Does `/verify` count against the public IP throttle (~30/min, 100/day)?
   If a bank or landlord checks many certs in a session, do they need a key? What does the
   429 body look like, and is there a `Retry-After` we should respect?

---

## B. Certificate ID format

8. **[BLOCKER] Exact format.** Pattern/regex, length, allowed character set, case
   sensitivity. Is `GH-CERT-` a fixed prefix? Are the hyphens significant — should we
   normalise `ghcertabc123` to `GH-CERT-ABC123` before sending, or send input verbatim?

9. **Client-side validation.** Do you want us to validate before calling, or always hit the
   server and let it be the authority? (We lean toward the latter — fewer false rejections.)

---

## C. `GET /v2/certificates/{id}` (full payload)

10. **[BLOCKER] Public or key-required?** `mobile-api.md` says verification is "deliberately
    public — an auditor, bank, or landlord must be able to check a cert without trusting us
    or holding a key," but marks this endpoint 🔑. This is the only call that returns
    anything substantial (subject, confidence, `device_distance_m`, address, integrity), so
    the answer decides whether an anonymous verifier gets a rich screen or just a badge.

11. **If key-required:** what is the intended anonymous experience? Is
    "badge + issuer + issued date" the deliberate anonymous view?

12. **Guaranteed vs nullable fields.** Which of `subject.customer_id`,
    `subject.declared_address`, `verification.confidence`, `verification.device_distance_m`,
    `address.*`, and `integrity.*` are always present? A captured real response settles this.

13. **Privacy.** Is it acceptable to display `subject.customer_id` and
    `subject.declared_address` to anyone who holds the certificate ID? Any field we must
    mask or omit in the mobile UI?

14. **Enum values.** We need the complete sets to render labels and non-colour indicators:
    - `verification.result` — `"matched"` and what else?
    - `verification.method` — `"proximity"` and what else?
    - `integrity.spoof_risk` — `"none"` and what else?
    - `integrity.ip_location_match` — `"matched"` and what else?
    - `integrity.fraud_risk_score` — range and direction (0–100, higher = worse?), and the
      thresholds you consider low / medium / high.

15. **`disclaimer`.** Always present? Must it be displayed verbatim for legal reasons, and
    must it be visible without scrolling or is a collapsed section acceptable?

---

## D. `GET /v2/certificates/{id}/pdf`

16. **Headers and direct-open.** Content-Type and Content-Disposition, and is the URL
    directly openable in a system web view / browser with no headers? `mobile-api.md` says
    "open it in a web view", which only works if the URL needs no auth header.

17. **Generation cost.** Is the PDF generated on demand (we need a spinner and a generous
    timeout) or served from cache?

18. **Unknown or revoked ID.** 404, or a PDF stamped "revoked"?

---

## E. Offline signature verification — `GET /.well-known/verification-key.json`

This is the one item in `mobile-api.md` we currently **cannot implement at all**. The doc
gives the URL and the purpose ("lets the app or an auditor independently verify the
signature offline") and nothing else.

19. **[BLOCKER] Key document sample.** The exact JSON. Is it a JWKS (`{"keys":[...]}`), a
    single JWK, or a raw base64 Ed25519 public key? How does `signature.kid` /
    `signing_key_id` map to an entry in it?

20. **[BLOCKER] What exactly is signed.** Which bytes go through Ed25519? The `certificate`
    object serialised how — JCS / RFC 8785? Compact JSON with lexicographically sorted keys?
    A defined concatenation of specific fields? Any implementation without this rule is a
    guess that will fail silently, which is the worst outcome for a verification feature.

21. **[BLOCKER] Signature encoding.** Standard base64 or base64url? Padded or unpadded?

22. **Key rotation.** How many keys are live at once, how long are retired keys still served,
    and what should the app do when it sees a `kid` it doesn't recognise — fail closed, or
    re-fetch the key document?

23. **Is this required for v1?** If server-side `signature_valid` is sufficient for launch,
    we skip a cryptography dependency entirely and ship sooner. We'd like your call on this.

---

## F. Entry points and scope

24. **Cert QR.** `mobile-api.md`'s MVP order-of-operations says "tap a result → optional
    `certificates/{id}/verify` if it's a cert QR", but never says what a cert QR encodes.
    Is it a full verification URL, a bare ID, or a signed blob? Please send one real sample
    payload. Also: is QR scanning in scope for v1? (It needs a camera dependency we haven't
    added yet.)

25. **User's own certificates.** Is there an endpoint to list a signed-in user's certs
    (e.g. `GET /v2/me/certificates`)? Or is this page strictly ID-entry-only?

26. **Deep links.** Should a universal link or `afrihex://` URL open a certificate directly —
    e.g. from the `verification_base_url` embedded in the cert? If so, what is the URL
    pattern we should register?

---

## G. Test data

27. **[BLOCKER] Real certificate IDs we can test against.** We need at minimum:
    - one valid certificate
    - one revoked certificate
    - one with an invalid/tampered signature
    - one expired, if expiry exists

    Without these we cannot exercise or test the page at all — every non-happy path would be
    untested at ship.

28. **Environment.** Is there a staging base URL for this, or do we test against
    `https://api.afrihex.com` directly? If prod, are the test certs above safe to hit
    repeatedly given the public rate limit?

---

## Summary — the minimum to unblock us

| Need | Why |
| --- | --- |
| Captured `/verify` responses for all states (Q1) | Decides the whole error/result render path |
| Certificate ID format (Q8) | Input validation and normalisation |
| Is `GET /v2/certificates/{id}` public? (Q10) | Decides how rich the anonymous screen is |
| Test certificate IDs (Q27) | Nothing can be verified without them |

With just those four we can build and ship the page. Section E (Q19–21) is only needed if
offline signature verification is required for v1 — see Q23.
