# Backend deployment — Phase 7

See canonical runbook: `pranidoctor_user/docs/deployment/DEPLOY_RUNBOOK.md`

## Quick reference

- **Migrate:** `ALLOW_PRODUCTION_MIGRATE=true npm run db:migrate:deploy`
- **Health:** `curl http://127.0.0.1:3000/ready`
- **Backup cron:** `sudo ./scripts/backup/install-backup-cron.sh`
- **nginx:** `deploy/nginx/pranidoctor.conf.example`
- **Alerts:** `deploy/monitoring/prometheus-alerts.yml`
