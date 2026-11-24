# RealProHomesNG — website and administration

## Run locally (Windows / VS Code)

1. Extract the ZIP. Open the extracted project folder (the folder containing package.json) in VS Code.
2. Install Node.js 22.13+ (Node.js 24 LTS recommended).
3. Copy .env.example to .env. In PowerShell: `Copy-Item .env.example .env`.
4. Edit .env: choose a strong unique ADMIN_PASSWORD of at least 12 characters and set ADMIN_EMAIL. Add your MongoDB and Cloudinary credentials below. Leave FLW_SECRET_KEY blank until you have a sandbox key.
5. Run `npm install`.
6. If you have older SQLite records, migrate them before running the server (see below).
7. Run `npm start`. Visit http://localhost:3000 and http://localhost:3000/admin.html.

## MongoDB and Cloudinary configuration

- MongoDB Atlas: create a database user with read/write privileges on the RealProHomesNG database, configure network access for your development machine or hosting server, and copy the Node.js connection string into MONGODB_URI. Replace its username/password placeholders; URL-encode special characters in the password. Use MONGODB_DB=realprohomesng (or your chosen database name). Do not use your Atlas website sign-in password as the database password.
- Cloudinary: copy your cloud name, API key and API secret from your product environment into CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET. These remain in the server environment; never put them in public JavaScript or commit .env.
- Node.js and Express serve the website and authenticated API; MongoDB holds properties, inquiries and invoices. Cloudinary stores uploaded property images; MongoDB stores the secure image URL and media identifier. Existing packaged sample images remain in public/Images.
- Open http://localhost:3000/api/health after startup to check MongoDB connectivity.

## Migrate from the earlier SQLite version

If you already published properties, received inquiries or created invoices in the previous version, back up the old data/realpro.sqlite file (stop the old server first), and keep your .env credentials.

With MongoDB and Cloudinary configured in the new project, run `npm run migrate:sqlite -- "C:\\path\\to\\backup\\realpro.sqlite"` **before** the first `npm start` on the new database. The migration imports properties, inquiries and invoices, keeps their original IDs, uploads previously stored property photos to Cloudinary, and leaves the SQLite file unchanged. A rerun skips already imported records. Do not run the old and new websites against different data stores for ongoing business.

## Flutterwave

Get a Flutterwave v3 sandbox secret key from your merchant account; keep the key only in .env on the server. Never commit .env or expose the secret in the frontend. Set PUBLIC_BASE_URL to the exact externally accessible HTTPS origin on production, without a subpath. Restart the server after changing .env.

Admin signs in, creates an invoice for the agreed amount, and shares its payment link with the customer. The customer pays on hosted Flutterwave checkout. On return, the website checks payment status with Flutterwave and compares amount, currency, and reference with the stored invoice. The dashboard can also verify later if the browser closes or the callback is missed. An invoice is not a title transfer or automatic property allocation.

Test with sandbox credentials before accepting live payments. The included integration does not configure Flutterwave webhooks; verification is on return or on demand, including from the dashboard. An initiated checkout has a single payment reference. If checkout fails or expires, reconcile directly with Flutterwave before issuing a replacement invoice to prevent double payment. Confirm merchant transaction limits and business policies.

## Deploy

Deploy on a Node.js-capable hosting service, **not static hosting or GitHub Pages**. Run npm install and npm start and serve HTTPS through the host's reverse proxy. Set the environment variables listed in .env.example (DATA_DIR is only for optional migration). Back up MongoDB and monitor Cloudinary storage. This version targets a single running server process. Use HTTPS in production. Admin sessions expire after eight hours or server restart.

## Admin dashboard

- Add, edit, remove and change the availability of listings.
- Upload a JPG, PNG or WebP photo (up to 5 MB), enter the property name, location, price, description and status, then click Publish property. The latest six listings appear on the homepage, and all listings appear on the Property Listing page. Edit or delete listings from the dashboard; changes appear after refreshing the public page.
- Uploaded property photos are stored in Cloudinary; the database stores the image URL. Back up your MongoDB data. Replacing or deleting a listing also attempts to remove its previous uploaded Cloudinary image.
- Review booking requests, inquiries and newsletter signups.
- Issue payment invoices and verify their payment status.

The main property listing is database-backed; older individual brochure pages are retained for reference. Public sign-up collects interest rather than creating a customer account. The supplied website includes existing unrelated content, images, contact details and analytics; review them before publication. No actual transactions or merchant account credentials were used during development.
