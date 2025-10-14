Deployment checklist for Funeral-Book

This file contains a concise set of steps and sample config files to make the app "official" using a domain such as `funeralbook.com`.

1) Register the domain
   - Use any registrar (Namecheap, GoDaddy, Google Domains, Cloudflare, etc.). If `funeralbook.com` is available and you want that exact name, register it there.
   - Keep your registrar login and enable DNS management.

2) Provision a public server
   - Recommended: small VPS (DigitalOcean, Hetzner, AWS EC2, Linode) with Ubuntu 24.04 LTS or similar.
   - Minimum: 1 vCPU, 1GB RAM for small testing; 2GB+ for production traffic.

3) DNS setup
   - Create an A record for `funeralbook.com` pointing to your server public IP.
   - Add `www` CNAME to `funeralbook.com` (or add another A record).

4) Clone and install
   - On the server:

```bash
sudo apt update && sudo apt install -y git nodejs npm
git clone https://github.com/Jashachris/Funeral-Book.git /srv/funeralbook
cd /srv/funeralbook
npm ci
```

5) Environment variables
   - Create `/srv/funeralbook/.env` with at least:
     - TOKEN_SECRET=replace-with-a-secret
     - NODE_ENV=production
     - PORT=3000

6) Systemd unit (example)
   - Copy `deploy/funeralbook.service` to `/etc/systemd/system/funeralbook.service` and enable it.

7) Reverse proxy & TLS
   - Copy `deploy/nginx.funeralbook.conf` to `/etc/nginx/sites-available/funeralbook` and symlink to `sites-enabled`.
   - Test nginx and reload.
   - Install certbot and obtain certs:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d funeralbook.com -d www.funeralbook.com
```

8) Firewall
   - Allow HTTP & HTTPS:

```bash
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

9) Monitoring & backup
   - Create periodic backups of `data.json` or `data.sqlite` and your `patent/` folder. Use `rsync` or a cloud backup.

10) Optional: Use managed DB
   - For production, migrate from the JSON/sql.js store to Postgres or a hosted DB.

Files in this folder:
 - `nginx.funeralbook.conf` - example nginx site config
 - `funeralbook.service` - systemd unit file

Support: If you want, I can deploy this to a VM you provide, or start an ngrok session for a short-term public URL. To use ngrok long-term, provide an `NGROK_AUTH_TOKEN`.

Happy to help with individual steps.
