# MongoDB setup (VocalX)

VocalX uses **two separate MongoDB databases**:
- **Webapp DB**: `vocalx_webapp`
- **Affiliate DB**: `vocalx_affiliate`

MongoDB creates databases/collections automatically on first write. A “proper” setup means:
- a real MongoDB server/cluster (Atlas or self-hosted)
- dedicated DB user with least privilege
- stable connection string in env vars
- indexes synced/created

## Option A (recommended): MongoDB Atlas (scalable)

1. Create a MongoDB Atlas cluster.
2. Create a DB user (e.g. `vocalx_dev`) and restrict network access.
3. Copy the SRV connection string (looks like `mongodb+srv://...`).
4. Set env vars:
   - Webapp: create `apps/webapp/.env.local` from `apps/webapp/.env.example`
   - Affiliate: create `apps/affiliate/.env.local` from `apps/affiliate/.env.example`

Use the **same cluster** but **different DB names** (`MONGO_DB_NAME`) for separation.

## Option B: Local MongoDB service (Windows)

Install MongoDB Community Server and ensure it’s running on `mongodb://127.0.0.1:27017`.

Then set:
- `MONGO_URL=mongodb://127.0.0.1:27017`
- `MONGO_DB_NAME=vocalx_webapp` (webapp)
- `MONGO_DB_NAME=vocalx_affiliate` (affiliate)

## Initialize/sync indexes

After the apps can connect, run:
- Webapp: `npm.cmd run -w apps/webapp mongo:init`
- Affiliate: `npm.cmd run -w apps/affiliate mongo:init`

These commands ensure required indexes (including unique email indexes) exist.
