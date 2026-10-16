export const generateSecretCode = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
    const parts = [];
    
    for (let i = 0; i < 3; i++) {
        let part = '';
        for (let j = 0; j < 4; j++) {
            part += chars[Math.floor(Math.random() * chars.length)];
        }
        parts.push(part);
    }
    
    return `EMP-${parts.join('-')}`;
};