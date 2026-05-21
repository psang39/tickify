export const formatHashToJSON = (hash: Record<string, string>) => {
    const tiers: Record<string, any> = {};
    for (const [key, value] of Object.entries(hash)) {
        if (key.startsWith('tier:')) {
            const [, tierId, property] = key.split(':');
            if (!tiers[tierId]) tiers[tierId] = {};
            tiers[tierId][property] = Number(value);
        }
    }
    return {
        valid_quantities: hash.valid_quantities ? JSON.parse(hash.valid_quantities) : {},
        tiers: tiers
    };
};