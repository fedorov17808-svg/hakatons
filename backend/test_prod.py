import urllib.request
import json

base_url = 'https://frontend-gamma-pink-41.vercel.app/api/analyze'

test_wallets = [
    ('Aave V3 DeFi Protocol', '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2'),
    ('Ondo OUSG US Treasury RWA', '0xe8684521db5a68778844145ba0a0374d8e95e140'),
    ('Vitalik.eth Whale EOA', '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'),
    ('Fresh Zero-State Account', '0x000000000000000000000000000000000000dEaD'),
    ('Arbitrary Random EOA User', '0x71C7656EC7ab88b098defB751B7401B5f6d8976F')
]

for label, addr in test_wallets:
    req = urllib.request.Request(
        base_url,
        data=json.dumps({'address': addr}).encode(),
        headers={'Content-Type': 'application/json', 'User-Agent': 'CreditPulseTest/8.0'}
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            d = json.loads(r.read().decode())
            qm = d.get("quantitative_model", {})
            att = d.get("eip712_attestation", {})
            sig = att.get("signature", "")
            telem = d.get('onchain_telemetry', {})
    except Exception as e:
