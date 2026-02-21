# WebMyDrive Server

## Setup

1.  Navigate to `server` directory: `cd server`
2.  Install dependencies: `npm install`
3.  Set up environment variables: Copy `.env.example` to `.env` (already done)
4.  Generate Prisma Client: `npx prisma generate`
5.  Migrate Database: `npx prisma migrate dev --name init`
6.  Start Server: `npm run dev`

## Troubleshooting

If `prisma migrate` fails with connection error:
- Ensure `.env` file exists in `server` root.
- Check permissions.
- Try hardcoding `file:./dev.db` in `prisma/schema.prisma` temporarily.

## Audit Logs

All actions are logged via `logAudit` service.
Uses `redis` for queuing potentially in future.
Currently `bullmq` is installed but not configured yet.
