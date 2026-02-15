# Terraform Outputs

output "ec2_instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.app.id
}

output "ec2_public_ip" {
  description = "Elastic IP address of the EC2 instance"
  value       = aws_eip.app.public_ip
}

output "ssh_command" {
  description = "SSH command to connect to the EC2 instance"
  value       = "ssh -i ~/.ssh/signatureshades-ec2 ubuntu@${aws_eip.app.public_ip}"
}

output "application_url" {
  description = "Application URL"
  value       = "https://${var.subdomain}.${var.domain_name}"
}

output "route53_zone_id" {
  description = "Route 53 hosted zone ID for the subdomain"
  value       = aws_route53_zone.subdomain.zone_id
}

output "nameservers_for_route53" {
  description = "Nameservers to configure in your domain registrar for subdomain delegation"
  value       = aws_route53_zone.subdomain.name_servers
}

output "s3_backup_bucket" {
  description = "S3 bucket name for backups"
  value       = aws_s3_bucket.backups.id
}
