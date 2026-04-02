import { KHQR, CURRENCY, TAG } from 'ts-khqr';

export async function generateKHQR(req, res) {
    const { amount, billNumber, currency = 'USD' } = req.body;

    const result = KHQR.generate({
        tag: TAG.INDIVIDUAL,
        accountID: 'vannak_dim@cadi',
        merchantName: 'TORK SINET',
        merchantCity: 'Phnom Penh',
        currency: currency === 'KHR' ? CURRENCY.KHR : CURRENCY.USD,
        amount: amount,
        expirationTimestamp: Date.now() + 10 * 60 * 1000,
        additionalData: {
            billNumber: billNumber,
            storeLabel: 'My Store',
        },
    });

    if (result.status.code !== 0) {
        return res.status(400).json({ error: result.status.message });
    }

    return res.json({
        qr: result.data.qr,
        md5: result.data.md5,
    });
}
