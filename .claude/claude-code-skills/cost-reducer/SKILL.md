---
name: cost-reducer
description: AWS cost optimisation for the signature-sap production deployment (single EC2 + docker-compose.prod.yml). Read when sizing the EC2, considering managed services (RDS, S3, CloudFront), or when the user mentions budget/cost/saving.
applies-to: signature-sap
---

# Cost Reducer Skill — Signature Shades

## Project Context
- **Deployment:** Single AWS EC2 instance (region `ap-southeast-2`) running `docker-compose.prod.yml` (postgres + backend + frontend together). Internet-facing, EIP attached, DNS via Route53.
- **DB:** Postgres in a Docker container on the same EC2 — no managed RDS yet.
- **IaC:** Terraform in [terraform/](terraform/) — review there before AWS console changes (drift hurts). Always `terraform plan` before `apply`.
- **S3 backup bucket** is provisioned ([terraform/s3.tf](terraform/s3.tf)) with 7-day → Glacier, 30-day expiry. Don't reinvent backup infra.
- **No K8s, no Lambda, no CDN** yet — this is a small-business app, keep architecture lean.
- **No spot instances** for this workload (single prod box, statefulness on EC2 means downtime hurts).
- **Reserved instance candidate:** if EC2 has been stable for 6+ months, evaluate 1-year reserved pricing.
- **Storage:** EBS gp3 30 GB on EC2 (encrypted). Watch for log/upload growth in [backend/uploads/](backend/uploads/) — set up rotation before migrating to S3.
- **Free-tier sensitivity:** verify the current instance class in [terraform/terraform.tfvars](terraform/terraform.tfvars) before recommending a larger size.

## When to Activate
- Discussion of EC2 sizing, billing, region, or instance type
- Considering migration to RDS / S3 / CloudFront / Lambda
- Adding any AWS resource (security group is fine; managed service triggers cost discussion)
- User mentions "cost", "budget", "save money", "AWS bill"

## NOT Applicable to This Project
- Spot/Preemptible advice — single prod EC2, stateful
- K8s autoscaling — no K8s

## Sub-Skills
| File | When to Read |
|------|-------------|
| `cloud-and-infra.md` | EC2 sizing, EBS, networking costs, region choice |
| `services-and-finops.md` | Evaluating managed service tiers (RDS, S3, etc.) |
| `code-level-savings.md` | Reducing compute/bandwidth — Docker image size, query efficiency |

## Core Cost Rules
1. **Start small, scale up** — never over-provision. Use the smallest viable instance/tier
2. **Use free tiers first** — both AWS and OCI have generous free tiers
3. **Spot/Preemptible for non-critical** — dev/staging/batch jobs should use spot instances
4. **Right-size everything** — monitor actual usage and downsize over-provisioned resources
5. **Automate shutdown** — dev/staging environments should auto-stop outside work hours
6. **Choose region wisely** — pricing varies by region, pick the cheapest that meets latency needs
7. **Reserved > On-Demand** — for stable production workloads, commit for 1-3 years
8. **Serverless for spiky loads** — Lambda/Functions for unpredictable traffic patterns
9. **Delete unused resources** — orphaned EBS volumes, old snapshots, unused EIPs cost money
10. **Monitor daily** — set up billing alerts before you start spending

## Quick Cost Check (Before Any Provisioning)
```
□ Is this the smallest instance that meets requirements?
□ Can this use spot/preemptible instances?
□ Is auto-scaling configured (scale down, not just up)?
□ Are dev/staging resources scheduled to stop after hours?
□ Is this covered by free tier?
□ Are billing alerts configured?
□ Is there a cheaper region that meets latency needs?
□ Can this be serverless instead of always-on?
```
