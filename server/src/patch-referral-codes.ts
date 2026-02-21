/**
 * Patches existing distributors with auto-generated referral codes.
 * Run: npx ts-node --transpile-only src/patch-referral-codes.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function makeCode(name: string | null | undefined, id: number): string {
    const base = (name ?? "DIST")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 6)
        .padEnd(4, "X");
    return `${base}${id.toString().padStart(3, "0")}`;
}

async function main() {
    console.log("🔧 Patching distributor referral codes...\n");

    const distributors = await prisma.distributor.findMany();
    for (const d of distributors) {
        if (!(d as any).referralCode) {
            const code = makeCode(d.name, d.id);
            await (prisma.distributor as any).update({
                where: { id: d.id },
                data: { referralCode: code },
            });
            console.log(`✅ ${d.email} → ${code}`);
        } else {
            console.log(`⚪ ${d.email} already has code: ${(d as any).referralCode}`);
        }
    }

    console.log("\nDone.");
}

main()
    .catch(e => { console.error("❌", e.message); process.exit(1); })
    .finally(() => prisma.$disconnect());
