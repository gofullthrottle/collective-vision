# 2025-11-29 – Setup & Verification Notes

1. **Update D1 schema**
   ```bash
   wrangler d1 execute collective-vision-feedback --file=schema.sql --local
   ```
   This creates the new `rate_limits` table needed for request throttling.

2. **Configure admin token**
   ```bash
   wrangler secret put ADMIN_API_TOKEN
   ```
   - Required for `/api/v1/:workspace/:board/admin/feedback`.
   - Pass the same value via `X-Admin-Token` when calling admin endpoints.

3. **Run locally**
   ```bash
   wrangler dev
   ```
   - Verify `GET /api/v1/{workspace}/{board}/feedback` returns data.
   - Hit admin routes (list + PATCH) with the token to confirm moderation/status updates.

4. **Widget sanity check**
   ```html
   <script
     src="http://127.0.0.1:8787/widget.js"
     data-workspace="demo"
     data-board="main"
   ></script>
   ```
   - Submit an idea; ensure the “Thank you” CTA and powered-by badge show.
   - Try rapid submissions/votes to confirm rate limiting returns `429` with `retry_after`.

5. **Notes**
   - Payload validation now enforces title/description length and status enums.
   - Admin PATCH can change `status`, `moderation_state`, `is_hidden`, and tags in one request.
   - Tags are lowercased/stored once per workspace; PATCH replaces the full tag set for the item.
