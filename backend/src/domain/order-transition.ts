export type OrderStatus = 'pending' | 'confirmed' | 'cancelled';

const allowedTransitions: Record<OrderStatus, ReadonlySet<OrderStatus>> = {
    pending: new Set<OrderStatus>(['confirmed', 'cancelled']),
    confirmed: new Set<OrderStatus>(),
    cancelled: new Set<OrderStatus>(),
};

export const canTransitionOrder = (from: OrderStatus, to: OrderStatus): boolean => {
    return allowedTransitions[from].has(to);
};

export const assertOrderTransition = (from: OrderStatus, to: OrderStatus): void => {
    if (!canTransitionOrder(from, to)) {
        throw new Error(`Invalid order transition: ${from} -> ${to}`);
    }
};
