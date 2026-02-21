import { prisma } from "../models";

export const logAudit = async (
    actionName: string,
    entity: string,
    entityId?: string,
    actorId?: number,
    ipAddress?: string,
    details?: any
) => {
    try {
        await prisma.auditLog.create({
            data: {
                actionName: `[${entity}] ${actionName}`,
                actorId,
                ipAddress,
                payloadJson: details ? JSON.stringify({ entityId, ...details }) : undefined,
            }
        });
    } catch (error) {
        console.error("Failed to write audit log:", error);
    }
};
