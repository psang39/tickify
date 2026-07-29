const normalizeRole = (role: unknown): string => String(role || '').trim().toLowerCase();

export const hasAnyRole = (role: unknown, allowedRoles: readonly string[]): boolean => {
    const normalizedRole = normalizeRole(role);
    return allowedRoles.some(allowedRole => normalizeRole(allowedRole) === normalizedRole);
};
