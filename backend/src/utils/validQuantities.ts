const MAX_TICKETS_PER_ORDER = 4; 

export const calculateValidQuantities = (rowStrings: string[]): number[] => {
    const validSet = new Set<number>();

    rowStrings.forEach(rowStr => {
        const emptyChunks = rowStr.split(/[^O]+/).filter(chunk => chunk.length > 0);

        emptyChunks.forEach(chunk => {
            const chunkSize = chunk.length; 

            const maxIteration = Math.min(chunkSize, MAX_TICKETS_PER_ORDER);

            for (let qty = 1; qty <= maxIteration; qty++) {
                if (chunkSize - qty !== 1) {
                    validSet.add(qty);
                }
            }
        });
    });

    return Array.from(validSet).sort((a, b) => a - b);
};