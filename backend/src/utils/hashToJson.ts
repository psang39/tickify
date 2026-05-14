export const formatHashToJSON = (hash: Record<string, string>) => {
    const tiers: Record<string, any> = {};
    let minPrice = Infinity;

    for (const [key, value] of Object.entries(hash)) {
        if (key.startsWith('tier:')) {
            const [, tierName, property] = key.split(':');
            if (!tiers[tierName]) tiers[tierName] = {};
            const numValue = parseInt(value);
            tiers[tierName][property] = numValue;

            if (property === 'price' && tiers[tierName].count > 0 && numValue < minPrice) {
                minPrice = numValue;
            }
        }
    }

    return {
        min_price: minPrice === Infinity ? null : minPrice,
        valid_quantities: JSON.parse(hash.valid_quantities || '[]'),
        tiers: tiers
    };
};