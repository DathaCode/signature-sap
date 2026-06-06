/**
 * Side-effect module: selects the AWS Embedded Metrics environment BEFORE the
 * `aws-embedded-metrics` library is imported.
 *
 * The library resolves its environment (and therefore its output sink) eagerly
 * at module-load time by reading `AWS_EMF_ENVIRONMENT`. Setting
 * `Configuration.environmentOverride` programmatically afterwards is too late —
 * the environment promise has already been cached. This module must therefore be
 * imported FIRST in metrics.ts, before the `aws-embedded-metrics` import.
 *
 *   - production  → "Lambda": serialises structured EMF JSON to stdout (collected
 *                   by the CloudWatch Agent from Docker container logs).
 *   - development → "Local": plain EMF JSON to stdout via the console sink.
 *
 * Both sinks write to stdout with no TCP agent dependency. We only set the value
 * if it has not already been supplied via the real environment.
 */
if (!process.env.AWS_EMF_ENVIRONMENT) {
    process.env.AWS_EMF_ENVIRONMENT = process.env.NODE_ENV === 'production' ? 'Lambda' : 'Local';
}

export {};
